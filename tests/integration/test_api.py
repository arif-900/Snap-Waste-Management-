import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    """Create a test client for FastAPI endpoints."""
    return TestClient(app)

def test_status_endpoint(client):
    """Test the status endpoint API return format."""
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["status"] == "online"
    assert "service" in json_data
    assert "database" in json_data

def test_compliance_stream_endpoint(client):
    """Test that the compliance stream starts and runs successfully."""
    response = client.get("/api/v1/compliance/stream?project_url=https://gitlab.com/arif-900/Snap-Waste-Management-")
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    
    # Read the streamed event-stream chunks
    lines = list(response.iter_lines())
    assert len(lines) > 0
    # Decode and inspect first SSE lines
    first_event = lines[0]
    assert first_event.startswith("data: ")
