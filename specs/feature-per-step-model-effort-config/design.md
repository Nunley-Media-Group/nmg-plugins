# Design: Per-Step Model and Effort Level Configuration

**Issues**: #77, #91, #130
**Date**: 2026-04-18
**Status**: Draft
**Author**: Claude (spec-writer)

---

## Overview

This feature adds per-step model and effort level configuration to three layers of the nmg-sdlc system: the SDLC runner script, individual skill frontmatter, and the config example template.

At the **runner layer**, `sdlc-runner.mjs` gains per-step `model` and `effort` fields in the step config, resolving via a fallback chain (`step.field → config.field → default`). The `buildClaudeArgs()` function uses the resolved model for `--model` and sets `CLAUDE_CODE_EFFORT_LEVEL` in the subprocess environment. The implement step uses a single `runClaude()` invocation — the same as every other step — with the skill's unattended-mode handling planning internally.

At the **skill layer**, all SKILL.md files gain a `model` frontmatter field so Claude Code enforces the recommended model during manual invocation. The write-code skill's existing unattended-mode support (skips `EnterPlanMode`, designs internally, then executes) is relied upon — no changes to the skill itself.

At the **documentation layer**, `sdlc-config.example.json` is updated with recommended per-step defaults (flat config for implement, no nested plan/code), and the README gains a model/effort recommendations table.

---

## Architecture

### Component Diagram

```
Manual User Path:
┌─────────────────────────────────────────────────────────┐
│  /write-code #N                                 │
│  SKILL.md frontmatter: model: opus                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Single session (Opus)                            │   │
│  │  Steps 1-4 of skill (plan + execute internally)   │   │
│  │  Unattended-mode: skips EnterPlanMode, designs then     │   │
│  │  executes directly in same session                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

Runner Path (SDLC runner):
┌─────────────────────────────────────────────────────────┐
│  sdlc-runner.mjs → implement step                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  claude -p (single invocation)                    │   │
│  │  --model opus                                     │   │
│  │  EFFORT_LEVEL=medium                              │   │
│  │  Skill's unattended-mode handles plan + execute         │   │
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
      "skill": "write-spec"
    },
    "implement": {
      "model": "opus",
      "effort": "medium",
      "maxTurns": 100,
      "timeoutMin": 30,
      "skill": "write-code"
    },
    "createPR": {
      "maxTurns": 30,
      "timeoutMin": 5,
      "skill": "open-pr",
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
| `draft-issue` | `sonnet` | Structured interview, moderate reasoning |
| `open-pr` | `sonnet` | Template-driven PR creation |
| `init-config` | `sonnet` | Mechanical config generation |
| `write-code` | `opus` | Planning + execution needs deep reasoning |
| `migrate-project` | `opus` | Complex project analysis |
| `run-retro` | `opus` | Pattern analysis across defects |
| `setup-steering` | `opus` | Understanding project architecture |
| `start-issue` | `sonnet` | Mechanical branch creation |
| `verify-code` | `sonnet` | Structured verification (architecture-reviewer agent already runs on opus) |
| `write-spec` | `opus` | Complex spec writing needs deep reasoning |

---

## Affected Files

### Runner Script (`scripts/sdlc-runner.mjs`)

| Area | Change | Lines (approx) |
|------|--------|----------------|
| `validateConfig()` | Remove `plan`/`code` sub-object validation loop | ~198-207 |
| `resolveImplementPhaseConfig()` | Remove entire function | ~239-247 |
| `buildClaudeArgs()` prompt for step 4 | Remove "Do NOT call EnterPlanMode" from prompt | ~910 |
| `runImplementStep()` | Remove entire function | ~1640-1725 |
| `runStep()` | Remove `if (step.number === 4)` special case — step 4 falls through to standard `runClaude()` path | ~1769-1771 |
| Named exports | Remove `resolveImplementPhaseConfig` and `runImplementStep` from exports | ~2125, ~2137 |

### Config Template (`scripts/sdlc-config.example.json`)

| Area | Change |
|------|--------|
| `steps.implement` | Remove nested `plan`/`code` sub-objects; set flat `model: "opus"`, `effort: "medium"` |
| `steps.createPR` | Increase `maxTurns` from 15 to 30 |

### Test File (`scripts/__tests__/sdlc-runner.test.mjs`)

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
| **B: Single invocation, skill handles internally** | Remove runner split; rely on skill's unattended-mode to plan then execute in one session | Consistent with all other steps; simpler runner code; fewer functions to maintain | Single model for both planning and coding (opus for both) | **Selected** — consistency and simplicity win; write-code already has unattended-mode support |
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
| Single invocation for implement runs out of turns | Low | Medium | `maxTurns: 100` in example config is generous; write-code skill is designed for single-session execution |
| Skill frontmatter `model` field silently ignored on older Claude Code versions | Low | Low | Document minimum Claude Code version; frontmatter is additive — no breakage if ignored |
| Removing exported functions breaks downstream consumers | Low | High | Only the test file imports these functions; update tests in the same PR |

---

## Open Questions

None — all design decisions are straightforward simplifications.

---

## Issue #130 Addendum — Defaults optimization for latest model lineup

### Overview

Issue #130 revisits every step's `model` / `effort` / `maxTurns` / `timeoutMin` against the current Claude Code lineup (Opus 4.7, Sonnet 4.6, Haiku 4.5) and Anthropic's published effort-level guidance. Four concrete surface changes follow:

1. **Runner validation expands** — `VALID_EFFORTS` gains `xhigh`; `max` is explicitly rejected; `effort` on Haiku steps is explicitly rejected.
2. **Runner module defaults flip** — `resolveStepConfig()` falls back to `sonnet` / `medium` instead of `opus` / `undefined`, so omitting model/effort everywhere produces a cost-aware baseline.
3. **Example config is rewritten** — every step gets an explicit `model`, `maxTurns`, `timeoutMin`, plus `effort` where the model supports it; Opus is hard-capped to `writeSpecs`/`implement`/`verify`; turn budgets are raised to the AC36 floors.
4. **Skill frontmatter gains `model` and `effort`** — so interactive invocation honors the same defaults the runner uses (subject to the documented precedence chain).

Two supporting documentation surfaces update: README gains a rewritten recommendations table and a precedence subsection; CHANGELOG gains `[Unreleased]` entries; `upgrade-project` grows a curated-defaults diff flow.

### Source citations

- Anthropic effort-level docs: `https://platform.claude.com/docs/en/build-with-claude/effort`
- Claude Code model config: `https://code.claude.com/docs/en/model-config`

