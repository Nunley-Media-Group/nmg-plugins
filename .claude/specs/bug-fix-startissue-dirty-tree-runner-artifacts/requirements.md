# Defect Report: `startIssue` fails with dirty working tree caused by runner's own state file

**Date**: 2026-02-26
**Status**: Complete
**Author**: Claude
**Severity**: High
**Related Spec**: `.claude/specs/bug-fix-sdlc-runner-auto-mode-gitignore/`

---

## Reproduction

### Steps to Reproduce

1. Have a target project where `.claude/sdlc-state.json` was committed before the gitignore fix (#57) was in place
2. Run the SDLC runner — it writes/updates `.claude/sdlc-state.json` during cycle execution
3. The runner's auto-commit logic skips committing `.claude/sdlc-state.json` (correctly treating it as a runner artifact)
4. `starting-issues` skill runs `git status --porcelain` and finds `.claude/sdlc-state.json` modified
5. The skill aborts with: `Working tree is not clean. Cannot create feature branch.`
6. Step 3 (`writeSpecs`) precondition `"feature branch exists"` fails
7. Runner bounces back to step 2 three times, hits escalation, then a consecutive escalation loop, and exits with code 1

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (cross-platform) |
| **Version / Commit** | `sdlc-runner.mjs` v3.1.0 |
| **Runtime** | Node.js v24+ |
| **Configuration** | Any SDLC runner config pointing to a target project where `.claude/sdlc-state.json` was previously committed |

### Frequency

Always (when `.claude/sdlc-state.json` is git-tracked in the target project)

---

## Root Cause

`.claude/sdlc-state.json` is both **git-tracked** (committed before gitignore fix #57) and **mutated by the runner at runtime**. Adding it to `.gitignore` does NOT untrack already-tracked files. The runner's own precondition check (`validatePreconditions()` case 2) correctly filters `RUNNER_ARTIFACTS`, but the `starting-issues` skill's Step 4 precondition uses raw `git status --porcelain` without filtering.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | `starting-issues` proceeds with branch creation when the only dirty files are known runner artifacts |
| **Actual** | `starting-issues` aborts because `git status --porcelain` shows modified `.claude/sdlc-state.json` (tracked file) |

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Runner untracks previously committed runner artifacts

**Given** the SDLC runner starts with a target project where `.claude/sdlc-state.json` is git-tracked
**When** the runner initializes
**Then** the runner runs `git rm --cached` on the tracked runner artifacts
**And** the artifacts become untracked (gitignore takes effect)

### AC2: starting-issues skill tolerates runner artifacts in working tree

**Given** the working tree contains only modified runner artifacts (`.claude/sdlc-state.json`, `.claude/auto-mode`)
**When** the `starting-issues` skill evaluates the working tree precondition
**Then** the filtered output is considered clean
**And** branch creation proceeds normally

### AC3: starting-issues skill still rejects real dirty files

**Given** the working tree contains modified source files alongside runner artifacts
**When** the `starting-issues` skill evaluates the working tree precondition
**Then** the skill aborts with the dirty tree error listing only the real dirty files

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Runner must untrack RUNNER_ARTIFACTS that are already git-tracked at startup | Must |
| FR2 | Runner untracking must be idempotent (safe if artifacts are not tracked) | Must |
| FR3 | `starting-issues` skill must filter known runner artifacts from dirty-tree evaluation | Must |
| FR4 | `starting-issues` skill must still reject real working-tree dirt | Must |

---

## Out of Scope

- Modifying `autoCommitIfDirty()` behavior (already correctly filters)
- Modifying `validatePreconditions()` case 2 (already correctly filters)
- Changing how `sdlc-state.json` is stored or managed

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
