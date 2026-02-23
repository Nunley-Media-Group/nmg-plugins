# Tasks: Fix inconsistent version bumping in automated SDLC runs

**Issue**: #60
**Date**: 2026-02-19
**Status**: Planning
**Author**: Claude (nmg-sdlc)

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix: Add deterministic version bump postcondition and reinforced prompt | [ ] |
| T002 | Add regression test | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the Defect

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `validateVersionBump()` function exists and checks `git diff main -- VERSION` after Step 7
- [ ] `performDeterministicVersionBump()` function exists and performs version bumping via shell commands when `validateVersionBump()` fails
- [ ] The deterministic bump reads `VERSION`, issue labels (`gh issue view`), milestone (`gh api`), and `.claude/steering/tech.md` to compute bump type using the same classification matrix as `/creating-prs` Step 2
- [ ] The deterministic bump updates `VERSION`, `CHANGELOG.md` (moves `[Unreleased]` entries to versioned heading), and stack-specific files from `tech.md`
- [ ] The deterministic bump commits with `chore: bump version to {new_version}` and pushes
- [ ] Step 7 postcondition gate is added in `runStep()` after the existing Step 6 gate block (follows the pattern of steps 3, 6, 8)
- [ ] If version bump is missing and the deterministic bump succeeds, the step returns `'retry'` to re-run Step 7 (PR creation) with the bump commit included
- [ ] If the project has no `VERSION` file, the postcondition is skipped (returns `{ ok: true }`)
- [ ] If `VERSION` contains invalid semver, the postcondition is skipped with a log warning
- [ ] Step 7 prompt (line 810) is updated to include explicit version bumping mandate: "You MUST bump the version (Steps 2-3 of the skill) before creating the PR."
- [ ] No changes to step numbering, step keys, or config schema

**Notes**:
- Follow the fix strategy from design.md
- The postcondition gate pattern should match the existing `validateSpecs()`, `validatePush()`, and `validateCI()` patterns
- The `performDeterministicVersionBump()` function should be robust: guard against missing files, parse errors, and invalid semver
- For `CHANGELOG.md` updates, find `## [Unreleased]`, insert `## [{new_version}] - {YYYY-MM-DD}` after it, move entries
- For stack-specific files, parse the `## Versioning` table from `tech.md` (same format as `/creating-prs` Step 3)
- Use the existing `git()` and `gh()` helper functions for shell commands
- Commit format: `chore: bump version to {new_version}`

### T002: Add Regression Test

**File(s)**: `.claude/specs/60-fix-inconsistent-version-bumping/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenarios cover all 4 acceptance criteria from requirements.md
- [ ] Scenarios tagged `@regression`
- [ ] Scenario 1: Deterministic version bump step fires when LLM skips it
- [ ] Scenario 2: Reinforced prompt includes version bump mandate
- [ ] Scenario 3: Postcondition detects missing version bump and triggers recovery
- [ ] Scenario 4: Manual workflow still uses `AskUserQuestion` for version bump confirmation

### T003: Verify No Regressions

**File(s)**: existing test files, `openclaw/scripts/sdlc-runner.mjs`
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] Existing runner tests still pass (`npm test` in `openclaw/scripts/`)
- [ ] Step numbering is unchanged (STEP_KEYS array, STEPS mapping)
- [ ] Config schema is unchanged (sdlc-config.example.json)
- [ ] `/creating-prs` SKILL.md is unmodified (AC4 — manual workflow preserved)
- [ ] The postcondition does not double-bump when the LLM correctly performs Steps 2–3
- [ ] Projects without a `VERSION` file are unaffected (postcondition skipped)

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
