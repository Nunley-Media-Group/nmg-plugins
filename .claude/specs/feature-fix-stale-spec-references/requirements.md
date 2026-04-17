# Requirements: Fix Stale Spec References

**Issues**: #114
**Date**: 2026-04-16
**Status**: Draft
**Author**: Rich Nunley

---

## User Story

**As a** developer maintaining the nmg-sdlc plugin
**I want** all historical specs in `.claude/specs/` to describe the current implementation
**So that** specs remain trustworthy artifacts I can grep for design context without being misled by references to removed components

---

## Background

A drift audit triggered by v4.1.0 (OpenClaw integration removal) and v5.0.0 (gerund → imperative skill rename) found that spec *bodies* were never rewritten to match the current codebase. The directory renames landed cleanly in v5.0.0, so no v5.0.0 gerund-form skill names remain in spec bodies — all remaining drift is from v4.1.0 OpenClaw leftovers and two OpenClaw-era skill names that were either renamed (`generating-openclaw-config` → `init-config`) or removed entirely (`installing-openclaw-skill`).

Per project convention (rewrite historical specs during renames; rely on git history for context — see `memory/feedback_refactor_docs.md`), specs should be updated so they accurately describe the current implementation rather than the pre-v4.1.0 / pre-v5.0.0 world.

The audit already identified the exact drift patterns and scoped the affected files. This feature is the cleanup work — a documentation-only change with no runtime impact.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: No stale `openclaw/scripts/` paths remain

**Given** the drift audit found ~25 specs referencing `openclaw/scripts/sdlc-runner.mjs` or `openclaw/scripts/sdlc-config.example.json`
**When** the cleanup is complete
**Then** `grep -r 'openclaw/scripts/' .claude/specs/` returns zero matches
**And** every former reference points to the current path `scripts/sdlc-runner.mjs` or `scripts/sdlc-config.example.json`

**Example**:
- Before: `` `openclaw/scripts/sdlc-runner.mjs` ``
- After: `` `scripts/sdlc-runner.mjs` ``

### AC2: No references to removed OpenClaw-era skill names remain

**Given** the skills `generating-openclaw-config` and `installing-openclaw-skill` no longer exist (renamed to `init-config` and removed, respectively)
**When** the cleanup is complete
**Then** `grep -r 'generating-openclaw-config\|installing-openclaw-skill' .claude/specs/` returns zero matches
**And** references to `generating-openclaw-config` are replaced with `init-config` where the surrounding context still applies
**And** references to `installing-openclaw-skill` are removed (since the skill was deleted, not renamed) and surrounding prose is adjusted so paragraphs remain coherent

### AC3: No references to removed Discord integration remain

**Given** Discord posting (`postDiscord()`, `discordChannelId`, Discord retry/backoff handling) was removed in v4.1.0
**When** the cleanup is complete
**Then** `grep -r 'postDiscord\|discordChannelId' .claude/specs/` returns zero matches
**And** `grep -r -i 'discord' .claude/specs/` returns zero matches in spec bodies (not including the `.claude/specs/feature-fix-stale-spec-references/` directory itself, which documents this very cleanup)
**And** any scenario or AC that depended on Discord behavior is either deleted (if Discord was the sole subject) or rewritten to describe the current status-logging implementation that replaced it

### AC4: OpenClaw skill-sync and gateway-restart behavior removed

**Given** `feature-installing-locally-skill/` and `feature-migrate-project-skill/` describe OpenClaw skill-sync behavior and `~/.openclaw/` gateway-restart flows that no longer exist
**When** the cleanup is complete
**Then** no references to `~/.openclaw/` remain in `.claude/specs/`
**And** no references to OpenClaw gateway restart or gateway-sync operations remain in `.claude/specs/`
**And** ACs that depended on those behaviors are either deleted or rewritten to describe the current Claude Code plugin installation flow

### AC5: References to non-existent `feature-openclaw-runner-operations` spec resolved

**Given** two specs cite a `feature-openclaw-runner-operations` directory that no longer exists in `.claude/specs/`
**When** the cleanup is complete
**Then** `grep -r 'feature-openclaw-runner-operations' .claude/specs/` returns zero matches
**And** each former reference is replaced with a pointer to an existing spec that covers the same subject matter (likely one of the SDLC-runner bug specs) OR removed if no replacement is apt

