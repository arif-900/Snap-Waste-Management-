import pytest

def test_status_endpoint(client):
    """Verifies that the /api/v1/status endpoint is online and returns correct details."""
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "online"

def test_complaints_endpoint(client):
    """Verifies that retrieving complaints returns a valid JSON array."""
    response = client.get("/api/v1/complaints")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
