# Tasks: Detect Soft Failures (error_max_turns) and Add Runner Test Suite

**Issue**: #38
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude (nmg-sdlc)

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add soft failure detection to the runner | [ ] |
| T002 | Refactor runner for testability (isMainModule guard + exports) | [ ] |
| T003 | Create Jest test suite with ESM config | [ ] |
| T004 | Improve auto-mode instruction prominence in starting-issues | [ ] |
| T005 | Verify no regressions | [ ] |

---

### T001: Add Soft Failure Detection to the Runner

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New `detectSoftFailure(stdout)` function added that parses JSON output
- [ ] Returns `{ isSoftFailure: true, reason: '...' }` when `subtype` is `"error_max_turns"`
- [ ] Returns `{ isSoftFailure: true, reason: '...' }` when `permission_denials` is a non-empty array
- [ ] Returns `{ isSoftFailure: false }` when `subtype` is `"success"` and no denials
- [ ] Returns `{ isSoftFailure: false }` when stdout is not valid JSON (graceful fallback)
- [ ] `runStep()` calls `detectSoftFailure()` after `exitCode === 0` check, before state extraction
- [ ] Soft failures are logged and routed to `handleFailure()` with the result

**Notes**: Insert the check at line ~1201, inside the `if (result.exitCode === 0)` block. If soft failure detected, log the reason and fall through to the failure handler at the end of the function. Keep the existing `extractSessionId()` JSON parsing separate — it has different error handling semantics.

---

### T002: Refactor Runner for Testability

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] CLI bootstrap code (argument parsing, config loading, `main()` call) is guarded behind an `isMainModule` check
- [ ] All internal functions are exported via a named export block at the bottom of the file
- [ ] Exported functions include at minimum: `detectSoftFailure`, `detectAndHydrateState`, `validatePreconditions`, `extractStateFromStep`, `matchErrorPattern`, `incrementBounceCount`, `defaultState`, `validateSpecs`, `validateCI`, `validatePush`, `autoCommitIfDirty`, `buildClaudeArgs`, `readSkill`, `handleFailure`, `escalate`, `haltFailureLoop`, `runStep`
- [ ] The script still runs correctly as a CLI tool (`node sdlc-runner.mjs --config ...`)
- [ ] Module-level mutable state (e.g., `bounceCount`, `consecutiveEscalations`, `escalatedIssues`) is accessible for test setup/reset

**Notes**: Use `import.meta.url` comparison with `process.argv[1]` (resolved via `node:url` `fileURLToPath`) to detect main module. Wrap the CLI bootstrap (lines 28–87 and the final `main().catch(...)` call) in the guard. Export a `__test__` namespace or individual named exports for test access. Consider exporting a `resetTestState()` helper that resets module-level counters.

---

### T003: Create Comprehensive Jest Test Suite

**File(s)**: `openclaw/scripts/package.json`, `openclaw/scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Create
**Depends**: T002
**Acceptance**:
- [ ] `package.json` exists with Jest as dev dependency, configured for ESM (`"type": "module"`, `--experimental-vm-modules`)
- [ ] Test file covers all core runner functionality:
  - `detectSoftFailure()` — error_max_turns, permission_denials, normal success, invalid JSON
  - `validatePreconditions()` — all 9 step precondition checks (pass and fail cases)
  - `extractStateFromStep()` — state extraction for steps 1, 2, 3, 7, 9
  - `matchErrorPattern()` — all immediate escalation patterns, rate limit, no match
  - `incrementBounceCount()` — threshold detection, reset behavior
  - `detectAndHydrateState()` — main branch, feature branch at various stages, merged PR
  - `autoCommitIfDirty()` — dirty tree, clean tree, runner artifacts only, dry-run
  - `defaultState()` — returns expected shape
  - `validateSpecs()` — all files present, missing files, missing directory
  - `validateCI()` — passing, failing, error
  - `validatePush()` — pushed, unpushed, error
  - `buildClaudeArgs()` — verifies correct argument construction per step
  - Soft failure integration — `runStep()` routes soft failures to handleFailure
- [ ] Tests use mocks for `node:child_process` (`execSync`, `spawn`), `node:fs`, and external commands (`git`, `gh`)
- [ ] All tests pass with `npm test` (or `npx jest`)
- [ ] Tests tagged/organized by functional area

**Notes**: Use `jest.unstable_mockModule()` for ESM module mocking. Structure tests with `describe` blocks per functional area. Use `beforeEach` to reset module-level state via the exported reset helper. For `spawn`-based functions (`runClaude`, `postDiscord`), mock the spawn return value with event emitters.

---

### T004: Improve Auto-Mode Instruction Prominence in Starting-Issues

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] A bold critical callout is added immediately after the frontmatter, before the skill title or "When to Use" section, stating: in headless/auto-mode, NEVER call `AskUserQuestion`
- [ ] The existing "Automation Mode" section content is preserved but reformatted for emphasis (bold key directives)
- [ ] Step 2 (Present Issue Selection) includes a reminder: "If `.claude/auto-mode` exists, skip this step entirely — do NOT call `AskUserQuestion`"
- [ ] No changes to manual-mode workflow behavior

**Notes**: The goal is to make the instruction impossible to miss. Position the critical directive at the top of the file where Claude reads it first, and repeat it at the point of action (Step 2). Use bold markdown and explicit tool name references.

---

### T005: Verify No Regressions

**File(s)**: existing test files, `openclaw/scripts/sdlc-runner.mjs`
**Type**: Verify (no file changes)
**Depends**: T001, T002, T003, T004
**Acceptance**:
- [ ] All Jest tests pass (`npm test` in `openclaw/scripts/`)
- [ ] Script still runs correctly as CLI (`node sdlc-runner.mjs --help` exits 0)
- [ ] No side effects in related code paths (per blast radius from design.md)
- [ ] `starting-issues` SKILL.md manual-mode workflow is unchanged

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T003 covers AC1–AC3 and all runner functionality)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
