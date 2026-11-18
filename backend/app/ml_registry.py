"""Model registry and evaluation metadata for the three-model ML plan."""

from __future__ import annotations

from datetime import date
import json
from pathlib import Path

from sqlalchemy import func, select

from .models import OceanObservation
from .forecast import forecast_artifacts_available


ROOT = Path(__file__).resolve().parents[2]
EVALUATION_DIR = ROOT / "ml" / "evaluation"
MODEL_DIR = ROOT / "ml" / "saved_models"
FORECAST_HORIZONS = (1, 3, 7)
MIN_FORECAST_DAYS = 365


def _read_json(name: str) -> dict | None:
    path = EVALUATION_DIR / name
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _noaa_coverage(session) -> dict:
    start, end, count, distinct_days = session.execute(
        select(
            func.min(OceanObservation.observation_time),
            func.max(OceanObservation.observation_time),
            func.count(OceanObservation.id),
            func.count(func.distinct(func.date(OceanObservation.observation_time))),
        )
    ).one()
    if not count or not start or not end:
        return {
            "start": None,
            "end": None,
            "record_count": 0,
            "distinct_days": 0,
        }
    start_d = start.date() if hasattr(start, "date") else date.fromisoformat(str(start)[:10])
    end_d = end.date() if hasattr(end, "date") else date.fromisoformat(str(end)[:10])
    return {
        "start": start.isoformat() if hasattr(start, "isoformat") else str(start),
        "end": end.isoformat() if hasattr(end, "isoformat") else str(end),
        "record_count": int(count or 0),
        "distinct_days": int(distinct_days or 0),
    }


def model_registry(session) -> dict:
    noaa = _noaa_coverage(session)
    forecast_ready = noaa["distinct_days"] >= MIN_FORECAST_DAYS
    return {
        "status": "ok",
        "models": [
            {
                "id": "cmfri_random_forest",
                "name": "CMFRI Random Forest Regressor",
                "algorithm": "RandomForestRegressor",
                "purpose": "Experimental statewise fisheries landing prediction",
                "status": "trained" if (MODEL_DIR / "cmfri_random_forest.joblib").exists() else "unavailable",
                "artifact": "ml/saved_models/cmfri_random_forest.joblib",
                "evaluation": "ml/evaluation/cmfri_random_forest_metrics.json",
            },
            {
                "id": "noaa_isolation_forest",
                "name": "NOAA Isolation Forest",
                "algorithm": "IsolationForest",
                "purpose": "Statistical detection of unusual NOAA SST observations",
                "status": "trained" if (MODEL_DIR / "noaa_isolation_forest.joblib").exists() else "unavailable",
                "artifact": "ml/saved_models/noaa_isolation_forest.joblib",
                "evaluation": "ml/evaluation/noaa_isolation_forest_metrics.json",
            },
            {
                "id": "noaa_sst_lstm",
                "name": "NOAA SST LSTM",
                "algorithm": "LSTM",
                "purpose": "Future SST forecasting",
                "status": "trained" if forecast_artifacts_available() else ("pending" if not forecast_ready else "not_trained"),
                "artifact": "ml/saved_models/noaa_sst_lstm_h{1,3,7}.keras",
                "evaluation": "ml/evaluation/noaa_sst_lstm_metrics.json",
                "coverage": noaa,
                "minimum_required_days": MIN_FORECAST_DAYS,
                "limitation": (
                    "Forecast artifacts are present; verify the saved chronological evaluation and baseline comparisons before use."
                    if forecast_artifacts_available()
                    else "No complete trained and evaluated forecast artifact set is available."
                ),
            },
        ],
    }


def model_metrics(session) -> dict:
    noaa = _noaa_coverage(session)
    lstm = _read_json("noaa_sst_lstm_metrics.json")
    return {
        "status": "ok",
        "random_forest": _read_json("cmfri_random_forest_metrics.json"),
        "isolation_forest": _read_json("noaa_isolation_forest_metrics.json"),
        "anomaly_validation": _read_json("noaa_anomaly_validation.json"),
        "forecast": {
            "status": "ok" if forecast_artifacts_available() else "pending",
            "model": "LSTM",
            "coverage": noaa,
            "minimum_required_days": MIN_FORECAST_DAYS,
            "horizons": list(FORECAST_HORIZONS),
            "metrics_by_horizon": lstm.get("horizons") if lstm else None,
            "message": "Metrics are read from the saved evaluation report; compare each horizon with its baselines.",
        },
    }


def forecast_unavailable(session, latitude: float, longitude: float, horizon: int, date_value: str | None) -> dict:
    coverage = _noaa_coverage(session)
    return {
        "status": "unavailable",
        "model": "LSTM",
        "forecast_horizon_days": horizon,
        "latitude": latitude,
        "longitude": longitude,
        "forecast_date": None,
        "training_coverage": coverage,
        "evaluation_metrics": None,
        "message": "SST forecasting is pending because no trained and evaluated LSTM artifact exists yet.",
        "requested_date": date_value,
        "limitations": [
            f"At least {MIN_FORECAST_DAYS} calendar days are used as a screening threshold; this alone does not establish forecast skill.",
            "The saved evaluation report includes comparisons with persistence and lagged Random Forest baselines.",
            "A prediction is withheld until a compatible trained artifact and complete input history are available.",
        ],
    }
