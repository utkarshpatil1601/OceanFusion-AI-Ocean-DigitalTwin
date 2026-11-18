"""Shared, short-lived cache for expensive NOAA daily aggregates."""

from threading import Lock
from time import monotonic

from sqlalchemy import func, select

from .models import OceanObservation

_CACHE_TTL_SECONDS = 60
_CACHE_LOCK = Lock()
_CACHE_KEY = None
_CACHE_AT = 0.0
_CACHE_ROWS = None


def clear_daily_summary_cache():
    """Invalidate cached summaries after NOAA observations are ingested."""
    global _CACHE_KEY, _CACHE_AT, _CACHE_ROWS
    with _CACHE_LOCK:
        _CACHE_KEY = None
        _CACHE_AT = 0.0
        _CACHE_ROWS = None


def daily_ocean_rows(session):
    """Return compact daily aggregates shared by Explorer and Twin history."""
    global _CACHE_KEY, _CACHE_AT, _CACHE_ROWS
    bind = session.get_bind()
    cache_key = str(bind.url)
    is_memory_database = cache_key in {"sqlite://", "sqlite:///:memory:"}

    def load_rows():
        rows = session.execute(
            select(
                func.date(OceanObservation.observation_time).label("day"),
                func.avg(OceanObservation.sst).label("mean_sst"),
                func.min(OceanObservation.sst).label("min_sst"),
                func.max(OceanObservation.sst).label("max_sst"),
                func.avg(OceanObservation.sst_anomaly).label("mean_anomaly"),
                func.count(OceanObservation.id).label("count"),
            )
            .group_by(func.date(OceanObservation.observation_time))
            .order_by(func.date(OceanObservation.observation_time))
        ).all()
        return tuple(
            {
                "date": str(row.day),
                "mean_sst": float(row.mean_sst),
                "min_sst": float(row.min_sst),
                "max_sst": float(row.max_sst),
                "mean_anomaly": float(row.mean_anomaly) if row.mean_anomaly is not None else None,
                "count": int(row.count),
            }
            for row in rows
        )

    if is_memory_database:
        return load_rows()

    now = monotonic()
    if _CACHE_ROWS is not None and _CACHE_KEY == cache_key and now - _CACHE_AT < _CACHE_TTL_SECONDS:
        return _CACHE_ROWS

    # A single lock prevents Explorer and Digital Twin page loads from running
    # the same multi-million-row aggregation concurrently on a cold cache.
    with _CACHE_LOCK:
        now = monotonic()
        if _CACHE_ROWS is not None and _CACHE_KEY == cache_key and now - _CACHE_AT < _CACHE_TTL_SECONDS:
            return _CACHE_ROWS
        cached_rows = load_rows()
        _CACHE_KEY = cache_key
        _CACHE_ROWS = cached_rows
        _CACHE_AT = monotonic()
        return _CACHE_ROWS
