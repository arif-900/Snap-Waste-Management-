import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_history_comparison_flow(client):
    """Test standard reporting flow: check history, comparisons and lists."""
    # 1. Fetch history (initially empty or mock-filled)
    hist_resp = client.get("/api/v1/compliance/history")
    assert hist_resp.status_code == 200
    
    # 2. Fetch latest project reports
    latest_resp = client.get("/api/v1/compliance/latest")
    assert latest_resp.status_code == 200
    
    # 3. Check comparison rankings leaderboard
    comp_resp = client.get("/api/v1/compliance/comparison")
    assert comp_resp.status_code == 200
    comp_data = comp_resp.json()
    assert "projects" in comp_data
    assert "average_score" in comp_data

def test_batch_analyze(client):
    """Test batch analysis endpoint."""
    payload = {
        "project_urls": ["https://gitlab.com/arif-900/Snap-Waste-Management-"],
        "branch": "main"
    }
    response = client.post("/api/v1/compliance/batch", json=payload)
    assert response.status_code == 200
    results = response.json()
    assert isinstance(results, list)
    if len(results) > 0:
        assert "score" in results[0]
        assert results[0]["project_name"] == "Smart-Waste-Management"
