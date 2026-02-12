# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.5.0] - 2026-02-11

### Added

- **`/starting-issues`** — New standalone skill: select a GitHub issue, create linked feature branch, set issue to In Progress
- **Automation hooks** — Four new hooks that let external agents (e.g., OpenClaw) drive the SDLC without human input, gated by a `.claude/auto-mode` flag file:
  - `PermissionRequest` → auto-allows all tool permissions
  - `PreToolUse` on `AskUserQuestion` → blocks questions and steers Claude to proceed with defaults
  - `PreToolUse` on `EnterPlanMode` → blocks plan mode and instructs Claude to plan internally
  - `Stop` → forces continuation when Claude would wait for free-form input (with loop prevention)
- **OpenClaw automation prompt** — Example prompt for driving the full SDLC cycle with an OpenClaw agent (`openclaw-automation-prompt.md`)

### Changed

- **`/beginning-dev`** — Now delegates issue selection and branch setup to `/starting-issues` instead of handling inline
- **README** — Added Automation Mode section documenting hooks, enable/disable, default behaviors, and OpenClaw example

## [1.3.1] - 2026-02-11

### Changed

- **`/beginning-dev`** — Added context compaction handoffs between phases (writing-specs, implementing-specs) to free context window for each phase

## [1.3.0] - 2026-02-10

### Changed

- **`/verifying-specs`** — No longer read-only; now fixes findings during verification before generating report
- **`/verifying-specs`** — Added `Write`, `Edit`, and `Bash(git:*)` to allowed tools
- **`/verifying-specs`** — Report restructured: "Issues Found" replaced with "Fixes Applied" and "Remaining Issues" sections
- **`/verifying-specs`** — New Step 6 (Fix Findings) with prioritization, test-after-fix, re-verification, and deferral workflow

## [1.2.1] - 2026-02-10

### Changed

- Updated README skills reference to match actual SKILL.md definitions and argument hints

### Fixed

- Spec alignment hook now returns expected `{ok, reason}` JSON format and references `$ARGUMENTS` for edit context

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
