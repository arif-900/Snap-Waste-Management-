# Repository Governance & Quality Standards

This document establishes the repository management policies, branch protections, merge request approval rules, and security guidelines for the Smart Waste Management Platform.

---

## 1. Branch Protection Policies

To safeguard our production system state, the `main` branch is protected:

*   **Restrict Force Pushing**: Force pushing (`git push -f`) is permanently blocked.
*   **Restrict Branch Deletion**: The `main` branch cannot be deleted.
*   **Restrict Direct Commits**: No commits may be made directly to `main`. All modifications must be submitted via Merge Requests (MRs).

---

## 2. Merge Request Approval Rules

To enforce coding quality standards, any Merge Request targeting `main` must meet these conditions:

1.  **Required Codeowner Approvals**:
    *   Changes to `/backend/` require approval from `@python-architect` or `@arif-900`.
    *   Changes to `/frontend/` require approval from `@frontend-lead` or `@arif-900`.
2.  **CI/CD Pipeline Success**:
    *   The complete validation, format, lint, typecheck, security, and test stages must pass successfully.
    *   MRs will be blocked if test coverage drops below **80%**.
3.  **Vulnerability Thresholds**:
    *   The `Critical Vulnerability Rule` defined in `.gitlab/security-policies/policy.yml` is active.
    *   Any critical or high finding flagged by Gitleaks, pip-audit, or Semgrep prevents merging unless explicitly approved by the security officer.

---

## 3. Release Lifecycle Strategy

Releases follow a formal conventional release workflow:

1.  **Tagging Rules**:
    *   Releases must be annotated using annotated tags (`git tag -a vX.Y.Z -m "Release message"`).
2.  **Semantic Versioning**:
    *   `MAJOR` (breaking changes), `MINOR` (features), `PATCH` (bug fixes).
3.  **Release Assets**:
    *   Upon tag push, the `.gitlab-ci.yml` pipeline triggers a release job creating compilation assets and package builds.
