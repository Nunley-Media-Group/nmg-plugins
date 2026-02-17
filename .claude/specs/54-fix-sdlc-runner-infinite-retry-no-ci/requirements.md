# Defect Report: SDLC runner infinite retry when repo has no CI checks

**Issue**: #54
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: N/A (affects `openclaw/scripts/sdlc-runner.mjs`, no prior feature spec)

---

## Reproduction

### Steps to Reproduce

1. Run the SDLC runner against a repo with no GitHub Actions workflows or CI checks configured (e.g., `nmg-plugins`)
2. Complete Steps 1–7 successfully (issue start through PR creation)
3. Step 8 (`monitorCI`) begins and runs `gh pr checks`
4. `gh pr checks` exits with code 1 and prints "no checks reported on the '{branch}' branch"
5. Runner retries Step 8 indefinitely — the "no checks" condition never resolves

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (Darwin 25.3.0) |
| **Version / Commit** | nmg-plugins v2.12.3 (commit 58e8ecf) |
| **Runner** | `openclaw/scripts/sdlc-runner.mjs` |
| **Configuration** | Any repo without `.github/workflows/` or other CI integrations |

### Frequency

Always — 100% reproducible on any repo with zero CI checks.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | When `gh pr checks` reports "no checks" (repo has no CI configured), Steps 8 and 9 treat this as a passing condition and proceed normally |
| **Actual** | Step 8 interprets "no checks" as a CI failure and retries indefinitely. Step 9 has the same vulnerability if Step 8 were bypassed — it would refuse to merge |

### Error Output

```
$ gh pr checks
no checks reported on the 'N-feature-name' branch
(exit code 1)
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: No-checks treated as pass in monitorCI

**Given** a PR on a branch with no CI checks configured
**When** Step 8 (`monitorCI`) runs `gh pr checks` and receives "no checks reported"
**Then** the step treats it as a passing condition and completes successfully

### AC2: No-checks treated as pass in merge

**Given** a PR on a branch with no CI checks configured
**When** Step 9 (`merge`) checks CI status before merging
**Then** the merge precondition passes and the PR is merged

### AC3: Existing CI behavior preserved

**Given** a PR on a branch with CI checks configured
**When** Steps 8 and 9 run `gh pr checks`
**Then** existing behavior is unchanged — checks are polled normally and failures are handled as before

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Step 8 prompt must detect "no checks reported" output and treat it as success | Must |
| FR2 | Step 9 prompt must detect "no checks reported" output and proceed with merge | Must |
| FR3 | No change to behavior when CI checks exist and are pending/passing/failing | Must |

---

## Out of Scope

- Adding a `skipCI` config option (not needed if auto-detection works)
- Adding CI workflows to the `nmg-plugins` repo itself
- Changes to non-CI-related steps in the runner
- Refactoring the runner's prompt structure beyond the minimal fix

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
