# Design: Per-Step Model and Effort Level Configuration

**Issues**: #77
**Date**: 2026-02-22
**Status**: Draft
**Author**: Claude (spec-writer)

---

## Overview

This feature adds per-step model and effort level configuration to three layers of the nmg-sdlc system: the OpenClaw runner script, individual skill frontmatter, and the implementing-specs skill's internal orchestration.

At the **runner layer**, `sdlc-runner.mjs` gains per-step `model` and `effort` fields in the step config, resolving via a fallback chain (`step.field → config.field → default`). The `buildClaudeArgs()` function uses the resolved model for `--model` and sets `CLAUDE_CODE_EFFORT_LEVEL` in the subprocess environment. The implement step is always split into two sequential subprocesses (plan + code) with independent model/effort config.

At the **skill layer**, all SKILL.md files gain a `model` frontmatter field so Claude Code enforces the recommended model during manual invocation. The implementing-specs skill is restructured to run the plan phase directly (with `model: opus` from frontmatter) and delegate the code phase to a new `spec-implementer` subagent (with `model: sonnet`).

At the **documentation layer**, `sdlc-config.example.json` is updated with recommended per-step defaults, and the README gains a model/effort recommendations table.

---

## Architecture

### Component Diagram

```
Manual User Path:
┌─────────────────────────────────────────────────────────┐
│  /implementing-specs #N                                 │
│  SKILL.md frontmatter: model: opus                      │
│                                                         │
│  ┌──────────────────────┐    ┌────────────────────────┐ │
│  │  Plan Phase (Opus)   │───▶│  Code Phase (Sonnet)   │ │
│  │  Steps 1-4 of skill  │    │  spec-implementer agent│ │
│  │  Runs in main convo  │    │  Via Task tool          │ │
│  └──────────────────────┘    └────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

Runner Path (OpenClaw):
┌─────────────────────────────────────────────────────────┐
│  sdlc-runner.mjs → implement step                       │
│                                                         │
│  ┌──────────────────────┐    ┌────────────────────────┐ │
│  │  claude -p (plan)    │───▶│  claude -p (code)      │ │
│  │  --model opus        │    │  --model sonnet         │ │
│  │  EFFORT_LEVEL=high   │    │  EFFORT_LEVEL=high      │ │
│  └──────────────────────┘    └────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

All Other Steps:
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
3. For each step, resolveStepConfig() produces { model, effort } via fallback chain
4. buildClaudeArgs() uses resolved model for --model flag
5. runClaude() sets CLAUDE_CODE_EFFORT_LEVEL in subprocess env (if effort resolved)
6. For implement step: runImplementStep() calls runClaude() twice (plan, then code)
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

**Implement step** — two new optional sub-step objects:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `plan` | `object` | `{}` | Config overrides for the plan phase (`model`, `effort`, `maxTurns`, `timeoutMin`) |
| `code` | `object` | `{}` | Config overrides for the code phase (`model`, `effort`, `maxTurns`, `timeoutMin`) |

**Config example (abbreviated):**

```json
{
  "model": "sonnet",
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
      "skill": "implementing-specs",
      "plan": {
        "model": "opus",
        "effort": "high",
        "maxTurns": 50,
        "timeoutMin": 15
      },
      "code": {
        "model": "sonnet",
        "effort": "high",
        "maxTurns": 100,
        "timeoutMin": 30
      }
    }
  }
}
```

**Fallback chain for implement sub-steps:**

```
implement.plan.model → implement.model → config.model → 'opus'
implement.plan.effort → implement.effort → config.effort → (unset)
implement.code.model → implement.model → config.model → 'opus'
implement.code.effort → implement.effort → config.effort → (unset)
```

### New Agent Definition

**File**: `plugins/nmg-sdlc/agents/spec-implementer.md`

```yaml
---
name: spec-implementer
description: "Executes implementation tasks from specs sequentially. Delegates coding work from implementing-specs after planning is complete."
tools: Read, Glob, Grep, Write, Edit, Bash, WebFetch, WebSearch
model: sonnet
---
```

This agent receives the implementation plan and task list, then executes tasks sequentially using the same rules as the current implementing-specs Step 5 (Execute Tasks). It runs on Sonnet for cost-efficient code generation.

### Skill Frontmatter Changes

All SKILL.md files gain a `model` field:

| Skill | Model | Rationale |
|-------|-------|-----------|
| `creating-issues` | `sonnet` | Structured interview, moderate reasoning |
| `creating-prs` | `sonnet` | Template-driven PR creation |
| `generating-openclaw-config` | `sonnet` | Mechanical config generation |
| `implementing-specs` | `opus` | Plan phase needs deep reasoning (code phase delegates to spec-implementer agent on sonnet) |
| `installing-openclaw-skill` | `sonnet` | Mechanical file operations |
| `migrating-projects` | `opus` | Complex project analysis |
| `running-retrospectives` | `opus` | Pattern analysis across defects |
| `setting-up-steering` | `opus` | Understanding project architecture |
| `starting-issues` | `sonnet` | Mechanical branch creation |
| `verifying-specs` | `sonnet` | Structured verification (architecture-reviewer agent already runs on opus) |
| `writing-specs` | `opus` | Complex spec writing needs deep reasoning |

---

## Database / Storage Changes

### Schema Changes

| Table / Collection | Column / Field | Type | Nullable | Default | Change |
|--------------------|----------------|------|----------|---------|--------|
| [name] | [name] | [type] | Yes/No | [value] | Add/Modify/Remove |

### Migration Plan

```
-- Describe the migration approach
-- Reference tech.md for migration conventions
```

### Data Migration

[If existing data needs transformation, describe the approach]

---

## State Management

Reference `structure.md` and `tech.md` for the project's state management patterns.

### New State Shape

```
// Pseudocode — use project's actual language/framework
FeatureState {
  isLoading: boolean
  items: List<Item>
  error: string | null
  selected: Item | null
}
```

### State Transitions

```
Initial → Loading → Success (with data)
                  → Error (with message)

