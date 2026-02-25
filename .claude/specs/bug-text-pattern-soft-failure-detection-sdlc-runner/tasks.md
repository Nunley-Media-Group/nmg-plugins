# Tasks: Text-Pattern Soft Failure Detection Missing from SDLC Runner

**Issues**: #86
**Date**: 2026-02-25
**Status**: Planning
**Author**: Claude (nmg-sdlc)

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add text-pattern scanning to `detectSoftFailure()` | [ ] |
| T002 | Add regression tests for text-pattern soft failure detection | [ ] |
| T003 | Verify no regressions in existing soft failure and success paths | [ ] |

---

### T001: Add Text-Pattern Scanning to `detectSoftFailure()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] A `TEXT_FAILURE_PATTERNS` constant array is defined near the existing `IMMEDIATE_ESCALATION_PATTERNS` constant (~line 1036), containing regex/label pairs for known text failure patterns:
  - `EnterPlanMode` (called in headless/pipe session)
  - `AskUserQuestion.*auto-mode` (called when auto-mode is active)
  - Other known text-based failure indicators as identified from runner logs
- [ ] `detectSoftFailure(stdout)` scans raw `stdout` against `TEXT_FAILURE_PATTERNS` after the existing JSON checks return no failure
- [ ] When a text pattern matches, returns `{ isSoftFailure: true, reason: 'text_pattern: <label>' }`
- [ ] The existing JSON-based checks (`subtype`, `permission_denials`) are unchanged and still execute first
- [ ] The return type and structure are unchanged — no call-site modifications needed
- [ ] `TEXT_FAILURE_PATTERNS` is exported for testability (added to the existing `export {}` block)
- [ ] No unrelated changes included in the diff

**Notes**: Follow the fix strategy from design.md. The constant array should use the same structural pattern as `IMMEDIATE_ESCALATION_PATTERNS` (array of regexes), but with an added label for human-readable Discord messages. Example structure:
```javascript
const TEXT_FAILURE_PATTERNS = [
  { pattern: /EnterPlanMode/i, label: 'EnterPlanMode' },
  { pattern: /AskUserQuestion.*auto-mode/i, label: 'AskUserQuestion in auto-mode' },
];
```

### T002: Add Regression Tests for Text-Pattern Soft Failure Detection

**File(s)**: `openclaw/scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Test: `detectSoftFailure()` returns `isSoftFailure: true` when stdout contains an `EnterPlanMode` text failure pattern
- [ ] Test: `detectSoftFailure()` returns `isSoftFailure: true` when stdout contains an `AskUserQuestion.*auto-mode` text failure pattern
- [ ] Test: `detectSoftFailure()` returns `isSoftFailure: false` when stdout contains normal success text with no failure patterns
- [ ] Test: JSON-based soft failure detection (`error_max_turns`, `permission_denials`) still works when text patterns are also present (JSON takes precedence)
- [ ] Test: `detectSoftFailure()` returns `isSoftFailure: false` for empty/null stdout
- [ ] Tests tagged or grouped under a `text-pattern soft failure` describe block
- [ ] All new tests pass with the fix applied

### T003: Verify No Regressions in Existing Soft Failure and Success Paths

**File(s)**: `openclaw/scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] All existing `detectSoftFailure` tests pass (JSON-based: `error_max_turns`, `permission_denials`, benign denials)
- [ ] All existing runner tests pass (`npm test` in `openclaw/scripts/`)
- [ ] No side effects in `runStep()`, `handleFailure()`, or `postDiscord()` — these functions are unchanged

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
