# Tasks: Per-Step Model and Effort Level Configuration

**Issues**: #77
**Date**: 2026-02-22
**Status**: Planning
**Author**: Claude (spec-writer)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 3 | [ ] |
| Runner Script | 4 | [ ] |
| Skills & Agents | 3 | [ ] |
| Integration | 3 | [ ] |
| Testing | 2 | [ ] |
| **Total** | **15** | |

---

## Phase 1: Setup

### T001: Add config validation function

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New `validateConfig(config)` function validates `effort` values at global and per-step levels against `['low', 'medium', 'high']`
- [ ] Validates `model` values are non-empty strings at global and per-step levels
- [ ] Validates `implement.plan` and `implement.code` sub-step objects if present (same model/effort rules)
- [ ] Returns descriptive error messages identifying the invalid field, its value, and valid options
- [ ] Called immediately after config loading, before any subprocess is spawned
- [ ] Missing/undefined fields are allowed (they use fallback defaults) — only explicitly set invalid values are rejected
- [ ] Exported for testability

### T002: Add step config resolution helper

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New `resolveStepConfig(step, config)` function returns `{ model, effort }` for a given step
- [ ] Fallback chain for model: `step.model → config.model → 'opus'`
- [ ] Fallback chain for effort: `step.effort → config.effort → undefined`
- [ ] When effort resolves to `undefined`, it signals "do not set env var"
- [ ] Exported for testability

### T003: Add implement sub-step resolution helper

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] New `resolveImplementPhaseConfig(step, config, phase)` function returns `{ model, effort, maxTurns, timeoutMin }` for `phase` = `'plan'` or `'code'`
- [ ] Fallback chain: `step[phase].field → step.field → config.field → default`
- [ ] Also resolves `maxTurns` and `timeoutMin` through the same chain (sub-step → step → defaults)
- [ ] Exported for testability

---

## Phase 2: Runner Script

### T004: Update config loading to read global effort

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] New `EFFORT` module-level variable, read from `config.effort` (default: `undefined`)
- [ ] `validateConfig()` called after config parsing, exits with non-zero code on failure
- [ ] `main()` logs effort alongside model at startup
- [ ] `__test__.setConfig()` updated to accept and set `effort`

### T005: Update `buildClaudeArgs()` and `runClaude()` for per-step model and effort

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002, T004
**Acceptance**:
- [ ] `buildClaudeArgs()` uses `resolveStepConfig(step, config)` for `--model` instead of the global `MODEL` variable
- [ ] `runClaude()` accepts an optional `effort` parameter
- [ ] When `effort` is defined, `runClaude()` sets `CLAUDE_CODE_EFFORT_LEVEL` in the subprocess environment via `spawn()` options
- [ ] When `effort` is `undefined`, the env var is not set (preserving current behavior)
- [ ] The caller (`runStep()`) passes the resolved effort to `runClaude()`

### T006: Implement `runImplementStep()` for plan/code split

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T003, T005
**Acceptance**:
- [ ] New `runImplementStep(step, state)` function that always runs two sequential `runClaude()` calls
- [ ] Plan phase: uses `resolveImplementPhaseConfig(step, config, 'plan')` for model/effort/maxTurns/timeoutMin
- [ ] Code phase: uses `resolveImplementPhaseConfig(step, config, 'code')` for model/effort/maxTurns/timeoutMin
- [ ] Plan phase prompt instructs Claude to design the approach (read specs, create plan) — similar to current Step 4 prompt but scoped to planning only
- [ ] Code phase prompt instructs Claude to execute the plan (implement tasks sequentially) — similar to current Step 5 but without planning
- [ ] Plan phase must complete with exit code 0 before code phase starts
- [ ] If plan phase fails, return the failure result directly (no code phase)
- [ ] Both phases get separate step log entries (`implement-plan` and `implement-code`)
- [ ] Exported for testability

### T007: Wire `runImplementStep()` into `runStep()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T006
**Acceptance**:
- [ ] `runStep()` delegates step 4 (implement) to `runImplementStep()` instead of calling `runClaude()` directly
- [ ] All post-step logic (soft failure detection, state extraction, auto-commit, validation gates) still runs after the code phase completes
- [ ] Step log for the implement step captures both phases
- [ ] Discord status updates reflect the two-phase execution (e.g., "Starting Step 4: implement (plan phase)...")

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
- [ ] Each SKILL.md has a `model:` field in its YAML frontmatter
- [ ] Model assignments match the recommendations matrix from the issue
- [ ] Frontmatter is valid YAML
- [ ] No other frontmatter fields are modified

### T009: Create `spec-implementer` agent

