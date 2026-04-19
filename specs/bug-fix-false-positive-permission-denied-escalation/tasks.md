# Tasks: Fix false-positive "permission denied" substring match in SDLC runner escalation

**Issues**: #133
**Date**: 2026-04-18
**Status**: Planning
**Author**: Rich Nunley

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Remove `/permission denied/i` from `IMMEDIATE_ESCALATION_PATTERNS` | [ ] |
| T002 | Add regression tests covering AC1 and AC2 | [ ] |
| T003 | Add CHANGELOG entry and verify no regressions | [ ] |

---

### T001: Remove the false-positive pattern

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] The line `/permission denied/i,` is removed from the `IMMEDIATE_ESCALATION_PATTERNS` array at `scripts/sdlc-runner.mjs:1077-1082`
- [ ] The remaining three patterns (`context_window_exceeded`, `signal: 9`, `signal: SIGKILL`) are left untouched and in the same order
- [ ] `matchErrorPattern()` at `scripts/sdlc-runner.mjs:1086-1092` is not otherwise modified
- [ ] `detectSoftFailure()` at `scripts/sdlc-runner.mjs:1135-1166` is not modified
- [ ] `handleFailure()` at `scripts/sdlc-runner.mjs:1222-1248` is not modified
- [ ] Running `node scripts/sdlc-runner.mjs --help` (or the file's top-level parse) still loads without syntax errors

**Notes**: Single-line deletion. Do not introduce any new helper, refactor the array shape, or reorder remaining entries — the fix is a deletion, nothing more.

### T002: Add regression tests

**File(s)**: `scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify (append tests)
**Depends**: T001
**Acceptance**:
- [ ] A new test (AC1) exercises `handleFailure()` (or directly asserts `matchErrorPattern()` behavior, consistent with the existing test style in the file) with stdout containing the literal phrase `permission denied` and a stream-json `result` event whose `permission_denials` is `[]`, and asserts that no immediate escalation is triggered by `IMMEDIATE_ESCALATION_PATTERNS`
- [ ] A new test (AC2) constructs a stream-json `result` event with a real non-benign `permission_denials` entry (tool not in `BENIGN_DENIED_TOOLS`, path not in OS tmpdir) and asserts `detectSoftFailure()` returns `{ isSoftFailure: true, reason: /^permission_denials:/ }`
- [ ] Both new tests follow the existing `describe`/`test` structure and ESM import style already used in `sdlc-runner.test.mjs`
- [ ] Both tests are tagged (via describe name or comment) so that reverting the fix in T001 causes AC1 to fail, and AC2 remains passing regardless of the fix
- [ ] `cd scripts && npm test` exits 0 with the new tests passing
- [ ] No existing tests are modified or deleted

**Notes**: Prefer asserting against `matchErrorPattern()` / `detectSoftFailure()` directly rather than spawning a subprocess — matches the existing unit-test style and keeps tests fast and deterministic. If the functions aren't currently exported, export them (or use the same technique existing tests use to access internal helpers).

### T003: Update CHANGELOG and verify no regressions

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T001, T002
**Acceptance**:
- [ ] `CHANGELOG.md` has a `[Unreleased]` section (create one if missing) with a `### Fixed` entry that:
  - References issue #133
  - Summarizes the fix in 1–2 sentences (removed the duplicate text-pattern match for `permission denied`; structured `permission_denials` remains authoritative)
  - Notes the motivating incident (agentchrome issue #181 verify-step false escalation)
- [ ] `cd scripts && npm test` still exits 0 (all existing + new tests pass)
- [ ] Blast radius from design.md is reviewed: no other call sites of `IMMEDIATE_ESCALATION_PATTERNS` or `matchErrorPattern()` exist that depend on the removed entry (`grep -n 'IMMEDIATE_ESCALATION_PATTERNS\|matchErrorPattern' scripts/sdlc-runner.mjs` shows only the declaration and the single call site in `handleFailure()`)

**Notes**: No plugin version bump on this task — version bumps are handled by `/open-pr` per `steering/tech.md` Versioning.

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