Key guidance applied:

| Model | Effort guidance |
|---|---|
| Opus 4.7 | `xhigh` is the recommended starting point for coding / agentic workflows; `high` is the "balance sweet spot"; `max` is prone to overthinking — nmg-sdlc policy excludes it |
| Sonnet 4.6 | `medium` is Anthropic's recommended default for agentic coding; `high` for maximum intelligence |
| Haiku 4.5 | Does **not** accept an effort parameter — the field must be omitted |

### Updated config schema

**Global level** — two fields, same semantics; defaults change:

| Field | Type | Default | Note |
|-------|------|---------|------|
| `model` | `string` | `"sonnet"` | Was `"opus"` prior to #130 |
| `effort` | `string` | `"medium"` | Was `undefined` prior to #130 |

**Per-step level** — two fields, same fallback chain, with one additional constraint: `effort` MUST be omitted when `model` is `"haiku"`.

### Runner changes (`scripts/sdlc-runner.mjs`)

| Location | Change |
|---|---|
| Line 26 — `VALID_EFFORTS` | Expand to `['low', 'medium', 'high', 'xhigh']` |
| `validateConfig()` (~189-210) | Add explicit rejection for `effort === 'max'` with message citing nmg-sdlc policy; add rejection for `effort` on steps where `model === 'haiku'` |
| `resolveStepConfig()` (line 225-230) | Change fallback: `step.model \|\| config.model \|\| 'sonnet'`; `step.effort \|\| config.effort \|\| 'medium'` |
| `getConfigObject()` (~216) | Unchanged — still packages module globals for resolution |
| Module init (line 104-105) | `MODEL = config.model \|\| 'sonnet'`; `EFFORT = config.effort \|\| 'medium'` |

**`max` rejection rationale** — `max` is not inherently invalid at the Claude Code layer, but nmg-sdlc policy excludes it (Anthropic notes `max` is prone to overthinking on coding workloads). Rejecting it at `validateConfig()` surfaces the policy immediately rather than silently degrading output quality at runtime.