User action → Optimistic update → Confirm / Rollback
```

---

## UI Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| [name] | [path per structure.md] | [description] |

### Component Hierarchy

```
FeatureScreen
├── Header
├── Content
│   ├── LoadingState
│   ├── ErrorState
│   ├── EmptyState
│   └── DataView
│       ├── ListItem × N
│       └── DetailView
└── Actions
```

---

## Affected Files

### Runner Script (`openclaw/scripts/sdlc-runner.mjs`)

| Area | Change | Lines |
|------|--------|-------|
| Config loading | Add `EFFORT` global, read `config.effort` | ~93 |
| Config validation | New `validateConfig()` function after config load | ~99-106 (new) |
| Step config resolution | New `resolveStepConfig(step)` helper | New function |
| `buildClaudeArgs()` | Use `resolveStepConfig()` for `--model`; return effort separately | ~832-833 |
| `runClaude()` | Accept effort param, set `CLAUDE_CODE_EFFORT_LEVEL` in subprocess env | ~864-867 |
| Implement step | New `runImplementStep()` that calls `runClaude()` twice | New function |
| `runStep()` | Delegate step 4 to `runImplementStep()` | ~1536 |
| `main()` | Log effort alongside model | ~1649 |
| Test helpers | Expose new functions, add `effort` to `setConfig()` | ~1847-1857 |
| Exports | Export `validateConfig`, `resolveStepConfig`, `runImplementStep` | ~1873 |

### Implementing-Specs Skill (`plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`)

| Area | Change |
|------|--------|
| Frontmatter | Add `model: opus` |
| Step 4 | Remains the plan phase (runs on opus via frontmatter) |
| Step 5 | Restructure to delegate to `spec-implementer` agent via Task tool instead of executing inline |
| Step 6 | Receives completion summary from agent, formats output |

The key restructuring of Step 5:

**Current**: The skill executes tasks inline in the same conversation.

**New**: The skill delegates task execution to the `spec-implementer` agent:
1. After plan approval (Step 4), the skill collects the plan, task list, and steering docs
2. It invokes the `spec-implementer` agent via the Task tool, passing:
   - The implementation plan
   - The task list from `tasks.md`
   - References to steering docs and spec files
   - The working directory context
3. The agent executes tasks sequentially on Sonnet
4. The skill receives the agent's completion summary and formats the Step 6 output

For auto-mode (runner path), the runner handles the split at the subprocess level instead — the skill's internal delegation is irrelevant because the runner spawns two separate `claude -p` processes.

### New Agent (`plugins/nmg-sdlc/agents/spec-implementer.md`)

New file. The agent encapsulates the current Step 5 (Execute Tasks) logic:
- Read specs and steering docs
- Execute tasks sequentially from `tasks.md`
- Follow implementation rules (one task at a time, test after each, reference steering docs)
- Handle bug fix implementation pattern (flat task list)
- Handle deviations
- Report completion summary

### Config Template (`openclaw/scripts/sdlc-config.example.json`)

Add `model` and `effort` to every step, plus `plan`/`code` sub-config for `implement`.

### Migrating-Projects Awareness (`plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`)

No code changes needed — the migrating-projects skill is self-updating (reads templates at runtime). When a project runs `/migrating-projects` after upgrading to this version, the following changes are automatically detected:

| Migration | How It's Detected | What's Added |
|-----------|-------------------|--------------|
| Global `effort` key | Step 5 root-level key comparison | `"effort": "high"` |
| Per-step `model`/`effort` | Step 5 step sub-key comparison | `"model"` and `"effort"` on each step |
| `implement.plan`/`implement.code` | Step 5 step sub-key comparison | `"plan"` and `"code"` sub-objects with full defaults |

The existing Step 5 logic ("Compare step sub-keys — For each step that exists in both, identify missing sub-keys") handles nested objects: `plan` and `code` are detected as missing sub-keys of the `implement` step and added with their template default values.

**Verification note**: After implementing the `sdlc-config.example.json` changes, confirm that running `/migrating-projects` against a project with an old-format `sdlc-config.json` correctly proposes adding the new keys without overwriting existing values.

### Documentation (`README.md`)

Add a "Model & Effort Recommendations" section with:
- Table of recommended model/effort per skill
- Instructions for overriding via runner config
- Note about skill frontmatter vs runner config precedence

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Inline model switch via `/model` command** | Have the skill call `/model sonnet` mid-session before coding | Simple, no new agent needed | Not programmatically accessible; changes entire session permanently; no way to scope | Rejected — not automatable |
| **B: `claude -p` subprocess from within skill** | Skill spawns a `claude -p` subprocess for the code phase | Full control over model/effort | Hides output from user; breaks transparency; duplicates runner logic | Rejected — user requested transparency |
| **C: Custom subagent via Task tool** | Skill delegates code phase to a subagent with `model: sonnet` | Transparent (labeled output block); uses existing Claude Code infrastructure; clean separation | Slight UX difference (subagent output block); agent needs comprehensive instructions | **Selected** |
| **D: Two separate skills** | Split implementing-specs into `/planning-specs` and `/coding-specs` | Each skill has its own model | Breaks single-command UX; doubles invocation steps for users | Rejected — user wants single invocation |

---

## Security Considerations

- [x] **No secrets**: No new secrets or credentials introduced. Config files contain model names and effort levels only.
- [x] **Input validation**: `validateConfig()` rejects invalid effort values at startup before spawning any subprocesses.
- [x] **Agent permissions**: The `spec-implementer` agent's `tools` field grants only what's needed for implementation (Read, Glob, Grep, Write, Edit, Bash, WebFetch, WebSearch). No `Task` tool (agents cannot spawn subagents).

---

## Performance Considerations

- [x] **Config resolution**: O(1) string lookups per step — negligible overhead.
- [x] **Implement split**: Two subprocesses instead of one. Net cost is similar — the same work is done, just on a cheaper model for the code phase. This is the primary cost optimization.
- [x] **Skill frontmatter**: Parsed once at skill load time — no runtime overhead.

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Config validation | Unit (Jest) | `validateConfig()` accepts valid values, rejects invalid effort/model |
| Config resolution | Unit (Jest) | `resolveStepConfig()` fallback chain: step → global → default |
| `buildClaudeArgs()` | Unit (Jest) | Per-step model appears in args; effort in env |
| `runImplementStep()` | Unit (Jest) | Two `runClaude()` calls with correct config; plan failure stops code phase |
| Backward compatibility | Unit (Jest) | Config without per-step fields produces same args as before |
| Skill frontmatter | Exercise test | Load plugin, verify model field parsed |
| Implement split (skill) | Exercise test | Run `/implementing-specs` against test project, verify plan runs on opus then code delegates to spec-implementer agent |
| BDD scenarios | Gherkin feature file | All 9 ACs from requirements |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `spec-implementer` agent receives insufficient context for complex implementations | Medium | Medium | Agent prompt includes explicit instructions to read specs/steering docs; Task tool prompt provides full context |
| Implement split doubles the number of subprocess invocations for the runner | Low | Low | Same total work; plan phase is short; code phase runs on cheaper model |
| Skill frontmatter `model` field silently ignored on older Claude Code versions | Low | Low | Document minimum Claude Code version; frontmatter is additive — no breakage if ignored |
| Config validation rejects valid model names added in future Claude Code releases | Low | Medium | Model validation only checks for non-empty string, not an allowlist — future model names work automatically |

---

## Open Questions

- [ ] [Technical question]
- [ ] [Architecture question]
- [ ] [Integration question]

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #77 | 2026-02-22 | Initial feature spec |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`)
- [x] All interface changes documented with schemas
- [x] No database/storage changes needed
- [x] State management unchanged (config is stateless resolution)
- [x] No UI components needed (CLI-only)
- [x] Security considerations addressed
- [x] Performance impact analyzed (net positive — cost optimization)
- [x] Testing strategy defined
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
