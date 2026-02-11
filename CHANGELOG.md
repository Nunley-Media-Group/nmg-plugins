# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.2.0] - 2026-02-10

### Added

- **`/beginning-dev`** — Pick a GitHub issue to work on, then automatically chain through `/writing-specs` and `/implementing-specs`

### Fixed

- **`/beginning-dev`** — Now links the feature branch to the GitHub issue (via `gh issue develop`) and updates the issue status to "In Progress" in any associated GitHub Project

## [1.0.0] - 2026-02-10

### Added

- **nmg-sdlc plugin** — Stack-agnostic BDD spec-driven development toolkit
- **`/creating-issues`** — Interview user, create groomed GitHub issue with BDD acceptance criteria
- **`/writing-specs`** — Create requirements, design, and task specs from a GitHub issue (3-phase with human gates)
- **`/implementing-specs`** — Read specs, enter plan mode, execute implementation tasks sequentially
- **`/verifying-specs`** — Verify implementation against spec, architecture review, update GitHub issue with evidence
- **`/creating-prs`** — Create pull request with spec-driven summary linking issue and specs
- **`/setting-up-steering`** — One-time codebase scan to generate product, tech, and structure steering documents
- **architecture-reviewer agent** — SOLID, security, performance, testability, error handling evaluation
- **Verification checklists** — SOLID principles, security (OWASP), performance, testability, error handling, report template
- **Spec templates** — Requirements, design, tasks, and Gherkin feature file templates
- **Steering templates** — Product, tech, and structure templates for project bootstrapping
- **Spec alignment hook** — PostToolUse hook that checks file modifications against active specs
