# Requirements: Per-Step Model and Effort Level Configuration

**Issue**: #77
**Date**: 2026-02-22
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

### AC3: Implementing-Specs Always Splits Into Planning and Coding Phases

**Given** the runner reaches the implement step
**When** it executes implementing-specs
**Then** it always runs two separate `claude -p` subprocesses sequentially:
  1. A **plan phase** subprocess (for plan creation)
  2. A **code phase** subprocess (for plan execution)

**And** each phase has its own model and effort configuration via `implement.plan` and `implement.code` sub-step config, falling back to the step-level `implement` config, then the global config
**And** the plan phase must complete successfully before the code phase starts
**And** state produced by the plan phase (spec files, plan artifacts in `.claude/`) is available to the code phase via the shared working directory
**And** the split is transparent to manual users — `/implementing-specs` continues to work as a single invocation. The skill handles the plan phase directly (using its frontmatter `model: opus`), then delegates the code phase to a custom subagent (with `model: sonnet`) via the Task tool. Users see both phases in their terminal: planning in the main conversation and code execution in a labeled subagent output block

**Example**:
- Given: config has `"implement": { "plan": { "model": "opus", "effort": "high" }, "code": { "model": "sonnet", "effort": "high" } }`
- When: runner executes implement step
- Then: first subprocess runs with `--model opus` and `CLAUDE_CODE_EFFORT_LEVEL=high`, then second subprocess runs with `--model sonnet` and `CLAUDE_CODE_EFFORT_LEVEL=high`

### AC4: Backward Compatibility Preserved

**Given** a `sdlc-config.json` without any per-step `model` or `effort` fields (existing format)
**When** the runner executes all steps
**Then** all steps use the global `model` (defaulting to `"opus"` if unset) with no `CLAUDE_CODE_EFFORT_LEVEL` set (preserving current behavior)
**And** the implement step still splits into plan + code phases (using global model/effort defaults for both)

### AC5: Config Template Shows Per-Step Model/Effort Examples

**Given** a user reads `sdlc-config.example.json`
**When** they review the step configuration
**Then** each step includes `model` and `effort` fields with recommended defaults matching the recommendations matrix from the issue
**And** the implement step shows `plan` and `code` sub-step configuration

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

  Scenario: Implement step splits into plan and code phases
    Given a config with implement.plan model "opus" and implement.code model "sonnet"
    When the runner executes the implement step
    Then two sequential subprocesses are spawned
    And the first uses "--model opus"
    And the second uses "--model sonnet"

  Scenario: Backward compatibility without per-step config
    Given a config with only global model "opus" and no per-step overrides
    When the runner executes any step
    Then the claude subprocess uses "--model opus"
    And no CLAUDE_CODE_EFFORT_LEVEL is set
    And the implement step still splits into plan and code phases using global defaults

  Scenario: Config validation rejects invalid effort
    Given a config with effort value "maximum"
    When the runner starts
    Then it exits with a non-zero code and an error message about invalid effort
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Add per-step `model` field to runner step config with global fallback | Must | `step.model \|\| config.model \|\| 'opus'` |
| FR2 | Add per-step `effort` field to runner step config with global fallback | Must | `step.effort \|\| config.effort \|\| undefined` |
| FR3 | Set `CLAUDE_CODE_EFFORT_LEVEL` env var on `claude` subprocess when effort is configured | Must | Only set when a value is resolved; omit entirely when no effort is configured |
| FR4 | Always split implementing-specs into plan + code phases | Must | Runner: two `claude -p` subprocesses. Skill: plan phase runs directly (frontmatter `model: opus`), code phase delegates to a custom subagent (`model: sonnet`) via Task tool |
| FR5 | Update `sdlc-config.example.json` with per-step model/effort defaults | Must | Match the recommendations matrix from the issue |
| FR6 | Add `model` frontmatter to all SKILL.md files | Must | Enforced by Claude Code at runtime for manual users |
| FR7 | Add model/effort recommendations table to README | Should | Helps users understand and customize the defaults |
| FR8 | Validate `effort` values against `['low', 'medium', 'high']` at config load time | Must | Fail fast with descriptive error |
| FR9 | Validate `model` values are non-empty strings at config load time | Must | Prevent empty/null from reaching `--model` |
| FR10 | Preserve backward compatibility for configs without per-step overrides | Must | Existing configs must continue to work unchanged |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | No measurable overhead — config field resolution is O(1) string lookup per step |
| **Reliability** | Runner fails fast on invalid config before spawning any subprocesses |
| **Compatibility** | Cross-platform: effort env var works on macOS, Linux, and Windows |
| **Maintainability** | New config fields follow the same pattern as existing `maxTurns`/`timeoutMin` per-step overrides |

---

## UI/UX Requirements

Reference `structure.md` and `product.md` for project-specific design standards.

| Element | Requirement |
|---------|-------------|
| **Interaction** | [Touch targets, gesture requirements] |
| **Typography** | [Minimum text sizes, font requirements] |
| **Contrast** | [Accessibility contrast requirements] |
| **Loading States** | [How loading should be displayed] |
| **Error States** | [How errors should be displayed] |
| **Empty States** | [How empty data should be displayed] |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| [field] | [type] | [rules] | Yes/No |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| [field] | [type] | [what it represents] |

---

## Dependencies

### Internal Dependencies
- [x] `sdlc-runner.mjs` — existing `buildClaudeArgs()` and step config merging infrastructure
- [x] `sdlc-config.example.json` — existing config template
- [x] All `SKILL.md` files — existing skill definitions (11 skills)

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
- Changes to the `/implementing-specs` invocation UX — manual users still invoke it as a single command (`/implementing-specs #N`)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| [metric] | [target value] | [how to measure] |

---

## Open Questions

- [x] Should the implement split be opt-in or always-on? **Decision**: Always-on — the split is mandatory. Even without explicit `plan`/`code` sub-config, the implement step always runs two subprocesses using global defaults.

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Edge cases and error states specified (AC4 backward compat, AC9 validation)
- [x] Dependencies identified
- [x] Out of scope is defined
