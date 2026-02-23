# Defect Report: Step 8 (monitorCI) exits without fixing CI failures

**Issue**: #20
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `.claude/specs/feature-openclaw-runner-operations/`

---

## Reproduction

### Steps to Reproduce

1. SDLC runner reaches Step 8 after creating a PR (Step 7)
2. CI fails (e.g., formatting, lint, or test failure)
3. Step 8 Claude session runs `gh pr checks`, reports CI is failing, exits with code 0
4. Runner advances to Step 9 (merge)
5. Step 9 precondition check detects CI failing, returns `{ ok: false }`
6. `handleFailure` returns `retry-previous`, loops back to Step 8
7. Cycle repeats 3 times, then escalates without ever attempting a fix

### Environment

| Factor | Value |
|--------|-------|
| **Component** | `openclaw/scripts/sdlc-runner.mjs` |
| **Step** | 8 (`monitorCI`) |
| **Config defaults** | `maxTurns: 20`, `timeoutMin: 10` |
| **Runtime** | Node.js v24+ (ESM) |

### Frequency

Always — deterministic when CI is failing at Step 8.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | Step 8 diagnoses CI failures, applies fixes (within spec bounds), commits, pushes, and re-polls CI. The runner only advances to Step 9 when CI checks are verified green. Unfixable issues (spec deviation required) trigger escalation via non-zero exit. |
| **Actual** | Step 8 reports CI status and exits cleanly (code 0). The runner advances to Step 9, which fails its CI precondition, triggers `retry-previous` back to Step 8, and the cycle repeats until `MAX_RETRIES` (3) is exhausted — never attempting a fix. |

### Error Output

```
[Step 8] CI checks: some checks failing
[Step 8] Reporting CI status... (exits 0)
[Step 9] Preconditions failed: CI checks failing
[handleFailure] retry-previous → Step 8
[Step 8] CI checks: some checks failing  (same loop)
... repeats until MAX_RETRIES → escalation
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: CI failures are automatically diagnosed and fixed

**Given** a PR with failing CI checks (formatting, lint, or test failures)
**When** Step 8 (`monitorCI`) runs
**Then** the Claude session reads CI logs, diagnoses the failure, applies a fix, commits, pushes, and re-polls CI until it passes

### AC2: Runner validates CI is green before advancing to merge

**Given** Step 8 completes with exit code 0
**When** the runner evaluates whether to advance to Step 9
**Then** it verifies CI checks are actually passing (analogous to the `validateSpecs` gate after Step 3), and retries Step 8 if CI is still failing

### AC3: Spec-deviating fixes trigger escalation

**Given** a CI failure that cannot be fixed without changing specified behavior
**When** the Claude session determines the fix would deviate from the spec
**Then** it exits with a non-zero code and the runner escalates for manual intervention

### AC4: Step 8 has sufficient resources for fix cycles

**Given** a CI failure requiring diagnosis, code fix, commit, push, and CI re-poll
**When** Step 8 runs
**Then** it has enough turns (>=40) and timeout (>=20 min) to complete at least one full fix cycle

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Add a CI-passing validation gate after Step 8 in `runStep` — pattern matches `validateSpecs` gate after Step 3 (line 964). Check `gh pr checks` output; retry Step 8 if any checks are failing. | Must |
| FR2 | Enhance Step 8 prompt: require non-zero exit for unresolved CI failures; remove the "report and exit" escape condition; instruct Claude to read CI logs, diagnose, fix, commit, push, and re-poll. | Must |
| FR3 | Increase Step 8 default `maxTurns` to >=40 and `timeoutMin` to >=20 in `sdlc-config.example.json` | Must |
| FR4 | Step 8 prompt must instruct Claude to check specs before applying fixes that could change specified behavior — exit non-zero if fix requires spec deviation | Should |

---

## Out of Scope

- Creating a dedicated CI-fix skill document (prompt enhancement is sufficient)
- Multi-job CI pipeline analysis (parallel/matrix builds)
- Caching or optimizing CI poll intervals
- Changes to the retry/escalation framework itself
- Changes to any steps other than Step 8

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC2 — validation gate ensures existing Step 9 behavior is preserved)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
