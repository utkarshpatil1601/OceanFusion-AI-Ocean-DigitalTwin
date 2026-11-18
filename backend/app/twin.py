"""Historical Ocean Digital Twin query helpers."""

from datetime import date, datetime, time

from sqlalchemy import func, select

from .anomalies import RESULTS_PATH, load_anomalies
from .models import OceanObservation
from .ocean_summary_cache import daily_ocean_rows
from .study_area import load_study_area


def parse_date(value: str | None, parameter: str = "date") -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{parameter} must use YYYY-MM-DD format") from error


def _bounds(request_args):
    values = {}
    for name in ("min_lat", "max_lat", "min_lon", "max_lon"):
        raw = request_args.get(name)
        if raw is not None:
            try:
                values[name] = float(raw)
            except ValueError as error:
                raise ValueError(f"{name} must be numeric") from error
    if (
        values.get("min_lat") is not None
        and values.get("max_lat") is not None
        and values["min_lat"] > values["max_lat"]
    ) or (
        values.get("min_lon") is not None
        and values.get("max_lon") is not None
        and values["min_lon"] > values["max_lon"]
    ):
        raise ValueError("minimum bounds must not exceed maximum bounds")
    return values


def _apply_bounds(query, bounds):
    if "min_lat" in bounds:
        query = query.where(OceanObservation.latitude >= bounds["min_lat"])
    if "max_lat" in bounds:
        query = query.where(OceanObservation.latitude <= bounds["max_lat"])
    if "min_lon" in bounds:
        query = query.where(OceanObservation.longitude >= bounds["min_lon"])
    if "max_lon" in bounds:
        query = query.where(OceanObservation.longitude <= bounds["max_lon"])
    return query


def _anomaly_index(session, selected_date: date, limit: int = 10000):
    payload = load_anomalies(
        results_path=RESULTS_PATH,
        selected_date=selected_date,
        limit=limit,
        session=session,
    )
    return {item["observation_id"]: item for item in payload.get("items", [])}, payload


def snapshot(session, selected_date, bounds, limit):
    latest = session.execute(
        select(func.max(OceanObservation.observation_time))
    ).scalar()
    if latest is None:
        return {
            "mode": "historical-digital-twin",
            "status": "empty",
            "items": [],
            "message": "Run flask ingest-noaa first.",
        }
    earliest = session.execute(
        select(func.min(OceanObservation.observation_time))
    ).scalar()
    selected_date = selected_date or (latest.date() if hasattr(latest, "date") else date.fromisoformat(str(latest)[:10]))
    start_dt = datetime.combine(selected_date, time.min)
    end_dt = datetime.combine(selected_date, time.max)
    query = select(OceanObservation).where(
        OceanObservation.observation_time >= start_dt,
        OceanObservation.observation_time <= end_dt,
    )
    query = _apply_bounds(query, bounds).order_by(
        OceanObservation.latitude, OceanObservation.longitude
    )
    rows = session.execute(query.limit(limit)).scalars().all()
    anomaly_index, anomaly_payload = _anomaly_index(session, selected_date)
    items = []
    for row in rows:
        anomaly = anomaly_index.get(row.id)
        items.append(
            {
                "observation_id": row.id,
                "observation_time": row.observation_time.isoformat(),
                "latitude": row.latitude,
                "longitude": row.longitude,
                "sst": row.sst,
                "sst_anomaly": row.sst_anomaly,
                "is_anomaly": anomaly is not None,
                "anomaly_score": anomaly["anomaly_score"] if anomaly else None,
                "severity": anomaly["severity"] if anomaly else None,
            }
        )
    return {
        "mode": "historical-digital-twin",
        "status": "ok",
        "historical_only": True,
        "selected_date": selected_date.isoformat(),
        "study_area": load_study_area(),
        "coverage": {
            "start": earliest.isoformat() if earliest else None,
            "end": latest.isoformat() if latest else None,
        },
        "filters": {"bounds": bounds, "limit": limit},
        "returned_count": len(items),
        "anomaly_artifact_status": anomaly_payload.get("status"),
        "items": items,
        "limitations": [
            "This is a historical-data-driven twin, not a live operational twin.",
            "The selected snapshot contains persisted NOAA grid observations and may be limited by the requested result limit.",
            "Anomaly flags are model scores requiring scientific validation.",
        ],
    }


