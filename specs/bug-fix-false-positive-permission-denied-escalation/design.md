# Root Cause Analysis: False-positive "permission denied" substring match in SDLC runner escalation

**Issues**: #133
**Date**: 2026-04-18
**Status**: Draft
**Author**: Rich Nunley

---

## Root Cause

The SDLC runner has two parallel mechanisms for detecting permission denials, and they disagree on semantics:

1. **Legacy text-pattern matcher** (`IMMEDIATE_ESCALATION_PATTERNS`, `scripts/sdlc-runner.mjs:1077-1082`) — a regex list that is substring-matched against the concatenated raw stdout+stderr of the Claude subprocess (`~250KB` of stream-json events). Any hit triggers immediate hard escalation via `escalate()`.
2. **Structured denial inspector** (`detectSoftFailure`, `scripts/sdlc-runner.mjs:1135-1166`) — reads the `permission_denials` array from the stream-json `result` event, filters out benign/ephemeral entries (`BENIGN_DENIED_TOOLS`, `isEphemeralScaffoldDenial`), and returns a soft-failure signal for real denials.

The structured inspector was added after the legacy pattern matcher and is the authoritative signal. The regex `/permission denied/i` remains in `IMMEDIATE_ESCALATION_PATTERNS` as a duplicate, pre-JSON-parsing era artifact. Because the Claude subprocess emits stream-json events that include quoted tool-result payloads, nested assistant text, spec filenames, and branch names, any literal occurrence of the phrase "permission denied" anywhere in the event stream — even when `permission_denials: []` — is enough to hard-escalate. This bypasses `detectSoftFailure()`'s filtering and halts otherwise-successful runs after two consecutive bounces.

The fix is to remove the duplicate regex. The remaining `IMMEDIATE_ESCALATION_PATTERNS` entries (`context_window_exceeded`, `signal: 9`, `signal: SIGKILL`) describe subprocess-level failures that have no structured equivalent and must remain.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `scripts/sdlc-runner.mjs` | 1077-1082 | `IMMEDIATE_ESCALATION_PATTERNS` array — source of the false positive |
| `scripts/sdlc-runner.mjs` | 1086-1092 | `matchErrorPattern()` — iterates the patterns and returns escalate action on match |
| `scripts/sdlc-runner.mjs` | 1222-1248 | `handleFailure()` — concatenates stdout+stderr and calls `matchErrorPattern()` before `detectSoftFailure()` |
| `scripts/sdlc-runner.mjs` | 1135-1166 | `detectSoftFailure()` — the authoritative structured-denial inspector that remains unchanged |

### Triggering Conditions

- Claude subprocess produces stream-json events containing the literal substring "permission denied" (case-insensitive) — e.g., quoted tool-result payloads, nested error messages, spec filenames, branch names.
- `permission_denials` array in the `result` event is empty (or contains only benign/ephemeral entries).
- `handleFailure()` is invoked because the subprocess exited non-zero (or the caller routed through failure handling for any reason).
- Two consecutive such escalations on the same issue trip `haltFailureLoop`, causing the runner to exit 1.

This wasn't caught earlier because real permission denials reliably populate the structured array, so the duplicate text match "happened to be right" in normal cases. The bug only surfaces when the phrase appears coincidentally in output (as on issue #181).

---

## Fix Strategy

### Approach

Delete the single line `/permission denied/i,` from the `IMMEDIATE_ESCALATION_PATTERNS` array. This is the minimal correct fix: it removes the duplicate-and-wrong pattern while leaving the authoritative structured-denial path (`detectSoftFailure`) and the other unrecoverable subprocess patterns (`context_window_exceeded`, `signal: 9`, `signal: SIGKILL`) untouched.

No new abstractions are introduced. The fix is a single-line deletion plus a regression test that pins the behavior in both directions (false-positive phrase is ignored; real denial still escalates via soft-failure).

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `scripts/sdlc-runner.mjs` | Remove `/permission denied/i,` from `IMMEDIATE_ESCALATION_PATTERNS` (line 1081) | Eliminates the false-positive hard-escalation path; structured `permission_denials` check in `detectSoftFailure` remains the single authoritative signal |
| `scripts/__tests__/sdlc-runner.test.mjs` | Add regression test covering AC1 and AC2 | Pin the contract: literal phrase in output with empty denials does not escalate; real non-benign denial still routes through the soft-failure escalation path |
| `CHANGELOG.md` | Add `[Unreleased]` entry under `Fixed` | Document the fix and the motivating incident (agentchrome issue #181) |

### Blast Radius

- **Direct impact**: `scripts/sdlc-runner.mjs` — `matchErrorPattern()` will no longer return `{action: 'escalate', pattern: 'permission denied'}`. `handleFailure()` will fall through to the downstream idempotency / retry / soft-failure path in that scenario.
- **Indirect impact**:
  - Any caller that previously relied on the text-pattern match to hard-escalate on a real permission denial is now served by `detectSoftFailure()` via `permission_denials`. Since every real denial populates the structured array (the subprocess protocol guarantees this), behavior is preserved.
  - Runs that falsely escalated on the phrase will instead fall through to normal failure handling — a net improvement.
- **Risk level**: Low. The structured path already filters the exact cases (`BENIGN_DENIED_TOOLS`, ephemeral tmpdir) that the text match could not distinguish; removing the text match removes a strictly less-informed check.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A real permission denial emits the phrase in text only and not in structured `permission_denials` | Very Low | The Claude subprocess stream-json protocol emits denials in the structured `result.permission_denials` array. No known path produces a text-only denial. AC2 test confirms the structured path still escalates. |
| Other `IMMEDIATE_ESCALATION_PATTERNS` entries are accidentally removed or reordered | Very Low | Fix is a single-line deletion; the test pins the remaining patterns by asserting they still match. |
| Downstream soft-failure handling is slower than immediate escalation for real denials | Low | Soft-failure escalation is the documented policy for permission denials today (`permission_denials` path already exists). No observable latency difference — both paths call `escalate()`. |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Narrow the regex (e.g., anchor to start of line or specific stderr prefix) | Instead of deleting, try to match only "real" permission denial strings | The structured `permission_denials` array is already the authoritative, well-filtered signal. A narrower regex is a strictly worse duplicate — still subject to stream-json quoting ambiguity, still requires maintenance. |
| Exclude the pattern only when the structured array is empty | Keep the regex but gate it on `permission_denials.length === 0` | Inverts the intended ordering (structured signal first); adds parsing complexity to `handleFailure()` for zero benefit — if the structured array is authoritative, the text match adds no information. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
