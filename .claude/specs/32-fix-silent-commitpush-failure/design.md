# Root Cause Analysis: Silent commitPush failure causing retry loop

**Issue**: #32
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude

---

## Root Cause

The SDLC runner's `runStep()` function (line 1031 of `sdlc-runner.mjs`) treats any step that exits with code 0 as successful. After a successful exit, it runs post-step validation gates — but only for step 3 (spec validation, lines 1040-1055) and step 8 (CI validation, lines 1066-1081). Step 6 (commitPush) has no post-step validation gate.

When Claude Code reports exit code 0 after running step 6, the runner unconditionally marks the step as complete and advances. If `git push` actually failed within the Claude Code session — but Claude treated the failure as informational rather than fatal — the runner has no way to detect this. Step 7 (createPR) has a proper precondition check (`git log origin/${branch}..HEAD --oneline`) that detects unpushed commits, but its failure triggers `retry-previous`, which sends execution back to step 6. Since step 6 has no preconditions of its own (`case 6: return { ok: true }` at line 517), it re-runs immediately with the same conditions, creating an infinite retry loop bounded only by `MAX_RETRIES`.

A secondary contributing factor is the step 6 prompt (line 585): it asks Claude to "Verify the push succeeded" but does not explicitly instruct it to exit with a non-zero status code if verification fails. This makes it easy for Claude Code to acknowledge a push failure in its output text while still exiting cleanly.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | 1031-1038 | Exit code 0 handler — trusts success unconditionally |
| `openclaw/scripts/sdlc-runner.mjs` | 1040-1055 | Spec validation gate (step 3) — the pattern to follow |
| `openclaw/scripts/sdlc-runner.mjs` | 1066-1081 | CI validation gate (step 8) — the pattern to follow |
| `openclaw/scripts/sdlc-runner.mjs` | 585 | Step 6 prompt — missing explicit failure instruction |
| `openclaw/scripts/sdlc-runner.mjs` | 517-518 | Step 6 precondition — always returns `{ ok: true }` |

### Triggering Conditions

- `git push` fails inside the Claude Code session for any reason (auth expiry, branch protection, remote rejection, network failure)
- Claude Code exits with code 0 despite the push failure (treats it as informational)
- The runner has no post-step validation to catch the discrepancy

---

## Fix Strategy

### Approach

Add a post-step push validation gate after step 6, following the identical pattern used for spec validation (step 3) and CI validation (step 8). The gate runs `git log origin/${branch}..HEAD --oneline` — the same check that step 7's precondition uses — and treats any output (unpushed commits) as a validation failure. On failure, it increments `retries[6]`, posts a Discord diagnostic message, and returns `'retry'` to re-run step 6. At `MAX_RETRIES`, it escalates with a message identifying the push failure.

Additionally, update the step 6 prompt to explicitly instruct Claude Code to exit with a non-zero status code if `git push` fails, reducing the likelihood of silent failures at the source.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` ~line 585 | Update step 6 prompt to include explicit failure-exit instruction | Reduces silent push failures at the source — Claude Code will be told to exit non-zero on push failure |
| `openclaw/scripts/sdlc-runner.mjs` ~lines 1055-1066 (insert between step 3 and step 8 gates) | Add `validatePush()` helper and post-step validation gate for step 6 | Catches push failures even when exit code is 0, following the established spec/CI validation pattern |

### Blast Radius

- **Direct impact**: `sdlc-runner.mjs` — the `runStep()` function's post-step validation section and the step 6 prompt string
- **Indirect impact**: None. The validation gate is additive — it runs only after step 6 reports success and only inspects git state. No other steps, preconditions, or state management is affected.
- **Risk level**: Low — the fix mirrors two existing, proven validation gates

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| False positive: validation gate flags a successful push as failed | Low | The check (`git log origin/${branch}..HEAD --oneline`) is the same one step 7 already uses and is proven reliable. A `git fetch` before the check ensures the remote ref is current. |
| Prompt change causes Claude to exit non-zero on benign warnings | Low | The prompt instruction is specific: "if `git push` reports an error or rejection, exit with a non-zero status code". Benign git output (e.g., progress messages) would not match this instruction. |
| Retry loop on persistent auth failure burns time | Low | Already bounded by `MAX_RETRIES` (default 3). The escalation message now identifies the cause, enabling faster human intervention. |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Add preconditions to step 6 | Check for unpushed commits before running step 6 | Step 6 creates the commits — preconditions can't know about push state before the step runs. The problem is post-step, not pre-step. |
| Modify step 7 to handle the loop | Change step 7's `retry-previous` to escalate instead of retrying | This would mask the real problem. Step 7's precondition logic is correct — the fix belongs in step 6's validation. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
