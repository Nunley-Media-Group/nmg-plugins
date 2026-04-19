# Design: Add /simplify Step to SDLC Pipeline

**Issues**: #140
**Date**: 2026-04-19
**Status**: Draft
**Author**: Rich Nunley

---

## Overview

This change inserts a `/simplify` pass between implementation and verification at every layer of the SDLC pipeline:

1. **Skill layer** — `write-code` calls `/simplify` after Step 5 (Execute Tasks) and before Step 6 (Signal Completion); `verify-code` calls `/simplify` after Step 6a (Prioritize and Fix) and before Step 6b (Run Tests After Fixes).
2. **Runner layer** — `scripts/sdlc-runner.mjs` adds a new `simplify` step to `STEP_KEYS` between `implement` and `verify`. The runner builds a step-specific prompt that probes for the `simplify` skill before invoking Claude, and skips gracefully if the skill is absent.
3. **Documentation layer** — The README pipeline diagram, every skill's `## Integration with SDLC Workflow` block, and `sdlc-config.example.json` are updated to show the new step.

The feature is opt-in by presence: if a project does not have `simplify` installed, the integration logs a warning and falls through. The marketplace `simplify` skill is never bundled with `nmg-sdlc` — Anthropic's marketplace remains the source of truth for the skill itself.

The probe-and-skip pattern is the central design decision. Without it, the runner would hard-fail on every project that hasn't installed `simplify`, defeating the "stack-agnostic" product principle. With it, the integration is a no-op for projects that don't want simplification and a value-add for those that do.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Claude Code Session                            │
│                                                                        │
│   /write-code  ──▶  [tasks loop]  ──▶  /simplify (probe+invoke)       │
│                                              │                         │
│                                              ▼                         │
│                                    Signal Completion                   │
│                                                                        │
│   /verify-code ──▶  Step 6a (Fix)  ──▶  /simplify (probe+invoke)      │
│                                              │                         │
│                                              ▼                         │
│                              Step 6b (Re-test) → 6c (Re-verify)        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                       SDLC Runner (sdlc-runner.mjs)                    │
│                                                                        │
│   STEP_KEYS = [startCycle, startIssue, writeSpecs, implement,         │
│                simplify,  ◀── NEW                                     │
│                verify, commitPush, createPR, monitorCI, merge]        │
│                                                                        │
│   buildClaudeArgs(simplify) ─▶ probe for skill ─▶ skip OR invoke      │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow (Runner)

```
1. Step 4 (implement) completes successfully
2. Runner advances to Step 5 (simplify) — new step
3. Runner builds prompt:
   "Probe for the simplify skill. If absent, log the skip warning and exit 0.
    If present, invoke /simplify on files changed in this branch and apply fixes."
4. Claude subprocess executes the prompt
5. On exit:
   a. Skill found + simplify ran → state.lastStep = 5, advance to verify
   b. Skill not found → log "[STATUS] simplify skill not available — skipping",
                        mark step success without invoking Claude (or via Claude exiting 0
                        after logging the skip — design choice below)
   c. Failure → standard retry/escalation path
6. Step 6 (verify) runs as before
```

### Skill-Side Data Flow (write-code)

```
1. Step 5 executes all tasks
2. NEW Step 5b: Probe for simplify skill (Glob over plugin dirs / known marketplace paths)
3. If found → invoke /simplify, apply changes, then proceed to Step 6
4. If not found → log warning, proceed to Step 6
5. Step 6 emits "Implementation complete..." (no longer the previous-final-step terminator)
```

---

## API / Interface Changes

### New Step Key

| Identifier | Type | Location | Purpose |
|------------|------|----------|---------|
| `simplify` | string in `STEP_KEYS` | `scripts/sdlc-runner.mjs` | New pipeline step between `implement` and `verify` |

### New Config Entry

| Field | Type | Location | Default |
|-------|------|----------|---------|
| `steps.simplify` | object | `scripts/sdlc-config.example.json` | `{ "model": "sonnet", "effort": "medium", "maxTurns": 60, "timeoutMin": 15 }` |

