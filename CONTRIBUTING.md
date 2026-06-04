# Contributing Guidelines

Thank you for contributing to the Smart Waste Management Platform! We welcome contributions from developers of all skill levels to help make urban waste management smarter, cleaner, and more efficient.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand our community standards.

## How to Contribute

### 1. Repository Setup

Clone the repository and install the dependencies for both backend and frontend:

#### Backend Setup (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

#### Frontend Setup (React + Vite + Tailwind)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### 2. Branching Model

We follow a structured Git branching workflow. Always branch off `main` for new work:

*   **Feature branches**: `feature/your-feature-name` for new features or additions.
*   **Bugfix branches**: `bugfix/issue-description` for resolving existing bugs.
*   **Hotfix branches**: `hotfix/critical-patch` for immediate production patches.
*   **Documentation**: `docs/update-description` for documentation improvements.

### 3. Commit Message Standards

We use the **Conventional Commits** specification. This enables automated versioning and changelog generation.

Format: `<type>(<scope>): <description>`

Common types:
*   `feat`: A new feature
*   `fix`: A bug fix
*   `docs`: Documentation changes
*   `style`: Code style changes (formatting, missing semi-colons, etc.)
*   `refactor`: Code changes that neither fix a bug nor add a feature
*   `perf`: Performance improvements
*   `test`: Adding missing tests or correcting existing tests
*   `chore`: Maintain tasks (e.g. updating configuration/dependencies)

Example:
```bash
git commit -m "feat(api): add waste analysis streaming support via SSE"
```

### 4. Code Quality & Pre-commit Hooks

Before submitting a Merge Request (MR), verify your code passes all local validation criteria:

1.  Initialize pre-commit hooks:
    ```bash
    pre-commit install
    ```
2.  Run checks manually:
    ```bash
    pre-commit run --all-files
    ```
3.  Ensure tests pass and coverage is at least 80%:
    ```bash
    pytest --cov=backend/app tests/
    ```

### 5. Merge Request Process

1.  Submit your Merge Request targeting the `main` branch.
2.  Provide a clear description of the changes in the MR template.
3.  Ensure all GitLab CI/CD pipelines pass successfully.
4.  Get approval from at least one reviewer before merging.
