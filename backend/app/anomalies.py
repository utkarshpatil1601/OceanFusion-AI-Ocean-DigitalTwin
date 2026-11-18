"""Access validated NOAA anomaly experiment results."""

import csv
from datetime import date
from datetime import datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
import pickle

import joblib
import numpy as np
from sqlalchemy import func, select

from .models import OceanObservation

RESULTS_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "processed"
    / "noaa_anomaly_scores.csv"
)
MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "saved_models" / "noaa_isolation_forest.joblib"


def _severity(score: float) -> str:
    if score <= -0.05:
        return "high"
    if score < 0:
        return "moderate"
    return "low"


_ANOMALY_CACHE: dict[str, tuple] = {}


@lru_cache(maxsize=1)
def _load_model(model_path: str):
    return joblib.load(model_path)


def _score_selected_date(session, selected_date: date, limit: int) -> dict:
    """Score one snapshot from the saved model when the large CSV isn't deployed."""
    if not MODEL_PATH.exists():
        return {
            "mode": "ml",
            "status": "unavailable",
            "items": [],
            "message": "The saved Isolation Forest model is not available on this server.",
        }

    start = datetime.combine(selected_date, time.min)
    end = start + timedelta(days=1)
    rows = session.execute(
        select(
            OceanObservation.id,
            OceanObservation.observation_time,
            OceanObservation.latitude,
            OceanObservation.longitude,
            OceanObservation.sst,
            OceanObservation.sst_anomaly,
        ).where(
            OceanObservation.observation_time >= start,
            OceanObservation.observation_time < end,
            OceanObservation.sst_anomaly.is_not(None),
        )
    ).all()
    if not rows:
        return {
            "mode": "ml",
            "status": "empty",
            "items": [],
            "message": "No scoreable NOAA observations are available for this date.",
        }

    features = np.asarray(
        [
            [
                row.sst,
                row.sst_anomaly,
                row.latitude,
                row.longitude,
                row.observation_time.timetuple().tm_yday,
            ]
            for row in rows
        ],
        dtype=np.float64,
    )
    model = _load_model(str(MODEL_PATH))
    scores = model.decision_function(features)
    flags = model.predict(features)
    items = [
        {
            "observation_id": row.id,
            "observation_time": row.observation_time.isoformat(),
            "latitude": float(row.latitude),
            "longitude": float(row.longitude),
            "sst": float(row.sst),
            "sst_anomaly": float(row.sst_anomaly),
            "anomaly_score": float(score),
            "severity": _severity(float(score)),
        }
        for row, score, flag in zip(rows, scores, flags)
        if flag == -1
    ]
    items.sort(key=lambda item: item["anomaly_score"])
    coverage_start, coverage_end = session.execute(
        select(
            func.min(OceanObservation.observation_time),
            func.max(OceanObservation.observation_time),
        )
    ).one()
    return {
        "mode": "ml",
        "status": "ok",
        "model": "IsolationForest",
        "coverage": {
            "start": coverage_start.date().isoformat() if coverage_start else None,
            "end": coverage_end.date().isoformat() if coverage_end else None,
        },
        "filter": {"date": selected_date.isoformat(), "anomalies_only": True},
        "returned_count": min(len(items), limit),
        "total_anomaly_count": len(items),
        "items": items[:limit],
        "limitations": [
            "Scores identify unusual observations within the acquired sample; they do not prove a physical ocean event.",
            "The acquired historical sample is not a multi-decadal climatology and is not real-time monitoring.",
            "Severity is a score-based display heuristic and requires domain validation.",
        ],
    }


def _load_raw_anomalies(results_path: Path):
    path_key = str(results_path)
    if path_key in _ANOMALY_CACHE:
        return _ANOMALY_CACHE[path_key]

    cache_path = results_path.with_suffix(".cache.pkl")
    try:
        if cache_path.exists():
            cached_mtime, cached_data = pickle.loads(cache_path.read_bytes())
            if cached_mtime == results_path.stat().st_mtime:
                _ANOMALY_CACHE[path_key] = cached_data
                return cached_data
    except Exception:
        pass

    coverage_start = None
    coverage_end = None
    all_anomalies = []
    by_date: dict[str, list[dict]] = {}

    with results_path.open(encoding="utf-8", newline="") as file:
        for row in csv.DictReader(file):
            observation_date = row["observation_time"][:10]
            coverage_start = coverage_start or observation_date
            coverage_end = observation_date
            if row["is_anomaly"].lower() != "true":
                continue
            score = float(row["anomaly_score"])
            item = {
                "observation_id": int(row["id"]),
                "observation_time": row["observation_time"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "sst": float(row["sst"]),
                "sst_anomaly": float(row["sst_anomaly"]),
                "anomaly_score": score,
                "severity": _severity(score),
            }
            all_anomalies.append(item)
            by_date.setdefault(observation_date, []).append(item)

    all_anomalies.sort(key=lambda item: item["anomaly_score"])
    for day_items in by_date.values():
        day_items.sort(key=lambda item: item["anomaly_score"])

    result_data = (coverage_start, coverage_end, all_anomalies, by_date)
    _ANOMALY_CACHE[path_key] = result_data
    try:
        cache_path.write_bytes(pickle.dumps((results_path.stat().st_mtime, result_data)))
    except Exception:
        pass
    return result_data


def load_anomalies(
    results_path: Path = RESULTS_PATH,
    selected_date: date | None = None,
    limit: int = 100,
    session=None,
) -> dict:
    if not results_path.exists():
        if session is not None and selected_date is not None and limit >= 1:
            return _score_selected_date(session, selected_date, limit)
        return {
            "mode": "ml",
            "status": "unavailable",
            "items": [],
            "message": (
                "Choose an observation date to score with the saved model."
                if session is not None
                else "Run python -m ml.ocean.train before requesting anomaly results."
            ),
        }
    if limit < 1:
        raise ValueError("limit must be at least 1")

    coverage_start, coverage_end, all_anomalies, by_date = _load_raw_anomalies(results_path)

    if selected_date:
        items = by_date.get(selected_date.isoformat(), [])
    else:
        items = all_anomalies

    return {
        "mode": "ml",
        "status": "ok",
        "model": "IsolationForest",
        "coverage": {"start": coverage_start, "end": coverage_end},
        "filter": {
            "date": selected_date.isoformat() if selected_date else None,
            "anomalies_only": True,
        },
        "returned_count": min(len(items), limit),
        "total_anomaly_count": len(items),
        "items": items[:limit],
        "limitations": [
            "Scores identify unusual observations within the acquired sample; they do not prove a physical ocean event.",
            "The acquired historical sample is not a multi-decadal climatology and is not real-time monitoring.",
            "Severity is a score-based display heuristic and requires domain validation.",
        ],
    }
