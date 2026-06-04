import pytest
from unittest.mock import MagicMock
import sys
import os

# Ensure the backend directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

@pytest.fixture(autouse=True)
def mock_supabase_service(monkeypatch):
    """Mocks supabase_service database calls to run tests in-memory."""
    from app.services.supabase_service import supabase_service
    
    mock_db = {}
    
    def mock_create(data):
        mock_db[data["id"]] = data
        return data
        
    def mock_get(project_url=None):
        reports = list(mock_db.values())
        if project_url:
            reports = [r for r in reports if r["project_url"] == project_url]
        return reports
        
    def mock_delete(report_id):
        if report_id in mock_db:
            del mock_db[report_id]
            return True
        return False

    monkeypatch.setattr(supabase_service, "create_report", mock_create)
    monkeypatch.setattr(supabase_service, "get_reports", mock_get)
    monkeypatch.setattr(supabase_service, "get_latest_project_reports", mock_get)
    monkeypatch.setattr(supabase_service, "delete_report", mock_delete)
    monkeypatch.setattr(supabase_service, "get_project_history", lambda url: mock_get(url))
    monkeypatch.setattr(supabase_service, "is_mock", True)
    
    return supabase_service

@pytest.fixture(autouse=True)
def mock_gitlab_service(monkeypatch):
    """Mocks gitlab_service API connections to avoid network calls during tests."""
    from app.services.gitlab_service import gitlab_service
    
    mock_details = {
        "id": 12345,
        "name": "Smart-Waste-Management",
        "description": "Comprehensive IoT Waste management systems.",
        "web_url": "https://gitlab.com/arif-900/Snap-Waste-Management-",
        "default_branch": "main",
        "topics": ["smart-city", "iot", "fastapi"]
    }
    
    mock_tree = [
        {"path": "README.md", "type": "blob"},
        {"path": "CONTRIBUTING.md", "type": "blob"},
        {"path": "USER_MANUAL.md", "type": "blob"},
        {"path": "AGENTS.md", "type": "blob"},
        {"path": "CHANGELOG.md", "type": "blob"},
        {"path": "LICENSE", "type": "blob"},
        {"path": ".gitignore", "type": "blob"},
        {"path": ".editorconfig", "type": "blob"},
        {"path": "SECURITY.md", "type": "blob"},
        {"path": "CODE_OF_CONDUCT.md", "type": "blob"},
        {"path": ".env.example", "type": "blob"},
        {"path": "Dockerfile", "type": "blob"},
        {"path": ".dockerignore", "type": "blob"},
        {"path": "pyproject.toml", "type": "blob"},
        {"path": ".flake8", "type": "blob"},
        {"path": ".semgrep.yaml", "type": "blob"},
        {"path": ".gitlab-ci.yml", "type": "blob"},
        {"path": ".pre-commit-config.yaml", "type": "blob"},
        {"path": ".specify/memory/constitution.md", "type": "blob"},
        {"path": ".specify/templates/spec-template.md", "type": "blob"},
        {"path": ".specify/templates/plan-template.md", "type": "blob"},
        {"path": ".specify/templates/tasks-template.md", "type": "blob"},
        {"path": "specs/example_feature.md", "type": "blob"},
        {"path": "tests/unit/test_main.py", "type": "blob"}
    ]
    
    monkeypatch.setattr(gitlab_service, "get_project_details", lambda path, pat=None: mock_details)
    monkeypatch.setattr(gitlab_service, "get_project_branches", lambda path, pat=None: ["main"])
    monkeypatch.setattr(gitlab_service, "get_project_releases", lambda path, pat=None: [{"tag_name": "v1.0.0"}])
    monkeypatch.setattr(gitlab_service, "get_project_tags", lambda path, pat=None: [{"name": "v1.0.0"}])
    monkeypatch.setattr(gitlab_service, "get_repository_tree", lambda path, branch, pat=None: mock_tree)
    monkeypatch.setattr(gitlab_service, "get_file_content", lambda path, filepath, branch, pat=None: "mock_content")
    
    return gitlab_service

@pytest.fixture(autouse=True)
def mock_gemini_suggestions(monkeypatch):
    """Mocks Gemini AI model text suggestions generation."""
    from app.services.gemini_suggestions import gemini_suggestions
    
    monkeypatch.setattr(gemini_suggestions, "generate_suggestions", lambda **kwargs: "## Mock AI recommendations")
    return gemini_suggestions
