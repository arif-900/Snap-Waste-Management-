# Agent Integration Guide (AGENTS.md)

This document outlines the guidelines, instructions, and context for AI coding agents (such as Antigravity, GitHub Copilot, and Gemini) operating within the Smart Waste Management Platform repository.

## Agent System Boundaries

When performing modifications or adding features to this codebase, AI agents must adhere to the following architectural boundaries:

1.  **Framework Standards**:
    *   **Frontend**: React (Vite) + Tailwind CSS. Refrain from writing pure vanilla CSS overrides in Components; use Tailwind utility classes.
    *   **Backend**: FastAPI (Python 3.10+). Follow standard asynchronous endpoint routines (`async def`) for I/O bound operations.
2.  **No Placeholders**: Never introduce dummy files, empty scripts, or comment blocks in place of production code.
3.  **Preservation of State**: Do not alter database migration history or existing mock databases (`compliance_db.json`) unless requested.

## Project Structure & Architecture

Agents should locate their updates according to this module structure:

```
SmartWaste/
├── backend/
│   ├── app/
│   │   ├── config.py           # Application Settings and Dotenv parsing
│   │   ├── main.py             # App routing and entry point
│   │   ├── schemas/            # Pydantic data schemas
│   │   └── services/           # Supabase, YOLO, Gemini, and GitLab logic
│   └── tests/                  # Pytest test cases
└── frontend/
    ├── src/
    │   ├── components/         # Reusable UI elements
    │   ├── pages/              # Main view screens (Dashboard, Citizen portal)
    │   └── App.jsx             # React routing setup
```

## Prompt Engineering & Instructions

Agents must prioritize the following operational workflows:

*   **Linting Compliance**: All Python scripts must be formatted with `ruff` and type-checked with `mypy` before marking a task complete.
*   **Security Context**: Ensure no API keys, tokens, or local `.env` values are hardcoded in source files. Check all environment references against `.env.example`.
*   **Verification Verification**: Run the target test suite (`pytest`) and verify that code changes preserve the overall pipeline health.