**File(s)**: `plugins/nmg-sdlc/agents/spec-implementer.md`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] Agent frontmatter includes `name: spec-implementer`, `model: sonnet`, appropriate `tools` list, and `description`
- [ ] `tools` list includes: Read, Glob, Grep, Write, Edit, Bash, WebFetch, WebSearch
- [ ] `tools` list does NOT include Task (agents cannot spawn subagents)
- [ ] Agent instructions cover: reading specs and steering docs, executing tasks sequentially from `tasks.md`, following implementation rules, handling bug fix patterns, handling deviations, reporting completion summary
- [ ] Agent instructions are self-contained (no references to SKILL.md steps — the agent must work independently)

### T010: Restructure implementing-specs to delegate code phase to spec-implementer

**File(s)**: `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
**Type**: Modify
**Depends**: T008, T009
**Acceptance**:
- [ ] Frontmatter includes `model: opus` (plan phase runs on opus)
- [ ] Steps 1-4 remain unchanged (identify context, read specs, read steering, design approach)
- [ ] Step 5 is restructured: instead of executing tasks inline, it delegates to the `spec-implementer` agent via the Task tool
- [ ] The Task tool prompt includes: the implementation plan, task list contents, spec file paths, steering doc paths, and working directory context
- [ ] Step 6 receives the agent's completion summary and formats the final output
- [ ] Auto-mode behavior preserved: in auto-mode, Step 4 still skips `EnterPlanMode` and designs internally, then delegates to the agent
- [ ] Bug fix implementation path preserved: the agent receives the same defect-specific instructions

---

## Phase 4: Integration

### T011: Update `sdlc-config.example.json` with per-step model/effort defaults

**File(s)**: `openclaw/scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] Global `effort` field added (value: `"high"`)
- [ ] Each step object includes `model` and `effort` fields with recommended defaults per the issue's matrix
- [ ] `implement` step includes `plan` and `code` sub-objects with their own `model`, `effort`, `maxTurns`, and `timeoutMin`
- [ ] JSON is valid and properly formatted (2-space indent)
- [ ] Existing fields (`maxTurns`, `timeoutMin`, `skill`) are preserved

### T012: Update README with model/effort recommendations table

**File(s)**: `README.md`
**Type**: Modify
**Depends**: T008, T011
**Acceptance**:
- [ ] New "Model & Effort Recommendations" section added
- [ ] Table lists all skills/steps with recommended model and effort
- [ ] Documents the implement plan/code split
- [ ] Explains skill frontmatter `model` (manual users) vs runner config `model`/`effort` (OpenClaw)
- [ ] Instructions for overriding defaults via runner config

### T013: Update CHANGELOG.md with feature entries

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T007, T010, T011
**Acceptance**:
- [ ] Entries added under `[Unreleased]` section
- [ ] Covers: per-step model/effort in runner, implementing-specs plan/code split, skill frontmatter model, new spec-implementer agent, config template updates

---

## Phase 5: BDD Testing (Required)

### T014: Add unit tests for new runner functions

**File(s)**: `openclaw/scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T001, T002, T003, T005, T006, T007
**Acceptance**:
- [ ] `validateConfig()` tests: valid config passes; invalid effort rejected; invalid model rejected; missing fields allowed; nested implement.plan/code validated
- [ ] `resolveStepConfig()` tests: step override used; falls back to global; falls back to default; effort undefined when unset
- [ ] `resolveImplementPhaseConfig()` tests: sub-step override used; falls back to step; falls back to global; falls back to default
- [ ] `buildClaudeArgs()` tests: per-step model in `--model` flag; global fallback used when no step override
- [ ] `runClaude()` tests: `CLAUDE_CODE_EFFORT_LEVEL` set in subprocess env when effort defined; not set when undefined
- [ ] `runImplementStep()` tests: two `runClaude()` calls made; plan failure prevents code phase; correct config resolution per phase
- [ ] Tests follow existing patterns in the test file (ESM mocking, `__test__` helpers)

### T015: Create BDD feature file

**File(s)**: `.claude/specs/77-per-step-model-effort-config/feature.gherkin`
**Type**: Create
**Depends**: T014
**Acceptance**:
- [ ] All 9 acceptance criteria from requirements.md have corresponding scenarios
- [ ] Uses Given/When/Then format
- [ ] Includes error handling scenarios (AC9)
- [ ] Feature file is valid Gherkin syntax

---

## Dependency Graph

```
T001 ──────────▶ T004 ──▶ T005 ──▶ T006 ──▶ T007 ──▶ T013
                                     ▲
T002 ──────────▶ T005               │
                                     │
T003 ──────────▶ T006, T011         │
                                     │
T008 ──────────▶ T010, T012         │
                                     │
T009 ──────────▶ T010               │
                                     │
T001, T002, T003, T005, T006, T007 ──▶ T014 ──▶ T015
                                     │
T008, T011 ────▶ T012               │
                                     │
T007, T010, T011 ──▶ T013           │
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #77 | 2026-02-22 | Initial feature spec |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T014 unit tests, T015 BDD feature file)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
