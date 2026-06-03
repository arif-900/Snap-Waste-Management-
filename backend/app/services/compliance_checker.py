import json
import re
from typing import List, Dict, Any, Optional, Callable

class ComplianceChecker:
    def __init__(self):
        # Weights for each category as defined in requirements
        self.weights = {
            "Metadata": 0.10,
            "Documentation": 0.20,
            "Health": 0.15,
            "CodeQuality": 0.15,
            "Security": 0.15,
            "Testing": 0.10,
            "CICD": 0.10,
            "SpecKit": 0.05
        }

    def run_check(self, project_info: Dict[str, Any], releases: List[Dict[str, Any]], tags: List[Dict[str, Any]], 
                  tree_files: List[Dict[str, Any]], fetch_file_content_fn: Callable[[str], Optional[str]],
                  log_fn: Optional[Callable[[str], None]] = None) -> Dict[str, Any]:
        """
        Executes all 43 compliance checks and computes scores.
        """
        def log(msg: str):
            if log_fn:
                log_fn(msg)

        log("Initializing check database...")
        
        # Flatten file paths for quick checks
        file_paths = {f["path"].lower(): f["path"] for f in tree_files}
        
        # Helper to check if file exists (case-insensitive)
        def file_exists(path: str) -> bool:
            return path.lower() in file_paths
        
        # Helper to check if any folder or file path matches a pattern
        def any_path_matches(pattern: str) -> bool:
            rx = re.compile(pattern, re.IGNORECASE)
            return any(rx.search(f) for f in file_paths.keys())

        # Pre-fetch key configuration files if they exist to inspect details
        config_files = [
            "pyproject.toml",
            ".gitlab-ci.yml",
            ".pre-commit-config.yaml",
            ".coveragerc",
            "setup.cfg",
            "package.json"
        ]
        
        contents = {}
        for filename in config_files:
            if file_exists(filename):
                log(f"Inspecting configuration file: {filename}...")
                actual_path = file_paths[filename.lower()]
                content = fetch_file_content_fn(actual_path)
                contents[filename] = content if content else ""
            else:
                contents[filename] = ""

        # Let's run individual checks
        checks = {}
        missing_files = []

        # =====================================================================
        # 1. Project Metadata (10% weight, 4 checks)
        # =====================================================================
        log("Evaluating Category: Project Metadata...")
        
        # Description
        desc = project_info.get("description")
        checks["Metadata: Description"] = bool(desc and len(desc.strip()) > 5)
        
        # Topics
        topics = project_info.get("topics", []) or project_info.get("tag_list", [])
        checks["Metadata: Topics/Tags"] = bool(topics and len(topics) > 0)
        
        # License
        has_license = bool(
            project_info.get("license") or 
            project_info.get("license_url") or 
            file_exists("LICENSE") or 
            file_exists("LICENSE.md") or 
            file_exists("LICENSE.txt")
        )
        checks["Metadata: License"] = has_license
        if not has_license:
            missing_files.append("LICENSE")
            
        # Releases / Release Tags
        checks["Metadata: Release Tags"] = bool(len(releases) > 0 or len(tags) > 0)

        # =====================================================================
        # 2. Documentation Validation (20% weight, 5 checks)
        # =====================================================================
        log("Evaluating Category: Documentation Validation...")
        docs = [
            ("README.md", "Documentation: README.md"),
            ("CONTRIBUTING.md", "Documentation: CONTRIBUTING.md"),
            ("USER_MANUAL.md", "Documentation: USER_MANUAL.md"),
            ("AGENTS.md", "Documentation: AGENTS.md"),
            ("CHANGELOG.md", "Documentation: CHANGELOG.md")
        ]
        for f, name in docs:
            exists = file_exists(f)
            checks[name] = exists
            if not exists:
                missing_files.append(f)

        # =====================================================================
        # 3. Repository Health (15% weight, 7 checks)
        # =====================================================================
        log("Evaluating Category: Repository Health...")
        health_files = [
            (".gitignore", "Health: .gitignore"),
            (".editorconfig", "Health: .editorconfig"),
            ("SECURITY.md", "Health: SECURITY.md"),
            ("CODE_OF_CONDUCT.md", "Health: CODE_OF_CONDUCT.md"),
            (".env.example", "Health: .env.example"),
            ("Dockerfile", "Health: Dockerfile"),
            (".dockerignore", "Health: .dockerignore")
        ]
        for f, name in health_files:
            exists = file_exists(f)
            checks[name] = exists
            if not exists:
                missing_files.append(f)

        # =====================================================================
        # 4. Code Quality Tool Detection (15% weight, 8 checks)
        # =====================================================================
        log("Evaluating Category: Code Quality Tool Detection...")
        pyproj = contents.get("pyproject.toml", "")
        setup_cfg = contents.get("setup.cfg", "")
        pre_commit = contents.get(".pre-commit-config.yaml", "")
        gitlab_ci = contents.get(".gitlab-ci.yml", "")

        # Ruff
        checks["CodeQuality: Ruff"] = bool(
            file_exists("ruff.toml") or 
            file_exists(".ruff.toml") or 
            "[tool.ruff]" in pyproj
        )
        # Mypy
        checks["CodeQuality: Mypy"] = bool(
            file_exists("mypy.ini") or 
            file_exists(".mypy.ini") or 
            "[tool.mypy]" in pyproj or
            "[mypy]" in setup_cfg
        )
        # Flake8
        checks["CodeQuality: Flake8"] = bool(
            file_exists(".flake8") or 
            "[flake8]" in setup_cfg
        )
        # Pylint
        checks["CodeQuality: Pylint"] = bool(
            file_exists(".pylintrc") or 
            file_exists("pylintrc") or 
            "[tool.pylint]" in pyproj
        )
        # Vulture
        checks["CodeQuality: Vulture"] = bool(
            file_exists("vulture_whitelist.py") or 
            "[tool.vulture]" in pyproj
        )
        # Bandit
        checks["CodeQuality: Bandit"] = bool(
            file_exists("bandit.yaml") or 
            file_exists(".bandit") or 
            "[tool.bandit]" in pyproj
        )
        # Semgrep
        checks["CodeQuality: Semgrep"] = bool(
            file_exists("semgrep.yaml") or 
            file_exists(".semgrep.yaml") or 
            any_path_matches(r"^\.semgrep/")
        )
        # Pyupgrade
        checks["CodeQuality: Pyupgrade"] = bool(
            "pyupgrade" in pre_commit or 
            "pyupgrade" in gitlab_ci
        )

        # =====================================================================
        # 5. Security Validation (15% weight, 4 checks)
        # =====================================================================
        log("Evaluating Category: Security Validation...")
        
        # Secret Scanning
        checks["Security: Secret Scanning"] = bool(
            "detect-secrets" in pre_commit or 
            "trufflehog" in pre_commit or 
            "gitleaks" in pre_commit or
            "secret_detection" in gitlab_ci or
            "gitleaks" in gitlab_ci or
            "trufflehog" in gitlab_ci
        )
        # Dependency Audit
        checks["Security: Dependency Audit"] = bool(
            "dependency_scanning" in gitlab_ci or
            "pip-audit" in gitlab_ci or
            "safety" in gitlab_ci or
            "npm audit" in gitlab_ci or
            "poetry check" in gitlab_ci or
            "audit" in gitlab_ci or
            "npm-audit" in gitlab_ci or
            "audit" in pre_commit
        )
        # Static Security Analysis (SAST)
        checks["Security: Static Security"] = bool(
            "sast" in gitlab_ci or
            "bandit" in gitlab_ci or
            "semgrep" in gitlab_ci or
            "sonarqube" in gitlab_ci or
            checks["CodeQuality: Bandit"] or
            checks["CodeQuality: Semgrep"]
        )
        # Security Policy
        has_sec_policy = bool(
            file_exists(".gitlab/security-policies/policy.yml") or 
            file_exists(".gitlab-security-policies.yml") or
            file_exists(".gitlab/security-policies.yml")
        )
        checks["Security: Security Policy"] = has_sec_policy
        if not has_sec_policy:
            missing_files.append(".gitlab/security-policies/policy.yml")

        # =====================================================================
        # 6. Testing Validation (10% weight, 5 checks)
        # =====================================================================
        log("Evaluating Category: Testing Validation...")
        
        # Presence of tests folder
        has_tests_folder = any_path_matches(r"^(tests?|specs?)/")
        checks["Testing: Tests Folder"] = has_tests_folder
        if not has_tests_folder:
            missing_files.append("tests/")
            
        # Unit Tests
        checks["Testing: Unit Tests"] = any_path_matches(r"test_.*\.py$|.*_test\.py$|.*\.test\.(js|ts|jsx|tsx)$|.*\.spec\.(js|ts|jsx|tsx)$")
        
        # Integration Tests
        checks["Testing: Integration Tests"] = any_path_matches(r"integration")
        
        # Coverage Configuration
        has_cov_config = bool(
            file_exists(".coveragerc") or 
            "[tool.coverage]" in pyproj or
            "[coverage]" in setup_cfg or
            "coverageThreshold" in contents.get("package.json", "")
        )
        checks["Testing: Coverage Config"] = has_cov_config
        if not has_cov_config:
            missing_files.append(".coveragerc")
            
        # Coverage Threshold
        has_threshold = False
        if has_cov_config:
            coveragerc = contents.get(".coveragerc", "")
            if "fail_under" in coveragerc or "fail_under" in pyproj or "coverageThreshold" in contents.get("package.json", ""):
                has_threshold = True
        checks["Testing: Coverage Threshold"] = has_threshold

        # =====================================================================
        # 7. CI/CD Validation (10% weight, 4 checks)
        # =====================================================================
        log("Evaluating Category: CI/CD Validation...")
        
        # .gitlab-ci.yml
        has_gitlab_ci = file_exists(".gitlab-ci.yml")
        checks["CI/CD: .gitlab-ci.yml"] = has_gitlab_ci
        if not has_gitlab_ci:
            missing_files.append(".gitlab-ci.yml")
            
        # Pre-commit config
        has_pre_commit = file_exists(".pre-commit-config.yaml")
        checks["CI/CD: Pre-commit Hooks"] = has_pre_commit
        if not has_pre_commit:
            missing_files.append(".pre-commit-config.yaml")
            
        # Automated Changelog Generation
        checks["CI/CD: Automated Changelog"] = bool(
            "release-please" in gitlab_ci or
            "semantic-release" in gitlab_ci or
            "towncrier" in gitlab_ci or
            file_exists("release-please-config.json") or
            file_exists(".releaserc") or
            file_exists(".releaserc.json") or
            file_exists(".releaserc.yml")
        )
        
        # Deployment pipelines
        checks["CI/CD: Deployment Pipelines"] = bool(
            "deploy" in gitlab_ci or
            "pages" in gitlab_ci or
            "publish" in gitlab_ci or
            "production" in gitlab_ci or
            "staging" in gitlab_ci
        )

        # =====================================================================
        # 8. Spec-Driven Development Validation (5% weight, 6 checks)
        # =====================================================================
        log("Evaluating Category: Spec-Driven Development Validation...")
        
        checks["SpecKit: .specify Directory"] = any_path_matches(r"^\.specify/")
        
        has_constitution = file_exists(".specify/constitution.md") or file_exists("constitution.md")
        checks["SpecKit: constitution.md"] = has_constitution
        if not has_constitution:
            missing_files.append(".specify/constitution.md")
            
        checks["SpecKit: Spec Templates"] = file_exists(".specify/templates/spec.md") or any_path_matches(r"^\.specify/.*spec.*\.md$")
        checks["SpecKit: Plan Templates"] = file_exists(".specify/templates/plan.md") or any_path_matches(r"^\.specify/.*plan.*\.md$")
        checks["SpecKit: Task Templates"] = file_exists(".specify/templates/task.md") or any_path_matches(r"^\.specify/.*task.*\.md$")
        
        has_specs_dir = file_exists("specs") or any_path_matches(r"^specs/") or any_path_matches(r"^\.specify/specs/")
        checks["SpecKit: specs Directory"] = has_specs_dir
        if not has_specs_dir:
            missing_files.append("specs/")

        # =====================================================================
        # Calculate Scoring Engine
        # =====================================================================
        log("Calculating compliance scores...")
        
        # Calculate Category Scores
        category_checks = {
            "Metadata": [c for c in checks if c.startswith("Metadata:")],
            "Documentation": [c for c in checks if c.startswith("Documentation:")],
            "Health": [c for c in checks if c.startswith("Health:")],
            "CodeQuality": [c for c in checks if c.startswith("CodeQuality:")],
            "Security": [c for c in checks if c.startswith("Security:")],
            "Testing": [c for c in checks if c.startswith("Testing:")],
            "CICD": [c for c in checks if c.startswith("CI/CD:")],
            "SpecKit": [c for c in checks if c.startswith("SpecKit:")]
        }
        
        cat_scores = {}
        for cat, clist in category_checks.items():
            passed = sum(1 for c in clist if checks[c])
            total = len(clist)
            cat_scores[cat] = (passed / total * 100) if total > 0 else 0.0

        # Weighted score: sum of (category_score * category_weight)
        weighted_score = sum(cat_scores[cat] * self.weights[cat] for cat in self.weights)
        
        # Simple stats
        passed_checks = sum(1 for c in checks.values() if c)
        total_checks = len(checks)
        
        # Round scores to 1 decimal place
        weighted_score = round(weighted_score, 1)
        for cat in cat_scores:
            cat_scores[cat] = round(cat_scores[cat], 1)

        # Risk Level Assessment
        if weighted_score < 40:
            risk_level = "Critical"
        elif weighted_score < 60:
            risk_level = "High"
        elif weighted_score < 80:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        log(f"Scan complete! Final score: {weighted_score}%, Risk level: {risk_level}")

        return {
            "score": weighted_score,
            "risk_level": risk_level,
            "category_scores": cat_scores,
            "checks_passed": passed_checks,
            "checks_failed": total_checks - passed_checks,
            "checks_total": total_checks,
            "details": checks,
            "missing_files": missing_files
        }

compliance_checker = ComplianceChecker()
