from datetime import datetime

from app import db
from app.models import Dataset, OceanObservation


def _add_observations(client):
    with client.application.app_context():
        dataset = Dataset(name="NOAA twin test", source="NOAA", description="test")
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
                    sst_anomaly=0.2,
                    source_record_id="twin-1.nc",
                ),
                OceanObservation(
                    dataset_id=dataset.id,
                    observation_time=datetime(2025, 1, 2, 12),
                    latitude=11,
                    longitude=61,
                    sst=26.5,
                    sst_anomaly=-0.2,
                    source_record_id="twin-2.nc",
                ),
            ]
        )
        db.session.commit()


def test_twin_snapshot_returns_spatial_observations(client):
    _add_observations(client)
    response = client.get("/api/ocean/twin?date=2025-01-01&min_lat=9&max_lat=10")
    assert response.status_code == 200
    assert response.json["status"] == "ok"
    assert response.json["historical_only"] is True
    assert len(response.json["items"]) == 1
    assert response.json["items"][0]["sst"] == 27.5


def test_twin_history_returns_daily_summaries(client):
    _add_observations(client)
    response = client.get(
        "/api/ocean/twin/history?start=2025-01-01&end=2025-01-02"
    )
    assert response.status_code == 200
    assert [item["date"] for item in response.json["items"]] == [
        "2025-01-01",
        "2025-01-02",
    ]


def test_twin_rejects_invalid_date(client):
    response = client.get("/api/ocean/twin?date=not-a-date")
    assert response.status_code == 400
