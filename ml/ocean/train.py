"""Detect unusual persisted NOAA observations with Isolation Forest."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from sqlalchemy import create_engine


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE = ROOT / "data" / "oceanfusion.sqlite"
DEFAULT_PROCESSED = ROOT / "data" / "processed" / "noaa_observation_features.csv"
DEFAULT_RESULTS = ROOT / "data" / "processed" / "noaa_anomaly_scores.csv"
DEFAULT_MODEL = ROOT / "ml" / "saved_models" / "noaa_isolation_forest.joblib"
DEFAULT_METRICS = ROOT / "ml" / "evaluation" / "noaa_isolation_forest_metrics.json"
FEATURE_COLUMNS = ["sst", "sst_anomaly", "latitude", "longitude", "day_of_year"]


def load_features(database_path: Path | str | None = None) -> pd.DataFrame:
    """Load valid NOAA observations from the configured application database."""
    database = database_path or os.getenv("DATABASE_URL") or DEFAULT_DATABASE
    if isinstance(database, Path):
        connection = sqlite3.connect(database)
        should_dispose = False
    else:
        connection = create_engine(database)
        should_dispose = True
    try:
        frame = pd.read_sql_query(
            """
            SELECT id, observation_time, latitude, longitude, sst, sst_anomaly
            FROM ocean_observations
            WHERE sst_anomaly IS NOT NULL
            ORDER BY observation_time, id
            """,
            connection,
        )
    finally:
        if should_dispose:
            connection.dispose()
    if frame.empty:
        raise ValueError("No NOAA observations with SST anomalies are available")
    frame["observation_time"] = pd.to_datetime(frame["observation_time"], errors="raise")
    numeric_columns = ["latitude", "longitude", "sst", "sst_anomaly"]
    if frame[["id", *numeric_columns]].isna().any().any():
        raise ValueError("NOAA observations contain missing IDs or feature values")
    if frame["id"].duplicated().any():
        raise ValueError("NOAA observations contain duplicate database IDs")
    if not frame[numeric_columns].map(lambda value: pd.api.types.is_number(value)).all().all():
        raise ValueError("NOAA observations contain non-numeric feature values")
    frame["day_of_year"] = frame["observation_time"].map(
        lambda value: value.timetuple().tm_yday
    )
    return frame


def train_and_score(
    database_path: Path | str | None = None,
    processed_path: Path = DEFAULT_PROCESSED,
    results_path: Path = DEFAULT_RESULTS,
    model_path: Path = DEFAULT_MODEL,
    metrics_path: Path = DEFAULT_METRICS,
) -> dict:
    """Fit the detector, persist scores, and return transparent experiment metrics."""
    frame = load_features(database_path)
    model = IsolationForest(
        n_estimators=200,
        contamination=0.01,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(frame[FEATURE_COLUMNS])
    frame["anomaly_score"] = model.decision_function(frame[FEATURE_COLUMNS])
    frame["is_anomaly"] = model.predict(frame[FEATURE_COLUMNS]) == -1
    flagged = frame[frame["is_anomaly"]]
    flagged_by_day = (
        flagged.groupby(flagged["observation_time"].dt.date)
        .size()
        .sort_values(ascending=False)
        .head(10)
    )
    flagged_by_latitude_band = (
        flagged.assign(latitude_band=(flagged["latitude"] // 2 * 2).astype(int))
        .groupby("latitude_band")
        .size()
        .sort_values(ascending=False)
        .head(10)
    )
    metrics = {
        "model": "IsolationForest",
        "task": "NOAA SST anomaly detection",
        "feature_columns": FEATURE_COLUMNS,
        "record_count": len(frame),
        "date_range": {
            "start": frame["observation_time"].min().isoformat(),
            "end": frame["observation_time"].max().isoformat(),
        },
        "anomaly_count": int(frame["is_anomaly"].sum()),
        "anomaly_rate": round(float(frame["is_anomaly"].mean()), 6),
        "contamination_parameter": 0.01,
        "score_range": {
            "min": round(float(frame["anomaly_score"].min()), 6),
            "max": round(float(frame["anomaly_score"].max()), 6),
        },
        "flagged_distribution": {
            "by_day": [
                {"date": str(day), "count": int(count)}
                for day, count in flagged_by_day.items()
            ],
            "by_latitude_band": [
                {"latitude_band_start": int(band), "count": int(count)}
                for band, count in flagged_by_latitude_band.items()
            ],
            "longitude_range": {
                "min": round(float(flagged["longitude"].min()), 6),
                "max": round(float(flagged["longitude"].max()), 6),
            },
        },
        "limitations": [
            "This is unsupervised anomaly detection, not a validated event classifier.",
            "The NOAA sample covers the acquired 2024-2025 period and is not a multi-decadal climatology.",
            "An anomaly score indicates unusual observations within this acquired sample; it does not prove a physical ocean event.",
        ],
    }
    processed_path.parent.mkdir(parents=True, exist_ok=True)
    results_path.parent.mkdir(parents=True, exist_ok=True)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(results_path, index=False)
    frame[["id", "observation_time", *FEATURE_COLUMNS]].to_csv(
        processed_path, index=False
    )
    joblib.dump(model, model_path)
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--database",
        type=Path,
        default=None,
        help="SQLite database path; defaults to DATABASE_URL when set",
    )
    parser.add_argument("--database-url", default=None, help="SQLAlchemy database URL")
    parser.add_argument("--processed", type=Path, default=DEFAULT_PROCESSED)
    parser.add_argument("--results", type=Path, default=DEFAULT_RESULTS)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--metrics", type=Path, default=DEFAULT_METRICS)
    args = parser.parse_args()
    print(json.dumps(train_and_score(
        args.database_url or args.database,
        args.processed, args.results, args.model, args.metrics
    ), indent=2))


if __name__ == "__main__":
    main()
