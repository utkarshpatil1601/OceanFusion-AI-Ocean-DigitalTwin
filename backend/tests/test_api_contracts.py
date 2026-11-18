import pytest


@pytest.mark.parametrize(
    "path,required_keys",
    [
        ("/api/overview", {"mode", "kpis"}),
        ("/api/sources", {"items"}),
        ("/api/ocean/summary", {"mode", "status"}),
        ("/api/ocean/anomalies", {"mode", "status", "items"}),
        ("/api/ocean/twin", {"mode", "status", "items"}),
        ("/api/ocean/twin/history", {"mode", "status", "items"}),
        ("/api/fisheries/summary", {"mode", "status"}),
        ("/api/biodiversity/summary", {"mode", "status"}),
        ("/api/molecular/results", {"mode", "status"}),
        ("/api/analytics/coverage", {"mode", "status", "coverage"}),
        ("/api/analytics/correlation", {"mode", "status", "coverage", "correlations", "reasons"}),
        ("/api/reports", {"mode", "status", "coverage", "quality", "limitations", "provenance"}),
        ("/api/ml/evaluation", {"status", "random_forest", "isolation_forest"}),
        ("/api/ml/models", {"status", "models"}),
        ("/api/ml/metrics", {"status", "random_forest", "isolation_forest", "forecast"}),
    ],
)
def test_dashboard_api_contracts(client, path, required_keys):
    response = client.get(path)

    assert response.status_code == 200
    assert required_keys <= response.json.keys()


def test_ocean_summary_includes_monthly_aggregation(client):
    response = client.get("/api/ocean/summary")

    assert response.status_code == 200
    if response.json["status"] == "ok":
        assert "monthly" in response.json


def test_forecast_is_explicitly_unavailable_until_history_is_sufficient(client):
    response = client.get(
        "/api/ocean/forecast?latitude=15&longitude=72&horizon=7&date=2025-01-15"
    )

    assert response.status_code == 200
    payload = response.json
    assert payload["status"] == "unavailable"
    assert payload["model"] == "LSTM"
    assert payload["forecast_horizon_days"] == 7
    assert payload["forecast_date"] is None
    assert payload["evaluation_metrics"] is None
    assert payload["training_coverage"]["distinct_days"] == 0


@pytest.mark.parametrize(
    "query",
    [
        "/api/ocean/forecast?horizon=1",
        "/api/ocean/forecast?latitude=15&longitude=72&horizon=2",
        "/api/ocean/forecast?latitude=30&longitude=72&horizon=1",
    ],
)
def test_forecast_rejects_invalid_inputs(client, query):
    assert client.get(query).status_code == 400
