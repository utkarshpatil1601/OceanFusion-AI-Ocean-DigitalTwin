from flask import Blueprint, jsonify, request
from werkzeug.exceptions import HTTPException
from sqlalchemy import func, select

from . import db
from .models import Dataset
from .source_registry import load_source_registry
from .study_area import load_study_area
from .live_sources import ncbi_search, obis_occurrences, worms_name
from .models import Dataset, FisheriesLanding, OceanObservation, ReferenceSequence, SequenceMatch, SpeciesOccurrence, TaxonomyRecord
from .ncbi import match_query_to_references, parse_fasta
from .analytics import correlation_report, coverage_report, data_quality_report
from .anomalies import load_anomalies
from .fisheries import predict_landings
from .forecast import forecast_sst
from .ml_registry import FORECAST_HORIZONS, forecast_unavailable, model_metrics, model_registry
from .twin import _bounds, history, parse_date, scenario, snapshot
from .ocean_summary_cache import daily_ocean_rows

api = Blueprint("api", __name__)


@api.errorhandler(Exception)
def api_error(error):
    """Keep API failures machine-readable and log the diagnostic traceback."""
    if isinstance(error, HTTPException):
        return jsonify({"error": error.description}), error.code
    api.logger.error(
        "Unhandled OceanFusion API error: %s",
        error,
        exc_info=(type(error), error, error.__traceback__),
    )
    return jsonify({"error": "The API request failed. Check the Flask console for details."}), 500


@api.get("/health")
def health():
    return jsonify({"status": "ok", "service": "oceanfusion-api"})


@api.get("/overview")
def overview():
    counts = {
        "datasets": db.session.query(Dataset).count(),
        "ocean_observations": db.session.query(OceanObservation).count(),
        "fisheries_landings": db.session.query(FisheriesLanding).count(),
        "species_occurrences": db.session.query(SpeciesOccurrence).count(),
        "reference_sequences": db.session.query(ReferenceSequence).count(),
    }
    return jsonify({"mode": "database", "kpis": counts})


@api.get("/ocean/summary")
def ocean_summary():
    daily = daily_ocean_rows(db.session)
    if not daily:
        return jsonify({"mode": "database", "status": "empty", "items": [], "message": "Run flask ingest-noaa first."})

    total_obs = sum(row["count"] for row in daily)
    overall_mean_sst = sum(row["mean_sst"] * row["count"] for row in daily) / total_obs
    overall_min_sst = min(row["min_sst"] for row in daily)
    overall_max_sst = max(row["max_sst"] for row in daily)
    monthly_totals = {}
    for row in daily:
        month = row["date"][:7]
        bucket = monthly_totals.setdefault(
            month, {"weighted_sst": 0.0, "weighted_anomaly": 0.0, "anomaly_count": 0, "count": 0}
        )
        bucket["weighted_sst"] += row["mean_sst"] * row["count"]
        bucket["count"] += row["count"]
        if row["mean_anomaly"] is not None:
            bucket["weighted_anomaly"] += row["mean_anomaly"] * row["count"]
            bucket["anomaly_count"] += row["count"]

    result_payload = {
        "mode": "database",
        "status": "ok",
        "coverage": {
            "start": daily[0]["date"] + "T00:00:00",
            "end": daily[-1]["date"] + "T23:59:59",
        },
        "summary": {
            "mean_sst": round(overall_mean_sst, 3),
            "min_sst": round(overall_min_sst, 3),
            "max_sst": round(overall_max_sst, 3),
            "observation_count": total_obs,
        },
        "daily": [
            {
                "date": row["date"],
                "mean_sst": round(row["mean_sst"], 3),
                "mean_anomaly": round(row["mean_anomaly"], 3) if row["mean_anomaly"] is not None else None,
                "count": row["count"],
            }
            for row in daily
        ],
        "monthly": [
            {
                "month": month,
                "mean_sst": round(values["weighted_sst"] / values["count"], 3),
                "mean_anomaly": (
                    round(values["weighted_anomaly"] / values["anomaly_count"], 3)
                    if values["anomaly_count"] else None
                ),
                "count": values["count"],
            }
            for month, values in sorted(monthly_totals.items())
        ],
    }
    return jsonify(result_payload)


@api.get("/ocean/observations")
def ocean_observations():
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 100, type=int), 1), 1000)
    rows = db.session.execute(
        select(OceanObservation)
        .order_by(OceanObservation.observation_time, OceanObservation.id)
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).scalars()
    return jsonify({"mode": "database", "page": page, "per_page": per_page, "items": [row.to_dict() for row in rows]})