**Haiku effort rejection rationale** — Claude Code ignores `effort` on Haiku silently; explicit rejection makes config files self-documenting and prevents accidental "configured but unused" effort values that drift out of sync with the model.

### Updated example config (`scripts/sdlc-config.example.json`)

Every step gets an explicit `model`, `maxTurns`, `timeoutMin`, plus `effort` where the model supports it:

```json
{
  "model": "sonnet",
  "effort": "medium",
  "steps": {
    "startCycle":  { "model": "haiku",                    "maxTurns": 10,  "timeoutMin": 5  },
    "startIssue":  { "model": "sonnet", "effort": "low",   "maxTurns": 25,  "timeoutMin": 5,  "skill": "start-issue" },
    "writeSpecs":  { "model": "opus",   "effort": "xhigh", "maxTurns": 60,  "timeoutMin": 15, "skill": "write-spec" },
    "implement":   { "model": "opus",   "effort": "xhigh", "maxTurns": 150, "timeoutMin": 30, "skill": "write-code" },
    "verify":      { "model": "opus",   "effort": "high",  "maxTurns": 100, "timeoutMin": 20, "skill": "verify-code" },
    "commitPush":  { "model": "haiku",                    "maxTurns": 15,  "timeoutMin": 5  },
    "createPR":    { "model": "sonnet", "effort": "low",   "maxTurns": 45,  "timeoutMin": 5,  "skill": "open-pr" },
    "monitorCI":   { "model": "sonnet", "effort": "medium","maxTurns": 60,  "timeoutMin": 20 },
    "merge":       { "model": "haiku",                    "maxTurns": 10,  "timeoutMin": 5  }
  }
}
```

### `maxTurns` / `timeoutMin` pairing rationale

Each `maxTurns` bump was paired against the existing `timeoutMin` to confirm turns (not time) remain the more binding constraint where telemetry suggests the step legitimately needs more work:

| Step | maxTurns: was → now | timeoutMin: was → now | Pairing rationale |
|---|---|---|---|
| `startCycle` | 5 → 10 | 5 | Turn bump only; still a single `gh` query, no time pressure |
| `startIssue` | 15 → 25 | 5 | Turn bump only; mechanical `gh` flows complete in ≤5 min |
| `writeSpecs` | 40 → 60 | 15 | Turn bump only; 15 min accommodates 60 turns of spec synthesis |
| `implement` | 100 → 150 | 30 | Turn bump only; 30 min remains the correct soft cap — if a step saturates 30 min and 150 turns, escalation signals a genuine issue-sizing problem, not a budget problem |
| `verify` | 60 → 100 | 20 | Turn bump only; `verify` exhausted 60 turns at 819s on #181, well inside 20 min — turns, not time, was the binding constraint |
| `commitPush` | 10 → 15 | 5 | Turn bump only; git + optional hook retry fits in 5 min |
| `createPR` | 30 → 45 | 5 | Turn bump only; PR body + CHANGELOG + version bump fits in 5 min even at 45 turns |
| `monitorCI` | 40 → 60 | 20 | Turn bump only; CI diagnostic rounds are the cost, not wall-clock |
| `merge` | 5 → 10 | 5 | Turn bump only; `gh pr merge` + cleanup remains fast |

No `timeoutMin` values were raised in this addendum — the observed failures were turn-bounded, not time-bounded. Future telemetry may warrant time adjustments but those are out of scope per the AC-level out-of-scope list.

### Skill frontmatter mapping (AC32 / AC33)

All eleven SDLC-pipeline skills gain `model` (and `effort` when the model supports it) in YAML frontmatter. Values match the runner's per-step assignment exactly:

| SKILL.md | Runner step | Frontmatter `model` | Frontmatter `effort` |
|---|---|---|---|
| `write-spec` | writeSpecs | `opus` | `xhigh` |
| `write-code` | implement | `opus` | `xhigh` |
| `verify-code` | verify | `opus` | `high` |
| `start-issue` | startIssue | `sonnet` | `low` |
| `open-pr` | createPR | `sonnet` | `low` |
| `draft-issue` | (interactive-only, not a runner step) | `sonnet` | `medium` |
| `run-retro` | (invoked on demand) | `opus` | `high` |
| `setup-steering` | (one-time) | `opus` | `high` |
| `init-config` | (one-time) | `haiku` | *(omitted)* |
| `run-loop` | (runner launcher) | `sonnet` | `low` |
| `upgrade-project` | (one-time) | `opus` | `high` |