### AC6: Automatic major-version bump references updated

**Given** v4.3.0 removed automatic major version bumps from `sdlc-runner.mjs` (only manual major bumps remain; milestone completion no longer triggers a major bump)
**When** the cleanup is complete
**Then** any spec describing milestone-triggered automatic major-version bumps is updated to describe the current behavior (manual major bumps only, milestone-based overrides removed)
**And** `grep -r -i 'major.version.*bump\|automatic.*major' .claude/specs/` returns only references consistent with the v4.3.0 behavior

### AC7: `postDiscord()` removed from runner code

**Given** `postDiscord()` in `scripts/sdlc-runner.mjs` is a pass-through wrapper that just calls `log()` (a v4.1.0 leftover)
**When** the cleanup is complete
**Then** the `postDiscord()` function definition is removed from `scripts/sdlc-runner.mjs`
**And** every call site `await postDiscord(msg)` / `postDiscord(msg)` is replaced with `log(\`[STATUS] ${msg}\`)` (or equivalent direct `log()` call preserving the existing `[STATUS]` prefix)
**And** the runner's behavior is unchanged — the orchestration log still receives the same `[STATUS]` messages at the same trigger points
**And** the Jest runner tests in `scripts/__tests__/` still pass

**Rationale**: Eliminating the legacy function name at the code level prevents specs from drifting back to mention `postDiscord` and removes a misleading artifact that hints at a Discord integration that no longer exists.

### AC8: Final drift sweep passes

