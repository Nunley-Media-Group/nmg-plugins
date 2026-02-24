# Requirements: Per-Step Model and Effort Level Configuration

**Issues**: #77, #91
**Date**: 2026-02-23
**Status**: Draft
**Author**: Claude (spec-writer)

---

## User Story

**As a** developer or OpenClaw automation agent running the SDLC workflow
**I want** per-step model and effort level configuration
**So that** each SDLC phase uses the optimal model for its task — high-reasoning models for planning and spec writing, efficient models for mechanical work — balancing quality and cost

---

## Background

The SDLC runner currently uses a single global model (`config.model`, default `"opus"`) for all steps. Every `claude -p` subprocess runs on the same model at the same (unspecified) effort level. This is suboptimal: spec writing and architecture review benefit from Opus-class reasoning, while implementation coding and mechanical tasks can use Sonnet efficiently.

Claude Code supports two relevant configuration mechanisms:
1. **Skill frontmatter `model` field** — enforced at runtime when a skill is loaded manually. Currently no nmg-sdlc SKILL.md files declare this field (only the `architecture-reviewer` agent does).
2. **`CLAUDE_CODE_EFFORT_LEVEL` environment variable** — session-scoped, valid values: `low`, `medium`, `high`. Currently never set by the runner.

The runner's `buildClaudeArgs()` function already supports per-step `maxTurns` and `timeoutMin` via the step config object, but `model` is hardcoded to the global `MODEL` variable and `effort` is not handled at all.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Runner Supports Per-Step Model Override

**Given** a `sdlc-config.json` with a step that has a `model` field (e.g., `"writeSpecs": { "model": "opus", ... }`)
**When** the runner executes that step
**Then** the `claude` subprocess is spawned with `--model` set to the step's model value

**And** the global `model` config is used as fallback for steps without a per-step `model`

**Example**:
- Given: config has `"model": "sonnet"` globally and `"writeSpecs": { "model": "opus" }`
- When: the runner executes the writeSpecs step
- Then: `claude -p ... --model opus` is invoked

### AC2: Runner Supports Per-Step Effort Override

**Given** a `sdlc-config.json` with a step that has an `effort` field (e.g., `"writeSpecs": { "effort": "high" }`)
**When** the runner executes that step
**Then** the `claude` subprocess is spawned with `CLAUDE_CODE_EFFORT_LEVEL` set to the step's effort value in its environment

**And** the global `effort` config is used as fallback for steps without a per-step `effort`

**Example**:
- Given: config has `"effort": "high"` globally and `"startIssue": { "effort": "medium" }`
- When: the runner executes the startIssue step
- Then: the subprocess environment includes `CLAUDE_CODE_EFFORT_LEVEL=medium`

### ~~AC3: Implementing-Specs Always Splits Into Planning and Coding Phases~~ (Superseded by AC10)

~~**Given** the runner reaches the implement step~~
~~**When** it executes implementing-specs~~
~~**Then** it always runs two separate `claude -p` subprocesses sequentially~~