@api.get("/ocean/anomalies")
def ocean_anomalies():
    selected_date = request.args.get("date")
    parsed_date = None
    if selected_date:
        try:
            from datetime import date

            parsed_date = date.fromisoformat(selected_date)
        except ValueError:
            return jsonify({"error": "date must use YYYY-MM-DD format"}), 400
    limit = min(max(request.args.get("limit", 100, type=int), 1), 1000)
    return jsonify(load_anomalies(selected_date=parsed_date, limit=limit, session=db.session))


@api.get("/ml/models")
def ml_models():
    return jsonify(model_registry(db.session))


@api.get("/ml/metrics")
def ml_metrics():
    return jsonify(model_metrics(db.session))


@api.get("/ocean/forecast")
def ocean_forecast():
    latitude = request.args.get("latitude", type=float)
    longitude = request.args.get("longitude", type=float)
    horizon = request.args.get("horizon", 1, type=int)
    date_value = request.args.get("date")
    if latitude is None or longitude is None:
        return jsonify({"error": "latitude and longitude are required"}), 400
    if not 5 <= latitude <= 26 or not 50 <= longitude <= 78:
        return jsonify({"error": "location must be within the configured study area bounds"}), 400
    if horizon not in FORECAST_HORIZONS:
        return jsonify({"error": "horizon must be one of 1, 3, or 7 days"}), 400
    try:
        result = forecast_sst(db.session, latitude, longitude, horizon, date_value)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except RuntimeError as error:
        unavailable = forecast_unavailable(db.session, latitude, longitude, horizon, date_value)
        unavailable["message"] = str(error)
        unavailable["limitations"].append(
            "Run the Flask service with Python 3.13 and TensorFlow 2.20 to serve the trained artifact."
        )
        return jsonify(unavailable)
    if result["status"] == "unavailable":
        unavailable = forecast_unavailable(db.session, latitude, longitude, horizon, date_value)
        unavailable["message"] = result.get("message", unavailable["message"])
        if result.get("selected_grid_cell"):
            unavailable["selected_grid_cell"] = result["selected_grid_cell"]
        return jsonify(unavailable)
    return jsonify(result)


@api.get("/ocean/twin")
def ocean_twin():
    try:
        selected_date = parse_date(request.args.get("date"))
        bounds = _bounds(request.args)
        limit = min(max(request.args.get("limit", 10000, type=int), 1), 20000)
        return jsonify(snapshot(db.session, selected_date, bounds, limit))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@api.get("/ocean/twin/history")
def ocean_twin_history():
    try:
        start = parse_date(request.args.get("start"), "start")
        end = parse_date(request.args.get("end"), "end")
        return jsonify(history(db.session, start, end, _bounds(request.args)))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@api.get("/ocean/twin/scenario")
def ocean_twin_scenario():
    try:
        selected_date = parse_date(request.args.get("date"))
        bounds = _bounds(request.args)
        delta = request.args.get("delta", type=float)
        if delta is None:
            raise ValueError("delta is required in degrees Celsius")
        limit = min(max(request.args.get("limit", 10000, type=int), 1), 20000)
        return jsonify(scenario(db.session, selected_date, bounds, limit, delta))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@api.get("/fisheries/summary")
def fisheries_summary():
    rows = db.session.execute(
        select(FisheriesLanding).order_by(FisheriesLanding.year, FisheriesLanding.state, FisheriesLanding.resource)
    ).scalars().all()
    if not rows:
        return jsonify({"mode": "database", "status": "empty", "items": [], "message": "Run flask ingest-cmfri first."})
    state_rows = [row for row in rows if row.state]
    resource_rows = [row for row in rows if row.resource]
    states = {}
    for row in state_rows:
        states[row.state] = states.get(row.state, 0) + row.landings_tonnes
    resources = {}
    for row in resource_rows:
        resources[row.resource] = resources.get(row.resource, 0) + row.landings_tonnes
    return jsonify({
        "mode": "database",
        "status": "ok",
        "summary": {
            "landing_record_count": len(rows),
            "statewise_record_count": len(state_rows),
            "resourcewise_record_count": len(resource_rows),
            "coverage_start": min(row.year for row in rows),
            "coverage_end": max(row.year for row in rows),
        },
        "states": [{"name": name, "landings_tonnes": round(total, 2)} for name, total in sorted(states.items())],
        "resources": [{"name": name, "landings_tonnes": round(total, 2)} for name, total in sorted(resources.items(), key=lambda item: item[1], reverse=True)[:50]],
        "items": [row.to_dict() for row in rows[:1000]],
        "message": "Real CMFRI landings. Statewise and national resource-wise records are separate coverage types.",
    })


