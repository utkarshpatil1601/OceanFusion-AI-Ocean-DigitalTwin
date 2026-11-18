def test_biodiversity_is_empty_before_obis_ingestion(client):
    response = client.get("/api/biodiversity/summary")

    assert response.status_code == 200
    assert response.json["status"] == "empty"
