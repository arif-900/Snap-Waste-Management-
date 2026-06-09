import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    """Returns a TestClient instance for testing the FastAPI application."""
    with TestClient(app) as c:
        yield c
