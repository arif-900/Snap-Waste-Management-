import pytest
from app.config import settings
from app.services.compliance_checker import compliance_checker

def test_settings_load():
    """Verify that default application settings are properly loaded."""
    assert settings.PORT == 8000
    assert settings.HOST == "0.0.0.0"
    assert settings.AI_PROVIDER in ["gemini", "yolo"]

def test_compliance_checker_run_all():
    """Verify that the ComplianceChecker successfully runs its audit logic and yields correct metrics."""
    mock_project_info = {
        "id": 9999,
        "name": "Test project",
        "description": "This is a detailed mock description for metadata validation.",
        "web_url": "https://gitlab.com/test/test",
        "default_branch": "main",
        "topics": ["iot", "smart-city"]
    }
    mock_releases = [{"tag_name": "v1.0.0"}]
    mock_tags = [{"name": "v1.0.0"}]
    
    # Fully compliant project files list
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
        {"path": "tests/unit/test_main.py", "type": "blob"},
        {"path": ".gitlab/security-policies/policy.yml", "type": "blob"},
        {"path": ".coveragerc", "type": "blob"}
    ]

    def mock_fetch_content(path):
        if path == "pyproject.toml":
            return "[tool.ruff]\n[tool.mypy]\n[tool.pylint]\n[tool.vulture]\n[tool.bandit]\n[tool.coverage.run]\nfail_under = 80"
        if path == ".gitlab-ci.yml":
            return "stages:\n  - validate\n  - lint\n  - security\n  - test\n  - build\n  - deploy\ndetect-secrets:\n  stage: security\ndependency_scanning:\n  stage: security\nsast:\n  stage: security\nrelease-please:\n  stage: deploy\ndeploy:\n  stage: deploy"
        if path == ".pre-commit-config.yaml":
            return "repos:\n  - repo: local\n    hooks:\n      - id: detect-secrets\n      - id: pyupgrade"
        return ""

    result = compliance_checker.run_check(
        project_info=mock_project_info,
        releases=mock_releases,
        tags=mock_tags,
        tree_files=mock_tree,
        fetch_file_content_fn=mock_fetch_content
    )
    
    assert "score" in result
    assert "risk_level" in result
    assert "category_scores" in result
    # It should have a high compliance score since we supplied all requested files
    assert result["score"] >= 95.0
    assert result["risk_level"] == "Low"
