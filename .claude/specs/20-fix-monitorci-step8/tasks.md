# Tasks: Fix Step 8 (monitorCI) to resolve CI failures before advancing

**Issue**: #20
**Date**: 2026-02-15
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Rewrite Step 8 prompt and add CI validation gate | [ ] |
| T002 | Increase Step 8 resource defaults in example config | [ ] |
| T003 | Add regression Gherkin scenarios | [ ] |
| T004 | Verify no regressions | [ ] |

---

### T001: Rewrite Step 8 prompt and add CI validation gate

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 8 prompt (line 546) rewritten: explicit instructions to read CI logs, diagnose failure, apply fix, commit, push, re-poll; non-zero exit required for unresolved failures; spec-deviation guard included
- [ ] `validateCI()` function added near `validateSpecs()` (after line 865) — runs `gh pr checks`, returns `{ ok, reason }` based on `/fail/i` pattern
- [ ] Post-Step-8 validation gate added in `runStep()` after line 978, following the exact `validateSpecs` pattern: on failure, retry Step 8 up to `MAX_RETRIES`, then escalate
- [ ] No changes to any other step prompts or validation logic

**Notes**:

Prompt should include:
1. Poll `gh pr checks` until all checks complete
2. If any check fails: read the CI logs (`gh pr checks --json` or run log URL), diagnose the root cause
3. Apply a minimal fix — but first check `.claude/specs/` to ensure the fix doesn't deviate from specified behavior
4. If fix would require spec changes, exit with non-zero status and explain why
5. Commit, push, and re-poll CI
6. Only exit with code 0 when all CI checks pass
7. If unable to fix after reasonable attempts, exit non-zero

`validateCI()` should:
1. Run `gh('pr checks')` (reuse the `gh` helper)
2. Return `{ ok: true }` if no `/fail/i` match
3. Return `{ ok: false, reason: 'CI checks still failing after Step 8' }` otherwise

### T002: Increase Step 8 resource defaults in example config

**File(s)**: `openclaw/scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `monitorCI` entry changed from `{ "maxTurns": 20, "timeoutMin": 10 }` to `{ "maxTurns": 40, "timeoutMin": 20 }`
- [ ] No other config entries modified

### T003: Add regression Gherkin scenarios

**File(s)**: `.claude/specs/20-fix-monitorci-step8/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenarios cover all 4 acceptance criteria from requirements.md
- [ ] All scenarios tagged `@regression`
- [ ] Valid Gherkin syntax

### T004: Verify no regressions

**File(s)**: Existing files (no changes)
**Type**: Verify (no file changes)
**Depends**: T001, T002, T003
**Acceptance**:
- [ ] Step 8 prompt is well-formed JavaScript (no syntax errors)
- [ ] `validateCI()` follows the same pattern as `validateSpecs()`
- [ ] Post-step-8 gate follows the same pattern as post-step-3 gate
- [ ] No other steps' prompts or validation logic changed
- [ ] `sdlc-config.example.json` remains valid JSON

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T003)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
