"""Train and evaluate a leakage-safe CMFRI landing baseline."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "data" / "raw" / "cmfri" / "CMFRI_Statewise_Landings_5_States_2013_2025.csv"
DEFAULT_PROCESSED = ROOT / "data" / "processed" / "cmfri_statewise_features.csv"
DEFAULT_MODEL = ROOT / "ml" / "saved_models" / "cmfri_random_forest.joblib"
DEFAULT_METRICS = ROOT / "ml" / "evaluation" / "cmfri_random_forest_metrics.json"


def load_features(input_path: Path = DEFAULT_INPUT) -> pd.DataFrame:
    """Load statewise records and add only prior-year features."""
    frame = pd.read_csv(input_path)
    required = {"year", "state", "landings_tonnes"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"CMFRI file is missing required columns: {sorted(missing)}")
    frame = frame[["year", "state", "landings_tonnes"]].copy()
    frame["year"] = pd.to_numeric(frame["year"], errors="raise").astype(int)
    frame["landings_tonnes"] = pd.to_numeric(
        frame["landings_tonnes"], errors="raise"
    )
    if frame[["year", "state"]].duplicated().any():
        raise ValueError("CMFRI statewise data contains duplicate year/state rows")
    frame = frame.sort_values(["state", "year"]).reset_index(drop=True)
    frame["previous_year_landings_tonnes"] = frame.groupby("state")[
        "landings_tonnes"
    ].shift(1)
    return frame.dropna(subset=["previous_year_landings_tonnes"]).reset_index(drop=True)


def chronological_split(
    frame: pd.DataFrame, test_years: int = 3
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split complete years so no future observations enter training."""
    years = sorted(frame["year"].unique())
    if len(years) <= test_years:
        raise ValueError("At least one training year is required before test years")
    cutoff = years[-test_years]
    train = frame[frame["year"] < cutoff].copy()
    test = frame[frame["year"] >= cutoff].copy()
    return train, test


def build_pipeline() -> Pipeline:
    features = ["year", "state", "previous_year_landings_tonnes"]
    transformer = ColumnTransformer(
        [
            ("state", OneHotEncoder(handle_unknown="ignore"), ["state"]),
        ],
        remainder="passthrough",
    )
    return Pipeline(
        [
            ("features", transformer),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=300,
                    random_state=42,
                    min_samples_leaf=2,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def train_and_evaluate(
    input_path: Path = DEFAULT_INPUT,
    processed_path: Path = DEFAULT_PROCESSED,
    model_path: Path = DEFAULT_MODEL,
    metrics_path: Path = DEFAULT_METRICS,
) -> dict:
    frame = load_features(input_path)
    train, test = chronological_split(frame)
    feature_columns = ["year", "state", "previous_year_landings_tonnes"]
    target = "landings_tonnes"
    model = build_pipeline()
    model.fit(train[feature_columns], train[target])
    predictions = model.predict(test[feature_columns]).clip(0, None)
    baseline = test["previous_year_landings_tonnes"]
    test_with_predictions = test[["year", "state", target]].copy()
    test_with_predictions["prediction"] = predictions

    def metric_block(actual, predicted):
        return {
            "mae_tonnes": round(float(mean_absolute_error(actual, predicted)), 3),
            "rmse_tonnes": round(float(mean_squared_error(actual, predicted) ** 0.5), 3),
            "r2": round(float(r2_score(actual, predicted)), 6),
        }

    metrics = {
        "model": "RandomForestRegressor",
        "task": "CMFRI statewise landing regression",
        "feature_columns": feature_columns,
        "training_years": sorted(train["year"].unique().tolist()),
        "test_years": sorted(test["year"].unique().tolist()),
        "train_rows": len(train),
        "test_rows": len(test),
        "model_metrics": metric_block(test[target], predictions),
        "persistence_baseline": metric_block(test[target], baseline),
        "metrics_by_state": {
            state: metric_block(group[target], group["prediction"])
            for state, group in test_with_predictions.groupby("state")
        },
        "metrics_by_year": {
            str(year): metric_block(group[target], group["prediction"])
            for year, group in test_with_predictions.groupby("year")
        },
        "prediction_constraints": {
            "lower_bound_tonnes": 0,
            "applied": "negative predictions are clipped to zero before evaluation and serving",
        },
        "limitations": [
            "Statewise records are a small experimental dataset.",
            "Validation uses the final three years and does not establish production forecasting accuracy.",
            "National resource-wise records are excluded because their historical coverage is partial.",
        ],
    }
    processed_path.parent.mkdir(parents=True, exist_ok=True)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(processed_path, index=False)
    joblib.dump(model, model_path)
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--processed", type=Path, default=DEFAULT_PROCESSED)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--metrics", type=Path, default=DEFAULT_METRICS)
    args = parser.parse_args()
    metrics = train_and_evaluate(args.input, args.processed, args.model, args.metrics)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
