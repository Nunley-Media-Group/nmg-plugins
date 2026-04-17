# Design: Fix Stale Spec References

**Issues**: #114
**Date**: 2026-04-16
**Status**: Draft
**Author**: Rich Nunley

---

## Overview

This is a documentation-only cleanup that rewrites spec bodies under `.claude/specs/` to match the current implementation after v4.1.0 (OpenClaw/Discord removal) and v5.0.0 (skill rename). No runtime files, steering docs, or plugin skill files are modified.

The cleanup uses a **two-pass strategy**:
1. **Mechanical pass** — batch find/replace for deterministic, context-free substitutions (`openclaw/scripts/` → `scripts/`, `generating-openclaw-config` → `init-config`).
2. **Semantic pass** — per-file Read + Edit for context-sensitive rewrites where surrounding prose must be adjusted (Discord removal, `installing-openclaw-skill` removal, `~/.openclaw/` paths, gateway-restart flows, `feature-openclaw-runner-operations` redirects, automatic major-bump wording).

The acceptance signal is a single verification grep sweep (AC7) that must return zero matches for every drift pattern. Because the final state is observable via grep, the cleanup is deterministic and easy to verify even though the implementation mixes mechanical and judgment-based steps.

An important nuance discovered during design: `postDiscord()` still exists as a **name** in `scripts/sdlc-runner.mjs` line 456, but its body is now a one-liner that calls `log()`. The v4.1.0 removal preserved the function name as a pass-through for minimal churn. After user direction, the scope expanded to also **eliminate the legacy function from the code** — `postDiscord()` is removed from the runner and every call site is inlined as a direct `log('[STATUS] ${msg}')` invocation. This prevents future specs from re-introducing the stale name and removes a misleading breadcrumb that hints at a Discord integration that no longer exists.

---

## Architecture

### Scope Map

```
.claude/specs/                           ← In scope (all edits here)
├── feature-*/                            ← Feature specs (9 affected)
├── bug-*/                                ← Bug specs (~15 affected)
└── feature-fix-stale-spec-references/    ← This spec — EXCLUDED from AC8 grep sweeps

scripts/sdlc-runner.mjs                  ← In scope (ONLY to remove postDiscord() per FR8)
scripts/__tests__/**                     ← In scope (update any postDiscord-specific tests)

.claude/steering/**                      ← OUT OF SCOPE (untouched)
scripts/** (non-runner files)            ← OUT OF SCOPE beyond FR8
plugins/**                               ← OUT OF SCOPE (untouched)
CHANGELOG.md                             ← In scope only for a one-line [Unreleased] entry noting the postDiscord removal
README.md                                ← OUT OF SCOPE (no drift here)
```

