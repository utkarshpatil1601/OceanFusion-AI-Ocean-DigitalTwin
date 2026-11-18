from datetime import datetime

from app import db
from app.models import FisheriesLanding, OceanObservation


def test_coverage_endpoint_reports_empty_source_states(client):
    response = client.get("/api/analytics/coverage")

    assert response.status_code == 200
    assert response.json["status"] == "ok"
    assert response.json["coverage"]["noaa"]["record_count"] == 0
    assert response.json["coverage"]["cmfri"]["record_count"] == 0


def test_correlation_withholds_insufficient_overlap(client):
    dataset_id = 1
    db.session.add_all(
        [
            OceanObservation(
                dataset_id=dataset_id,
                observation_time=datetime(2025, 1, 1),
                latitude=10,
                longitude=70,
                sst=25,
                source_record_id="test-ocean",
            ),
            FisheriesLanding(
                dataset_id=dataset_id,
                year=2025,
                state="Kerala",
                landings_tonnes=100,
                precision="test",
                source_url="https://example.test",
                source_record_id="test-fisheries",
            ),
        ]
    )
    db.session.commit()

    response = client.get("/api/analytics/correlation")

    assert response.status_code == 200
    assert response.json["status"] == "unavailable"
    assert response.json["aligned_periods"] == [2025]
    assert response.json["correlations"] == []