**Given** all targeted cleanups are complete
**When** the verification sweep runs
**Then** each of the following greps (scoped to `.claude/specs/` and excluding this feature's own spec directory) returns zero matches:
- `openclaw/scripts/`
- `generating-openclaw-config`
- `installing-openclaw-skill`
- `postDiscord`
- `discordChannelId`
- `feature-openclaw-runner-operations`
- `~/.openclaw/`
- case-insensitive `openclaw` (with narrow exception: the steering doc env var `OPENCLAW_DISCORD_CHANNEL` in `tech.md` is out of scope — spec bodies must not mention it)
- case-insensitive `discord` (excluding this spec's own directory)

**And** `grep -n 'postDiscord' scripts/sdlc-runner.mjs` returns zero matches (per AC7)

### Generated Gherkin Preview

```gherkin
Feature: Fix Stale Spec References
  As a developer maintaining the nmg-sdlc plugin
  I want all historical specs to describe the current implementation
  So that specs remain trustworthy artifacts without misleading references

  Scenario: No stale openclaw/scripts/ paths remain
    Given the drift cleanup has been applied
    When I grep for "openclaw/scripts/" under .claude/specs/
    Then zero matches are returned

  Scenario: No removed OpenClaw-era skill names remain
    Given the drift cleanup has been applied
    When I grep for "generating-openclaw-config" or "installing-openclaw-skill" under .claude/specs/
    Then zero matches are returned

  # ... one scenario per AC
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Replace every `openclaw/scripts/` path with `scripts/` across affected specs | Must | Mechanical find/replace; safe to batch |
| FR2 | Replace `generating-openclaw-config` with `init-config` where the surrounding context still applies | Must | Per-file judgment — some surrounding prose may need trimming |
| FR3 | Remove `installing-openclaw-skill` references and adjust surrounding prose so paragraphs remain coherent | Must | The skill was deleted, not renamed — no target to redirect to |
| FR4 | Remove all Discord integration references (APIs, config fields, scenarios) and rewrite dependent ACs to describe the current status-logging behavior | Must | High-judgment: some ACs may need deletion rather than rewriting |
| FR5 | Remove references to `~/.openclaw/` and OpenClaw gateway-restart flows | Must | Concentrated in `feature-installing-locally-skill/` and `feature-migrate-project-skill/` |
| FR6 | Resolve dangling `feature-openclaw-runner-operations` cross-references | Must | Replace with an existing spec pointer or remove if no apt replacement |
| FR7 | Update specs describing automatic major-version bumps to reflect v4.3.0's manual-only behavior | Should | Overlap with FR1 files (notably `bug-fix-inconsistent-version-bumping/`) |
| FR8 | Remove the `postDiscord()` function from `scripts/sdlc-runner.mjs` and replace every call site with a direct `log('[STATUS] …')` invocation, preserving message content and timing | Must | Also update any runner test that asserts on `postDiscord` specifically; behavior must remain identical |
| FR9 | After cleanup, a final verification grep returns zero matches for each drift pattern (per AC8) | Must | Acceptance signal for the whole feature |
| FR10 | Do NOT modify the project's steering docs (`.claude/steering/**`) or plugin skill files (`plugins/nmg-sdlc/skills/**`). Only `.claude/specs/**` and `scripts/sdlc-runner.mjs` (for FR8) are in scope | Must | The env var `OPENCLAW_DISCORD_CHANNEL` in `tech.md` is intentionally out of scope for this issue |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Cross-Platform** | All edits must use forward slashes (LF line endings); the cleanup tool (grep/sed/Edit) must work on macOS/Linux (Windows contributors use their tool equivalents) |
| **Reversibility** | All changes land in a single feature branch (`114-fix-stale-spec-references`) so the cleanup can be reviewed as a cohesive diff |
| **Verifiability** | Acceptance is a deterministic grep sweep — success is binary |
| **Scope Discipline** | Do not refactor or improve other spec content beyond the drift patterns listed in ACs |

---

## Out of Scope

- Modifying `.claude/steering/**` — steering docs are reviewed separately (e.g., the `OPENCLAW_DISCORD_CHANNEL` env var still documented in `tech.md` is intentionally untouched by this issue)
- Modifying plugin skill files (`plugins/nmg-sdlc/skills/**/SKILL.md`) — in-flight rename/cleanup work for skills is tracked by other issues
- Modifying `scripts/sdlc-runner.mjs` **beyond** removing `postDiscord()` per FR8 — no other runner changes (refactors, log format changes, etc.)
- Generalizing or improving spec quality beyond the drift patterns — other specs may have unrelated issues, but those are not this issue's scope
- Deleting entire obsolete specs — even if a spec is fully about a removed feature, the spec file stays (git history preservation); only the *contents* are rewritten to describe the current implementation
- Updating the `CHANGELOG.md` or README — the spec cleanup itself does not need a changelog entry; however, the `postDiscord` removal (FR8) SHOULD be mentioned under `[Unreleased]` per project convention

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Drift patterns eliminated | 0 matches for each pattern in AC8 | Run the AC8 grep sweep |
| Specs touched | ~40 files | Count of files in the final commit diff |
| `postDiscord` call sites replaced | All (currently ~10 call sites in `sdlc-runner.mjs`) | `grep -c postDiscord scripts/sdlc-runner.mjs` returns 0 |
| Runner test suite | All pass | `cd scripts && npm test` |
| Regression risk | Low | Only the runner change has behavioral surface area; the change is a mechanical name swap preserving log output exactly |

---

## Open Questions

- [ ] For `bug-text-pattern-soft-failure-detection-sdlc-runner` (heavy Discord content): should the Discord-specific scenarios be deleted, or rewritten to apply to the current status-logging pattern? → **Resolved during PLAN**: per FR4, rewrite if the underlying pattern (text-based soft-failure detection) still applies; delete if the scenario was purely Discord-specific.
- [ ] For references to `feature-openclaw-runner-operations`: which existing spec should they redirect to? → **Resolved during PLAN**: most likely `feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code/` (the surviving runner-operations spec); confirm per file.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #114 | 2026-04-16 | Initial feature spec for documentation drift cleanup |
| #114 | 2026-04-16 | Expanded scope: also remove `postDiscord()` from `scripts/sdlc-runner.mjs` and inline call sites as direct `log('[STATUS] …')` calls — eliminates the legacy name at the code level (AC7 added, FRs renumbered, out-of-scope adjusted) |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements (cleanup strategy deferred to PLAN)
- [x] All criteria are testable and unambiguous (grep-based)
- [x] Success metrics are measurable
- [x] Edge cases specified (ambiguous Discord content, dangling references)
- [x] Out of scope is explicit
- [x] Open questions are documented