### Cleanup Pipeline

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Inventory                                        │
│   Run baseline greps → capture affected file list        │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Runner Code Change (FR8)                         │
│   Remove postDiscord() from sdlc-runner.mjs              │
│   Inline every call site as log('[STATUS] …')            │
│   Update/remove any postDiscord-specific tests           │
│   Run scripts/ npm test → confirm green                  │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Mechanical Pass (bulk find/replace in specs)     │
│   3a: openclaw/scripts/ → scripts/                       │
│   3b: generating-openclaw-config → init-config           │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: Semantic Pass (per-file Edit with context)       │
│   4a: Remove installing-openclaw-skill refs + adjust     │
│   4b: Remove Discord references + rewrite dependents     │
│   4c: Remove ~/.openclaw/ and gateway-restart flows      │
│   4d: Redirect feature-openclaw-runner-operations refs   │
│   4e: Update automatic major-version bump language       │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│ Step 5: CHANGELOG entry                                  │
│   Add one line under [Unreleased] for postDiscord removal│
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│ Step 6: Verification Sweep                               │
│   Run AC8 greps → confirm zero matches across patterns   │
│   Run scripts/ npm test → confirm runner still green     │
└─────────────────────────────────────────────────────────┘
```

---

## Runner Code Change (FR8)

### Current State

`scripts/sdlc-runner.mjs` contains:
- One function definition: `async function postDiscord(message)` at **line 456**, body is a one-line `log('[STATUS] ${message}')`
- 21 call sites across the runner at lines 1133, 1148, 1167, 1216, 1245, 1688, 1716, 1736, 1745, 1764, 1778, 1807, 1810, 1815, 1825, 1835, 1891, 1908, 1914, 1919, 1945, 2041
- One module export at **line 2124** (`postDiscord` is re-exported for tests)
- Three test references in `scripts/__tests__/sdlc-runner.test.mjs`:
  - Line 1382–1385: "F2: postDiscord is a log-only wrapper" describe block + assertion that `postDiscord` body doesn't reference `Atomics`/`spawn`
  - Line 2059–2063: "handleSignal source does not await postDiscord" assertion

### Target State

- `postDiscord()` definition removed
- Every call site rewritten:
  - `await postDiscord(msg)` → `log(\`[STATUS] ${msg}\`)` (no `await` needed — `log()` is synchronous)
  - The SIGTERM fire-and-forget call at line 1688 (`postDiscord(...).catch(() => {})`) becomes a plain `log('[STATUS] …')` with no `.catch()` chain
- Export at line 2124 removed from the module.exports / object literal
- Tests updated:
  - Delete the F2 "postDiscord is a log-only wrapper" block — the function no longer exists, and the bug it guarded against (Atomics.wait in retry) is definitively impossible without the function
  - Delete or rewrite the handleSignal assertion at line 2059–2063 — rewrite to assert that `handleSignal` source doesn't `await log(` (preserving the non-blocking-in-signal-handler intent)

### Behavioral Invariant

Every `[STATUS]` line currently written to the orchestration log must still be written, at the same code location, with the same message content. The `log()` function already prefixes `[STATUS]` because `postDiscord` passes `[STATUS] ${message}` to `log()`. After inlining, the explicit `[STATUS]` prefix moves to the call site.

### Dedup Opportunity (Optional)

Line 1132–1133 currently does:
```js
log('Rate limited. Waiting 60s before retry...');
await postDiscord(`Rate limited on Step ${step.number}. Waiting 60s...`);
```

After inlining, this becomes two nearly-identical `log()` calls. The change MAY consolidate to a single `log('[STATUS] …')` — but this is optional and must not change the visible log content. If in doubt, keep both calls to preserve the current log output exactly.

---

## Mechanical Pass — Substitution Rules

These rules apply as-is via `Edit` with `replace_all: true` on each affected file.

| # | Find | Replace | Files Affected | Risk |
|---|------|---------|----------------|------|
| M1 | `openclaw/scripts/sdlc-runner.mjs` | `scripts/sdlc-runner.mjs` | ~25 files | None — deterministic path rename |
| M2 | `openclaw/scripts/sdlc-config.example.json` | `scripts/sdlc-config.example.json` | ~4 files | None |
| M3 | `openclaw/scripts/__tests__/` | `scripts/__tests__/` | Any spec mentioning runner tests | None |
| M4 | `openclaw/scripts/` (catch-all for any remaining) | `scripts/` | Catch-all | None — applied last in pass |
| M5 | `generating-openclaw-config` | `init-config` | 9 files | Low — only the skill name; surrounding prose stays valid |

**Why this works mechanically**: the substituted strings are 1:1 — `openclaw/scripts/` became `scripts/`, `generating-openclaw-config` became `init-config`. The surrounding prose ("the SDLC runner at `openclaw/scripts/sdlc-runner.mjs`…") reads correctly with the new path substituted in.

---

## Semantic Pass — Per-File Edits

These edits cannot be done mechanically because the surrounding prose or AC structure must change.

### S1: Remove `installing-openclaw-skill` references

**Affected files**: `feature-per-step-model-effort-config/{design.md,feature.gherkin,tasks.md}`, `feature-migrate-project-skill/{requirements.md,design.md,feature.gherkin}`, `bug-opus-rate-limits/{requirements.md,feature.gherkin,tasks.md}`

**Strategy**:
- The skill was *deleted*, not renamed — there is no target to redirect to
- Read each occurrence in context
- If the reference is in a list of skills (e.g., "skills like `generating-openclaw-config`, `installing-openclaw-skill`"), remove the list entry
- If the reference is in an AC or scenario that was specifically about the install skill, delete that AC/scenario entirely
- If the reference is in narrative prose, rewrite the sentence to no longer mention the skill
- Always confirm the surrounding paragraph still reads coherently after the edit

### S2: Remove Discord references and rewrite dependent ACs

**Affected files** (heavy): `bug-sdlc-runner-edge-case-fixes/`, `bug-text-pattern-soft-failure-detection-sdlc-runner/`, `feature-migrate-project-skill/feature.gherkin`

**Affected files** (light): Others with 1–2 Discord mentions

**Strategy**:
- Replace the behavioral description: "Discord posting" / "posts to Discord" → "status notification to the orchestration log"
- Replace API references: `postDiscord()` → `log()` (the current implementation). Note the function name `postDiscord` survives in code as a pass-through — spec bodies still must not mention it per AC3.
- Replace config field references: `discordChannelId` → remove entirely (the field is gone from `sdlc-config.example.json`)
- For the `Atomics.wait()` in Discord retry content in `bug-sdlc-runner-edge-case-fixes/`: this was a real bug at the time of writing, but the fix landed along with the Discord removal, so the F2 section's fix description is now stale. Rewrite F2 to describe the historical issue and note the fix used `await sleep()` (the current implementation has neither `Atomics.wait()` nor a retry loop around Discord posting). Since the spec is historical record, keeping F2's structure but pointing to the current state is preferable to deleting it outright.
- For `feature-migrate-project-skill/feature.gherkin:64` which tests `discordChannelId` preservation: delete the scenario (the field no longer exists)

**Nuanced cases**:
- `feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code/requirements.md:1` — single Discord mention; review in context and rewrite to describe the status-logging replacement
- `bug-opus-rate-limits/feature.gherkin` and `feature-run-retro-skill/feature.gherkin`: lightweight mentions — likely one-line fixes

### S3: Remove `~/.openclaw/` and gateway-restart references

**Affected files**: `feature-installing-locally-skill/{design.md,feature.gherkin,verification.md,tasks.md}`, `feature-migrate-project-skill/{requirements.md,feature.gherkin}`

**Strategy**:
- Remove Steps 5 and 6 from installation-locally workflow diagrams ("Copy OpenClaw skill files", "Restart OpenClaw gateway")
- Renumber subsequent steps and update scenario/AC counts accordingly
- Remove `~/.openclaw/` from architecture diagrams (e.g., the dual-directory diagram in `design.md:37`)
- Rewrite `verification.md:33` AC3 to reflect the current 5-step workflow (no OpenClaw sync)
- Delete gherkin scenarios that test OpenClaw skill sync or gateway restart
- In `feature-migrate-project-skill/`: AC6/AC7 (check `~/.openclaw/` and `/installing-openclaw-skill`) are deleted entirely; the spec's purpose (migrating Claude Code project conventions) still applies, but those specific ACs referenced removed components

### S4: Redirect `feature-openclaw-runner-operations` references

**Affected files**: `bug-fix-write-spec-defect-related-spec-search/requirements.md` (4 refs), `bug-text-pattern-soft-failure-detection-sdlc-runner/requirements.md` (1 ref)

**Redirect target**: `.claude/specs/feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code/`

**Justification**: The dangling references treat `feature-openclaw-runner-operations` as the original feature spec for runner internals (`cleanupProcesses()`, etc.). `feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code` is the surviving spec that covers SDLC pipeline/runner operations.

**Strategy**:
- Replace the directory name in each occurrence
- The surrounding prose references (e.g., "feature spec for `cleanupProcesses()`") remains accurate since the redirect target does cover the runner
- Verify each rewritten sentence still reads correctly

### S5: Update automatic major-version bump language

**Affected files**: `bug-fix-inconsistent-version-bumping/` (requirements, design, tasks), any other spec touching version-bump flow (discovered during Step 1 inventory)

**Strategy**:
- Find passages describing "milestone completion triggers major version bump" or "last issue in milestone → major"
- Rewrite to describe the current v4.3.0 behavior: "Major version bumps are always manual; milestone completion no longer affects bump classification"
- `tech.md` already documents this correctly (out of scope), so specs can defer to tech.md where appropriate

---

## API / Interface Changes

Minor — internal only, no external surface change.

| Change | Description |
|--------|-------------|
| Remove `postDiscord()` | Internal helper in `sdlc-runner.mjs`; not part of any public plugin API |
| Remove module export of `postDiscord` | The object literal at line ~2124 exports internal helpers for Jest; removing one entry is safe because no test file outside `scripts/__tests__/sdlc-runner.test.mjs` imports it |
| Call sites switch to `log('[STATUS] …')` | Log output on stdout and in `orchestration.log` is identical to the current behavior |

---

## Database / Storage Changes

None.

---

## State Management

None.

---

## UI Components

None.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Bulk sed script** | Use a single shell script with multiple `sed -i` expressions to do the mechanical pass in one shot | Very fast; reproducible | Cross-platform `sed` differences (macOS BSD vs GNU); no visibility into per-file context for semantic pass; still need separate semantic pass | Rejected |
| **B: Per-file Edit tool (all files)** | Use `Edit` with `replace_all: true` file-by-file for everything including mechanical substitutions | Uniform tool; reviewable per file; cross-platform | Slower than sed for the mechanical pass | Considered but combined with C |
| **C: Two-pass (Mechanical + Semantic)** | Batch the mechanical substitutions via `Edit`, then do per-file semantic edits | Balances speed and reviewability; clear separation of deterministic vs judgment work; final diff is readable | Two logical phases instead of one | **Selected** |
| **D: Leave historical specs alone** | Only rewrite specs that are still "active" | Less churn | Violates project convention (rewrite historical specs during renames per `memory/feedback_refactor_docs.md`); breaks grep-based audits going forward | Rejected |

---

## Security Considerations

- [x] **No secrets in specs** — cleanup does not expose any secret material; all changes are documentation text
- [x] **No injection surface** — no executable content is modified
- [x] **Git history preserves original** — the pre-cleanup spec text remains accessible via `git log -p`

---

## Performance Considerations

- [x] **One-time cost** — the cleanup is a one-shot change; no recurring runtime impact
- [x] **No runtime effect** — specs are read by humans and by `/write-spec` / `/verify-code` for AC text; none of the drifted content is parsed programmatically in a way that the cleanup would affect

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Drift sweep | Grep-based verification | Each AC8 pattern returns zero matches |
| Spot-check | Manual read | 5 random rewritten specs — confirm surrounding prose still reads coherently |
| Cross-reference integrity | Link-following | Any rewritten `feature-openclaw-runner-operations` redirect → confirm target directory exists |
| Runner test suite | Jest (`cd scripts && npm test`) | All tests pass after `postDiscord` removal and test-file updates |
| Runner smoke | Manual or CI | `node scripts/sdlc-runner.mjs --help` (or equivalent no-op invocation) runs without throwing — confirms no dangling `postDiscord` reference |

The spec-cleanup portion is documentation-only; the runner change is small and deterministic. The Gherkin feature file (Phase 3) documents the verification sweep and the runner invariant as testable scenarios.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Mechanical replacement breaks a valid reference (e.g., a spec legitimately discussed the pre-v4.1.0 path as historical context) | Low | Low | After Step 2 mechanical pass, do a spot-check diff read before committing; if any replacement turned prose nonsensical, revert that specific edit |
| Semantic rewrites over-aggressively delete AC content that is still valid | Medium | Medium | For borderline cases (e.g., F2 in `bug-sdlc-runner-edge-case-fixes/`), preserve the historical context and clarify that the fix was applied, rather than deleting the section outright |
| `feature-openclaw-runner-operations` redirect target is wrong | Low | Low | Per S4, the target (`feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code/`) is the only surviving spec covering runner internals; verify by reading the target spec's scope |
| Grep sweep misses a drift pattern due to unusual formatting (markdown variants, code fences, etc.) | Low | Low | AC7 includes case-insensitive greps; run them with `-i` and review any remaining hits before declaring done |
| Scope creep — editor improves unrelated spec content while doing per-file edits | Medium | Low | Keep FR10 in front of mind; commit diff review will catch out-of-scope edits before PR |
| Missed `postDiscord` call site in runner | Low | Medium | After edits, grep `scripts/sdlc-runner.mjs` for `postDiscord` — must return zero matches; run full Jest suite before declaring done |
| Log output regression (e.g., missing `[STATUS]` prefix after inlining) | Low | Medium | Every call-site rewrite must explicitly include the `[STATUS]` prefix; a simple before/after diff review of the log stream during a smoke run catches drift |

---

## Open Questions

- [x] Should `postDiscord()` references in specs become `log()` or stay as status-notification prose? → **Resolved**: rewrite to `log()` where the spec genuinely describes the code function; rewrite to "status notification / orchestration log" where the spec describes behavior abstractly. Per AC3, no mention of `postDiscord` remains in spec bodies regardless.
- [x] Should `bug-sdlc-runner-edge-case-fixes/` F2 (Atomics.wait in Discord retry) be kept as historical record or deleted? → **Resolved** (S2 strategy): keep the F2 structure but update the description to note the issue was fixed and the surrounding `postDiscord` retry loop is gone; do not mention Discord by name.
- [x] What about `feature-openclaw-runner-operations` redirect target? → **Resolved**: `feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code/`.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #114 | 2026-04-16 | Initial design for documentation drift cleanup |
| #114 | 2026-04-16 | Added Runner Code Change section (FR8): remove `postDiscord()` and inline call sites; updated pipeline, testing strategy, and risks |

---

## Validation Checklist

- [x] Architecture follows the project's convention of rewriting historical specs during renames
- [x] All changes scoped to `.claude/specs/` (no API/DB/UI changes exist)
- [x] Alternatives considered and documented (sed vs Edit, two-pass vs one-pass, full rewrite vs leave historical)
- [x] Risks identified with mitigations (over-aggressive rewrites, scope creep, grep blind spots)
- [x] Testing strategy defined (grep sweep + spot-check reads)
- [x] Open questions resolved inline
