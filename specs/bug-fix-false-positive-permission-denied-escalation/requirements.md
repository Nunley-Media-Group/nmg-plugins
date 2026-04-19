# Defect Report: False-positive "permission denied" substring match in SDLC runner escalation

**Issues**: #133
**Date**: 2026-04-18
**Status**: Draft
**Author**: Rich Nunley
**Severity**: High
**Related Spec**: `specs/feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code/`

---

## Reproduction

### Steps to Reproduce

1. Run the SDLC runner against any issue whose title, spec content, branch name, tool output, or event-stream message happens to contain the literal phrase "permission denied" (case-insensitive).
2. Observe the Claude subprocess complete with `permission_denials: []` in the stream-json `result` event.
3. `handleFailure()` concatenates `result.stdout + '\n' + result.stderr` (~250KB of stream-json events) and passes it to `matchErrorPattern()`.
4. `/permission denied/i` in `IMMEDIATE_ESCALATION_PATTERNS` matches the literal phrase somewhere in the event log.
5. `escalate()` is called immediately.
6. After two consecutive escalations on the same issue, `haltFailureLoop` exits the runner with code 1.

Recent real-world incident: issue #181 in the agentchrome repo, verify step. Logs at `/var/folders/46/dqllytqs0sg2xdfglxddcf500000gn/T/sdlc-logs/agentchrome/verify-*.log`.

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (Darwin 25.3.0) |
| **Version / Commit** | nmg-sdlc 6.0.0 / nmg-plugins main |
| **Runtime** | Node.js v24+ (runner invoked via `/run-loop` or `node scripts/sdlc-runner.mjs`) |
| **Configuration** | Any runner config; reproduces on any step whose subprocess output mentions the phrase |

### Frequency

Always — whenever the phrase appears in subprocess output while `permission_denials` is empty.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | The structured `permission_denials` array from the stream-json `result` event is the authoritative source of truth for permission-denial escalation. When that array is empty (or contains only benign/ephemeral entries), the runner does not escalate for permission reasons. |
| **Actual** | Any substring occurrence of "permission denied" in the concatenated stdout+stderr triggers immediate escalation via `IMMEDIATE_ESCALATION_PATTERNS`, even when `permission_denials: []`. |

### Error Output

```
Immediate escalation: matched pattern "permission denied"
Bounce loop / consecutive escalation → haltFailureLoop → exit 1
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Bug Is Fixed — No Escalation on Literal Phrase With Empty Denials

**Given** a Claude subprocess run whose stdout/stderr contains the literal text `permission denied` (case-insensitive, anywhere — in a spec, filename, tool-result payload, or nested error message)
**And** whose stream-json `result` event reports `permission_denials: []`
**When** `handleFailure()` processes the subprocess exit
**Then** the runner does not immediately escalate via `IMMEDIATE_ESCALATION_PATTERNS`
**And** normal failure-handling proceeds (idempotency check → precondition check → retry → soft-failure detection)

### AC2: No Regression — Real Permission Denials Still Escalate via Soft-Failure Path

**Given** a subprocess run whose stream-json `result` event reports a real non-benign entry in `permission_denials` (a denied tool that is not in `BENIGN_DENIED_TOOLS` and not an ephemeral tmpdir path)
**When** the step completes
**Then** `detectSoftFailure()` returns `{ isSoftFailure: true, reason: "permission_denials: …" }`
**And** the existing soft-failure escalation path handles it exactly as it does today (no behavior change for real denials)

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Remove `/permission denied/i` from `IMMEDIATE_ESCALATION_PATTERNS` at `scripts/sdlc-runner.mjs:1077-1082` | Must |
| FR2 | Add a regression test in `scripts/__tests__/sdlc-runner.test.mjs` covering AC1 (literal string in output, empty denials → no escalation) and AC2 (real non-benign denial → soft-failure escalation path fires) | Must |
| FR3 | Add a `[Unreleased]` CHANGELOG entry summarizing the fix and why it was needed | Must |

---

## Out of Scope

- Verify step `maxTurns` or any per-step `maxTurns` / `timeoutMin` bumps — tracked via amendment to issue #130
- Reviewer-prompt narrowing for the architecture-reviewer subagent
- Refactoring the broader escalation / soft-failure pipeline beyond removing this single pattern
- Removing the other `IMMEDIATE_ESCALATION_PATTERNS` entries (`context_window_exceeded`, `signal: 9`, `signal: SIGKILL`) — those remain valid text-based signals for unrecoverable subprocess failures

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #133 | 2026-04-18 | Initial defect spec |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
