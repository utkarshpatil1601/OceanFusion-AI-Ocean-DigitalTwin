from datetime import datetime

from app import db
from app.models import Dataset, OceanObservation
from app.routes import api


def test_ocean_summary_is_honest_when_database_is_empty(client):
    response = client.get("/api/ocean/summary")

    assert response.status_code == 200
    assert response.json["status"] == "empty"


def test_ocean_observation_serializes():
    observation = OceanObservation(
        dataset_id=1,
        observation_time=datetime(2025, 1, 1),
        latitude=10,
        longitude=60,
        sst=27.5,
        source_record_id="sample.nc",
    )

    assert observation.to_dict()["sst"] == 27.5