### Probe Contract (used by skills and runner alike)

A "skill availability probe" answers a single question: is a Claude Code skill named `simplify` discoverable from the current session?

**Approach (selected — option B in Alternatives):** the probe is a **prompt-level instruction**, not a JS function. The skill / runner prompt asks Claude to:

1. Run the deterministic check: `Glob` for `simplify/SKILL.md` under both:
   - the active project's `.claude/skills/`
   - any plugin directories (Claude Code surfaces these via the `Skill` tool's available-skills list in the system reminder)
2. Treat the skill as available if either lookup returns a match.
3. If unavailable, emit the warning string verbatim and continue.

This keeps the runner stack-agnostic — no JavaScript needs to model the marketplace's skill discovery rules.

### New Runner Prompt (Step 5)

```
Run the simplify pass over files changed on the current feature branch.

1. Probe for the simplify skill: Glob `~/.claude/skills/simplify/SKILL.md` and
   `~/.claude/plugins/**/skills/simplify/SKILL.md`. Also consult the
   available-skills list in your system reminder.
2. If no `simplify` skill is registered, print:
   "simplify skill not available — skipping simplification pass"
   and exit with code 0.
3. Otherwise, invoke /simplify on the files in `git diff main...HEAD --name-only`
   and apply any fixes it returns.
4. Exit with code 0 on success.
```

---

## Database / Storage Changes

None. State persistence in `.claude/sdlc-state.json` continues to track `lastStep` numerically; because `STEP_NUMBER` is derived from `STEP_KEYS`, the renumbering is automatic. **Migration concern:** existing in-flight `sdlc-state.json` files written by older runner versions will reference step numbers that no longer match the new ordering. Mitigation: the runner re-derives step numbers from `STEP_KEYS` on read, but a state file mid-cycle (e.g., `lastStep: 5` written by old runner) would be misinterpreted as `simplify` complete instead of `verify` complete. See **Risks & Mitigations** for the resolution strategy.

---

## State Management

The runner's state object (`state.lastStep`) stores the integer step number. After this change, step numbers shift:

| Old | New | Step Key |
|-----|-----|----------|
| 1 | 1 | startCycle |
| 2 | 2 | startIssue |
| 3 | 3 | writeSpecs |
| 4 | 4 | implement |
| — | 5 | **simplify** (NEW) |
| 5 | 6 | verify |
| 6 | 7 | commitPush |
| 7 | 8 | createPR |
| 8 | 9 | monitorCI |
| 9 | 10 | merge |

`STEP_NUMBER` is already `Object.fromEntries(STEP_KEYS.map((key, i) => [key, i + 1]))`, so any code that uses `STEP_NUMBER.verify` or `STEP_NUMBER.merge` automatically picks up the new value. The audit during implementation must confirm no literal step numbers remain in critical paths.

---

## UI Components

N/A (CLI-only project).

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: JS-side probe in runner** | Runner JavaScript inspects the filesystem for the `simplify` skill before spawning Claude; skips Claude entirely if absent | Faster (no Claude turn for the no-op case); deterministic | Runner must encode marketplace skill-discovery rules; brittle if Claude Code changes how it locates skills; couples runner to filesystem layout | Rejected — violates the runner's "no SDLC logic in scripts" invariant from `structure.md` |
| **B: Prompt-level probe** | Runner prompts Claude to probe and skip; same pattern in skill files | Stack-agnostic; centralizes skill-discovery rules in prompts (where they belong); zero new JS required for probe logic | One Claude turn is consumed even for the no-op case (~5s + small cost) | **Selected** |
| **C: Bundle simplify with nmg-sdlc** | Vendor the simplify skill into the plugin | Always available; no probe needed | Drifts from upstream `simplify`; adds licensing/attribution surface; out-of-scope per issue | Rejected — explicit Out of Scope in requirements |
| **D: Runner config opt-in** | Require `sdlc-config.json` to set `simplify.enabled = true` | Explicit | Adds friction; surprises users who installed simplify but forgot to enable | Rejected — "enabled if installed" is the lowest-friction default |

---

## Security Considerations

- [x] **Authentication**: N/A — runs under existing Claude Code session auth
- [x] **Authorization**: Inherits the runner's `--dangerously-skip-permissions` envelope; no new tools requested
- [x] **Input Validation**: The probe is a `Glob` against fixed patterns; no user-supplied input flows into shell commands
- [x] **Data Sanitization**: Files passed to simplify come from `git diff` output — already trusted in the existing pipeline
- [x] **Sensitive Data**: No new secrets or credentials introduced

---

## Performance Considerations

- [x] **Caching**: None needed; the probe is a single filesystem check per pipeline invocation
- [x] **Pagination**: N/A
- [x] **Lazy Loading**: Probe is the only work for projects that haven't installed simplify — effectively free
- [x] **Indexing**: N/A
- [x] **Step duration**: New step adds at most one Claude turn for the probe + simplify-skill execution time. Default config allots 15 min — should be sufficient based on the simplify skill's design (changed-files-only review)

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Runner | Jest unit | `STEP_KEYS` ordering, length, simplify position; `STEP_NUMBER` mapping for downstream steps |
| Runner | Jest unit | Prompt builder for step 5 returns a probe-and-skip prompt |
| Skills | Exercise (manual) | Load plugin against a test project with simplify installed; observe `/simplify` invocation in write-code and verify-code |
| Skills | Exercise (manual) | Same test project without simplify; observe warning and successful pass-through |
| BDD | Gherkin | All 5 ACs encoded as scenarios in `feature.gherkin` |
| Documentation | Grep | After change, `grep -r "/write-code.*\/verify-code"` returns zero direct adjacencies in pipeline diagrams |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Step renumbering breaks in-flight state files mid-cycle (an old `sdlc-state.json` with `lastStep: 5` would mean "verify" under the old scheme but "simplify" under the new) | Medium | Medium | The runner already validates preconditions for each step on resume — a stale `lastStep: 5` will be re-validated and fail the simplify precondition harmlessly (or re-execute the simplify step idempotently). Add a release-notes / CHANGELOG warning recommending that in-flight cycles complete before upgrading |
| Probe instruction misses Claude Code's actual skill-discovery path on some platforms | Low | Medium | Probe instructs Claude to consult both filesystem locations AND the available-skills system reminder; the dual check tolerates platform variation |
| Simplify pass introduces changes that contradict the spec | Medium | Low | verify-code re-runs after simplify in the runner; any spec deviations introduced will be caught by the next verify pass and rolled back per existing fix-rules |
| Hardcoded literal step numbers in runner code or comments | Low | Low | Implementation includes a grep audit (`grep -nE "step ?5|step ?6|step ?7|step ?8|step ?9" sdlc-runner.mjs`) and replaces literals with `STEP_NUMBER.<key>` references where they reference shifted steps |
| Adding a new step lengthens the average cycle by simplify's runtime even when no findings exist | High | Low | Acceptable cost — issue motivation explicitly trades pipeline time for verification quality; the warning-and-skip path keeps the cost zero for projects without simplify |

---

## Open Questions

- [ ] Should the runner step config default to `model: "sonnet"` or `model: "haiku"`? (Design proposes `sonnet medium` as a balance; can be tuned post-merge based on observed simplify behavior)
- [ ] Should the warning string be a soft-failure pattern that the runner counts toward escalation? (Design says no — it's an expected skip, not a soft failure; verify by absence of the string from `TEXT_FAILURE_PATTERNS` in the runner)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #140 | 2026-04-19 | Initial design |

---

## Validation Checklist

- [x] Architecture follows existing project patterns (per `structure.md`)
- [x] All API/interface changes documented (new `STEP_KEYS` entry, new config field, probe contract)
- [x] Database/storage impact analyzed (state file renumbering risk noted with mitigation)
- [x] State management approach is clear (derived numbering preserves invariant)
- [x] No UI components needed (CLI-only)
- [x] Security considerations addressed
- [x] Performance impact analyzed
- [x] Testing strategy defined
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
