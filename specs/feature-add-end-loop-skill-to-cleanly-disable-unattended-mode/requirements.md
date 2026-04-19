# Requirements: /end-loop Skill

**Issues**: #122
**Date**: 2026-04-18
**Status**: Draft
**Author**: Claude Code

---

## User Story

**As a** developer running the SDLC runner
**I want** a single command that stops unattended mode and clears runner state
**So that** I can return to interactive work without manually hunting for stale artifacts (trigger flag, state file, or an orphaned runner process)

---

## Background

The SDLC runner is enabled by the presence of `.claude/unattended-mode` and tracks progress via `.claude/sdlc-state.json` (see `scripts/sdlc-runner.mjs`). When a developer wants to exit the loop mid-cycle, or when the runner crashes and leaves stale artifacts behind, there is no first-class way to clean up. Today it is a manual `rm` of two files and (if unlucky) a `kill <pid>` against whatever the last `runnerPid` was.

This spec adds `/end-loop` as the explicit counterpart to `/run-loop` — one command that tears down unattended mode safely and reports what it did. The skill mirrors the existing `removeUnattendedMode()` helper semantics in `scripts/sdlc-runner.mjs` and extends it to the state file and the running process.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Happy Path — both artifacts exist, runner is live

**Given** `.claude/unattended-mode` and `.claude/sdlc-state.json` both exist, and `sdlc-state.json` contains a `runnerPid` pointing at a live process
**When** the user runs `/end-loop`
**Then** the skill sends SIGTERM to the runner PID, deletes both files, and reports a summary listing the removed files and the signalled PID

**Example**:
- Given: `.claude/unattended-mode` exists; `.claude/sdlc-state.json` contains `{"runnerPid": 12345, ...}` and PID 12345 is alive
- When: `/end-loop` is invoked
- Then: SIGTERM is sent to 12345; both files are removed; output reads `Signalled runner PID 12345; removed .claude/unattended-mode, .claude/sdlc-state.json`

### AC2: Already Disabled — no artifacts present

**Given** neither `.claude/unattended-mode` nor `.claude/sdlc-state.json` exists
**When** the user runs `/end-loop`
**Then** the skill reports "unattended mode already disabled — nothing to do" and exits 0

### AC3: Dead Runner PID

**Given** `.claude/sdlc-state.json` contains a `runnerPid` for a process that no longer exists
**When** the user runs `/end-loop`
**Then** the SIGTERM attempt is skipped silently (dead-PID detection must not raise an error), and both files are still deleted

### AC4: No `.claude` Directory

**Given** the project has no `.claude/` directory at all
**When** the user runs `/end-loop`
**Then** the skill reports "not a runner project — no .claude directory found" and exits 0

### AC5: SIGTERM Failure on Live PID

**Given** `runnerPid` is live but SIGTERM fails (e.g., permission denied, cross-user process)
**When** the user runs `/end-loop`
**Then** the skill reports the PID and the failure reason clearly, then continues with file deletion

### AC6: Malformed state file

**Given** `.claude/sdlc-state.json` exists but contains invalid JSON (or is missing `runnerPid`)
**When** the user runs `/end-loop`
**Then** the skill treats the file as opaque, skips PID extraction without raising an error, and deletes both files

### AC7: Idempotent re-run

**Given** `/end-loop` has just completed successfully
**When** the user runs `/end-loop` again immediately
**Then** the skill reports "already disabled" per AC2 and exits 0 (no errors, no spurious warnings)

### AC8: Permission-denied on file deletion

**Given** `.claude/unattended-mode` exists but the current user lacks permission to delete it
**When** the user runs `/end-loop`
**Then** the skill surfaces a clear error identifying the specific file that failed and exits non-zero, so the developer can resolve the permission issue manually

### Generated Gherkin Preview

