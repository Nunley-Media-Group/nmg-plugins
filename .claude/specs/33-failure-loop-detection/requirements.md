# Requirements: Failure Loop Detection and Halt

**Issue**: #33
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude

---

## User Story

**As a** developer relying on OpenClaw for autonomous SDLC execution
**I want** the runner to detect failure loops and halt with a detailed Discord report
**So that** wasted compute is minimized and I get actionable diagnostics instead of silent infinite loops

---

## Background

The SDLC runner (`sdlc-runner.mjs`) orchestrates `claude -p` subprocess invocations in a continuous `while (!shuttingDown)` loop. Per-step retry logic with escalation exists, but the outer loop has no failure cap. After an escalation, the runner immediately picks up the next (or same) issue and can fail again, creating unbounded failure loops. Three distinct patterns can occur: consecutive escalations across issues, repeatedly failing on the same issue, and step-back bouncing within a single cycle. This feature adds detection and halting for all three patterns.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Consecutive Escalation Detection — Runner Halts After 2 Back-to-Back Escalations

**Given** the runner is in continuous loop mode processing open issues
**When** 2 consecutive cycles result in escalation without any successful cycle completion in between
**Then** the runner posts a detailed failure-loop diagnostic to Discord and exits immediately with a non-zero exit code, leaving state as-is for manual inspection

**Example**:
- Given: Runner starts, picks issue #10, escalates at step 5; loops, picks issue #11, escalates at step 3
- When: Second consecutive escalation completes
- Then: Runner posts "FAILURE LOOP DETECTED: 2 consecutive escalations (issues #10, #11)..." to Discord and calls `process.exit(1)`

### AC2: Same-Issue Loop Detection — Runner Skips Previously-Escalated Issues

**Given** an issue caused an escalation in the current runner session
**When** the runner loops back and encounters the same issue as the next candidate
**Then** the runner skips that issue and selects the next open issue; if all remaining issues have been escalated, the runner halts with a Discord report and non-zero exit

**Example**:
- Given: Issue #10 escalated; runner loops and `/starting-issues` would select #10 again
- When: Runner detects #10 is in the escalated set
- Then: Runner skips #10 and attempts the next open issue; if only #10 remains, runner halts

### AC3: Step Bounce Loop Detection — Runner Halts on Excessive Step-Back Transitions

**Given** a cycle is in progress and steps are bouncing back via `retry-previous`
**When** the total number of step-back transitions within a single cycle exceeds `maxRetriesPerStep` (default 3)
**Then** the runner escalates the current cycle, posts a bounce-loop diagnostic to Discord, and exits immediately with non-zero exit code

**Example**:
- Given: Step 5 fails precondition, retries step 4; step 5 fails again, retries step 4; repeats
- When: 4th step-back transition occurs (exceeding default threshold of 3)
- Then: Runner escalates with "BOUNCE LOOP DETECTED: 4 step-back transitions in cycle for issue #10..."

### AC4: Discord Report Contains Actionable Diagnostics

**Given** any failure loop is detected (consecutive escalation, same-issue, or step bounce)
**When** the runner posts the halt notification to Discord
**Then** the message includes: loop type detected, affected issue number(s), step(s) involved, total escalation count, and the last 500 characters of subprocess output

**Example**:
- Given: Consecutive escalation loop detected
- When: Discord message is posted
- Then: Message contains "FAILURE LOOP DETECTED: consecutive escalations", issue numbers, step numbers, escalation counts, and truncated output

### AC5: State Preserved for Manual Inspection

**Given** a failure loop halt is triggered
**When** the runner exits
**Then** `sdlc-state.json` is NOT reset, `.claude/auto-mode` is NOT removed, the working tree is left as-is, and the branch is NOT changed — allowing manual inspection of the failure state

**Example**:
- Given: Bounce loop detected on branch `10-add-feature`
- When: Runner exits with code 1
- Then: `sdlc-state.json` contains the last step/retry info, `.claude/auto-mode` still exists, git branch remains `10-add-feature`

### Generated Gherkin Preview

