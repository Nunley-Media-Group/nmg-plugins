# Tasks: Per-Step Model and Effort Level Configuration

**Issues**: #77, #91
**Date**: 2026-02-23
**Status**: Planning
**Author**: Claude (spec-writer)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 3 | [x] |
| Runner Script | 4 | [x] |
| Skills & Agents | 3 | [x] |
| Integration | 3 | [x] |
| Testing | 2 | [x] |
| Simplification (Issue #91) | 6 | [ ] |
| **Total** | **21** | |

---

## Phase 1: Setup

### T001: Add config validation function

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] New `validateConfig(config)` function validates `effort` values at global and per-step levels against `['low', 'medium', 'high']`
- [x] Validates `model` values are non-empty strings at global and per-step levels
- [x] Validates `implement.plan` and `implement.code` sub-step objects if present (same model/effort rules)
- [x] Returns descriptive error messages identifying the invalid field, its value, and valid options
- [x] Called immediately after config loading, before any subprocess is spawned
- [x] Missing/undefined fields are allowed (they use fallback defaults) — only explicitly set invalid values are rejected
- [x] Exported for testability

### T002: Add step config resolution helper

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] New `resolveStepConfig(step, config)` function returns `{ model, effort }` for a given step
- [x] Fallback chain for model: `step.model → config.model → 'opus'`
- [x] Fallback chain for effort: `step.effort → config.effort → undefined`
- [x] When effort resolves to `undefined`, it signals "do not set env var"
- [x] Exported for testability

### T003: Add implement sub-step resolution helper

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [x] New `resolveImplementPhaseConfig(step, config, phase)` function returns `{ model, effort, maxTurns, timeoutMin }` for `phase` = `'plan'` or `'code'`
- [x] Fallback chain: `step[phase].field → step.field → config.field → default`
- [x] Also resolves `maxTurns` and `timeoutMin` through the same chain (sub-step → step → defaults)
- [x] Exported for testability