Frontmatter values are **declarative**, not enforced by nmg-sdlc code — Claude Code honors them when loading the skill manually. This is explicitly additive: missing frontmatter does not break backward compatibility.

### Precedence chain (AC34)

Four layers, highest wins:

```
CLAUDE_CODE_EFFORT_LEVEL env var (set by runner)
    ↓
Skill frontmatter (`model:` and `effort:`)
    ↓
Session `/model` / `/effort` overrides
    ↓
Claude Code built-in default
```

**Runner-driven runs** — the runner sets `CLAUDE_CODE_EFFORT_LEVEL` via subprocess env, which wins over skill frontmatter. This is intentional: the runner's per-step config is the authoritative automation policy.

**Interactive runs** — no env var is set, so skill frontmatter wins over the session's model/effort choice. This gives manual users the same defaults the runner uses without forcing them to `/model opus` before each skill.

README gains a new subsection under "Model & Effort Configuration" that encodes this chain explicitly.

### `verify` step sizing — candidate comparison (AC26)

`verify` does more than checklist validation: it applies auto-fixes via spec-implementer and invokes architecture-reviewer. The selection below weighs fix quality against cost:

| Candidate | Model | Effort | Tradeoff |
|---|---|---|---|
| Cheapest | `sonnet` | `high` | Adequate for checklist validation but under-provisions fix application — Sonnet 4.6 at high effort still trails Opus on multi-file reasoning required for auto-fixes that touch several layers |
| Middle | `opus` | `medium` | Keeps Opus's reasoning floor but deprioritizes deep thinking — risks shallow fix proposals on subtle architectural issues |
| **Selected** | `opus` | `high` | Anthropic's "balance sweet spot" for Opus 4.7; provides fix-application headroom without the `xhigh` cost premium that `implement` warrants |
| Over-provisioned | `opus` | `xhigh` | Identical output quality to `high` on verification checklists (diminishing returns); cost-disproportionate for a validation-plus-fix workload that already has a 100-turn budget |

### Guardrails (AC25)

**Opus rate-limit mitigation** — prior spec `specs/bug-opus-rate-limits/` established that concentrating Opus use triggers rate limits mid-cycle. The new default config uses Opus on only three of nine steps (down from a potential nine-of-nine under the old `"opus"` global default). Mechanical steps (`startCycle`, `commitPush`, `merge`) drop to Haiku — Anthropic's recommended model for deterministic tool-driven work — eliminating ~40% of previous Opus-subprocess starts per cycle.

**`implement` at `xhigh` within 150-turn / 30-min budget** — the current 100-turn `medium` budget is occasionally tight on mid-sized features. Moving to `xhigh` tier increases per-turn thinking time, but the 50% turn increase (100 → 150) absorbs the reduced turn efficiency. Wall-clock remains capped at 30 min. If a step saturates both, escalation correctly signals an issue that is too large for a single cycle rather than a budget problem.

**`monitorCI` at `sonnet`/`medium` headroom** — CI failure diagnosis typically needs 3-5 investigation rounds plus 1-2 fix rounds. The new 60-turn / 20-min budget leaves ~10-turn headroom above the 90th-percentile observed duration in collected logs. `medium` effort matches Anthropic's agentic-coding default and avoids the under-provisioning risk of `low`.

### `init-config` and `upgrade-project` interactions

**`init-config`** — reads `scripts/sdlc-config.example.json` at runtime (see `plugins/nmg-sdlc/skills/init-config/SKILL.md`). New defaults propagate automatically to fresh configs; no code change needed. AC22 is satisfied by updating the example template.

**`upgrade-project`** — currently key-merges new config keys but treats value drift as "report only" in unattended mode and requires per-value approval interactively. Issue #130 requires a new flow: present a curated diff of the *known recommended defaults that changed* with a batch-approve option (interactive only). In unattended mode the diff is reported in the summary but not auto-applied, preserving the existing value-drift contract.

**Curated diff format** — `upgrade-project` compares each `steps.*.{model,effort,maxTurns,timeoutMin}` in the user's config against the shipped example and presents a table:

```
Recommended default changes (plugin v1.47.0 → v1.48.0):

  steps.startCycle.model:     (unset — inherited "opus") → "haiku"
  steps.startCycle.maxTurns:  5 → 10
  steps.implement.effort:     "medium" → "xhigh"
  steps.implement.maxTurns:   100 → 150
  steps.verify.maxTurns:      60 → 100
  ...

Apply all recommended defaults? [y/N/review each]
```

