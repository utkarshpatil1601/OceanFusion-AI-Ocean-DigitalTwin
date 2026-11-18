"""CMFRI prediction helpers backed by the trained Random Forest artifact."""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sqlalchemy import select

from .models import FisheriesLanding


MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "saved_models" / "cmfri_random_forest.joblib"
FEATURE_COLUMNS = ["year", "state", "previous_year_landings_tonnes"]
LIMITATIONS = [
    "This is an experimental statewise regression model, not an operational forecast.",
    "Predictions use only CMFRI year, state, and previous-year state landings.",
    "National resource-wise records are excluded because their historical coverage is partial.",
]
MODEL_VERSION = "cmfri-rf-2025-01"


def predict_landings(session, year: int, state: str | None = None) -> dict:
    """Predict statewise landings for a target year using persisted CMFRI records."""
    if not MODEL_PATH.is_file():
        return {
            "status": "unavailable",
            "model": "CMFRI RandomForestRegressor",
            "message": "Train the CMFRI model before requesting predictions.",
            "model_path": str(MODEL_PATH),
        }

    previous_rows = session.execute(
        select(FisheriesLanding)
        .where(
            FisheriesLanding.year == year - 1,
            FisheriesLanding.state.is_not(None),
            FisheriesLanding.resource.is_(None),
        )
        .order_by(FisheriesLanding.state)
    ).scalars().all()
    if state:
        previous_rows = [row for row in previous_rows if row.state == state]
    if not previous_rows:
        raise ValueError(
            f"No statewise CMFRI landing record is available for {year - 1}"
            + (f" and state '{state}'" if state else "")
        )

    model = joblib.load(MODEL_PATH)
    features = pd.DataFrame(
        [
            {
                "year": year,
                "state": row.state,
                "previous_year_landings_tonnes": row.landings_tonnes,
            }
            for row in previous_rows
        ],
        columns=FEATURE_COLUMNS,
    )
    predictions = model.predict(features)
    items = [
        {
            "state": row.state,
            "target_year": year,
            "previous_year": year - 1,
            "previous_year_landings_tonnes": round(float(row.landings_tonnes), 3),
            "predicted_landings_tonnes": round(max(float(prediction), 0.0), 3),
        }
        for row, prediction in zip(previous_rows, predictions)
    ]
    return {
        "status": "ok",
        "model": "RandomForestRegressor",
        "model_version": MODEL_VERSION,
        "task": "CMFRI statewise landing regression",
        "target_year": year,
        "state": state,
        "feature_columns": FEATURE_COLUMNS,
        "items": items,
        "limitations": LIMITATIONS,
        "prediction_constraints": {"lower_bound_tonnes": 0},
    }
