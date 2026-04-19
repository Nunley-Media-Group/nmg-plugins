# Tasks: Per-Step Model and Effort Level Configuration

**Issues**: #77, #91, #130
**Date**: 2026-04-18
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
| Simplification (Issue #91) | 6 | [x] |
| Defaults Optimization (Issue #130) | 10 | [x] |
| **Total** | **31** | |

---

## Phase 1: Setup

### T001: Add config validation function

**File(s)**: `scripts/sdlc-runner.mjs`
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

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] New `resolveStepConfig(step, config)` function returns `{ model, effort }` for a given step
- [x] Fallback chain for model: `step.model → config.model → 'opus'`
- [x] Fallback chain for effort: `step.effort → config.effort → undefined`
- [x] When effort resolves to `undefined`, it signals "do not set env var"
- [x] Exported for testability

### T003: Add implement sub-step resolution helper

**File(s)**: `scripts/sdlc-runner.mjs`
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

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [x] New `EFFORT` module-level variable, read from `config.effort` (default: `undefined`)
- [x] `validateConfig()` called after config parsing, exits with non-zero code on failure
- [x] `main()` logs effort alongside model at startup
- [x] `__test__.setConfig()` updated to accept and set `effort`

### T005: Update `buildClaudeArgs()` and `runClaude()` for per-step model and effort

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002, T004
**Acceptance**:
- [x] `buildClaudeArgs()` uses `resolveStepConfig(step, config)` for `--model` instead of the global `MODEL` variable
- [x] `runClaude()` accepts an optional `effort` parameter
- [x] When `effort` is defined, `runClaude()` sets `CLAUDE_CODE_EFFORT_LEVEL` in the subprocess environment via `spawn()` options
- [x] When `effort` is `undefined`, the env var is not set (preserving current behavior)
- [x] The caller (`runStep()`) passes the resolved effort to `runClaude()`

### T006: Implement `runImplementStep()` for plan/code split

**File(s)**: `scripts/sdlc-runner.mjs`
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

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T006
**Acceptance**:
- [x] `runStep()` delegates step 4 (implement) to `runImplementStep()` instead of calling `runClaude()` directly
- [x] All post-step logic (soft failure detection, state extraction, auto-commit, validation gates) still runs after the code phase completes
- [x] Step log for the implement step captures both phases
- [x] Status notifications to the orchestration log reflect the two-phase execution (e.g., "Starting Step 4: implement (plan phase)...")

> **Note**: Superseded by T017 (issue #91) — step 4 special case is removed.

---

## Phase 3: Skills & Agents

### T008: Add `model` frontmatter to all SKILL.md files

**File(s)**:
- `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
- `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
- `plugins/nmg-sdlc/skills/init-config/SKILL.md`
- `plugins/nmg-sdlc/skills/write-code/SKILL.md`
- `plugins/nmg-sdlc/skills/migrate-project/SKILL.md`
- `plugins/nmg-sdlc/skills/run-retro/SKILL.md`
- `plugins/nmg-sdlc/skills/setup-steering/SKILL.md`
- `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
- `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
- `plugins/nmg-sdlc/skills/write-spec/SKILL.md`
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

### T010: Restructure write-code to delegate code phase to spec-implementer

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md`
**Type**: Modify
**Depends**: T008, T009
**Acceptance**:
- [x] Frontmatter includes `model: opus` (plan phase runs on opus)
- [x] Steps 1-4 remain unchanged (identify context, read specs, read steering, design approach)
- [x] Step 5 is restructured: instead of executing tasks inline, it delegates to the `spec-implementer` agent via the Task tool
- [x] The Task tool prompt includes: the implementation plan, task list contents, spec file paths, steering doc paths, and working directory context
- [x] Step 6 receives the agent's completion summary and formats the final output
- [x] Unattended-mode behavior preserved: in unattended-mode, Step 4 still skips `EnterPlanMode` and designs internally, then delegates to the agent
- [x] Bug fix implementation path preserved: the agent receives the same defect-specific instructions

---

## Phase 4: Integration

### T011: Update `sdlc-config.example.json` with per-step model/effort defaults

**File(s)**: `scripts/sdlc-config.example.json`
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
- [x] Explains skill frontmatter `model` (manual users) vs runner config `model`/`effort` (SDLC runner)
- [x] Instructions for overriding defaults via runner config

### T013: Update CHANGELOG.md with feature entries

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T007, T010, T011
**Acceptance**:
- [x] Entries added under `[Unreleased]` section
- [x] Covers: per-step model/effort in runner, write-code plan/code split, skill frontmatter model, new spec-implementer agent, config template updates

---

## Phase 5: BDD Testing (Required)

### T014: Add unit tests for new runner functions

**File(s)**: `scripts/__tests__/sdlc-runner.test.mjs`
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

**File(s)**: `specs/feature-per-step-model-effort-config/feature.gherkin`
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

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None (reverses T003)
**Acceptance**:
- [x] `resolveImplementPhaseConfig()` function is deleted
- [x] `resolveImplementPhaseConfig` is removed from the named exports block
- [x] `validateConfig()` no longer iterates over `plan`/`code` sub-objects (the `for (const phase of ['plan', 'code'])` loop is removed)
- [x] Configs with legacy `plan`/`code` keys under `steps.implement` do not cause validation errors (keys are silently ignored)
- [x] Configs without `plan`/`code` keys continue to validate normally

### T017: Remove `runImplementStep()` and simplify `runStep()`

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T016
**Acceptance**:
- [x] `runImplementStep()` function is deleted
- [x] `runImplementStep` is removed from the named exports block
- [x] In `runStep()`, the `if (step.number === 4)` special case is removed — step 4 falls through to the standard `result = await runClaude(step, state)` path, same as all other steps
- [x] Step 4 prompt in `buildClaudeArgs()` is simplified: remove "Do NOT call EnterPlanMode — this is a headless session with no user to approve plans. Design your approach internally, then implement directly." Replace with a clean prompt: "Implement the specifications for issue #${issue} on branch ${branch}. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/."
- [x] The step 4 prompt no longer references EnterPlanMode in any form

### T018: Update `sdlc-config.example.json`

**File(s)**: `scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T017
**Acceptance**:
- [x] `steps.implement` is a flat object with no nested `plan`/`code` sub-objects
- [x] `steps.createPR.maxTurns` is increased (to 45 per AC36)
- [x] All other step configs are unchanged
- [x] JSON is valid and properly formatted (2-space indent)

### T019: Update tests for removed functions

**File(s)**: `scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T016, T017
**Acceptance**:
- [x] `resolveImplementPhaseConfig` test suite is removed
- [x] `runImplementStep` test suite is removed
- [x] `resolveImplementPhaseConfig` and `runImplementStep` are removed from the import block
- [x] `validateConfig` tests are updated: add a test case verifying that a config with `plan`/`code` sub-objects under `steps.implement` passes validation (keys are ignored, no errors)
- [x] A new test case verifies that step 4 in `runStep()` uses the standard `runClaude()` path (no special-case delegation)
- [x] Existing `resolveStepConfig` and `buildClaudeArgs` tests still pass (no changes needed)

### T020: Update CHANGELOG and documentation

**File(s)**: `CHANGELOG.md`, `README.md`
**Type**: Modify
**Depends**: T016, T017, T018
**Acceptance**:
- [x] `CHANGELOG.md` has entries under `[Unreleased]` for the defaults rework and maxTurns bump
- [x] `README.md` model/effort recommendations table is updated with new defaults table

### T021: Fix write-spec unattended-mode spec discovery

**File(s)**: `plugins/nmg-sdlc/skills/write-spec/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] In the Spec Discovery section, step 6's unattended-mode instruction skips `AskUserQuestion` entirely and proceeds directly in amendment mode (amend the top-scored existing spec)
- [x] The instruction makes clear that in unattended-mode, no `AskUserQuestion` call is made at all — the skill goes straight to amendment mode
- [x] The non-unattended-mode path (presenting the `AskUserQuestion` with amend vs create options) is unchanged

---

## Phase 7: Defaults Optimization — Issue #130

### T022: Expand `VALID_EFFORTS` and reject `max`

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `VALID_EFFORTS` at line 26 is updated to `['low', 'medium', 'high', 'xhigh']` (exact string literal `xhigh`, no hyphen)
- [ ] `validateConfig()` adds an explicit rejection branch for `effort === 'max'` (global and per-step) with a message stating that `max` is intentionally excluded from nmg-sdlc defaults
- [ ] The generic "must be one of" error message still fires for other invalid values (e.g., `"maximum"`, `"xtra-high"`)
- [ ] The `max` rejection message is distinct enough to be greppable in logs

### T023: Reject effort on Haiku steps in `validateConfig()`

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T022
**Acceptance**:
- [ ] `validateConfig()` iterates steps and rejects any step config where `model === 'haiku'` and `effort` is defined (any value)
- [ ] Error message identifies the step key and explains that Haiku does not support the effort parameter
- [ ] Same rule applies if the resolved (global fallback) effort would land on a Haiku step — the rule is enforced at the final resolved level, not just at the step-defined level (i.e., a Haiku step with no step-level effort but a global `effort` present is flagged)
- [ ] A step without a model (falling back to global) that happens to be Haiku is also flagged if effort is defined
- [ ] Test coverage added in T029

### T024: Update `resolveStepConfig()` and module defaults

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T022
**Acceptance**:
- [ ] `resolveStepConfig()` (lines 225-230) returns `model: step.model || config.model || 'sonnet'` (was `'opus'`)
- [ ] `resolveStepConfig()` returns `effort: step.effort || config.effort || 'medium'` (was `undefined`)
- [ ] Module-level init (lines 104-105) updated: `MODEL = config.model || 'sonnet'`; `EFFORT = config.effort || 'medium'`
- [ ] Existing tests that assert the old `'opus'` default are updated in T029

### T025: Rewrite `sdlc-config.example.json` per AC30 / AC36 tables

**File(s)**: `scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T024
**Acceptance**:
- [ ] Global `model` changed to `"sonnet"` and `effort` to `"medium"`
- [ ] Every step object explicitly declares `model`, `maxTurns`, `timeoutMin` (in that order of precedence for consistency with existing style)
- [ ] Every step with a non-Haiku model also declares `effort`; steps with `model: "haiku"` omit `effort`
- [ ] Per-step values match the AC30 reference table exactly (model, effort) and AC36 floors exactly (maxTurns)
- [ ] `timeoutMin` values are preserved from the prior config (no time-axis changes this round)
- [ ] `startCycle` is no longer the only step that inherits the global model — it gets an explicit `"model": "haiku"`
- [ ] Opus hard cap verified: `writeSpecs`, `implement`, `verify` are the only steps with `"model": "opus"`
- [ ] JSON is valid, 2-space indented

### T026: Add `model` and `effort` frontmatter to SDLC skills

**File(s)**:
- `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
- `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
- `plugins/nmg-sdlc/skills/write-spec/SKILL.md`
- `plugins/nmg-sdlc/skills/write-code/SKILL.md`
- `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
- `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
- `plugins/nmg-sdlc/skills/run-retro/SKILL.md`
- `plugins/nmg-sdlc/skills/setup-steering/SKILL.md`
- `plugins/nmg-sdlc/skills/init-config/SKILL.md`
- `plugins/nmg-sdlc/skills/run-loop/SKILL.md`
- `plugins/nmg-sdlc/skills/upgrade-project/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Each SKILL.md has a `model:` field in its YAML frontmatter matching the AC33 mapping
- [ ] Opus/Sonnet skills also declare `effort:` per the mapping
- [ ] `init-config/SKILL.md` declares `model: haiku` and omits `effort:` entirely
- [ ] All authoring goes through `/skill-creator` per project rule (`steering/tech.md` line 110) — do not hand-edit SKILL.md frontmatter; use `skill-creator` to apply the frontmatter changes
- [ ] Frontmatter remains valid YAML; no other frontmatter fields altered
- [ ] A grep verification confirms the pairs exist: e.g., `plugins/nmg-sdlc/skills/write-code/SKILL.md` contains both `model: opus` and `effort: xhigh`

### T027: Rewrite README recommendations table + add precedence subsection

**File(s)**: `README.md`
**Type**: Modify
**Depends**: T025, T026
**Acceptance**:
- [ ] "Recommended model assignments" table (~lines 183-195) rewritten per AC30 table, including a rationale column citing Anthropic's published effort guidance
- [ ] Table rows reflect the hard cap on Opus (only `writeSpecs`/`implement`/`verify`)
- [ ] The Haiku entries clearly show effort as `—` (omitted), not blank
- [ ] A new subsection documents the precedence chain per AC34: `env var > skill frontmatter > session /model / /effort > built-in default`
- [ ] A short note documents that `max` is intentionally excluded from nmg-sdlc defaults, and that Haiku does not accept `effort`
- [ ] Links to Anthropic's effort-level docs (`https://platform.claude.com/docs/en/build-with-claude/effort`) and model config docs (`https://code.claude.com/docs/en/model-config`) are present

### T028: Add `[Unreleased]` CHANGELOG entries

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T024, T025, T026
**Acceptance**:
- [ ] One `[Unreleased]` bullet summarizes the defaults rework: new `xhigh` tier accepted; `max` rejected; Haiku+effort rejected; global default flipped to `sonnet`/`medium`; Opus hard-capped to `writeSpecs`/`implement`/`verify`
- [ ] A second bullet documents the `maxTurns` floor bump across steps and cites #181 as the motivating incident (per Issue #130 addendum FR17/FR35)
- [ ] A migration note points users to `/upgrade-project` for applying the new defaults to existing configs
- [ ] Style matches existing CHANGELOG entries (conventional-commit-flavored bullets)

### T029: Update `sdlc-runner.test.mjs` for new defaults and validation rules

**File(s)**: `scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T022, T023, T024
**Acceptance**:
- [ ] New test: `validateConfig()` accepts `effort: 'xhigh'` at both global and per-step levels
- [ ] New test: `validateConfig()` rejects `effort: 'max'` with the policy-specific message
- [ ] New test: `validateConfig()` rejects a step config with `model: 'haiku'` + `effort: <any>`
- [ ] New test: `validateConfig()` rejects a Haiku step whose global-fallback effort is defined (covers the "resolved level" case)
- [ ] New test: `resolveStepConfig()` returns `{ model: 'sonnet', effort: 'medium' }` when step and global are empty
- [ ] Existing tests asserting the old `opus`/`undefined` default are updated to the new defaults
- [ ] All tests pass (`cd scripts && npm test`)

### T030: Extend `upgrade-project` with curated defaults diff

**File(s)**: `plugins/nmg-sdlc/skills/upgrade-project/SKILL.md`
**Type**: Modify
**Depends**: T025
**Acceptance**:
- [ ] A new section describes the "recommended defaults diff" flow: compare each `steps.*.{model,effort,maxTurns,timeoutMin}` in the user's config against the shipped example and present a table of differences
- [ ] The flow offers batch-approve + per-field review options in interactive mode
- [ ] In unattended mode, the diff is reported in the summary but not auto-applied (consistent with existing value-drift rules)
- [ ] The skill authoring uses `/skill-creator` per project rule (`steering/tech.md` line 110)
- [ ] The section explicitly states this is additive — the existing key-merge behavior is preserved; only value-drift handling for the per-step defaults gains the curated flow

### T031: Verify `init-config` template substitution preserves new defaults

**File(s)**: `plugins/nmg-sdlc/skills/init-config/SKILL.md`, `scripts/sdlc-config.example.json`
**Type**: Verify
**Depends**: T025
**Acceptance**:
- [ ] Exercise test: running `/nmg-sdlc:init-config` on a fresh test project produces a `sdlc-config.json` whose step defaults match the example JSON verbatim
- [ ] No template placeholders are left for per-step `model` / `effort` / `maxTurns` / `timeoutMin`
- [ ] The Opus hard cap holds in the generated file
- [ ] If substitution logic needs updating to preserve the new fields, the change goes through `/skill-creator`
- [ ] Finding is recorded in the verification report (pass or specific remediation)

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
T021 (independent — write-spec fix)

Phase 7 (new for #130):
T022 ──▶ T023
T022 ──▶ T024
T024 ──▶ T025 ──▶ T027
T026 ──▶ T027
T022, T023, T024 ──▶ T029
T025 ──▶ T030
T025 ──▶ T031
T024, T025, T026 ──▶ T028
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #77 | 2026-02-22 | Initial feature spec: T001–T015 across 5 phases |
| #91 | 2026-02-23 | Phase 6 (T016–T021): remove plan/code split, simplify implement step, increase createPR maxTurns, fix write-spec unattended-mode spec discovery |
| #130 | 2026-04-18 | Phase 7 (T022–T031): expand VALID_EFFORTS with `xhigh`; reject `max` + Haiku+effort; flip runner default to sonnet/medium; rewrite example config per AC30/AC36; add `model`/`effort` frontmatter to SDLC skills; rewrite README table + add precedence subsection; CHANGELOG entries; tests; curated `upgrade-project` diff; verify `init-config` substitution |

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
