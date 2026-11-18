import csv
from datetime import date, datetime

import numpy as np

from app import db
from app.anomalies import load_anomalies
from app.models import Dataset, OceanObservation


def test_anomaly_results_are_sorted_and_date_filterable(tmp_path):
    results = tmp_path / "scores.csv"
    with results.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "id", "observation_time", "latitude", "longitude", "sst",
                "sst_anomaly", "anomaly_score", "is_anomaly",
            ],
        )
        writer.writeheader()
        writer.writerows(
            [
                {"id": 1, "observation_time": "2025-01-01 12:00:00", "latitude": 10, "longitude": 70, "sst": 20, "sst_anomaly": -2, "anomaly_score": -0.02, "is_anomaly": "True"},
                {"id": 2, "observation_time": "2025-01-02 12:00:00", "latitude": 11, "longitude": 71, "sst": 19, "sst_anomaly": -3, "anomaly_score": -0.08, "is_anomaly": "True"},
                {"id": 3, "observation_time": "2025-01-02 12:00:00", "latitude": 12, "longitude": 72, "sst": 25, "sst_anomaly": 1, "anomaly_score": 0.1, "is_anomaly": "False"},
            ],
        )
    payload = load_anomalies(results, selected_date=date(2025, 1, 2), limit=10)
    assert payload["total_anomaly_count"] == 1
    assert payload["items"][0]["severity"] == "high"


def test_missing_anomaly_artifact_is_explicit(tmp_path):
    payload = load_anomalies(tmp_path / "missing.csv")
    assert payload["status"] == "unavailable"
    assert payload["items"] == []


def test_scores_selected_date_with_saved_model_when_csv_is_missing(client, tmp_path, monkeypatch):
    import app.anomalies as anomalies

    model_path = tmp_path / "saved-model.joblib"
    model_path.touch()

    class FakeModel:
        def decision_function(self, features):
            assert features.shape == (2, 5)
            return np.array([-0.08, 0.02])

        def predict(self, features):
            return np.array([-1, 1])

    monkeypatch.setattr(anomalies, "MODEL_PATH", model_path)
    monkeypatch.setattr(anomalies, "_load_model", lambda _: FakeModel())

    with client.application.app_context():
        dataset = Dataset(name="NOAA model test", source="NOAA", description="test")
        db.session.add(dataset)
        db.session.flush()
        db.session.add_all(
            [
                OceanObservation(
                    dataset_id=dataset.id,
                    observation_time=datetime(2025, 1, 1, 12),
                    latitude=10,
                    longitude=60,
                    sst=27.5,
                    sst_anomaly=-0.4,
                    source_record_id="score-test-1",
                ),
                OceanObservation(
                    dataset_id=dataset.id,
                    observation_time=datetime(2025, 1, 1, 12),
                    latitude=11,
                    longitude=61,
                    sst=27.0,
                    sst_anomaly=0.1,
                    source_record_id="score-test-2",
                ),
            ]
        )
        db.session.commit()

        payload = load_anomalies(
            tmp_path / "missing.csv",
            selected_date=date(2025, 1, 1),
            limit=10,
            session=db.session,
        )

    assert payload["status"] == "ok"
    assert payload["total_anomaly_count"] == 1
    assert payload["items"][0]["observation_id"] == 1