Users who deliberately customized values can still decline; batch-approve addresses the "upgrade to new defaults" path without forcing per-field interaction.

### Affected files (addendum)

Additions to the file list from the original design:

| Area | Change |
|------|--------|
| `scripts/sdlc-runner.mjs` line 26 | `VALID_EFFORTS` expanded to include `xhigh` |
| `scripts/sdlc-runner.mjs` `validateConfig()` | Reject `max`; reject effort on Haiku |
| `scripts/sdlc-runner.mjs` `resolveStepConfig()` | Defaults `sonnet` / `medium` |
| `scripts/sdlc-runner.mjs` module init (104-105) | Same default change at module scope |
| `scripts/sdlc-config.example.json` | Rewritten per AC30 / AC36 tables |
| `scripts/__tests__/sdlc-runner.test.mjs` | Add tests: `xhigh` accept, `max` reject, Haiku+effort reject, new defaults |
| `README.md` (~lines 179-205) | Recommendations table rewritten; precedence subsection added; `max`-exclusion + Haiku-no-effort rules documented |
| `CHANGELOG.md` `[Unreleased]` | Two entries: defaults rework; turn-budget revision citing #181 |
| `plugins/nmg-sdlc/skills/*/SKILL.md` (all eleven listed above) | Add `model:` and `effort:` frontmatter fields |
| `plugins/nmg-sdlc/skills/upgrade-project/SKILL.md` | Add curated-defaults diff section |

### Alternatives considered (addendum)

| Option | Description | Decision |
|---|---|---|
| **Keep `opus` global default** | Leave the runner's fallback at `opus` and just fix the example config | Rejected — the runner default is the "nothing configured" outcome; leaving it at `opus` means downstream projects that never run `upgrade-project` silently run the most expensive model forever |
| **Allow `max` with a warning** | Accept `max` but log a warning | Rejected — warnings get ignored in automation logs; a hard reject surfaces the policy once at config-load time |
| **Auto-apply new defaults in `upgrade-project`** | Overwrite user values without confirmation | Rejected — breaks the existing value-drift contract and surprises users who deliberately customized step budgets |
| **Add a `policyVersion` field to config** | Track which defaults version the config matches so `upgrade-project` knows what "old" means | Deferred — useful but adds schema surface; curated diff works without it for this revision |
| **Collect telemetry before raising `maxTurns`** | Wait for real-world data before picking new floors | Rejected — #181 provides sufficient evidence; conservative AC36 floors have explicit "future telemetry may tighten" note |

### Risks & mitigations (addendum)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Downstream project runs old Opus-heavy defaults after plugin upgrade (no `upgrade-project`) | Medium | Medium | `upgrade-project` curated diff makes the bump discoverable; CHANGELOG entry flags the behavior change; runner default flip catches configs that omit fields |
| Skill frontmatter declarations break older Claude Code versions | Low | Low | Frontmatter fields are ignored if unrecognized; no error, just no-op |
| `xhigh` on `writeSpecs`/`implement` triggers Opus rate limits in long cycles | Low | Medium | Only three steps use Opus; `verify` at `high` moderates the total Opus footprint; cycle-level retry logic unchanged |
| `upgrade-project` diff overwhelms users with many changed fields | Low | Low | Batch-approve and per-field review both offered; tables are scannable |
| `max` rejection breaks a hypothetical user who set `"max"` manually | Low | Low | Clear error message identifies the field and the policy; trivial to change to `high` or `xhigh` |

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #77 | 2026-02-22 | Initial feature spec |
| #91 | 2026-02-23 | Replace plan/code split with single invocation; simplify architecture diagram, data flow, config schema; remove runImplementStep/resolveImplementPhaseConfig; add createPR maxTurns increase |
| #130 | 2026-04-18 | Optimize defaults for Opus 4.7 / Sonnet 4.6 / Haiku 4.5; expand `VALID_EFFORTS` to include `xhigh`; reject `max` and Haiku+effort; flip runner default to `sonnet`/`medium`; Opus hard cap on three steps; rewrite example config with AC30/AC36 tables; add `model`/`effort` to skill frontmatter; document precedence chain; `upgrade-project` curated diff |

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