> **Superseded by AC10 (issue #91):** The implement step now uses a single `runClaude()` invocation, matching all other runner steps. The skill's auto-mode logic handles planning internally.

### AC4: Backward Compatibility Preserved

**Given** a `sdlc-config.json` without any per-step `model` or `effort` fields (existing format)
**When** the runner executes all steps
**Then** all steps use the global `model` (defaulting to `"opus"` if unset) with no `CLAUDE_CODE_EFFORT_LEVEL` set (preserving current behavior)

### AC5: Config Template Shows Per-Step Model/Effort Examples

**Given** a user reads `sdlc-config.example.json`
**When** they review the step configuration
**Then** each step includes `model` and `effort` fields with recommended defaults matching the recommendations matrix from the issue
**And** the implement step shows a flat step config (no nested `plan`/`code` objects) with `model: "opus"` and `effort: "medium"` as defaults

### AC6: Skill Frontmatter Includes Model Field

**Given** any nmg-sdlc SKILL.md file
**When** Claude Code loads it for manual invocation
**Then** the `model` frontmatter field enforces the recommended model for that skill's execution

**Example**:
- Given: `writing-specs/SKILL.md` has `model: opus` in frontmatter
- When: a user manually runs `/nmg-sdlc:writing-specs`
- Then: Claude Code uses the Opus model for that session regardless of the session's default model

### AC7: README Documents Model/Effort Recommendations

**Given** a user reads the README
**When** they look for model/effort guidance
**Then** they find a table of recommended model and effort settings per skill/step
**And** instructions for overriding defaults via runner config

### AC8: Global Effort Fallback Works

**Given** a `sdlc-config.json` with a global `effort` field but no per-step effort overrides
**When** the runner executes any step
**Then** every subprocess is spawned with `CLAUDE_CODE_EFFORT_LEVEL` set to the global effort value

**Example**:
- Given: config has `"effort": "high"` and no per-step effort fields
- When: runner executes writeSpecs step
- Then: subprocess environment includes `CLAUDE_CODE_EFFORT_LEVEL=high`

### AC9: Invalid Model or Effort Values Are Rejected

**Given** a `sdlc-config.json` with an invalid `effort` value (e.g., `"effort": "maximum"`) or an empty `model` value
**When** the runner starts
**Then** it exits with a non-zero exit code and a descriptive error message identifying the invalid field and valid options

### AC10: Single Invocation for Implement Step

**Given** the runner reaches Step 4 (implement)
**When** it executes the implement step
**Then** it calls `runClaude()` once (like all other steps), using the skill's auto-mode to handle planning and execution internally
**And** the `runImplementStep()` function is no longer called
**And** the `resolveImplementPhaseConfig()` function is no longer used

**Example**:
- Given: runner reaches step 4 with issue #42 on branch 42-add-feature
- When: it executes the implement step
- Then: a single `claude -p` subprocess runs with `--model opus` and `CLAUDE_CODE_EFFORT_LEVEL=medium`

### AC11: Implement Step Default Model and Effort

**Given** no step-level or global model/effort overrides are configured for the implement step
**When** the implement step resolves its configuration
**Then** it defaults to model `opus` and effort `medium`

**Example**:
- Given: config has no `implement.model` or `implement.effort` fields, and no global overrides
- When: runner resolves implement step config
- Then: model resolves to `"opus"`, effort resolves to `"medium"`

### AC12: Runner Prompt Simplified

**Given** the runner builds the prompt for Step 4
**When** `.claude/auto-mode` is active
**Then** the prompt no longer includes "Do NOT call EnterPlanMode" (the skill handles this via its own auto-mode detection)

### AC13: Backward Compatibility — Legacy plan/code Config

**Given** an existing config file that still has `plan` and `code` sub-objects under `steps.implement`
**When** the runner validates the config
**Then** it ignores the unused sub-objects gracefully (no validation errors, no crashes)
**And** the step-level `implement.model` and `implement.effort` fields are used (the nested `plan`/`code` sub-objects are simply ignored)

### AC15: Writing-Specs Auto-Mode Always Amends Existing Spec

**Given** `.claude/auto-mode` exists
**And** the writing-specs spec discovery step finds one or more matching feature specs
**When** the skill decides whether to amend or create a new spec
**Then** it skips the `AskUserQuestion` prompt entirely and proceeds directly in amendment mode (amend the top-scored existing spec)
**And** the decision does not depend on option ordering in any `AskUserQuestion` call

### AC14: Create PR Step Default maxTurns Increased

**Given** a user runs the SDLC runner with default configuration
**When** the runner reaches the createPR step (Step 7)
**Then** the default `maxTurns` in `sdlc-config.example.json` is 30 (increased from 15)

### Generated Gherkin Preview

```gherkin
Feature: Per-step model and effort level configuration
  As a developer or OpenClaw automation agent
  I want per-step model and effort level configuration
  So that each SDLC phase uses the optimal model for its task

  Scenario: Per-step model override
    Given a config with step-level model "opus" for writeSpecs and global model "sonnet"
    When the runner executes the writeSpecs step
    Then the claude subprocess is invoked with "--model opus"

  Scenario: Per-step effort override
    Given a config with step-level effort "medium" for startIssue and global effort "high"
    When the runner executes the startIssue step
    Then the subprocess environment includes "CLAUDE_CODE_EFFORT_LEVEL=medium"

  Scenario: Implement step uses single invocation
    Given a config with implement step configuration
    When the runner executes the implement step
    Then a single runClaude call is made (not two sequential phases)
    And the subprocess uses "--model opus" and "CLAUDE_CODE_EFFORT_LEVEL=medium" by default

  Scenario: Implement step prompt omits EnterPlanMode warning
    Given the runner builds the prompt for step 4
    When the prompt is constructed
    Then it does not contain "Do NOT call EnterPlanMode"

  Scenario: Backward compatibility without per-step config
    Given a config with only global model "opus" and no per-step overrides
    When the runner executes any step
    Then the claude subprocess uses "--model opus"
    And no CLAUDE_CODE_EFFORT_LEVEL is set

  Scenario: Legacy plan/code config is ignored gracefully
    Given a config with plan and code sub-objects under steps.implement
    When the runner validates the config
    Then no validation errors are raised
    And the step-level model and effort are used

  Scenario: Config validation rejects invalid effort
    Given a config with effort value "maximum"
    When the runner starts
    Then it exits with a non-zero code and an error message about invalid effort

  Scenario: Create PR step defaults to 30 maxTurns
    Given the default sdlc-config.example.json
    When the createPR step configuration is read
    Then maxTurns is 30

  Scenario: Writing-specs auto-mode always amends existing spec
    Given auto-mode is active
    And spec discovery finds a matching existing feature spec
    When the skill decides whether to amend or create
    Then it proceeds directly in amendment mode without calling AskUserQuestion
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Add per-step `model` field to runner step config with global fallback | Must | `step.model \|\| config.model \|\| 'opus'` |
| FR2 | Add per-step `effort` field to runner step config with global fallback | Must | `step.effort \|\| config.effort \|\| undefined` |
| FR3 | Set `CLAUDE_CODE_EFFORT_LEVEL` env var on `claude` subprocess when effort is configured | Must | Only set when a value is resolved; omit entirely when no effort is configured |
| ~~FR4~~ | ~~Always split implementing-specs into plan + code phases~~ | ~~Must~~ | Superseded by FR11 |
| FR5 | Update `sdlc-config.example.json` with per-step model/effort defaults | Must | Match the recommendations matrix from the issue |
| FR6 | Add `model` frontmatter to all SKILL.md files | Must | Enforced by Claude Code at runtime for manual users |
| FR7 | Add model/effort recommendations table to README | Should | Helps users understand and customize the defaults |
| FR8 | Validate `effort` values against `['low', 'medium', 'high']` at config load time | Must | Fail fast with descriptive error |
| FR9 | Validate `model` values are non-empty strings at config load time | Must | Prevent empty/null from reaching `--model` |
| FR10 | Preserve backward compatibility for configs without per-step overrides | Must | Existing configs must continue to work unchanged |
| FR11 | Remove `runImplementStep()` and route Step 4 through the standard `runClaude()` path | Must | Single invocation matches all other steps |
| FR12 | Remove `resolveImplementPhaseConfig()` function | Must | No longer needed without plan/code split |
| FR13 | Update default model to `opus` and effort to `medium` for the implement step in `sdlc-config.example.json` | Must | Flat config, no nested `plan`/`code` objects |
| FR14 | Remove nested `plan`/`code` config from `sdlc-config.example.json` | Must | Simplify to flat step config |
| FR15 | Simplify Step 4 prompt in `buildClaudeArgs()` to remove "Do NOT call EnterPlanMode" instruction | Must | Skill handles auto-mode internally |
| FR16 | Update `validateConfig()` to stop validating `plan`/`code` sub-objects (ignore gracefully) | Should | Legacy configs should not break |
| FR17 | Increase `createPR` step default `maxTurns` to 30 in `sdlc-config.example.json` | Must | PR creation needs more turns for version bumping |
| FR18 | Fix writing-specs auto-mode spec discovery to skip `AskUserQuestion` and directly amend | Must | Current instruction says "auto-select Option 1" which is fragile; should skip the prompt entirely |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | No measurable overhead — config field resolution is O(1) string lookup per step |
| **Reliability** | Runner fails fast on invalid config before spawning any subprocesses |
| **Compatibility** | Cross-platform: effort env var works on macOS, Linux, and Windows |
| **Maintainability** | New config fields follow the same pattern as existing `maxTurns`/`timeoutMin` per-step overrides |

---

## Dependencies

### Internal Dependencies
- [x] `sdlc-runner.mjs` — existing `buildClaudeArgs()` and step config merging infrastructure
- [x] `sdlc-config.example.json` — existing config template
- [x] All `SKILL.md` files — existing skill definitions (11 skills)
- [x] `implementing-specs/SKILL.md` — already has auto-mode support (line 22)

### External Dependencies
- [x] Claude Code CLI `--model` flag — already supported
- [x] `CLAUDE_CODE_EFFORT_LEVEL` env var — already supported by Claude Code
- [x] SKILL.md `model` frontmatter field — already supported by Claude Code

### Blocked By
- None

---

## Out of Scope

- Automatic model selection based on task complexity or token usage
- Dynamic effort adjustment during a step
- Per-skill effort in SKILL.md frontmatter (not supported by Claude Code — effort is session-level via env var)
- Changes to the architecture-reviewer agent's model declaration (already hardcoded to Opus)
- Per-step temperature or max-token configuration
- Changes to `implementing-specs` SKILL.md itself (its auto-mode logic is already correct)
- Changes to the plugin manifest model field

---

## Open Questions

- [x] Should the implement split be opt-in or always-on? **Decision (issue #77)**: Always-on — the split is mandatory. **Reversed by issue #91**: The split is removed; a single invocation is used. The skill's auto-mode handles planning internally.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #77 | 2026-02-22 | Initial feature spec |
| #91 | 2026-02-23 | Replace plan/code phase split with single implementing-specs invocation; supersede AC3/FR4; add AC10–AC15, FR11–FR18; increase createPR maxTurns to 30; fix writing-specs auto-mode spec discovery |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Edge cases and error states specified (AC4 backward compat, AC9 validation, AC13 legacy config)
- [x] Dependencies identified
- [x] Out of scope is defined