@api.get("/fisheries/predict")
def fisheries_predict():
    year = request.args.get("year", type=int)
    state = request.args.get("state")
    if year is None:
        return jsonify({"error": "year is required"}), 400
    if year < 1900 or year > 2100:
        return jsonify({"error": "year must be between 1900 and 2100"}), 400
    try:
        return jsonify(predict_landings(db.session, year, state))
    except ValueError as error:
        return jsonify({"error": str(error)}), 404


@api.get("/biodiversity/summary")
def biodiversity_summary():
    occurrences = db.session.execute(
        select(SpeciesOccurrence).order_by(SpeciesOccurrence.occurrence_date)
    ).scalars().all()
    if not occurrences:
        return jsonify({"mode": "database", "status": "empty", "items": [], "message": "Run flask ingest-obis first."})
    taxonomy = {
        row.source_name: row
        for row in db.session.execute(select(TaxonomyRecord)).scalars()
    }
    species = {}
    for occurrence in occurrences:
        taxon = taxonomy.get(occurrence.scientific_name)
        name = taxon.accepted_name if taxon and taxon.accepted_name else occurrence.scientific_name
        species.setdefault(name, {"name": name, "records": 0, "aphia_id": taxon.aphia_id if taxon else occurrence.aphia_id})
        species[name]["records"] += 1
    return jsonify({
        "mode": "database",
        "status": "ok",
        "summary": {
            "occurrence_count": len(occurrences),
            "species_count": len(species),
            "taxonomy_resolved": sum(1 for row in taxonomy.values() if row.resolution_status == "resolved"),
            "taxonomy_total": len(taxonomy),
        },
        "species": sorted(species.values(), key=lambda item: item["records"], reverse=True)[:50],
        "items": [occurrence.to_dict() for occurrence in occurrences[:1000]],
    })


@api.get("/analytics/correlation")
def correlation():
    return jsonify(correlation_report(db.session))


@api.get("/analytics/coverage")
def analytics_coverage():
    return jsonify({
        "mode": "database",
        "status": "ok",
        "coverage": coverage_report(db.session),
        "message": "Coverage describes acquired records and does not imply comparable sampling effort.",
    })


@api.get("/molecular/results")
def molecular_results():
    scope = request.args.get("scope")
    query = select(ReferenceSequence)
    if scope and scope != "all":
        query = query.where(ReferenceSequence.ecological_scope == scope)
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    sequences = db.session.execute(
        query
        .order_by(ReferenceSequence.organism, ReferenceSequence.accession)
        .limit(500)
    ).scalars().all()
    if not total:
        return jsonify({"mode": "database", "status": "empty", "items": [], "message": "Run flask retrieve-ncbi or ingest-bold first."})
    matches = db.session.execute(
        select(SequenceMatch).order_by(SequenceMatch.percent_identity.desc())
    ).scalars().all()
    bold_count = db.session.execute(
        select(func.count()).select_from(
            query.where(ReferenceSequence.accession.like("BOLD:%")).subquery()
        )
    ).scalar_one()
    ncbi_count = db.session.execute(
        select(func.count()).select_from(
            query.where(~ReferenceSequence.accession.like("BOLD:%")).subquery()
        )
    ).scalar_one()
    return jsonify({
        "mode": "database",
        "status": "ok",
        "summary": {
            "reference_count": total,
            "valid_count": db.session.query(ReferenceSequence).filter_by(
                validation_status="valid"
            ).count(),
            "invalid_count": db.session.query(ReferenceSequence).filter_by(
                validation_status="invalid"
            ).count(),
            "returned_count": len(sequences),
            "bold_count": bold_count,
            "ncbi_count": ncbi_count,
            "ecological_scope": scope or "all",
            "marine_count": db.session.query(ReferenceSequence).filter_by(
                ecological_scope="marine"
            ).count(),
        },
        "matches": [match.to_dict() for match in matches[:50]],
        "references": [row.to_dict() for row in sequences],
        "message": "Reference sequences and local alignment candidate matches are available. Ecological scope is conservative and unresolved records are not marine evidence.",
    })


@api.get("/live/obis")
def live_obis():
    try:
        return jsonify({"source": "OBIS", "mode": "live", "data": obis_occurrences(
            request.args.get("limit", 100, type=int)
        )})
    except Exception as error:
        return jsonify({"error": f"OBIS request failed: {error}"}), 502


