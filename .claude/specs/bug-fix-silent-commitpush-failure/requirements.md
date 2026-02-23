# Defect Report: Silent commitPush failure causing retry loop in SDLC runner

**Issue**: #32
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `.claude/specs/feature-openclaw-runner-operations/`

---

## Reproduction

### Steps to Reproduce

1. Run `sdlc-runner.mjs` in autonomous mode against a project
2. Have `git push` fail silently during step 6 (e.g., due to auth expiry, branch protection, or remote rejection)
3. Claude Code exits with code 0 despite the push failure
4. Runner advances to step 7 (createPR), whose precondition checks `git log origin/${branch}..HEAD` and detects unpushed commits
5. Step 7 precondition failure triggers `retry-previous`, sending execution back to step 6
6. Step 6 has no preconditions of its own (`case 6: return { ok: true }`) and re-runs the same failing push
7. After `maxRetriesPerStep` (default 3) retries, runner escalates and resets

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (Darwin 25.3.0) |
| **Component** | `openclaw/scripts/sdlc-runner.mjs` |
| **Runner mode** | Autonomous (OpenClaw orchestrated) |
| **Node.js** | v24+ (ESM) |

### Frequency

Intermittent — depends on external conditions (auth expiry, network issues, branch protection). Observed in cycle 3 after 2 successful cycles.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | After step 6 reports success (exit code 0), the runner validates that no unpushed commits remain. If validation fails, the step is treated as failed and retried with diagnostic logging — not blindly advanced to step 7. |
| **Actual** | Runner trusts exit code 0 unconditionally at line 1031 of `sdlc-runner.mjs`. It advances to step 7, whose precondition correctly detects unpushed commits, triggering `retry-previous` back to step 6. This loops until `MAX_RETRIES` is exhausted, then escalates — without ever identifying the push failure as the root cause. |

### Error Output

```
Step 7 preconditions failed: Unpushed commits exist
Retrying Step 6 (commitPush) to produce required artifacts.
... (repeats MAX_RETRIES times)
Step 6 exhausted retries. Escalating.
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Push validation gate prevents silent failure

**Given** step 6 (commitPush) completes with exit code 0
**When** the runner checks for unpushed commits via `git log origin/${branch}..HEAD --oneline`
**Then** the step is marked as failed if unpushed commits remain
**And** the runner retries step 6 with a log message identifying the push validation failure

### AC2: Step 6 prompt instructs explicit failure exit

**Given** Claude Code is running the commitPush step
**When** `git push` fails for any reason (auth, protection, rejection)
**Then** the step 6 prompt explicitly instructs Claude to exit with a non-zero status code and report the error

### AC3: Successful push is not regressed

**Given** step 6 runs and `git push` succeeds normally
**When** the post-step push validation gate runs
**Then** no unpushed commits are detected
**And** the runner advances to step 7 normally

### AC4: Retry loop is bounded correctly

**Given** step 6 fails push validation on every attempt
**When** the runner exhausts `maxRetriesPerStep` retries
**Then** the runner escalates with a diagnostic message identifying the push failure
**And** the escalation does not loop between steps 6 and 7

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Add a post-step push validation gate after step 6 in `sdlc-runner.mjs`, following the existing pattern used for spec validation (step 3) and CI validation (step 8): check `git log origin/${branch}..HEAD --oneline` for unpushed commits | Must |
| FR2 | Update the step 6 prompt to explicitly instruct Claude Code to exit non-zero if `git push` fails, rather than treating the failure as informational | Must |
| FR3 | Push validation failure must follow the same retry/escalate pattern as the spec and CI validation gates: increment `retries[6]`, return `'retry'` if under `MAX_RETRIES`, escalate if exhausted | Must |

---

## Out of Scope

- Diagnosing the specific cause of the original push failure (auth, branch protection, etc.)
- Adding push retry logic inside the Claude Code session itself (the runner handles retries)
- Changes to step 7 precondition logic (it is already correct)
- Refactoring the validation gate pattern into a shared abstraction
- Adding validation gates for other steps

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC3)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
