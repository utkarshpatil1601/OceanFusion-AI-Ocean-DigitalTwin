from datetime import datetime

from app import db
from app.models import Dataset, OceanObservation


def test_twin_scenario_returns_simulated_values(client):
    with client.application.app_context():
        dataset = Dataset(name="NOAA scenario test", source="NOAA")
        db.session.add(dataset)
        db.session.flush()
        db.session.add(
            OceanObservation(
                dataset_id=dataset.id,
                observation_time=datetime(2025, 1, 1, 12),
                latitude=10,
                longitude=60,
                sst=27.5,
                sst_anomaly=0.2,
                source_record_id="scenario.nc",
            )
        )
        db.session.commit()
    response = client.get("/api/ocean/twin/scenario?date=2025-01-01&delta=1")
    assert response.status_code == 200
    assert response.json["hypothetical"] is True
    assert response.json["items"][0]["simulated_sst"] == 28.5


def test_twin_scenario_rejects_unbounded_delta(client):
    response = client.get("/api/ocean/twin/scenario?delta=6")
    assert response.status_code == 400