```gherkin
Feature: Failure Loop Detection and Halt
  As a developer relying on OpenClaw for autonomous SDLC execution
  I want the runner to detect failure loops and halt with a detailed Discord report
  So that wasted compute is minimized and I get actionable diagnostics

  Scenario: Consecutive escalation detection halts runner
    Given the runner is in continuous loop mode processing open issues
    When 2 consecutive cycles result in escalation
    Then the runner posts a failure-loop diagnostic to Discord
    And the runner exits with a non-zero exit code
    And sdlc-state.json is not reset

  Scenario: Same-issue loop detection skips escalated issues
    Given an issue caused an escalation in the current runner session
    When the runner encounters the same issue as the next candidate
    Then the runner skips that issue and selects the next open issue

  Scenario: All issues escalated halts runner
    Given all remaining open issues have been escalated in this session
    When the runner attempts to select the next issue
    Then the runner halts with a Discord report and non-zero exit

  Scenario: Step bounce loop detection halts runner
    Given a cycle is in progress with step-back bouncing
    When step-back transitions exceed maxRetriesPerStep
    Then the runner escalates the current cycle
    And posts a bounce-loop diagnostic to Discord
    And exits with non-zero exit code

  Scenario: Discord report contains actionable diagnostics
    Given any failure loop is detected
    When the runner posts the halt notification to Discord
    Then the message includes loop type, issue numbers, steps, escalation count, and last 500 chars of output

  Scenario: State preserved for manual inspection on halt
    Given a failure loop halt is triggered
    When the runner exits
    Then sdlc-state.json is not reset
    And .claude/auto-mode is not removed
    And the working tree is left as-is
    And the branch is not changed
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Track consecutive escalation count across cycles; halt at 2 | Must | Counter resets on successful cycle completion |
| FR2 | Track escalated issue numbers in-session; skip them on re-encounter | Must | In-memory set, not persisted to state file |
| FR3 | Track step-back transition count per cycle; halt when exceeding `maxRetriesPerStep` | Must | Counter resets at the start of each new cycle |
| FR4 | Post detailed diagnostic to Discord on any failure-loop halt | Must | Include loop type, issue numbers, steps, escalation count, last 500 chars of output |
| FR5 | Exit with non-zero code on failure-loop halt, preserving all state | Must | No state reset, no auto-mode removal, no branch checkout |
| FR6 | Reset consecutive escalation counter on any successful cycle completion | Should | A successful merge (step 9) resets the counter |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Tracking adds negligible overhead — in-memory counters and sets only |
| **Reliability** | Halt behavior must be deterministic — same failure pattern always produces same halt |
| **Platforms** | Must work on macOS, Windows, and Linux (Node.js script, cross-platform) |
| **Backwards Compatibility** | Existing behavior unchanged when no failure loops occur; thresholds use existing config values |

---

## UI/UX Requirements

Reference `structure.md` and `product.md` for project-specific design standards.

| Element | Requirement |
|---------|-------------|
| **Interaction** | [Touch targets, gesture requirements] |
| **Typography** | [Minimum text sizes, font requirements] |
| **Contrast** | [Accessibility contrast requirements] |
| **Loading States** | [How loading should be displayed] |
| **Error States** | [How errors should be displayed] |
| **Empty States** | [How empty data should be displayed] |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| [field] | [type] | [rules] | Yes/No |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| [field] | [type] | [what it represents] |

---

## Dependencies

### Internal Dependencies
- [x] Existing escalation logic in `sdlc-runner.mjs` (the `escalate()` function)
- [x] Existing `retry-previous` logic in the main loop
- [x] Existing `postDiscord()` function for status reporting

### External Dependencies
- [x] OpenClaw Discord integration (`openclaw message send`)

### Blocked By
- None

---

## Out of Scope

- Configurable thresholds (consecutive escalation limit, bounce limit) — hardcode sensible defaults for now
- Auto-recovery strategies (e.g., automatically closing problematic issues)
- Alerting channels beyond Discord (email, Slack, etc.)
- Changes to per-step retry logic or escalation patterns
- Persisting failure-loop tracking to `sdlc-state.json` (in-memory only for this release)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Failure loop halts | Runner never exceeds 2 consecutive escalations | Observe runner logs during automated cycles |
| Same-issue avoidance | Previously-escalated issues are never re-attempted in same session | Runner logs show skip messages |
| Diagnostic quality | Discord reports are actionable without checking server logs | Manual review of Discord halt messages |

---

## Open Questions

- None — all requirements are well-defined in the issue

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
