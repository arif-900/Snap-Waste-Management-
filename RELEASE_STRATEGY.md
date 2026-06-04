# Release Strategy & Tagging Workflow

This project adheres to **Semantic Versioning (SemVer)** (e.g., `vMAJOR.MINOR.PATCH`) to manage versioning and releases systematically.

## Release Version Stages

1.  **v1.0.0**: Initial stable production release of the Smart Waste Management Platform.
2.  **v1.1.0**: Feature update adding custom compliance tooling and local pytest configurations.
3.  **v1.2.0**: Secondary feature update refining formatters, strict typing, and Spec-Kit structures.
4.  **v2.0.0**: Major release containing breaking changes or complete architectural refactorings.

---

## GitLab Release Tag Commands

To tag a release and push it to the remote repository, execute the following commands in your shell:

### 1. Create a Tag Locally
Specify an annotated tag containing the release summary message:
```bash
git tag -a v1.0.0 -m "Initial stable release"
```

### 2. Push the Tag to GitLab
Push the newly created tag to your GitLab remote repository (`origin`):
```bash
git push origin v1.0.0
```

---

## Standard Release Workflow

1.  **Branch Validation**: Ensure all features are merged into `main` and the CI/CD pipeline runs successfully.
2.  **Verify Changelog**: Update `CHANGELOG.md` with the new changes using conventional commits summaries.
3.  **Create Annotated Tag**: Execute `git tag -a vX.Y.Z -m "Release description"`.
4.  **Push to GitLab**: Run `git push origin vX.Y.Z`.
5.  **GitLab Release Page**: GitLab CI/CD will detect the tag and automatically build a corresponding release asset using the `.releaserc.json` configuration.
