# Root Cause Analysis: SDLC runner infinite retry when repo has no CI checks

**Issue**: #54
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude

---

## Root Cause

The Step 8 (`monitorCI`) prompt in `sdlc-runner.mjs` instructs Claude to run `gh pr checks` and poll every 30 seconds until no checks are "pending", then exit with code 0 if all checks pass, or attempt to fix failures. The prompt does not account for a third possible outcome: **zero checks exist**.

When a repository has no CI checks configured, `gh pr checks` exits with code 1 and outputs `no checks reported on the '{branch}' branch`. The prompt's instructions create an impossible loop:
- Step 1 says "poll until no checks are pending" — there are no checks, so no pending state to resolve
- Step 2 says "if all checks pass" — there are no checks to pass
- Step 3 says "if any check fails" — there are no checks failing either
- Step 5 says "only exit with code 0 when ALL CI checks show as passing"

Claude interprets the exit code 1 from `gh pr checks` as a failure and retries indefinitely, because none of the prompt's branches match the "no checks" scenario.

Step 9 (`merge`) has an identical vulnerability: it instructs Claude to "verify CI is passing with `gh pr checks`" and refuse to merge if "any check is failing". When there are no checks, the exit code 1 from `gh pr checks` causes Claude to interpret this as a failure, blocking the merge.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | 700–714 | Step 8 prompt — CI monitoring with polling loop |
| `openclaw/scripts/sdlc-runner.mjs` | 716 | Step 9 prompt — CI precondition before merge |

### Triggering Conditions

- The target repository has no GitHub Actions workflows (no `.github/workflows/` directory)
- No other CI integrations (e.g., CircleCI, Jenkins) are configured on the repo
- `gh pr checks` returns exit code 1 with "no checks reported" output
- This is the default state for the `nmg-plugins` repository

---

## Fix Strategy

### Approach

Add explicit "no checks" handling to both Step 8 and Step 9 prompts. The prompts are plain-text instructions to Claude, so the fix is a prompt modification — no JavaScript logic changes needed.

For Step 8: Add a new step (before the polling loop) that checks for "no checks reported" output and treats it as success. This short-circuits the entire polling loop.

For Step 9: Add a clause that recognizes "no checks reported" as equivalent to "all checks pass" for the merge precondition.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` (lines 700–714) | Add a "Step 0" to the monitorCI prompt: if `gh pr checks` outputs "no checks reported", treat as passing and exit with code 0 | Short-circuits the polling loop when no CI is configured |
| `openclaw/scripts/sdlc-runner.mjs` (line 716) | Extend the merge prompt to also accept "no checks reported" as a passing condition | Prevents merge from being blocked when no CI exists |

### Blast Radius

- **Direct impact**: Only the Step 8 and Step 9 prompt strings in `buildClaudeArgs()` are modified
- **Indirect impact**: None — prompt strings are self-contained text passed to `claude -p`. No other code references or depends on the specific wording of these prompts
- **Risk level**: Low — the change only adds a new conditional branch to the prompts. Existing behavior for repos with CI checks is not touched

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Repos with CI checks start skipping CI monitoring | Low | The "no checks reported" condition only triggers when `gh pr checks` literally outputs that message — repos with any checks (even failing ones) produce different output |
| Step 8 exits too early during a brief window before checks register | Low | GitHub typically registers checks within seconds of a push. The prompt can be explicit: run `gh pr checks` once; if it reports "no checks", treat as pass. If checks are pending, enter the existing poll loop |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| [Alternative fix] | [approach] | [why the chosen approach is better] |

*Omit this section if only one reasonable fix approach exists.*

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