@api.get("/live/worms")
def live_worms():
    name = request.args.get("name")
    if not name:
        return jsonify({"error": "Query parameter 'name' is required."}), 400
    try:
        return jsonify({"source": "WoRMS", "mode": "live", "data": worms_name(name)})
    except Exception as error:
        return jsonify({"error": f"WoRMS request failed: {error}"}), 502


@api.get("/live/ncbi")
def live_ncbi():
    term = request.args.get("term", "marine fish COI")
    try:
        return jsonify({"source": "NCBI", "mode": "live", "data": ncbi_search(term)})
    except Exception as error:
        return jsonify({"error": f"NCBI request failed: {error}"}), 502


@api.post("/molecular/validate")
def validate_fasta():
    content = None
    uploaded = request.files.get("file")
    if uploaded is not None and uploaded.filename:
        content = uploaded.read().decode("utf-8", errors="replace")
    elif request.is_json and request.json and "content" in request.json:
        content = request.json["content"]
    elif request.form and "content" in request.form:
        content = request.form["content"]

    if not content:
        return jsonify({"error": "A FASTA file or sequence content is required."}), 400
    sequences = parse_fasta(content)
    invalid = sorted({char for _, sequence in sequences for char in sequence if char not in "ACGTURYSWKMBDHVN"})
    return jsonify({"valid": bool(sequences) and not invalid, "sequence_count": len(sequences), "invalid_characters": invalid})


@api.post("/molecular/identify")
def identify_sequence():
    content = None
    uploaded = request.files.get("file")
    if uploaded is not None and uploaded.filename:
        content = uploaded.read().decode("utf-8", errors="replace")
    elif request.is_json and request.json and "content" in request.json:
        content = request.json["content"]
    elif request.form and "content" in request.form:
        content = request.form["content"]

    if not content:
        return jsonify({"error": "A FASTA query file or sequence content is required."}), 400
    records = parse_fasta(content)
    if len(records) != 1:
        return jsonify({"error": "Provide exactly one FASTA query sequence."}), 400
    query_name, query_sequence = records[0]
    scope = request.args.get("scope", "marine")
    marker = request.args.get("marker")
    limit = min(max(request.args.get("limit", 10, type=int), 1), 50)
    try:
        matches = match_query_to_references(
            db.session,
            query_name,
            query_sequence,
            limit=limit,
            scope=scope,
            marker=marker,
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    try:
        for match in matches:
            db.session.add(SequenceMatch(**match))
        db.session.commit()
    except Exception:
        db.session.rollback()
    return jsonify({
        "status": "ok",
        "query_name": query_name,
        "query_length": len(query_sequence),
        "method": "local pairwise alignment against stored references",
        "ecological_scope": scope,
        "marker": marker or "all",
        "matches": matches,
        "warning": "Matches are candidate identifications, not taxonomic proof.",
    })


@api.get("/ml/evaluation")
def ml_evaluation():
    import json
    from pathlib import Path

    eval_dir = Path(__file__).resolve().parents[2] / "ml" / "evaluation"
    rf_path = eval_dir / "cmfri_random_forest_metrics.json"
    iso_path = eval_dir / "noaa_isolation_forest_metrics.json"
    val_path = eval_dir / "noaa_anomaly_validation.json"

    rf_data = json.loads(rf_path.read_text(encoding="utf-8-sig")) if rf_path.exists() else None
    iso_data = json.loads(iso_path.read_text(encoding="utf-8-sig")) if iso_path.exists() else None
    val_data = json.loads(val_path.read_text(encoding="utf-8-sig")) if val_path.exists() else None

    return jsonify({
        "status": "ok",
        "random_forest": rf_data,
        "isolation_forest": iso_data,
        "anomaly_validation": val_data,
        "forecast": model_metrics(db.session)["forecast"],
    })


@api.get("/reports")
def reports():
    return jsonify(data_quality_report(db.session))


@api.get("/sources")
def list_sources():
    return jsonify({"items": load_source_registry()})


@api.get("/study-area")
def study_area():
    return jsonify(load_study_area())


@api.get("/datasets")
def list_datasets():
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 25, type=int), 1), 100)
    query = select(Dataset).order_by(Dataset.created_at.desc())
    datasets = db.session.execute(
        query.offset((page - 1) * per_page).limit(per_page)
    ).scalars()
    return jsonify(
        {
            "items": [dataset.to_dict() for dataset in datasets],
            "page": page,
            "per_page": per_page,
        }
    )
