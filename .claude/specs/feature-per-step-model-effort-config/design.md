# Design: Per-Step Model and Effort Level Configuration

**Issues**: #77, #91
**Date**: 2026-02-23
**Status**: Draft
**Author**: Claude (spec-writer)

---

## Overview

This feature adds per-step model and effort level configuration to three layers of the nmg-sdlc system: the OpenClaw runner script, individual skill frontmatter, and the config example template.

At the **runner layer**, `sdlc-runner.mjs` gains per-step `model` and `effort` fields in the step config, resolving via a fallback chain (`step.field → config.field → default`). The `buildClaudeArgs()` function uses the resolved model for `--model` and sets `CLAUDE_CODE_EFFORT_LEVEL` in the subprocess environment. The implement step uses a single `runClaude()` invocation — the same as every other step — with the skill's auto-mode handling planning internally.

At the **skill layer**, all SKILL.md files gain a `model` frontmatter field so Claude Code enforces the recommended model during manual invocation. The implementing-specs skill's existing auto-mode support (skips `EnterPlanMode`, designs internally, then executes) is relied upon — no changes to the skill itself.

At the **documentation layer**, `sdlc-config.example.json` is updated with recommended per-step defaults (flat config for implement, no nested plan/code), and the README gains a model/effort recommendations table.

---

## Architecture

### Component Diagram

```
Manual User Path:
┌─────────────────────────────────────────────────────────┐
│  /implementing-specs #N                                 │
│  SKILL.md frontmatter: model: opus                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Single session (Opus)                            │   │
│  │  Steps 1-4 of skill (plan + execute internally)   │   │
│  │  Auto-mode: skips EnterPlanMode, designs then     │   │
│  │  executes directly in same session                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

Runner Path (OpenClaw):
┌─────────────────────────────────────────────────────────┐
│  sdlc-runner.mjs → implement step                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  claude -p (single invocation)                    │   │
│  │  --model opus                                     │   │
│  │  EFFORT_LEVEL=medium                              │   │
│  │  Skill's auto-mode handles plan + execute         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

All Steps (including implement):
┌─────────────────────────────────────────────────────────┐
│  sdlc-runner.mjs → buildClaudeArgs()                    │
│                                                         │
│  Model:  step.model  ──▶  config.model  ──▶  'opus'     │
│  Effort: step.effort ──▶  config.effort ──▶  (unset)    │
│                                                         │
│  claude -p --model <resolved>                           │
│  env: CLAUDE_CODE_EFFORT_LEVEL=<resolved|unset>         │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Runner loads sdlc-config.json
2. validateConfig() checks global + per-step model/effort values (fail fast)
   - Legacy plan/code sub-objects under implement are ignored (not validated)
3. For each step, resolveStepConfig() produces { model, effort } via fallback chain
4. buildClaudeArgs() uses resolved model for --model flag
5. runClaude() sets CLAUDE_CODE_EFFORT_LEVEL in subprocess env (if effort resolved)
6. All steps (including implement) use the standard runStep() → runClaude() path
7. Post-step validation gates run as before
```

---

## API / Interface Changes

### Config Schema Changes

**Global level** — two new optional fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | `string` | `"opus"` | Global default model (existing, no change) |
| `effort` | `string` | (unset) | Global default effort level: `"low"`, `"medium"`, or `"high"` |

**Per-step level** — two new optional fields on each step object:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | `string` | (falls back to global) | Model override for this step |
| `effort` | `string` | (falls back to global) | Effort override for this step |

**Implement step** — flat config (no nested sub-objects):

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | `string` | `"opus"` | Model for the single invocation |
| `effort` | `string` | `"medium"` | Effort for the single invocation |

> **Legacy `plan`/`code` sub-objects**: If present in an existing config, they are silently ignored. `validateConfig()` no longer validates them, and `resolveImplementPhaseConfig()` is removed.

**Config example (abbreviated):**

```json
{
  "model": "opus",
  "effort": "high",
  "steps": {
    "writeSpecs": {
      "model": "opus",
      "effort": "high",
      "maxTurns": 40,
      "timeoutMin": 15,
      "skill": "writing-specs"
    },
    "implement": {
      "model": "opus",
      "effort": "medium",
      "maxTurns": 100,
      "timeoutMin": 30,
      "skill": "implementing-specs"
    },
    "createPR": {
      "maxTurns": 30,
      "timeoutMin": 5,
      "skill": "creating-prs",
      "model": "sonnet"
    }
  }
}
```

**Fallback chain (all steps, including implement):**

```
step.model → config.model → 'opus'
step.effort → config.effort → (unset)
```

### Skill Frontmatter Changes

All SKILL.md files gain a `model` field:

| Skill | Model | Rationale |
|-------|-------|-----------|
| `creating-issues` | `sonnet` | Structured interview, moderate reasoning |
| `creating-prs` | `sonnet` | Template-driven PR creation |
| `generating-openclaw-config` | `sonnet` | Mechanical config generation |
| `implementing-specs` | `opus` | Planning + execution needs deep reasoning |
| `installing-openclaw-skill` | `sonnet` | Mechanical file operations |
| `migrating-projects` | `opus` | Complex project analysis |
| `running-retrospectives` | `opus` | Pattern analysis across defects |
| `setting-up-steering` | `opus` | Understanding project architecture |
| `starting-issues` | `sonnet` | Mechanical branch creation |
| `verifying-specs` | `sonnet` | Structured verification (architecture-reviewer agent already runs on opus) |
| `writing-specs` | `opus` | Complex spec writing needs deep reasoning |

