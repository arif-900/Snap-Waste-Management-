# Smart Waste Project Constitution

This document defines the core architecture, coding rules, and development standards that must be adhered to at all times.

## Architectural Principles

1.  **Strict Separation of Concerns**:
    *   **Frontend**: Built with React (Vite) + Tailwind CSS. Must remain stateless where possible, deferring logic to backend APIs.
    *   **Backend**: FastAPI (Python 3.10+). Handles validation, calculations, external APIs (Gemini, Supabase), and object detection (YOLO).
2.  **Stateless API Contracts**:
    *   All backend paths under `/api/v1` must follow RESTful standards and return standard JSON formats.
3.  **Local Development Fallbacks**:
    *   External services (like Supabase or Gemini API) must have local file fallback mechanisms (e.g., `compliance_db.json` for storage) to ensure full offline capabilities during development.

## Quality Standards

1.  **Testing Policy**:
    *   All new backend endpoints must have corresponding integration tests inside `tests/integration/`.
    *   The minimum coverage threshold is set to **80%**, enforced automatically in CI/CD pipeline steps.
2.  **Linting & Style Checks**:
    *   All Python code must adhere to Ruff, Black, and Mypy strict settings. No commit is allowed to proceed without clean validation reports.
