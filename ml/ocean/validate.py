"""Create a transparent validation summary for NOAA anomaly scores."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "data" / "processed" / "noaa_anomaly_scores.csv"
DEFAULT_OUTPUT = ROOT / "ml" / "evaluation" / "noaa_anomaly_validation.json"


def validate_scores(input_path: Path = DEFAULT_INPUT, output_path: Path = DEFAULT_OUTPUT) -> dict:
    frame = pd.read_csv(input_path, parse_dates=["observation_time"])
    anomalies = frame[frame["is_anomaly"]].copy()
    daily = anomalies.groupby(anomalies["observation_time"].dt.date).size()
    coverage_start = frame["observation_time"].min().date().isoformat()
    coverage_end = frame["observation_time"].max().date().isoformat()
    result = {
        "input": str(input_path),
        "record_count": len(frame),
        "anomaly_count": len(anomalies),
        "anomaly_rate": round(float(anomalies.shape[0] / frame.shape[0]), 6),
        "coverage": {
            "start": coverage_start,
            "end": coverage_end,
            "distinct_days": int(frame["observation_time"].dt.date.nunique()),
        },
        "score_quantiles": {
            str(percentile): round(float(anomalies["anomaly_score"].quantile(percentile)), 6)
            for percentile in [0.0, 0.1, 0.5, 0.9, 1.0]
        },
        "flagged_sst_anomaly": {
            "mean": round(float(anomalies["sst_anomaly"].mean()), 6),
            "min": round(float(anomalies["sst_anomaly"].min()), 6),
            "max": round(float(anomalies["sst_anomaly"].max()), 6),
        },
        "top_flagged_days": [
            {"date": str(day), "count": int(count)}
            for day, count in daily.sort_values(ascending=False).head(5).items()
        ],
        "interpretation": [
            "Isolation Forest flags observations relative to this acquired sample.",
            "The score is not a probability and is not an environmental-impact label.",
            "The acquired two-year window is not a multi-decadal climatology and does not prove physical events.",
        ],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


if __name__ == "__main__":
    print(json.dumps(validate_scores(), indent=2))
