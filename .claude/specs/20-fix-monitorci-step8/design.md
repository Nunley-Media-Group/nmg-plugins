# Root Cause Analysis: Step 8 (monitorCI) exits without fixing CI failures

**Issue**: #20
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## Root Cause

Step 8 (`monitorCI`) has four compounding issues that create a deterministic retry loop when CI fails.

**Primary cause**: The Step 8 prompt (line 546) ends with "Report the final CI status" — which Claude satisfies by reporting the failure and exiting cleanly with code 0. Compare Step 9's prompt (line 548) which explicitly says "do NOT merge — report the failure and exit with a non-zero status." Step 8 provides no equivalent non-zero exit instruction for unresolved failures.

**Secondary cause**: There is no post-step CI validation gate. After Step 3, the runner validates that all spec artifacts exist (lines 964-978) — even when Claude exits with code 0. Step 8 has no equivalent gate, so when Claude exits with code 0 after merely reporting CI status, the runner blindly advances to Step 9.

**Tertiary causes**: Step 8 has no skill injection (no structured guidance for CI diagnosis), and its resource limits (`maxTurns: 20`, `timeoutMin: 10`) are too low for a full diagnosis-fix-commit-push-repoll cycle.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | 546 | Step 8 prompt — permissive "report and exit" wording |
| `openclaw/scripts/sdlc-runner.mjs` | 954-978 | Post-step validation area — Step 3 has a gate, Step 8 does not |
| `openclaw/scripts/sdlc-config.example.json` | 14 | Step 8 defaults — `maxTurns: 20`, `timeoutMin: 10` (too low) |

### Triggering Conditions

- CI is failing when Step 8 runs (formatting, lint, or test failure)
- Claude interprets "Report the final CI status" as a valid exit action after observing the failure
- No validation gate catches the exit-code-0-but-CI-still-failing case
- Step 9 precondition (line 497-505) correctly rejects, triggering retry-previous back to Step 8
- Loop repeats identically because nothing in Step 8 changes between retries

---

## Fix Strategy

### Approach

Three changes, all in the same two files, address all four root causes:

1. **Rewrite the Step 8 prompt** to give Claude explicit instructions: read CI logs, diagnose failures, apply fixes that don't deviate from specs, commit, push, re-poll. Exit non-zero if CI cannot be fixed without spec changes. Remove the "report and exit" escape.

2. **Add a CI validation gate after Step 8** in `runStep()`, following the exact pattern of the `validateSpecs` gate after Step 3 (lines 964-978). After Step 8 exits with code 0, run `gh pr checks` — if any check is still failing, retry Step 8 up to `MAX_RETRIES` times, then escalate.

3. **Increase Step 8 resource defaults** in `sdlc-config.example.json` to `maxTurns: 40` and `timeoutMin: 20` — enough for at least one full fix cycle (diagnosis + code change + commit + push + CI re-poll).

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs:546` | Rewrite Step 8 prompt — explicit fix loop instructions, non-zero exit for unfixable failures, spec-deviation guard | Addresses root causes #2 (no guidance) and #3 (permissive prompt) |
| `openclaw/scripts/sdlc-runner.mjs:978` (after) | Add `validateCI()` function and call it after Step 8 exits with code 0, matching `validateSpecs` gate pattern | Addresses root cause #1 (no validation gate) |
| `openclaw/scripts/sdlc-config.example.json:14` | Change `monitorCI` defaults to `maxTurns: 40, timeoutMin: 20` | Addresses root cause #4 (insufficient resources) |

### Blast Radius

- **Direct impact**: Step 8 prompt behavior (what Claude does during monitorCI) and post-Step-8 validation logic
- **Indirect impact**: The retry loop between Steps 8-9 will now be caught earlier by the validation gate instead of burning through MAX_RETRIES at Step 9
- **Risk level**: Low — changes are scoped to Step 8's prompt and a new post-step gate that mirrors an existing pattern. No other steps are modified.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| New prompt causes Claude to over-fix (change spec-specified behavior) | Low | Prompt explicitly instructs Claude to check specs before applying fixes; exit non-zero if fix requires spec deviation |
| CI validation gate false-positives on pending/queued checks | Low | Gate only triggers when Step 8 exits code 0 — Claude should have already polled to completion. Use same `/fail/i` check as Step 9 precondition. |
| Increased maxTurns/timeoutMin waste resources on unfixable issues | Low | Non-zero exit instruction means Claude escalates unfixable issues rather than spinning. Validation gate also caps retries at MAX_RETRIES. |
| Existing passing CI workflows broken by gate | Very Low | Gate only rejects if `/fail/i` matches in `gh pr checks` output — passing CI has no "fail" text |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Create a dedicated CI-fix skill | Inject a full SKILL.md for Step 8 like Steps 2-5, 7 | Over-engineered for now. The enhanced prompt provides enough structure. A skill can be added later if needed. Explicitly out of scope per issue. |
| Only add validation gate, keep prompt | Add the gate but don't change the prompt | Claude would still exit without fixing, just retry more. The gate alone doesn't teach Claude to actually fix CI. |
| Move CI validation to Step 9 precondition | Strengthen Step 9's failure handling instead | Already exists and works correctly. The problem is Step 8 never fixes anything — the solution must change Step 8's behavior. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
