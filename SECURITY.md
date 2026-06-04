# Security Policy (SECURITY.md)

We take the security of the Smart Waste Management Platform seriously. This document outlines our policy regarding security reporting, vulnerability management, and scanning standards.

## Supported Versions

Only the latest active release branch receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please do **NOT** open a public issue. Instead, report it directly to our security team:

*   Email: `security@smartwaste-management.example.com`
*   GPG Key: [Link to public key if applicable]

Please include:
1.  A detailed description of the vulnerability.
2.  Steps to reproduce (a proof of concept).
3.  Potential impact and exploit scenarios.

We will acknowledge receipt within 48 hours and coordinate a public release date for a fix in accordance with responsible disclosure practices.

## Secure Development Lifecycle (SDL)

Our codebase enforces several automated safeguards:

1.  **Secret Prevention**: Git commits are scanned locally by `gitleaks` and `trufflehog` to ensure no passwords or API keys are committed.
2.  **Dependency Auditing**: Automated dependency vulnerability sweeps run inside our GitLab pipelines.
3.  **Static Application Security Testing (SAST)**: Automated code scans utilizing `bandit` and `semgrep` analyze all Python files on every merge request.