---

## Affected Files

### Runner Script (`openclaw/scripts/sdlc-runner.mjs`)

| Area | Change | Lines (approx) |
|------|--------|----------------|
| `validateConfig()` | Remove `plan`/`code` sub-object validation loop | ~198-207 |
| `resolveImplementPhaseConfig()` | Remove entire function | ~239-247 |
| `buildClaudeArgs()` prompt for step 4 | Remove "Do NOT call EnterPlanMode" from prompt | ~910 |
| `runImplementStep()` | Remove entire function | ~1640-1725 |
| `runStep()` | Remove `if (step.number === 4)` special case — step 4 falls through to standard `runClaude()` path | ~1769-1771 |
| Named exports | Remove `resolveImplementPhaseConfig` and `runImplementStep` from exports | ~2125, ~2137 |

### Config Template (`openclaw/scripts/sdlc-config.example.json`)

| Area | Change |
|------|--------|
| `steps.implement` | Remove nested `plan`/`code` sub-objects; set flat `model: "opus"`, `effort: "medium"` |
| `steps.createPR` | Increase `maxTurns` from 15 to 30 |

### Test File (`openclaw/scripts/__tests__/sdlc-runner.test.mjs`)

| Area | Change |
|------|--------|
| `resolveImplementPhaseConfig` tests | Remove test suite (~2214-2280) |
| `runImplementStep` tests | Remove test suite (~2422-2560) |
| `validateConfig` tests | Update to verify `plan`/`code` sub-objects are ignored (no errors raised) |
| `runStep` tests | Update or add test verifying step 4 goes through standard `runClaude()` path |

### Documentation (`README.md`)

Add a "Model & Effort Recommendations" section with:
- Table of recommended model/effort per skill
- Instructions for overriding via runner config
- Note about skill frontmatter vs runner config precedence

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Keep plan/code split, just change defaults** | Keep the two-subprocess architecture but change default models | Minimal code change | Unnecessary complexity; every other step uses single invocation; skill already handles plan internally | Rejected — unnecessary overhead |
| **B: Single invocation, skill handles internally** | Remove runner split; rely on skill's auto-mode to plan then execute in one session | Consistent with all other steps; simpler runner code; fewer functions to maintain | Single model for both planning and coding (opus for both) | **Selected** — consistency and simplicity win; implementing-specs already has auto-mode support |
| **C: Deprecation warning before removal** | Emit a warning when `plan`/`code` keys are detected, remove in next major version | Gradual migration path | Over-engineering for an internal tool with few users; adds code that will be immediately removed | Rejected — silent ignore is sufficient for an internal tool |

---

## Security Considerations

- [x] **No secrets**: No new secrets or credentials introduced. Config files contain model names and effort levels only.
- [x] **Input validation**: `validateConfig()` rejects invalid effort values at startup before spawning any subprocesses. Legacy `plan`/`code` sub-objects are silently ignored (no validation, no injection risk).

---

## Performance Considerations

- [x] **Config resolution**: O(1) string lookups per step — negligible overhead.
- [x] **Implement step**: Single subprocess instead of two. The skill handles both planning and execution in one session, reducing subprocess spawn overhead.
- [x] **Skill frontmatter**: Parsed once at skill load time — no runtime overhead.

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Config validation | Unit (Jest) | `validateConfig()` accepts valid values, rejects invalid effort/model, ignores legacy plan/code |
| Config resolution | Unit (Jest) | `resolveStepConfig()` fallback chain: step → global → default |
| `buildClaudeArgs()` | Unit (Jest) | Per-step model appears in args; step 4 prompt omits EnterPlanMode warning |
| `runStep()` for step 4 | Unit (Jest) | Step 4 uses standard `runClaude()` path (no special case) |
| Backward compatibility | Unit (Jest) | Config without per-step fields produces same args as before; config with legacy plan/code keys doesn't error |
| Skill frontmatter | Exercise test | Load plugin, verify model field parsed |
| Config example | Structural | `createPR.maxTurns` is 30; implement is flat with `model: "opus"`, `effort: "medium"` |
| BDD scenarios | Gherkin feature file | All ACs from requirements (AC1-AC2, AC4-AC14; AC3 superseded) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing configs with `plan`/`code` keys break on upgrade | Low | Medium | Silent ignore — `validateConfig()` skips unknown sub-objects; `resolveStepConfig()` only reads `step.model` and `step.effort` |
| Single invocation for implement runs out of turns | Low | Medium | `maxTurns: 100` in example config is generous; implementing-specs skill is designed for single-session execution |
| Skill frontmatter `model` field silently ignored on older Claude Code versions | Low | Low | Document minimum Claude Code version; frontmatter is additive — no breakage if ignored |
| Removing exported functions breaks downstream consumers | Low | High | Only the test file imports these functions; update tests in the same PR |

---

## Open Questions

None — all design decisions are straightforward simplifications.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #77 | 2026-02-22 | Initial feature spec |
| #91 | 2026-02-23 | Replace plan/code split with single invocation; simplify architecture diagram, data flow, config schema; remove runImplementStep/resolveImplementPhaseConfig; add createPR maxTurns increase |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`)
- [x] All interface changes documented with schemas
- [x] No database/storage changes needed
- [x] State management unchanged (config is stateless resolution)
- [x] No UI components needed (CLI-only)
- [x] Security considerations addressed
- [x] Performance impact analyzed (net positive — fewer subprocesses)
- [x] Testing strategy defined
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
