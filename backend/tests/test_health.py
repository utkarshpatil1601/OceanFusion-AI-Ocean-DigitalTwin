def test_health(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json == {"status": "ok", "service": "oceanfusion-api"}


def test_prometheus_metrics_endpoint(client):
    response = client.get("/metrics")

    assert response.status_code == 200
    assert response.mimetype == "text/plain"
    assert "oceanfusion_up 1" in response.get_data(as_text=True)
    assert "oceanfusion_database_up 1" in response.get_data(as_text=True)

