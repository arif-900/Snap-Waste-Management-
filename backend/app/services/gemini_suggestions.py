from typing import Dict, List, Any, Optional
from app.services.gemini_service import gemini_service

class GeminiSuggestionsService:
    def __init__(self):
        pass

    def generate_suggestions(self, project_name: str, score: float, risk_level: str, 
                             category_scores: Dict[str, float], missing_files: List[str], 
                             details: Dict[str, bool]) -> str:
        """
        Generates actionable suggestions for improvement using Gemini.
        Falls back to rule-based static templates if Gemini is not configured or fails.
        """
        failed_checks = [name for name, passed in details.items() if not passed]
        
        if gemini_service.is_configured and gemini_service.client:
            try:
                # Format a rich prompt for Gemini
                prompt = f"""
                You are a Devops & Repository Compliance Expert.
                Analyze the following repository compliance report and generate an actionable improvement plan.
                
                ### Project Details:
                - Project Name: {project_name}
                - Compliance Score: {score}%
                - Risk Level: {risk_level}
                
                ### Category Performance:
                {chr(10).join([f"- {cat}: {val}%" for cat, val in category_scores.items()])}
                
                ### Failed Checks:
                {', '.join(failed_checks) if failed_checks else "None! Perfect score!"}
                
                ### Missing Files:
                {', '.join(missing_files) if missing_files else "None"}
                
                ### Instructions:
                1. Provide a professional, constructive overview of the project's compliance health.
                2. List the top 3-4 high-priority action items.
                3. Generate copyable, complete code blocks/stubs for the missing configuration files (e.g. if .pre-commit-config.yaml or .specify/constitution.md are missing, write a complete starter configuration for it). Limit code blocks to the 2 most important missing files to keep the response concise but highly useful.
                4. Keep the formatting elegant in Markdown. Do not include introductory conversational text like "Here is the response". Start directly with the Markdown content.
                """
                
                response = gemini_service.client.models.generate_content(
                    model='gemini-1.5-flash',
                    contents=[prompt]
                )
                
                return response.text.strip()
            except Exception as e:
                print(f"Error calling Gemini for suggestions: {e}. Falling back to static generator.")
        
        # Static Fallback Report Generator
        return self._generate_static_suggestions(project_name, score, risk_level, category_scores, missing_files, failed_checks)

    def _generate_static_suggestions(self, project_name: str, score: float, risk_level: str, 
                                     category_scores: Dict[str, float], missing_files: List[str], 
                                     failed_checks: List[str]) -> str:
        """Fallback static recommendations system."""
        markdown = f"""# Compliance Remediation Report for **{project_name}**
        
**Status**: {risk_level} Risk | **Compliance Score**: {score}%

While Google Gemini is currently running in local offline fallback mode, we have compiled a set of standardized instructions to help you remediate the issues found.

## 🚀 Key Actions Required

"""
        # Add actions based on failed categories
        actions = []
        if category_scores.get("Documentation", 100) < 80:
            actions.append("### 1. Document Project Guidelines\nCreate missing documentation files (like `README.md` and `CONTRIBUTING.md`) to align with Git standards.")
        if category_scores.get("Health", 100) < 80:
            actions.append("### 2. Standardize Repository Environment\nAdd configurations such as `.gitignore` and `.editorconfig` to ensure developers share standard lint/line endings.")
        if category_scores.get("CodeQuality", 100) < 80:
            actions.append("### 3. Add Linting & Code Quality Tools\nSet up python tools like Ruff, Mypy, or Flake8 in your `pyproject.toml` or setup config files.")
        if category_scores.get("Security", 100) < 80:
            actions.append("### 4. Enable Secret Scanning & Security Checks\nImplement pre-commit hooks for trufflehog/detect-secrets, and configure dependency updates checking.")
        if category_scores.get("Testing", 100) < 80:
            actions.append("### 5. Setup Test Infrastructure\nEnsure you have a `tests/` directory, write unit tests, and add coverage enforcement thresholds (`fail_under` in `.coveragerc`).")
        if category_scores.get("CICD", 100) < 80:
            actions.append("### 6. Create GitLab CI/CD Pipeline\nCreate a `.gitlab-ci.yml` pipeline with automated checks, test running, and docker building.")
        if category_scores.get("SpecKit", 100) < 80:
            actions.append("### 7. Initialize Spec-Driven Development\nCreate a `.specify` directory containing `constitution.md` and templates to track specs, plans, and tasks.")

        if not actions:
            markdown += "* No actions required! The repository is 100% compliant. Perfect work!\n\n"
        else:
            markdown += "\n\n".join(actions) + "\n\n"

        # Templates Section
        if missing_files:
            markdown += "## 📁 Configuration File Templates\n\nBelow are templates for key missing files in your repository:\n\n"
            
            if ".gitlab-ci.yml" in missing_files:
                markdown += """### Template: `.gitlab-ci.yml`
Add this to your repository root to configure your pipeline:
```yaml
stages:
  - test
  - build
  - deploy

variables:
  PIP_CACHE_DIR: "$CI_PROJECT_DIR/.cache/pip"

cache:
  paths:
    - .cache/pip
    - venv/

before_script:
  - python -V
  - python -m venv venv
  - source venv/bin/activate
  - pip install -r requirements.txt

run_tests:
  stage: test
  script:
    - pytest --cov=app tests/
    - coverage report -m --fail-under=80

build_image:
  stage: build
  script:
    - docker build -t my-app:$CI_COMMIT_SHA .
  only:
    - main
```
\n"""
            if ".pre-commit-config.yaml" in missing_files:
                markdown += """### Template: `.pre-commit-config.yaml`
Add this to configure pre-commit hooks for secret detection and linting:
```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: check-yaml
      - id: end-of-file-fixer
      - id: trailing-whitespace
      - id: check-added-large-files

  - repo: https://github.com/charliermarsh/ruff-pre-commit
    rev: v0.0.275
    hooks:
      - id: ruff
        args: [ --fix ]

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.4.1
    hooks:
      - id: mypy
        additional_dependencies: [types-requests, types-urllib3]

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.17.0
    hooks:
      - id: gitleaks-system
```
\n"""
            if ".specify/constitution.md" in missing_files or "constitution.md" in missing_files:
                markdown += """### Template: `.specify/constitution.md`
Add this to configure your team's development rules:
```markdown
# Repository Constitution

We follow Spec-Driven Development:
1. Every new feature must begin with a written spec inside the `specs/` folder.
2. Every implementation must follow a plan approved by the team.
3. Automated linting, formatting, and unit tests must pass before merging.
4. All secrets must be scanner-protected.
```
\n"""
            if ".editorconfig" in missing_files:
                markdown += """### Template: `.editorconfig`
Create this file to enforce consistent coding style:
```ini
root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```
\n"""

        return markdown

gemini_suggestions = GeminiSuggestionsService()