def history(session, start, end, bounds):
    latest = session.execute(
        select(func.max(OceanObservation.observation_time))
    ).scalar()
    earliest = session.execute(
        select(func.min(OceanObservation.observation_time))
    ).scalar()
    if latest is None:
        return {
            "mode": "historical-digital-twin",
            "status": "empty",
            "items": [],
            "message": "Run flask ingest-noaa first.",
        }
    start = start or (earliest.date() if hasattr(earliest, "date") else date.fromisoformat(str(earliest)[:10]))
    end = end or (latest.date() if hasattr(latest, "date") else date.fromisoformat(str(latest)[:10]))
    if start > end:
        raise ValueError("start must not be after end")
    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)
    if not bounds:
        rows = [
            row for row in daily_ocean_rows(session)
            if start.isoformat() <= row["date"] <= end.isoformat()
        ]
        items = [
            {
                "date": row["date"],
                "observation_count": row["count"],
                "mean_sst": round(row["mean_sst"], 3),
                "min_sst": round(row["min_sst"], 3),
                "max_sst": round(row["max_sst"], 3),
            }
            for row in rows
        ]
    else:
        query = select(
            func.date(OceanObservation.observation_time).label("day"),
            func.count(OceanObservation.id).label("observation_count"),
            func.avg(OceanObservation.sst).label("mean_sst"),
            func.min(OceanObservation.sst).label("min_sst"),
            func.max(OceanObservation.sst).label("max_sst"),
        ).where(
            OceanObservation.observation_time >= start_dt,
            OceanObservation.observation_time <= end_dt,
        )
        query = _apply_bounds(query, bounds).group_by(
            func.date(OceanObservation.observation_time)
        ).order_by(func.date(OceanObservation.observation_time))
        rows = session.execute(query).all()
        items = [
            {
                "date": str(row.day),
                "observation_count": row.observation_count,
                "mean_sst": round(float(row.mean_sst), 3),
                "min_sst": round(float(row.min_sst), 3),
                "max_sst": round(float(row.max_sst), 3),
            }
            for row in rows
        ]
    return {
        "mode": "historical-digital-twin",
        "status": "ok",
        "historical_only": True,
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "study_area": load_study_area(),
        "items": items,
        "limitations": [
            "Historical daily summaries do not represent live conditions.",
            "The current NOAA coverage spans 2024 through 2025.",
        ],
    }


def scenario(session, selected_date, bounds, limit, delta):
    if delta < -5 or delta > 5:
        raise ValueError("delta must be between -5 and 5 degrees Celsius")
    base = snapshot(session, selected_date, bounds, limit)
    if base["status"] != "ok":
        return base
    items = [
        {
            **item,
            "simulated_sst": round(item["sst"] + delta, 3),
            "temperature_delta": delta,
        }
        for item in base["items"]
    ]
    return {
        "mode": "historical-digital-twin-scenario",
        "status": "ok",
        "historical_only": True,
        "hypothetical": True,
        "scenario": {
            "delta_celsius": delta,
            "affected_grid_cells": len(items),
        },
        "selected_date": base["selected_date"],
        "coverage": base["coverage"],
        "filters": base["filters"],
        "items": items,
        "limitations": [
            "This is a uniform temperature perturbation, not a physical ocean simulation.",
            "It does not model currents, heat exchange, biology, or atmospheric feedback.",
            "The simulated values must not be interpreted as a forecast.",
        ],
    }
