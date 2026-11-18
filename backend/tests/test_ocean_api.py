from datetime import datetime

from app import db
from app.models import Dataset, OceanObservation


def test_ocean_summary_uses_persisted_records(client):
    with client.application.app_context():
        dataset = Dataset(name="NOAA test", source="NOAA", description="test")
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
                source_record_id="test.nc",
            )
        )
        db.session.commit()

    response = client.get("/api/ocean/summary")

    assert response.json["status"] == "ok"
    assert response.json["summary"]["observation_count"] == 1
    assert response.json["daily"][0]["mean_sst"] == 27.5
