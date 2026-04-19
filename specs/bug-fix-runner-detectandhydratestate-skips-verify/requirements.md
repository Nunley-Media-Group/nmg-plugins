# Defect Report: `detectAndHydrateState` advances past verify (Step 5) on pushed-but-unverified branches

**Issue**: (tracked with #122 commit)
**Date**: 2026-04-18
**Status**: Fixed
**Author**: Claude (spec agent)
**Severity**: Critical (correctness)
**Related**: `specs/bug-fix-verify-step-false-escalation-on-temp-dir-denials/`

---

## Reproduction

### Steps to Reproduce

1. Start an SDLC cycle for an issue through `/run-loop` or `node scripts/sdlc-runner.mjs`.
2. Let the runner complete Step 4 (`implement`) — this produces a commit on the feature branch.
3. Let Step 5 (`verify`) begin but crash / escalate / be killed before it succeeds (any non-graceful exit that does NOT set `savedState.signalShutdown = true`).
4. Push the feature branch to origin (manually, or via the SIGTERM handler, or because verify itself committed+pushed WIP before escalating).
5. Re-invoke the runner (`/run-loop`).
6. Observe `detectAndHydrateState` report `lastCompletedStep=6` and resume from Step 7 (`createPR`).

### Environment

| Factor | Value |
|--------|-------|
| **Component** | `detectAndHydrateState()` in `scripts/sdlc-runner.mjs` |
| **Applicable to** | All projects using `nmg-sdlc` |
| **Trigger** | Any branch where commits are pushed but verify has not successfully run |

### Frequency

Deterministic — happens whenever the runner restarts on a branch whose commits are fully pushed and `savedState.signalShutdown` is not set.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | Resume must not skip verify. Without explicit evidence that Step 5 passed, the runner should resume at Step 5, not Step 7. |
| **Actual** | The hydration probe treats "all commits pushed to origin" as sufficient evidence that Steps 4–6 all completed, even though verify (Step 5) has no git-observable artifact. This lets an unverified implementation sail straight into `createPR`. |

### Observed Sequence

```
detectAndHydrateState: on feature branch "122-add-end-loop-skill", issue #122
no pull requests found for branch "122-add-end-loop-skill"
no pull requests found for branch "122-add-end-loop-skill"
detectAndHydrateState: detected lastCompletedStep=6, featureName=...
Detected in-progress work: issue #122, branch "122-add-end-loop-skill", lastCompletedStep=6 — resuming from step 7
```

---

## Root Cause

`detectAndHydrateState` probes observable artifacts to infer step completion:

- Step 3 → `specs/<feature>/` contains all required files
- Step 4 → at least one commit ahead of `main`
- Step 6 → **all commits pushed to origin (no `origin/<branch>..HEAD` output)** ← overreaches
- Step 7 → a PR exists
- Step 8 → CI is passing or no checks are configured

Step 5 (`verify`) produces no artifact the runner can probe from git — verification happens inside a Claude subprocess. Jumping from probed step 4 → probed step 6 based solely on "pushed" implicitly asserts verify passed. It did not.

A guardrail at the bottom of the function caps the probed value to `savedState.lastCompletedStep` only when `savedState.signalShutdown === true`. A crash mid-verify (or a manual state reset, or any shutdown path that doesn't set the flag) bypasses the cap entirely.

---

## Fix Requirements

**FR1.** `detectAndHydrateState` MUST NOT advance `lastCompletedStep` past 4 on the basis of "branch pushed" alone.

**FR2.** Advancement past Step 4 via the "pushed" signal MUST require the saved state to show `lastCompletedStep >= 5` (explicit evidence that verify previously completed).

**FR3.** When no saved state exists (fresh resume on a dangling feature branch), the function MUST conservatively report `lastCompletedStep = 4` at most, so the next cycle re-runs verify.

**FR4.** The existing `signalShutdown` cap MUST remain in place as a reinforcing guard, but MUST NOT be the only mechanism preventing false advancement.

**FR5.** The fix MUST apply to all projects using `nmg-sdlc` (the runner is shared plugin infrastructure).

## Acceptance Criteria

- **AC1.** Resume on a branch with pushed commits but no saved state reports `lastCompletedStep=4` → runner re-runs Step 5.
- **AC2.** Resume on a branch whose saved state shows `lastCompletedStep=4` (mid-verify escalation) reports `lastCompletedStep=4`, even if all commits are pushed.
- **AC3.** Resume on a branch whose saved state shows `lastCompletedStep=6` (previous verify succeeded) and all commits pushed reports `lastCompletedStep=6` — no regression to the success path.
- **AC4.** Resume on a branch with a merged PR still correctly reports `lastCompletedStep=9` via the PR-merged probe.

## Fix Summary

Hoist `readState()` to the top of the function. Add `savedLastCompleted >= 5` as an additional condition before the "pushed → step 6" promotion. Leave the `signalShutdown` cap intact.