> **Note**: Superseded by T016 (issue #91) — this function is removed.

---

## Phase 2: Runner Script

### T004: Update config loading to read global effort

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [x] New `EFFORT` module-level variable, read from `config.effort` (default: `undefined`)
- [x] `validateConfig()` called after config parsing, exits with non-zero code on failure
- [x] `main()` logs effort alongside model at startup
- [x] `__test__.setConfig()` updated to accept and set `effort`

### T005: Update `buildClaudeArgs()` and `runClaude()` for per-step model and effort

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002, T004
**Acceptance**:
- [x] `buildClaudeArgs()` uses `resolveStepConfig(step, config)` for `--model` instead of the global `MODEL` variable
- [x] `runClaude()` accepts an optional `effort` parameter
- [x] When `effort` is defined, `runClaude()` sets `CLAUDE_CODE_EFFORT_LEVEL` in the subprocess environment via `spawn()` options
- [x] When `effort` is `undefined`, the env var is not set (preserving current behavior)
- [x] The caller (`runStep()`) passes the resolved effort to `runClaude()`

### T006: Implement `runImplementStep()` for plan/code split

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T003, T005
**Acceptance**:
- [x] New `runImplementStep(step, state)` function that always runs two sequential `runClaude()` calls
- [x] Plan phase: uses `resolveImplementPhaseConfig(step, config, 'plan')` for model/effort/maxTurns/timeoutMin
- [x] Code phase: uses `resolveImplementPhaseConfig(step, config, 'code')` for model/effort/maxTurns/timeoutMin
- [x] Plan phase prompt instructs Claude to design the approach (read specs, create plan) — similar to current Step 4 prompt but scoped to planning only
- [x] Code phase prompt instructs Claude to execute the plan (implement tasks sequentially) — similar to current Step 5 but without planning
- [x] Plan phase must complete with exit code 0 before code phase starts
- [x] If plan phase fails, return the failure result directly (no code phase)
- [x] Both phases get separate step log entries (`implement-plan` and `implement-code`)
- [x] Exported for testability

> **Note**: Superseded by T017 (issue #91) — this function is removed.

### T007: Wire `runImplementStep()` into `runStep()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T006
**Acceptance**:
- [x] `runStep()` delegates step 4 (implement) to `runImplementStep()` instead of calling `runClaude()` directly
- [x] All post-step logic (soft failure detection, state extraction, auto-commit, validation gates) still runs after the code phase completes
- [x] Step log for the implement step captures both phases
- [x] Discord status updates reflect the two-phase execution (e.g., "Starting Step 4: implement (plan phase)...")

> **Note**: Superseded by T017 (issue #91) — step 4 special case is removed.

---

## Phase 3: Skills & Agents

### T008: Add `model` frontmatter to all SKILL.md files

**File(s)**:
- `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
- `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`
- `plugins/nmg-sdlc/skills/generating-openclaw-config/SKILL.md`
- `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
- `plugins/nmg-sdlc/skills/installing-openclaw-skill/SKILL.md`
- `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
- `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
- `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`
- `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
- `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
- `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] Each SKILL.md has a `model:` field in its YAML frontmatter
- [x] Model assignments match the recommendations matrix from the issue
- [x] Frontmatter is valid YAML
- [x] No other frontmatter fields are modified

### T009: Create `spec-implementer` agent

**File(s)**: `plugins/nmg-sdlc/agents/spec-implementer.md`
**Type**: Create
**Depends**: None
**Acceptance**:
- [x] Agent frontmatter includes `name: spec-implementer`, `model: sonnet`, appropriate `tools` list, and `description`
- [x] `tools` list includes: Read, Glob, Grep, Write, Edit, Bash, WebFetch, WebSearch
- [x] `tools` list does NOT include Task (agents cannot spawn subagents)
- [x] Agent instructions cover: reading specs and steering docs, executing tasks sequentially from `tasks.md`, following implementation rules, handling bug fix patterns, handling deviations, reporting completion summary
- [x] Agent instructions are self-contained (no references to SKILL.md steps — the agent must work independently)

### T010: Restructure implementing-specs to delegate code phase to spec-implementer

**File(s)**: `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
**Type**: Modify
**Depends**: T008, T009
**Acceptance**:
- [x] Frontmatter includes `model: opus` (plan phase runs on opus)
- [x] Steps 1-4 remain unchanged (identify context, read specs, read steering, design approach)
- [x] Step 5 is restructured: instead of executing tasks inline, it delegates to the `spec-implementer` agent via the Task tool
- [x] The Task tool prompt includes: the implementation plan, task list contents, spec file paths, steering doc paths, and working directory context
- [x] Step 6 receives the agent's completion summary and formats the final output
- [x] Auto-mode behavior preserved: in auto-mode, Step 4 still skips `EnterPlanMode` and designs internally, then delegates to the agent
- [x] Bug fix implementation path preserved: the agent receives the same defect-specific instructions

---

## Phase 4: Integration

### T011: Update `sdlc-config.example.json` with per-step model/effort defaults

**File(s)**: `openclaw/scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [x] Global `effort` field added (value: `"high"`)
- [x] Each step object includes `model` and `effort` fields with recommended defaults per the issue's matrix
- [x] `implement` step includes `plan` and `code` sub-objects with their own `model`, `effort`, `maxTurns`, and `timeoutMin`
- [x] JSON is valid and properly formatted (2-space indent)
- [x] Existing fields (`maxTurns`, `timeoutMin`, `skill`) are preserved

> **Note**: Superseded by T018 (issue #91) — implement config flattened, createPR maxTurns increased.

### T012: Update README with model/effort recommendations table

**File(s)**: `README.md`
**Type**: Modify
**Depends**: T008, T011
**Acceptance**:
- [x] New "Model & Effort Recommendations" section added
- [x] Table lists all skills/steps with recommended model and effort
- [x] Documents the implement plan/code split
- [x] Explains skill frontmatter `model` (manual users) vs runner config `model`/`effort` (OpenClaw)
- [x] Instructions for overriding defaults via runner config

### T013: Update CHANGELOG.md with feature entries

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T007, T010, T011
**Acceptance**:
- [x] Entries added under `[Unreleased]` section
- [x] Covers: per-step model/effort in runner, implementing-specs plan/code split, skill frontmatter model, new spec-implementer agent, config template updates

---

## Phase 5: BDD Testing (Required)

### T014: Add unit tests for new runner functions

**File(s)**: `openclaw/scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T001, T002, T003, T005, T006, T007
**Acceptance**:
- [x] `validateConfig()` tests: valid config passes; invalid effort rejected; invalid model rejected; missing fields allowed; nested implement.plan/code validated
- [x] `resolveStepConfig()` tests: step override used; falls back to global; falls back to default; effort undefined when unset
- [x] `resolveImplementPhaseConfig()` tests: sub-step override used; falls back to step; falls back to global; falls back to default
- [x] `buildClaudeArgs()` tests: per-step model in `--model` flag; global fallback used when no step override
- [x] `runClaude()` tests: `CLAUDE_CODE_EFFORT_LEVEL` set in subprocess env when effort defined; not set when undefined
- [x] `runImplementStep()` tests: two `runClaude()` calls made; plan failure prevents code phase; correct config resolution per phase
- [x] Tests follow existing patterns in the test file (ESM mocking, `__test__` helpers)

### T015: Create BDD feature file

**File(s)**: `.claude/specs/feature-per-step-model-effort-config/feature.gherkin`
**Type**: Create
**Depends**: T014
**Acceptance**:
- [x] All 9 acceptance criteria from requirements.md have corresponding scenarios
- [x] Uses Given/When/Then format
- [x] Includes error handling scenarios (AC9)
- [x] Feature file is valid Gherkin syntax

---

## Phase 6: Simplification — Issue #91

### T016: Remove `resolveImplementPhaseConfig()` and update `validateConfig()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None (reverses T003)
**Acceptance**:
- [ ] `resolveImplementPhaseConfig()` function is deleted
- [ ] `resolveImplementPhaseConfig` is removed from the named exports block
- [ ] `validateConfig()` no longer iterates over `plan`/`code` sub-objects (the `for (const phase of ['plan', 'code'])` loop is removed)
- [ ] Configs with legacy `plan`/`code` keys under `steps.implement` do not cause validation errors (keys are silently ignored)
- [ ] Configs without `plan`/`code` keys continue to validate normally

### T017: Remove `runImplementStep()` and simplify `runStep()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T016
**Acceptance**:
- [ ] `runImplementStep()` function is deleted
- [ ] `runImplementStep` is removed from the named exports block
- [ ] In `runStep()`, the `if (step.number === 4)` special case is removed — step 4 falls through to the standard `result = await runClaude(step, state)` path, same as all other steps
- [ ] Step 4 prompt in `buildClaudeArgs()` is simplified: remove "Do NOT call EnterPlanMode — this is a headless session with no user to approve plans. Design your approach internally, then implement directly." Replace with a clean prompt: "Implement the specifications for issue #${issue} on branch ${branch}. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/."
- [ ] The step 4 prompt no longer references EnterPlanMode in any form

### T018: Update `sdlc-config.example.json`

**File(s)**: `openclaw/scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T017
**Acceptance**:
- [ ] `steps.implement` is a flat object: `{ "maxTurns": 100, "timeoutMin": 30, "skill": "implementing-specs", "model": "opus", "effort": "medium" }` — no nested `plan`/`code` sub-objects
- [ ] `steps.createPR.maxTurns` is increased from 15 to 30
- [ ] All other step configs are unchanged
- [ ] JSON is valid and properly formatted (2-space indent)

### T019: Update tests for removed functions

**File(s)**: `openclaw/scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T016, T017
**Acceptance**:
- [ ] `resolveImplementPhaseConfig` test suite is removed
- [ ] `runImplementStep` test suite is removed
- [ ] `resolveImplementPhaseConfig` and `runImplementStep` are removed from the import block
- [ ] `validateConfig` tests are updated: add a test case verifying that a config with `plan`/`code` sub-objects under `steps.implement` passes validation (keys are ignored, no errors)
- [ ] A new test case verifies that step 4 in `runStep()` uses the standard `runClaude()` path (no special-case delegation)
- [ ] Existing `resolveStepConfig` and `buildClaudeArgs` tests still pass (no changes needed)

### T020: Update CHANGELOG and documentation

**File(s)**: `CHANGELOG.md`, `README.md`
**Type**: Modify
**Depends**: T016, T017, T018
**Acceptance**:
- [ ] `CHANGELOG.md` has entries under `[Unreleased]` for: removal of plan/code split, simplified implement step, createPR maxTurns increase
- [ ] `README.md` model/effort recommendations table is updated: implement step shows single invocation with `opus`/`medium` (no plan/code split mention)

### T021: Fix writing-specs auto-mode spec discovery

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] In the Spec Discovery section, step 6's auto-mode instruction is changed from "auto-select Option 1 (amend existing) without prompting" to: "skip `AskUserQuestion` entirely and proceed directly in amendment mode (amend the top-scored existing spec)"
- [ ] The instruction makes clear that in auto-mode, no `AskUserQuestion` call is made at all — the skill goes straight to amendment mode
- [ ] The non-auto-mode path (presenting the `AskUserQuestion` with amend vs create options) is unchanged

---

## Dependency Graph

```
Phase 1-5 (completed for #77):
T001 ──────────▶ T004 ──▶ T005 ──▶ T006 ──▶ T007 ──▶ T013
T002 ──────────▶ T005
T003 ──────────▶ T006, T011
T008 ──────────▶ T010, T012
T009 ──────────▶ T010
T001-T007 ─────▶ T014 ──▶ T015
T008, T011 ────▶ T012
T007, T010, T011 ──▶ T013

Phase 6 (new for #91):
T016 ──▶ T017 ──▶ T018 ──▶ T020
T016, T017 ──▶ T019
T021 (independent — writing-specs fix)
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #77 | 2026-02-22 | Initial feature spec: T001–T015 across 5 phases |
| #91 | 2026-02-23 | Phase 6 (T016–T021): remove plan/code split, simplify implement step, increase createPR maxTurns, fix writing-specs auto-mode spec discovery |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T019 unit test updates)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
