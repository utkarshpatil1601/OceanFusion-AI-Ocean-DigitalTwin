from collections import defaultdict
from math import sqrt
from sqlalchemy import extract, func, select

from .models import FisheriesLanding, OceanObservation, ReferenceSequence, SpeciesOccurrence
from .models import TaxonomyRecord


def _date_range(values):
    dates = [value for value in values if value is not None]
    return {
        "start": min(dates).isoformat() if dates else None,
        "end": max(dates).isoformat() if dates else None,
    }


def coverage_report(session):
    ocean_count = session.query(func.count(OceanObservation.id)).scalar()
    ocean_dates = session.execute(
        select(func.min(OceanObservation.observation_time), func.max(OceanObservation.observation_time))
    ).one()
    ocean_range = {
        "start": ocean_dates[0].isoformat() if ocean_dates[0] else None,
        "end": ocean_dates[1].isoformat() if ocean_dates[1] else None,
    }

    occurrences = session.query(SpeciesOccurrence).all()
    landings = session.query(FisheriesLanding).all()
    ref_total = session.query(func.count(ReferenceSequence.id)).scalar()
    marine_count = session.query(func.count(ReferenceSequence.id)).filter(ReferenceSequence.ecological_scope == "marine").scalar()
    unresolved_count = session.query(func.count(ReferenceSequence.id)).filter(ReferenceSequence.ecological_scope == "unresolved").scalar()
    ncbi_count = session.query(func.count(ReferenceSequence.id)).filter(~ReferenceSequence.accession.startswith("BOLD:")).scalar()
    return {
        "noaa": {
            "record_count": ocean_count,
            "date_range": ocean_range,
            "spatial_scope": "configured Arabian Sea study polygon",
        },
        "obis": {
            "record_count": len(occurrences),
            "dated_record_count": sum(row.occurrence_date is not None for row in occurrences),
            "date_range": _date_range([row.occurrence_date for row in occurrences]),
            "spatial_scope": "acquired OBIS records",
        },
        "cmfri": {
            "record_count": len(landings),
            "year_range": {
                "start": min((row.year for row in landings), default=None),
                "end": max((row.year for row in landings), default=None),
            },
            "spatial_scope": "five western Indian coastal states",
        },
        "bold": {
            "record_count": ref_total,
            "marine_record_count": marine_count,
            "unresolved_record_count": unresolved_count,
            "spatial_scope": "India-wide BOLD query",
        },
        "ncbi": {
            "record_count": ncbi_count,
            "spatial_scope": "NCBI reference search",
        },
    }


def _pearson(left, right):
    left_mean = sum(left) / len(left)
    right_mean = sum(right) / len(right)
    numerator = sum((x - left_mean) * (y - right_mean) for x, y in zip(left, right))
    denominator = sqrt(
        sum((x - left_mean) ** 2 for x in left)
        * sum((y - right_mean) ** 2 for y in right)
    )
    return round(numerator / denominator, 6) if denominator else None


def correlation_report(session):
    coverage = coverage_report(session)
    ocean_by_year = {}
    if coverage["noaa"]["record_count"] > 0:
        annual_sst = session.execute(
            select(
                extract("year", OceanObservation.observation_time),
                func.avg(OceanObservation.sst),
            )
            .group_by(extract("year", OceanObservation.observation_time))
            .order_by(extract("year", OceanObservation.observation_time))
        )
        ocean_by_year = {
            int(year): float(mean_sst)
            for year, mean_sst in annual_sst
            if year is not None and mean_sst is not None
        }

    landings_by_year = defaultdict(float)
    for row in session.query(FisheriesLanding).all():
        landings_by_year[row.year] += row.landings_tonnes
    shared_years = sorted(set(ocean_by_year) & set(landings_by_year))
    annual_ocean = [ocean_by_year[year] for year in shared_years]
    annual_landings = [landings_by_year[year] for year in shared_years]
    correlations = []
    reasons = []
    if len(shared_years) < 3:
        reasons.append(
            "NOAA and CMFRI share fewer than three annual periods; correlation is withheld."
        )
    elif len(set(annual_ocean)) < 2 or len(set(annual_landings)) < 2:
        reasons.append("One aligned variable has no variance; correlation is undefined.")
    else:
        correlations.append({
            "left": "annual_mean_noaa_sst",
            "right": "annual_cmfri_landings_tonnes",
            "coefficient": _pearson(annual_ocean, annual_landings),
            "method": "Pearson correlation",
            "periods": shared_years,
        })
    if coverage["obis"]["dated_record_count"] == 0:
        reasons.append("OBIS records have no normalized dates for temporal alignment.")
    if coverage["bold"]["unresolved_record_count"]:
        reasons.append("Unresolved BOLD records are excluded from marine evidence.")
    return {
        "mode": "database",
        "status": "ok" if correlations else "unavailable",
        "coverage": coverage,
        "aligned_periods": shared_years,
        "correlations": correlations,
        "reasons": reasons,
        "method": "Coverage-aware annual alignment; correlation is withheld when overlap is insufficient.",
    }


def data_quality_report(session):
    coverage = coverage_report(session)
    valid_references = session.query(func.count(ReferenceSequence.id)).filter(ReferenceSequence.validation_status == "valid").scalar()
    invalid_references = session.query(func.count(ReferenceSequence.id)).filter(ReferenceSequence.validation_status == "invalid").scalar()
    taxonomy = session.query(TaxonomyRecord).all()
    resolved_taxonomy = sum(row.resolution_status == "resolved" for row in taxonomy)
    unresolved_taxonomy = sum(row.resolution_status != "resolved" for row in taxonomy)
    limitations = [
        "NOAA coverage is limited to the acquired 2024–2025 daily sample.",
        "OBIS records represent the acquired sample and not the provider's full regional total.",
        "BOLD was queried India-wide; unresolved records are excluded from marine evidence.",
        "Correlation is withheld unless at least three annual NOAA/CMFRI periods overlap.",
    ]
    return {
        "mode": "database",
        "status": "ok",
        "title": "OceanFusion data quality and coverage report",
        "coverage": coverage,
        "quality": {
            "reference_valid_count": valid_references,
            "reference_invalid_count": invalid_references,
            "taxonomy_record_count": len(taxonomy),
            "taxonomy_resolved_count": resolved_taxonomy,
            "taxonomy_unresolved_count": unresolved_taxonomy,
            "obis_dated_count": coverage["obis"]["dated_record_count"],
        },
        "limitations": limitations,
        "provenance": {
            "noaa": "NOAA NCEI OISST",
            "obis": "Ocean Biodiversity Information System",
            "cmfri": "Central Marine Fisheries Research Institute",
            "worms": "World Register of Marine Species",
            "ncbi": "NCBI E-utilities",
            "bold": "BOLD Systems Portal",
        },
    }
