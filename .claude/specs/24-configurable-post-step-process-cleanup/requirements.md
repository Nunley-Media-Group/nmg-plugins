# Requirements: Configurable Post-Step Process Cleanup

**Issue**: #24
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude (from issue by rnunley-nmg)

---

## User Story

**As an** OpenClaw agent operator
**I want** the SDLC runner to programmatically clean up orphaned processes after each step
**So that** processes spawned by Claude subprocesses (e.g., headed Chrome instances) don't accumulate and exhaust host resources

---

## Background

The SDLC runner (`openclaw/scripts/sdlc-runner.mjs`) orchestrates `claude -p` subprocesses that may spawn external processes like headed Chrome browsers during implementation and verification. Currently, cleanup of these processes relies entirely on advisory steering instructions to the AI — but when steps timeout, fail, or the AI doesn't get to cleanup, those processes are orphaned. The runner has no post-step cleanup mechanism. Over multiple cycles, this leads to dozens of zombie processes consuming memory and CPU.

Key code paths with no cleanup today: normal completion, timeout (kills Claude subprocess only, not its process tree), failure handling (focuses on retries), escalation (cleans up git state only), and graceful shutdown (kills current Claude subprocess only).

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Configurable Process Cleanup Patterns

**Given** a config file with a `cleanup.processPatterns` array (e.g., `["chrome", "chromium"]`)
**When** the runner loads the config
**Then** it stores the patterns for use in post-step cleanup

**Example**:
- Given: `sdlc-config.json` contains `{ "cleanup": { "processPatterns": ["chrome", "chromium"] } }`
- When: the runner parses the config at startup
- Then: the patterns `["chrome", "chromium"]` are available for cleanup operations

### AC2: Post-Step Cleanup Runs After Every Step

**Given** a step completes (success or failure) and process patterns are configured
**When** the runner transitions between steps
**Then** it kills any running processes matching the configured patterns before starting the next step

**Example**:
- Given: patterns `["chrome"]` are configured and a Chrome process is running after step 3
- When: step 3 completes and the runner prepares step 4
- Then: the Chrome process is killed before step 4 begins

### AC3: Cleanup Runs on Escalation

**Given** an escalation is triggered and process patterns are configured
**When** the runner escalates
**Then** it kills matching processes before returning to main or exiting

**Example**:
- Given: patterns `["chrome"]` are configured and Chrome is running
- When: a step fails and triggers escalation
- Then: Chrome processes are killed as part of escalation handling

### AC4: Cleanup Runs on Graceful Shutdown

**Given** the runner receives SIGTERM/SIGINT and process patterns are configured
**When** it performs graceful shutdown
**Then** it kills matching processes before exiting

**Example**:
- Given: patterns `["chrome"]` are configured and Chrome is running
- When: the operator sends SIGTERM to the runner
- Then: Chrome processes are killed before the runner exits

### AC5: Cleanup Is Optional and Backward-Compatible

**Given** a config file without `cleanup.processPatterns`
**When** the runner runs normally
**Then** no cleanup is performed and behavior is identical to the current version

**Example**:
- Given: `sdlc-config.json` has no `cleanup` field
- When: a step completes
- Then: no process cleanup occurs and the runner proceeds as before

### AC6: Cleanup Logs Actions

**Given** cleanup kills one or more processes
**When** the cleanup completes
**Then** the runner logs which processes were killed and how many

**Example**:
- Given: patterns `["chrome"]` are configured and 3 Chrome processes are running
- When: post-step cleanup runs
- Then: the log shows something like `[CLEANUP] Killed 3 processes matching "chrome"`

### Generated Gherkin Preview

```gherkin
Feature: Configurable Post-Step Process Cleanup
  As an OpenClaw agent operator
  I want the SDLC runner to clean up orphaned processes after each step
  So that spawned processes don't accumulate and exhaust host resources

  Scenario: Configurable process cleanup patterns
    Given a config file with a "cleanup.processPatterns" array
    When the runner loads the config
    Then it stores the patterns for use in post-step cleanup

  Scenario: Post-step cleanup runs after every step
    Given a step completes and process patterns are configured
    When the runner transitions between steps
    Then it kills any running processes matching the configured patterns

  Scenario: Cleanup runs on escalation
    Given an escalation is triggered and process patterns are configured
    When the runner escalates
    Then it kills matching processes before returning to main or exiting

  Scenario: Cleanup runs on graceful shutdown
    Given the runner receives SIGTERM/SIGINT and process patterns are configured
    When it performs graceful shutdown
    Then it kills matching processes before exiting

  Scenario: Cleanup is optional and backward-compatible
    Given a config file without "cleanup.processPatterns"
    When the runner runs normally
    Then no cleanup is performed and behavior is identical to current

  Scenario: Cleanup logs actions
    Given cleanup kills one or more processes
    When the cleanup completes
    Then the runner logs which processes were killed and how many
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Add `cleanup.processPatterns` config field (array of process name patterns) | Should | New optional section in config schema |
| FR2 | Implement `cleanupProcesses()` function that kills processes matching configured patterns | Should | Uses cross-platform process killing |
| FR3 | Run cleanup after every step completion (success and failure paths) | Should | Insert into post-step logic |
| FR4 | Run cleanup during escalation handling | Should | Before escalation exit/return |
| FR5 | Run cleanup during graceful shutdown (SIGTERM/SIGINT) | Should | Before process exit |
| FR6 | Log cleanup actions (process names, count killed) | Should | Use existing logging conventions |
| FR7 | No-op when `cleanup` is not configured (backward-compatible) | Must | Guard all cleanup calls |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Cleanup should complete in < 5 seconds; must not delay step transitions significantly |
| **Reliability** | Cleanup failures must not crash the runner or prevent the next step from starting |
| **Platforms** | Must work on macOS and Linux (the two platforms OpenClaw runs on) |
| **Security** | Only kill processes matching user-configured patterns; never kill system processes |

---

## Dependencies

### Internal Dependencies
- [ ] `openclaw/scripts/sdlc-runner.mjs` — the file being modified

### External Dependencies
- [ ] OS process listing/killing commands (`pkill` or equivalent)

### Blocked By
- None

---

## Out of Scope

- Process group / cgroup-based tree killing (too platform-specific for now)
- Cleanup of non-process resources (temp files, ports, etc.)
- Discord reporting of cleanup actions (just log locally)
- Automatic detection of what to clean up — must be explicitly configured
- Windows support for process cleanup (OpenClaw currently targets macOS/Linux)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Orphaned process count after multi-step run | 0 matching processes remain | Check `pgrep` after a full SDLC cycle |
| Backward compatibility | Existing configs work without changes | Run with config lacking `cleanup` field |

---

## Open Questions

- [x] Should cleanup use `pkill -f` (pattern match against full command line) or just process name? — Issue specifies `pkill -f`, using pattern matching
- [ ] Should there be a configurable grace period (SIGTERM then SIGKILL) or just force-kill immediately?

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states specified
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
