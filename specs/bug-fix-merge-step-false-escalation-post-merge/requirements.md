# Defect Report: Merge step (Step 9) false-escalates when PR merges but subprocess exits non-zero

**Issue**: (tracked with #122 commit)
**Date**: 2026-04-18
**Status**: Fixed
**Author**: Claude (spec agent)
**Severity**: High
**Related**: observed during SDLC cycle on issue #115 (PR #126)

---

## Reproduction

### Steps to Reproduce

1. Run the SDLC pipeline through to Step 9 (`merge`) for an issue that has a ready-to-merge PR.
2. The `merge` skill's Claude session runs `gh pr merge …`. The merge succeeds — GitHub squash-merges and auto-deletes the remote feature branch. The local HEAD usually auto-switches to `main`.
3. Afterward, the same Claude session encounters rate-limit noise, runs a redundant `gh pr checks` on the now-missing branch, or otherwise exits with a non-zero code.
4. Runner enters `handleFailure`. It sleeps for the rate-limit wait, then probes preconditions for Step 9.
5. Precondition probe calls `gh pr checks` on the current branch (`main`), which responds "no pull requests found for branch 'main'". The probe returns `failedCheck: 'PR status check'`.
6. Runner bounces to Step 8 (`monitorCI`) → Step 7 (`createPR`), each failing their own preconditions on the missing branch.
7. Bounce counter exceeds `MAX_BOUNCE_RETRIES` → escalation.

### Environment

| Factor | Value |
|--------|-------|
| **Component** | `handleFailure()` and `validatePreconditions()` for Step 9 in `scripts/sdlc-runner.mjs` |
| **Applicable to** | All projects using `nmg-sdlc` |
| **Trigger** | Any Step-9 run where `gh pr merge` succeeds but the Claude process exits non-zero afterward |

### Frequency

Intermittent — depends on whether post-merge noise (rate limits, gh follow-up calls) trips the session. Observed in #115's cycle in this repo.

### Observed Output (#115)

```
Step 9 exited with code 1 in 19s
Rate limited. Waiting 60s before retry...
no pull requests found for branch "main"
Step 9 (merge) precondition failed: "PR status check". Bouncing to Step 8 (monitorCI). (bounce 2/3)
Preconditions failed for step 8 (monitorCI): "PR exists"
Step 8 (monitorCI) bounced to Step 7 (createPR). Precondition failed: "PR exists". (bounce 3/3)
Preconditions failed for step 7 (createPR): "branch pushed to remote"
Bounce loop detected: 4 step-back transitions exceed threshold 3
ESCALATION: Step 6 — Bounce loop: …
```

Meanwhile, PR #126 was already merged successfully.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | When Step 9 already achieved its outcome (PR merged, branch deleted) but the subprocess exited non-zero on follow-up noise, the runner should recognize the merge and treat the step as complete. |
| **Actual** | Runner retries / bounces as if no work had been done, eventually hitting the bounce-loop guard and escalating. The false escalation can pair with any other escalation (e.g., verify soft failure on a different issue) to trip the consecutive-escalation failure-loop halt. |

---

## Root Cause

Step 9 is the only step whose inner action produces irreversible side-effects on shared GitHub state (squash-merge + branch delete) before the Claude session can exit. When the session exits non-zero *after* the merge has landed, the runner's generic failure-handling path (`handleFailure` → precondition probe → bounce) treats the deleted branch and missing PR as failure signals. It has no idempotency check.

`validatePreconditions` for Step 9 runs `gh pr checks` on the current branch, which can now be `main` (no PR exists for `main`) — a state that's indistinguishable from "user never merged" to that check.

---

## Fix Requirements

**FR1.** Before entering the retry / bounce / precondition-probe path in `handleFailure`, the runner MUST check whether the step's expected outcome is already achieved. When satisfied, treat the exit as success.

**FR2.** The outcome check for Step 9 MUST query GitHub for a merged PR tied to the current issue number (via title/body reference).

**FR3.** The check MUST be tolerant of gh/API errors — on error, fall through to the existing retry path (don't mask non-idempotent failures as successes).

**FR4.** The check MUST only apply to steps where retrying is either impossible or harmful. Initial scope: Step 9 only. Other steps remain retryable.

**FR5.** The idempotent-success path MUST update `lastCompletedStep` and emit a status log so the operator can tell the step was short-circuited rather than silently skipped.

## Acceptance Criteria

- **AC1.** A Step-9 subprocess that merges the PR then exits non-zero no longer triggers bounce logic — the runner logs an idempotency note and advances past Step 9.
- **AC2.** A Step-9 subprocess that exits non-zero without merging (e.g., merge blocked by failing checks) still enters the retry path as before.
- **AC3.** Other steps (1–8) are unaffected — their retry/bounce behavior is identical to before.
- **AC4.** The fix is confined to `scripts/sdlc-runner.mjs` and applies to all projects using the plugin.

## Fix Summary

Add `isStepOutcomeSatisfied(step, state)` helper that returns true for Step 9 when a merged PR referencing the current issue is found via `gh pr list --state merged --search "<issue> in:title,body"`. Consult it at the top of `handleFailure` and short-circuit with a synthetic `'ok'` result when satisfied.
