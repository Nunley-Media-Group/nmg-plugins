# Defect Report: SDLC runner not deleting auto-mode on exit

**Issue**: #17
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `.claude/specs/11-automation-mode-support/`

---

## Reproduction

### Steps to Reproduce

1. Configure the SDLC runner with a valid `sdlc-config.json`
2. Start the runner: the runner creates `.claude/auto-mode` in the target project
3. Let it process at least one cycle, or stop it via SIGTERM/SIGINT
4. Observe that `.claude/auto-mode` still exists in the target project directory
5. Run any SDLC skill manually (e.g., `/writing-specs`, `/creating-issues`)
6. Interactive prompts (interviews, review gates, plan mode) are silently skipped

### Environment

| Factor | Value |
|--------|-------|
| **Component** | `openclaw/scripts/sdlc-runner.mjs` |
| **Version** | Current (`main` branch) |
| **Runtime** | Node.js v24+ (ESM) |
| **Configuration** | Any valid SDLC runner config targeting a project with `.claude/` directory |

### Frequency

Always — 100% reproducible on every exit path.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | When the SDLC runner stops for any reason, `.claude/auto-mode` is deleted so subsequent manual skill usage works interactively |
| **Actual** | `.claude/auto-mode` persists after runner exit on all five exit paths: graceful shutdown (SIGTERM/SIGINT), escalation, no-more-issues completion, fatal crash, and single-step mode exit |

### Error Output

No error output — the bug is a silent omission. The symptom is that SDLC skills skip interactive prompts without warning.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Auto-mode cleaned up on graceful shutdown

**Given** the SDLC runner is running with `.claude/auto-mode` present in the target project
**When** the runner receives SIGTERM or SIGINT
**Then** the `.claude/auto-mode` file is deleted before the process exits

### AC2: Auto-mode cleaned up on escalation

**Given** the SDLC runner escalates due to exhausted retries or an unrecoverable error
**When** the escalation handler completes
**Then** the `.claude/auto-mode` file is deleted in the target project

### AC3: Auto-mode cleaned up when no issues remain

**Given** the SDLC runner finds no more open issues in the project
**When** the runner exits the main loop
**Then** the `.claude/auto-mode` file is deleted

### AC4: Auto-mode cleaned up on fatal crash

**Given** the SDLC runner encounters an unhandled exception
**When** the fatal error handler runs
**Then** the `.claude/auto-mode` file is deleted (best effort)

### AC5: Auto-mode cleaned up on single-step exit

**Given** the SDLC runner is invoked in single-step mode
**When** the single step completes (success or failure)
**Then** the `.claude/auto-mode` file is deleted before the process exits

### AC6: No regression — auto-mode still active during execution

**Given** the SDLC runner is actively processing steps
**When** a skill is invoked via `claude -p` subprocess
**Then** `.claude/auto-mode` still exists and the skill operates in headless mode

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Delete `.claude/auto-mode` on all runner exit paths (graceful shutdown, escalation, completion, crash, single-step) | Must |
| FR2 | Centralize cleanup in a single helper function to avoid missing future exit paths | Should |
| FR3 | Cleanup must be best-effort and non-fatal — never mask the original exit reason | Must |

---

## Out of Scope

- Changing how auto-mode is created (the runner should still create it on startup)
- Modifying how skills detect auto-mode (flag-file approach is correct)
- Adding auto-mode cleanup to the `running-sdlc` SKILL.md `stop` command (the runner's own exit paths should handle it)
- Refactoring exit paths beyond adding the cleanup call

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC6)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
