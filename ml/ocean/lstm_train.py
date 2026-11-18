"""Train reproducible location-aware SST LSTM forecasts from NOAA observations."""

from __future__ import annotations

import argparse
from datetime import date
import json
import os
from pathlib import Path
import sqlite3

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
from sqlalchemy import create_engine


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE = ROOT / "data" / "oceanfusion.sqlite"
DEFAULT_MODEL_DIR = ROOT / "ml" / "saved_models"
DEFAULT_EVALUATION = ROOT / "ml" / "evaluation" / "noaa_sst_lstm_metrics.json"
WINDOW = 30
HORIZONS = (1, 3, 7)
MAX_CELLS = 32
FEATURE_COLUMNS = [
    "sst",
    "sst_anomaly",
    "latitude",
    "longitude",
    "sin_day_of_year",
    "cos_day_of_year",
]


def _connection(database: Path | str | None):
    value = database or os.getenv("DATABASE_URL") or DEFAULT_DATABASE
    if isinstance(value, Path):
        return sqlite3.connect(value), False
    return create_engine(value), True


def _select_cells(connection, max_cells: int) -> list[tuple[float, float]]:
    cells = pd.read_sql_query(
        """
        SELECT DISTINCT latitude, longitude
        FROM ocean_observations
        WHERE sst IS NOT NULL AND sst_anomaly IS NOT NULL
        ORDER BY latitude, longitude
        """,
        connection,
    )
    if cells.empty:
        raise ValueError("No complete NOAA grid cells are available for LSTM training")
    step = max(1, len(cells) // max_cells)
    selected = cells.iloc[::step].head(max_cells)
    return [(float(row.latitude), float(row.longitude)) for row in selected.itertuples()]


def load_grid_series(
    database: Path | str | None = None,
    max_cells: int = MAX_CELLS,
) -> pd.DataFrame:
    """Load complete daily series for a deterministic representative cell sample."""
    connection, dispose = _connection(database)
    try:
        cells = _select_cells(connection, max_cells)
        parts = []
        for latitude, longitude in cells:
            parts.append(
                pd.read_sql_query(
                    """
                    SELECT observation_time, latitude, longitude, sst, sst_anomaly
                    FROM ocean_observations
                    WHERE latitude = :latitude
                      AND longitude = :longitude
                      AND sst IS NOT NULL
                      AND sst_anomaly IS NOT NULL
                    ORDER BY observation_time
                    """,
                    connection,
                    params={"latitude": latitude, "longitude": longitude},
                )
            )
    finally:
        if dispose:
            connection.dispose()
    frame = pd.concat(parts, ignore_index=True)
    frame["observation_time"] = pd.to_datetime(frame["observation_time"], errors="raise")
    frame["date"] = frame["observation_time"].dt.date
    frame["day_of_year"] = frame["observation_time"].dt.day_of_year
    frame["sin_day_of_year"] = np.sin(2 * np.pi * frame["day_of_year"] / 365.25)
    frame["cos_day_of_year"] = np.cos(2 * np.pi * frame["day_of_year"] / 365.25)
    counts = frame.groupby(["latitude", "longitude"])["date"].nunique()
    if counts.min() < WINDOW + max(HORIZONS):
        raise ValueError("Selected NOAA cells do not contain enough daily history")
    return frame


def _make_examples(
    frame: pd.DataFrame,
    feature_scaler: StandardScaler,
    target_scaler: StandardScaler,
    horizon: int,
    train_end: pd.Timestamp,
    validation_end: pd.Timestamp,
):
    sequences = []
    targets = []
    dates = []
    persistence = []
    cells = []
    for (latitude, longitude), group in frame.groupby(["latitude", "longitude"]):
        group = group.sort_values("observation_time").reset_index(drop=True)
        features = feature_scaler.transform(group[FEATURE_COLUMNS])
        target = target_scaler.transform(group[["sst"]]).ravel()
        for end in range(WINDOW, len(group) - horizon + 1):
            target_index = end + horizon - 1
            sequences.append(features[end - WINDOW:end])
            targets.append(target[target_index])
            persistence.append(group.loc[end - 1, "sst"])
            dates.append(group.loc[target_index, "observation_time"])
            cells.append((float(latitude), float(longitude)))
    dates_array = pd.to_datetime(dates)
    split = np.where(
        dates_array < train_end,
        "train",
        np.where(dates_array < validation_end, "validation", "test"),
    )
    return {
        "x": np.asarray(sequences, dtype=np.float32),
        "y": np.asarray(targets, dtype=np.float32),
        "dates": dates_array,
        "split": split,
        "persistence": np.asarray(persistence, dtype=float),
        "cells": cells,
    }


def _metric_block(actual, predicted) -> dict:
    return {
        "mae": round(float(mean_absolute_error(actual, predicted)), 6),
        "rmse": round(float(mean_squared_error(actual, predicted) ** 0.5), 6),
        "r2": round(float(r2_score(actual, predicted)), 6),
    }


def train_lstm(
    database: Path | str | None = None,
    model_dir: Path = DEFAULT_MODEL_DIR,
    evaluation_path: Path = DEFAULT_EVALUATION,
    max_cells: int = MAX_CELLS,
) -> dict:
    """Train one TensorFlow LSTM per forecast horizon and persist all metadata."""
    try:
        import tensorflow as tf
    except ImportError as error:
        raise RuntimeError(
            "TensorFlow is required. Run this command with Python 3.13, where TensorFlow 2.20 is supported."
        ) from error

    tf.keras.utils.set_random_seed(42)
    frame = load_grid_series(database, max_cells=max_cells)
    unique_dates = pd.Series(frame["observation_time"].dt.normalize().unique()).sort_values()
    train_end = pd.Timestamp(unique_dates.iloc[int(len(unique_dates) * 0.70)])
    validation_end = pd.Timestamp(unique_dates.iloc[int(len(unique_dates) * 0.85)])
    train_rows = frame[frame["observation_time"] < train_end]
    feature_scaler = StandardScaler().fit(train_rows[FEATURE_COLUMNS])
    target_scaler = StandardScaler().fit(train_rows[["sst"]])
    model_dir.mkdir(parents=True, exist_ok=True)
    evaluation_path.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        "model_version": "noaa-sst-lstm-2024-2025-v1",
        "window_days": WINDOW,
        "horizons": list(HORIZONS),
        "feature_columns": FEATURE_COLUMNS,
        "cell_count": int(frame[["latitude", "longitude"]].drop_duplicates().shape[0]),
        "coverage": {
            "start": frame["observation_time"].min().date().isoformat(),
            "end": frame["observation_time"].max().date().isoformat(),
            "distinct_days": int(frame["date"].nunique()),
        },
        "split_dates": {
            "train_end_exclusive": train_end.date().isoformat(),
            "validation_end_exclusive": validation_end.date().isoformat(),
        },
        "cells": [
            {"latitude": float(lat), "longitude": float(lon)}
            for lat, lon in frame[["latitude", "longitude"]].drop_duplicates().itertuples(index=False)
        ],
    }
    joblib.dump(
        {
            "feature_scaler": feature_scaler,
            "target_scaler": target_scaler,
            **metadata,
        },
        model_dir / "noaa_sst_lstm_preprocessing.joblib",
    )
    results = {
        "model": "LSTM",
        "task": "Location-aware NOAA SST forecasting",
        **metadata,
        "horizons": {},
        "limitations": [
            "Training uses a deterministic representative sample of NOAA grid cells, not every grid cell.",
            "The forecast is observational and statistical; it is not a hydrodynamic simulation.",
            "Predictions require a complete 30-day history at the selected nearest training grid cell.",
        ],
    }
    for horizon in HORIZONS:
        examples = _make_examples(
            frame, feature_scaler, target_scaler, horizon, train_end, validation_end
        )
        train_mask = examples["split"] == "train"
        validation_mask = examples["split"] == "validation"
        test_mask = examples["split"] == "test"
        model = tf.keras.Sequential(
            [
                tf.keras.layers.Input(shape=(WINDOW, len(FEATURE_COLUMNS))),
                tf.keras.layers.LSTM(32, dropout=0.15),
                tf.keras.layers.Dense(1),
            ]
        )
        model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss="mse")
        model.fit(
            examples["x"][train_mask],
            examples["y"][train_mask],
            validation_data=(examples["x"][validation_mask], examples["y"][validation_mask]),
            epochs=30,
            batch_size=64,
            callbacks=[tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True)],
            verbose=0,
        )
        model_path = model_dir / f"noaa_sst_lstm_h{horizon}.keras"
        model.save(model_path)
        lstm_scaled = model.predict(examples["x"][test_mask], verbose=0).ravel()
        lstm_predictions = target_scaler.inverse_transform(lstm_scaled.reshape(-1, 1)).ravel()
        test_actual = target_scaler.inverse_transform(
            examples["y"][test_mask].reshape(-1, 1)
        ).ravel()
        rf_x = examples["x"][:, -7:, 0]
        rf = RandomForestRegressor(
            n_estimators=100, random_state=42, min_samples_leaf=2, n_jobs=-1
        )
        rf.fit(rf_x[train_mask], examples["y"][train_mask])
        rf_scaled = rf.predict(rf_x[test_mask])
        rf_predictions = target_scaler.inverse_transform(rf_scaled.reshape(-1, 1)).ravel()
        persistence_predictions = examples["persistence"][test_mask]
        results["horizons"][str(horizon)] = {
            "test_examples": int(test_mask.sum()),
            "lstm": _metric_block(test_actual, lstm_predictions),
            "persistence": _metric_block(test_actual, persistence_predictions),
            "lagged_random_forest": _metric_block(test_actual, rf_predictions),
        }
    evaluation_path.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", type=Path, default=None)
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument("--evaluation", type=Path, default=DEFAULT_EVALUATION)
    parser.add_argument("--max-cells", type=int, default=MAX_CELLS)
    args = parser.parse_args()
    result = train_lstm(
        args.database_url or args.database,
        args.model_dir,
        args.evaluation,
        args.max_cells,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
