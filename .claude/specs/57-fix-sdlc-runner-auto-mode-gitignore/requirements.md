# Defect Report: SDLC runner commits auto-mode file to target projects

**Issue**: #57
**Date**: 2026-02-19
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `.claude/specs/17-fix-auto-mode-cleanup-on-exit/`

---

## Reproduction

### Steps to Reproduce

1. Configure the SDLC runner with a target project that does NOT have `.claude/auto-mode` in its `.gitignore`
2. Run the SDLC runner (`node sdlc-runner.mjs --config <path>`)
3. Let it reach a step where `autoCommitIfDirty()`, escalation handling, or signal handling triggers `git add -A`
4. The `.claude/auto-mode` and `.claude/sdlc-state.json` files are staged and committed to the target project

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (cross-platform) |
| **Version / Commit** | Current `sdlc-runner.mjs` (v2.12.7) |
| **Runtime** | Node.js v24+ |
| **Configuration** | Any SDLC runner config pointing to a target project without `.claude/auto-mode` in `.gitignore` |

### Frequency

Always (when the target project's `.gitignore` doesn't exclude runner artifacts)

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | Runner artifacts (`.claude/auto-mode`, `.claude/sdlc-state.json`) are never committed to the target project, regardless of the target project's `.gitignore` contents |
| **Actual** | Runner artifacts are staged by `git add -A` and committed to the target project if they are not in the project's `.gitignore` |

### Error Output

No error is raised — the artifacts are silently committed as part of normal `git add -A` operations at:
- `autoCommitIfDirty()` (line ~509-511)
- Escalation handler (line ~960-965)
- Signal handler (line ~1197-1199)

The `RUNNER_ARTIFACTS` filtering at line ~493-498 only controls whether a commit *should happen* — once the decision to commit is made, `git add -A` stages everything not in `.gitignore`.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Runner ensures artifacts are gitignored at startup

**Given** the SDLC runner starts with a target project whose `.gitignore` does not include `.claude/auto-mode` or `.claude/sdlc-state.json`
**When** the runner creates `.claude/auto-mode`
**Then** the runner first ensures `.claude/auto-mode` and `.claude/sdlc-state.json` are listed in the target project's `.gitignore`

### AC2: Existing gitignore is preserved

**Given** the target project already has a `.gitignore` with existing entries
**When** the runner appends runner artifact patterns
**Then** existing `.gitignore` entries are not modified or removed
**And** duplicate entries are not added if the patterns are already present

### AC3: No regression — runner cleanup still works

**Given** the runner is operating normally with artifacts gitignored
**When** the runner completes a cycle or receives a shutdown signal
**Then** `.claude/auto-mode` is still removed as before (cleanup behavior preserved)

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Runner must ensure `.claude/auto-mode` and `.claude/sdlc-state.json` are in the target project's `.gitignore` before creating any runner artifacts | Must |
| FR2 | Runner must not duplicate entries if they already exist in `.gitignore` | Must |
| FR3 | Runner must not modify or remove existing `.gitignore` content | Must |
| FR4 | If the target project has no `.gitignore`, the runner must create one with the artifact patterns | Must |

---

## Out of Scope

- Modifying the `git add -A` calls to use `git add` with explicit pathspecs (defense-in-depth but separate concern)
- Adding runner artifact patterns to the nmg-plugins repo's own `.gitignore` (already done)
- Cleaning up runner artifacts that were already committed to target projects in past runs

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
