# Tasks: Failure Loop Detection and Halt

**Issue**: #33
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [ ] |
| Backend | 5 | [ ] |
| Integration | 1 | [ ] |
| Testing | 1 | [ ] |
| **Total** | **8** | |

---

## Phase 1: Setup

### T001: Add in-memory failure loop tracking variables

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `consecutiveEscalations` variable declared as `let` with initial value `0`
- [ ] `escalatedIssues` variable declared as `const new Set()`
- [ ] `bounceCount` variable declared as `let` with initial value `0`
- [ ] Variables placed after config loading (after line ~79), before step definitions
- [ ] Variables are module-level (accessible to all functions)

**Notes**: These are intentionally NOT persisted to `sdlc-state.json`. In-memory only — a fresh runner process starts with clean counters.

---

## Phase 2: Backend Implementation

### T002: Implement `haltFailureLoop()` function

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify (add function)
**Depends**: T001
**Acceptance**:
- [ ] Function signature: `async function haltFailureLoop(loopType, details)`
- [ ] `details` is an array of strings
- [ ] Builds diagnostic message containing: loop type, details, consecutive escalation count, escalated issue list
- [ ] Calls `log()` with the diagnostic
- [ ] Calls `postDiscord()` with the diagnostic
- [ ] Calls `process.exit(1)` after Discord post
- [ ] Does NOT call `removeAutoMode()`, `updateState()`, or `git checkout main`
- [ ] Placed after the `escalate()` function

### T003: Modify `escalate()` to track failure loop metrics and check threshold

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001, T002
**Acceptance**:
- [ ] At the start of `escalate()`, before `cleanupProcesses()`:
  - Adds `state.currentIssue` to `escalatedIssues` (if non-null)
  - Increments `consecutiveEscalations`
- [ ] After incrementing, checks `if (consecutiveEscalations >= 2)`
- [ ] If threshold met: calls `haltFailureLoop('consecutive escalations', [...])` with affected issues, last step, reason, and truncated output
- [ ] If threshold NOT met: proceeds with existing `escalate()` logic unchanged
- [ ] Existing `escalate()` behavior (commit, checkout main, Discord, reset state, remove auto-mode) is preserved for below-threshold cases

### T004: Add bounce loop detection to `handleFailure()` retry-previous path

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001, T002
**Acceptance**:
- [ ] In `handleFailure()`, before the existing `return 'retry-previous'` (around line 738):
  - Increments `bounceCount`
  - Checks `if (bounceCount > MAX_RETRIES)`
- [ ] If threshold exceeded: calls `escalate()` with bounce loop reason, returns `'escalated'`
- [ ] If under threshold: proceeds with existing `return 'retry-previous'` behavior
- [ ] Log and Discord messages include bounce count and threshold for diagnostics

### T005: Add bounce loop detection to `runStep()` precondition retry-previous path

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001, T002
**Acceptance**:
- [ ] In `runStep()`, in the precondition failure block (around line 1021), before returning `'retry-previous'`:
  - Increments `bounceCount`
  - Checks `if (bounceCount > MAX_RETRIES)`
- [ ] If threshold exceeded: calls `escalate()` with bounce loop reason, returns `'escalated'`
- [ ] If under threshold: proceeds with existing retry-previous logic (increment per-step retry, update state)

### T006: Add `hasNonEscalatedIssues()` helper and modify step 2 prompt

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify (add function + modify `buildClaudeArgs`)
**Depends**: T001
**Acceptance**:
- [ ] `hasNonEscalatedIssues()` function: queries `gh issue list --state open --json number`, returns `true` if any issue is NOT in `escalatedIssues`; returns `true` on error (conservative fallback)
- [ ] In `buildClaudeArgs()` step 2 prompt: if `escalatedIssues.size > 0`, appends exclusion clause listing issue numbers to skip
- [ ] Placed after existing `hasOpenIssues()` function

---

## Phase 3: Integration

### T007: Modify main loop for cycle-level failure loop management

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002, T003, T004, T005, T006
**Acceptance**:
- [ ] At the start of each cycle (before the for-loop at line ~1223): `bounceCount = 0`
- [ ] Before entering the cycle: call `hasNonEscalatedIssues()` — if false, call `haltFailureLoop('all issues escalated', [...])`
- [ ] After step 2 succeeds and state is extracted: check if `state.currentIssue` is in `escalatedIssues` — if so, call `haltFailureLoop('all issues escalated', [...])`
- [ ] After step 9 succeeds (successful cycle completion): `consecutiveEscalations = 0`
- [ ] Existing main loop flow (for-loop, retry, escalation, skip) preserved for non-loop cases

---

## Phase 4: BDD Testing

### T008: Create Gherkin feature file for failure loop detection

**File(s)**: `.claude/specs/33-failure-loop-detection/feature.gherkin`
**Type**: Create
**Depends**: T007
**Acceptance**:
- [ ] All 5 acceptance criteria from `requirements.md` have corresponding scenarios
- [ ] Scenarios use Given/When/Then format
- [ ] Feature file is valid Gherkin syntax
- [ ] Includes scenarios for: consecutive escalation, same-issue skip, all-issues-escalated halt, bounce loop, Discord diagnostics, state preservation
- [ ] Uses concrete examples (issue numbers, step numbers, thresholds)

---

## Dependency Graph

```
T001 ──┬──▶ T002 ──┬──▶ T003
       │           ├──▶ T004
       │           └──▶ T005
       ├──▶ T006
       │
       └──▶ T007 (depends on T002–T006)
                    │
                    └──▶ T008
```

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T008 — Gherkin feature file)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
