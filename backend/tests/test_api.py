from fastapi.testclient import TestClient
from app.main import app

def test_health_no_credentials_needed():
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json()["scope"] == "Zambézia"

def test_invalid_query_fails_before_gee():
    response = TestClient(app).get("/api/tiles/Gilé?mode=garbage")
    assert response.status_code == 422
    response = TestClient(app).get("/api/series/Gilé?threshold=0")
    assert response.status_code == 422