```gherkin
Feature: /end-loop Skill
  As a developer running the SDLC runner
  I want a single command that stops unattended mode and clears runner state
  So that I can return to interactive work without manually hunting for stale artifacts

  Scenario: Happy path — both artifacts exist, runner is live
    Given the unattended-mode flag and sdlc-state.json both exist
    And sdlc-state.json records a live runnerPid
    When /end-loop is invoked
    Then SIGTERM is sent to the runner PID
    And both artifacts are deleted
    And the output lists the signalled PID and removed files

  Scenario: Already disabled
    Given no runner artifacts exist
    When /end-loop is invoked
    Then the output reads "unattended mode already disabled — nothing to do"
    And the skill exits 0

  # ... all ACs become scenarios
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Delete `.claude/unattended-mode` and `.claude/sdlc-state.json` when present | Must | Matches `RUNNER_ARTIFACTS` in `scripts/sdlc-runner.mjs` |
| FR2 | Read `runnerPid` from `sdlc-state.json` and SIGTERM it before deletion if the process is live | Must | Dead-PID detection must be silent |
| FR3 | Operate idempotently — safe to run multiple times with no error | Must | Second run should report "already disabled" |
| FR4 | Use OS-agnostic path joins; no hardcoded platform separators | Must | Skill runs on macOS, Windows, Linux |
| FR5 | Surface permission-denied errors identifying the specific file that failed | Must | Non-zero exit when a required deletion is blocked |
| FR6 | Mirror the delete-with-best-effort semantics of `sdlc-runner.mjs` `removeUnattendedMode()` | Should | Missing files are not errors |
| FR7 | Pair with `/run-loop` in naming and UX (start/stop wording symmetry in output) | Should | Reinforces the mental model |
| FR8 | Handle malformed `sdlc-state.json` by treating it as opaque — do not attempt `runnerPid` extraction | Must | Out of scope excludes parsing recovery; file is still deleted |
| FR9 | Continue with file deletion after SIGTERM failure | Must | Partial cleanup is preferable to no cleanup |
| FR10 | Skill is user-invocable and does not require arguments | Must | Matches `/run-loop`'s no-argument form for symmetry |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Skill completes in under 2 seconds in the happy path (no network calls, no blocking waits beyond SIGTERM) |
| **Security** | Uses the invoking user's process permissions; does not escalate or bypass OS permission checks |
| **Accessibility** | N/A — command-line skill with plain-text output |
| **Reliability** | Idempotent; partial failure (e.g., SIGTERM denied) does not prevent the remaining cleanup steps |
| **Platforms** | macOS, Windows, Linux — reference `steering/tech.md` for cross-platform constraints |

---

## UI/UX Requirements

Command-line output only. Output must pair with `/run-loop` in tone and structure.

| Element | Requirement |
|---------|-------------|
| **Interaction** | Single invocation, no prompts, no flags required |
| **Typography** | Plain text; no ANSI color required (mirrors existing runner log output) |
| **Loading States** | N/A — operation is synchronous and fast |
| **Error States** | Errors report the specific file or PID that failed and the OS-level reason |
| **Empty States** | "Already disabled" message when there is nothing to clean up |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| `.claude/unattended-mode` (file presence) | file | Existence check | No — absence is a valid state |
| `.claude/sdlc-state.json` (file contents) | JSON object | Attempt to parse; fall back to opaque deletion | No — absence is a valid state |
| `runnerPid` (field within state file) | integer | Must be a positive integer to attempt SIGTERM | No — missing or malformed means skip SIGTERM |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| Summary line | stdout text | Lists removed files and signalled PID (happy path) or "already disabled" (empty path) |
| Error messages | stderr text | Specific file path and OS-level reason when a cleanup step fails |
| Exit code | integer | 0 on success or "already disabled"; non-zero when a required deletion fails |

---

## Dependencies

### Internal Dependencies
- [ ] `RUNNER_ARTIFACTS` path convention from `scripts/sdlc-runner.mjs:552`
- [ ] Existing `removeUnattendedMode()` semantics from `scripts/sdlc-runner.mjs:600`

### External Dependencies
- [ ] Node.js process signalling (`process.kill(pid, 0)` for liveness check, `process.kill(pid, 'SIGTERM')` for termination) — already available in the runner's runtime

### Blocked By
- None

---

## Out of Scope

Explicitly list what this feature does NOT include:

- Git state cleanup (no branch checkout, no stash, no discard)
- PR state, issue status, or milestone changes
- Log file rotation or archiving
- Recovering data from a malformed `sdlc-state.json` — if unparseable, the file is deleted as opaque
- Config file (`sdlc-config.json`) — not touched
- SIGKILL escalation — SIGTERM only; if the process resists termination, that is the developer's problem to resolve manually
- Waiting for the signalled process to actually exit — SIGTERM is fire-and-forget

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Clean teardown success rate | 100% in happy path | Exercise test: create fake artifacts + live PID, run `/end-loop`, assert files gone and signal sent |
| Idempotency | No error on repeated invocation | Exercise test: run `/end-loop` twice consecutively, assert second run exits 0 with "already disabled" |
| Cross-platform compatibility | Passes on macOS, Linux | Exercise test on both platforms via CI or manual verification |

---

## Open Questions

- [ ] None at this time — the issue is scoped tightly enough to proceed.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #122 | 2026-04-18 | Initial feature spec |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC3, AC5, AC6, AC8)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
