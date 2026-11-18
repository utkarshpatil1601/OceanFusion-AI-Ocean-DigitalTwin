from pathlib import Path

from app import db
from app.fisheries import MODEL_PATH
from app.models import Dataset, FisheriesLanding


def seed_statewise_rows():
    dataset = Dataset(name="CMFRI test", source="CMFRI", description="test")
    db.session.add(dataset)
    db.session.flush()
    for state, value in [("Goa", 100.0), ("Kerala", 200.0)]:
        db.session.add(
            FisheriesLanding(
                dataset_id=dataset.id,
                year=2024,
                state=state,
                landings_tonnes=value,
                source_url="https://example.test",
                source_record_id=f"{state}-2024",
            )
        )
    db.session.commit()


def test_fisheries_prediction_returns_statewise_result(client, monkeypatch):
    seed_statewise_rows()
    monkeypatch.setattr("app.fisheries.MODEL_PATH", Path(MODEL_PATH))
    response = client.get("/api/fisheries/predict?year=2025&state=Goa")
    assert response.status_code == 200
    payload = response.json
    assert payload["status"] == "ok"
    assert payload["items"][0]["state"] == "Goa"
    assert payload["items"][0]["previous_year_landings_tonnes"] == 100.0
    assert payload["feature_columns"] == [
        "year",
        "state",
        "previous_year_landings_tonnes",
    ]


def test_fisheries_prediction_requires_year(client):
    response = client.get("/api/fisheries/predict")
    assert response.status_code == 400
    assert response.json["error"] == "year is required"


def test_fisheries_prediction_missing_previous_year(client):
    response = client.get("/api/fisheries/predict?year=2025")
    assert response.status_code == 404
    assert "2024" in response.json["error"]
