"""Load and serve validated NOAA SST LSTM forecasts."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from functools import lru_cache
import json
from math import hypot
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from .models import OceanObservation


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "ml" / "saved_models"
EVALUATION_PATH = ROOT / "ml" / "evaluation" / "noaa_sst_lstm_metrics.json"
PREPROCESSING_PATH = MODEL_DIR / "noaa_sst_lstm_preprocessing.joblib"


@lru_cache(maxsize=3)
def _load_lstm_model(horizon: int):
    """Keep each horizon's model loaded so repeated requests do not retrace it."""
    import tensorflow as tf

    return tf.keras.models.load_model(
        MODEL_DIR / f"noaa_sst_lstm_h{horizon}.keras", compile=False
    )


def forecast_artifacts_available() -> bool:
    return PREPROCESSING_PATH.exists() and EVALUATION_PATH.exists() and all(
        (MODEL_DIR / f"noaa_sst_lstm_h{horizon}.keras").exists()
        for horizon in (1, 3, 7)
    )


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _parse_requested_date(value: str | None) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError("date must use YYYY-MM-DD format") from error


def forecast_sst(
    session,
    latitude: float,
    longitude: float,
    horizon: int,
    date_value: str | None = None,
) -> dict:
    """Forecast the nearest trained NOAA grid cell after a complete history check."""
    if not forecast_artifacts_available():
        return {
            "status": "unavailable",
            "message": "No trained and evaluated LSTM artifacts are available.",
        }
    # A forecast is served only by the trained artifact. Never substitute a
    # hand-written trend while labeling it as an LSTM prediction.
    try:
        import tensorflow as tf
    except ImportError as error:
        raise RuntimeError(
            "TensorFlow 2.20 is not available in this Flask Python runtime. "
            "Restart Flask with Python 3.13; the pinned TensorFlow runtime is not supported on Python 3.14."
        ) from error

    requested_date = _parse_requested_date(date_value)
    preprocessing = joblib.load(PREPROCESSING_PATH)
    cells = preprocessing["cells"]
    cell = min(
        cells,
        key=lambda item: hypot(item["latitude"] - latitude, item["longitude"] - longitude),
    )
    observations = (
        session.query(OceanObservation)
        .filter(
            OceanObservation.latitude == cell["latitude"],
            OceanObservation.longitude == cell["longitude"],
        )
        .order_by(OceanObservation.observation_time)
        .all()
    )
    if not observations:
        return {
            "status": "unavailable",
            "message": "The nearest trained grid cell has no persisted observations.",
        }
    frame = pd.DataFrame(
        [
            {
                "observation_time": row.observation_time,
                "sst": row.sst,
                "sst_anomaly": row.sst_anomaly,
                "latitude": row.latitude,
                "longitude": row.longitude,
            }
            for row in observations
        ]
    )
    frame["observation_time"] = pd.to_datetime(frame["observation_time"])
    if requested_date is None:
        selected_date = frame["observation_time"].max().date()
    else:
        selected_date = requested_date
    frame = frame[frame["observation_time"].dt.date <= selected_date].tail(
        preprocessing["window_days"]
    )
    expected_dates = [
        selected_date - timedelta(days=offset)
        for offset in reversed(range(preprocessing["window_days"]))
    ]
    actual_dates = frame["observation_time"].dt.date.tolist()
    if actual_dates != expected_dates:
        return {
            "status": "unavailable",
            "message": (
                f"A forecast for {selected_date.isoformat()} needs {preprocessing['window_days']} "
                "consecutive observed days ending on that date. Choose a later date within the data coverage."
            ),
            "selected_grid_cell": cell,
        }
    day_of_year = frame["observation_time"].dt.day_of_year
    frame["sin_day_of_year"] = np.sin(2 * np.pi * day_of_year / 365.25)
    frame["cos_day_of_year"] = np.cos(2 * np.pi * day_of_year / 365.25)
    features = frame[preprocessing["feature_columns"]].copy()
    scaled = preprocessing["feature_scaler"].transform(features)
    model = _load_lstm_model(horizon)
    prediction_scaled = model.predict(
        scaled.reshape(1, preprocessing["window_days"], len(preprocessing["feature_columns"])),
        verbose=0,
    )
    predicted_sst = float(
        preprocessing["target_scaler"].inverse_transform(prediction_scaled)[0, 0]
    )
    limitations = [
        "The prediction is for the nearest representative trained grid cell.",
        "Uncertainty is not estimated; MAE and RMSE are reported instead.",
        "This is a statistical forecast, not a physical hydrodynamic simulation.",
    ]

    metrics = _read_json(EVALUATION_PATH)["horizons"][str(horizon)]["lstm"]
    forecast_date = selected_date + timedelta(days=horizon)
    return {
        "status": "ok",
        "model": "LSTM",
        "model_version": preprocessing["model_version"],
        "latitude": latitude,
        "longitude": longitude,
        "selected_grid_cell": cell,
        "observed_through": selected_date.isoformat(),
        "forecast_date": forecast_date.isoformat(),
        "forecast_horizon_days": horizon,
        "predicted_sst": round(predicted_sst, 6),
        "training_coverage": preprocessing["coverage"],
        "evaluation_metrics": metrics,
        "uncertainty": None,
        "limitations": limitations,
    }
