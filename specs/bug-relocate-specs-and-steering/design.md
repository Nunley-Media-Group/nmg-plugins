# Root Cause Analysis: Relocate specs and steering out of `.claude/` to restore SDLC pipeline

**Issues**: #121
**Date**: 2026-04-18
**Status**: Draft
**Author**: Rich Nunley

---

## Root Cause

Recent releases of Claude Code treat the project-level `.claude/` directory as protected configuration space. The Write/Edit tools silently refuse any path under `.claude/` — even when the session is started with `--dangerously-skip-permissions`. This is a deliberate safety boundary in the runtime: project-level hooks, subagent definitions, and permission settings live in `.claude/`, and the runtime prevents tools from mutating them.

The `nmg-sdlc` plugin was built before this boundary existed. It authored two kinds of artifacts under `.claude/`: (1) **user-authored SDLC artifacts** (steering docs in `steering/`, spec directories in `specs/`) which are meant to be edited by Edit/Write during skill execution, and (2) **runtime state artifacts** (`.claude/unattended-mode` flag, `.claude/sdlc-state.json`, `.claude/migration-exclusions.json`) which are only read/written by the SDLC runner (a Node.js subprocess) and not by Claude's Edit/Write tools. Only the first class is blocked by the new protection — the second class continues to work because it never passes through Claude's tool layer.

The fix is therefore a directory relocation, not a behavioral change: move the user-authored artifacts out from under `.claude/` to the project root (`steering/`, `specs/`) where Edit/Write can reach them, and leave the runtime artifacts where they are. Because this is a breaking directory convention change, existing projects need a single-command upgrade path — and the existing `/migrate-project` skill is the natural vehicle, but its name no longer reflects its primary job (bringing a project forward to match current plugin standards), so it is renamed to `/upgrade-project` as part of this fix.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/setup-steering/SKILL.md` | ~10 refs | Writes `steering/*.md` and creates `specs/` during bootstrap and enhancement flows |
| `plugins/nmg-sdlc/skills/write-spec/SKILL.md` | ~20 refs | Writes `specs/{feature-|bug-}{slug}/{requirements,design,tasks}.md` and `feature.gherkin` |
| `plugins/nmg-sdlc/skills/write-code/SKILL.md` | ~7 refs | Reads specs from `specs/` and steering from `steering/` |
| `plugins/nmg-sdlc/skills/verify-code/SKILL.md` | ~4 refs | Reads/updates specs under `specs/` and steering |
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` | ~20 refs | Reads/writes steering, specs, and `.claude/migration-exclusions.json` (also the target of the rename to `upgrade-project`) |
| `plugins/nmg-sdlc/skills/draft-issue/SKILL.md` | ~5 refs | Reads steering docs for issue drafting |
| `plugins/nmg-sdlc/skills/open-pr/SKILL.md` | ~12 refs | Reads specs for PR body generation |
| `plugins/nmg-sdlc/skills/run-retro/SKILL.md` | ~15 refs | Reads specs to derive retrospective learnings |
| `plugins/nmg-sdlc/skills/start-issue/SKILL.md` | — | Filters runtime artifacts under `.claude/`; must add legacy-layout gate |
| `plugins/nmg-sdlc/skills/{write-spec,run-retro,verify-code}/templates/*.md` + `skills/setup-steering/templates/*.md` | ~10 refs | Embedded path references in templates |
| `plugins/nmg-sdlc/agents/spec-implementer.md` | 2 refs | Reads specs for implementation |
| `plugins/nmg-sdlc/.claude-plugin/plugin.json` | `version` | Bump to 6.1.0 (minor) |
| `.claude-plugin/marketplace.json` | plugin `version` | Bump to 6.1.0 (minor) |
| `README.md` | 3 refs | Public docs reference old paths and `/migrate-project` |
| `CHANGELOG.md` | `[Unreleased]` | Add entry |
| `scripts/sdlc-runner.mjs`, `scripts/__tests__/sdlc-runner.test.mjs` | — | Audit for any `.claude/specs` or `.claude/steering` path refs and for `migration-exclusions.json` references |

### Triggering Conditions

- Claude Code's `.claude/` write-protection is active (current releases).
- The skill under execution calls `Write` or `Edit` against a path whose first segment is `.claude/` inside the project directory.
- The protection is enforced before user permission mode is consulted, so `--dangerously-skip-permissions` does not override it.
- Why this wasn't caught before: the nmg-sdlc design predates the protection; `/migrate-project` previously handled legacy-to-new moves for different reasons (spec directory naming convention) and was not set up to relocate files out of `.claude/`.

---

## Fix Strategy

### Approach

Perform a mechanical two-part relocation + rename, then add a single hard gate.

**Part A — Relocation.** Move the canonical locations of user-authored artifacts from `steering/` → `steering/` and `specs/` → `specs/`. Update every skill, template, and doc reference to point at the new paths. The set of references is finite (~111 occurrences across 17 files under `plugins/nmg-sdlc/`, 3 in README.md, plus templates and agents); this is a grep-and-replace exercise, not a behavior change.

**Part B — Rename `migrate-project` → `upgrade-project`.** Rename the skill directory, update its SKILL.md frontmatter, and update every cross-reference. Rename the exclusions file `.claude/migration-exclusions.json` → `.claude/upgrade-exclusions.json` and teach the renamed skill to auto-migrate the old file on first run. Extend the existing legacy-layout detection in the renamed skill to also detect the `.claude/{steering,specs}` layout and `git mv` those directories.

**Part C — Hard gate.** Add detection at the top of `/start-issue` (the first interactive SDLC step) that refuses to proceed when `steering/` or `specs/` exists with content, printing an instructive message containing the exact `/upgrade-project` invocation. Other downstream skills rely on this gate rather than each duplicating it; downstream skills add a one-line reference-check in their prerequisites.

**Part D — Version bump.** Bump both `plugin.json` and `marketplace.json` to 6.1.0 (MINOR) — the breaking directory-convention change is mitigated by the automated `/upgrade-project` migration, so per the bug-label classification this ships as a minor bump.

**Part E — Self-upgrade of this repo.** This very repo's `steering/` and `specs/` directories are subject to the same protection. The upgrade flow is exercised on this repo as part of verification — after the code changes land, running `/upgrade-project` here relocates our own artifacts.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/*/SKILL.md` | Replace `specs/` → `specs/` and `steering/` → `steering/` in all 17 affected skill + template + agent files | Restores Edit/Write access; paths resolve to project-root locations |
| `plugins/nmg-sdlc/skills/*/templates/*.md` | Same replacement | Templates are copy-pasted into generated specs — keep them pointing at the new locations |
| `plugins/nmg-sdlc/skills/migrate-project/` → `plugins/nmg-sdlc/skills/upgrade-project/` | `git mv` directory; update SKILL.md frontmatter `name`/description; add new detection + relocation branch | Skill name matches its primary purpose (upgrade to current plugin contract) |
| `plugins/nmg-sdlc/skills/upgrade-project/SKILL.md` | Add a workflow branch that detects legacy `steering/` and `specs/` layout and migrates via `git mv`, rewriting any intra-file cross-references to the old path | Provides the AC2 upgrade path |
| `plugins/nmg-sdlc/skills/upgrade-project/references/migration-procedures.md` → `upgrade-procedures.md` (rename) | `git mv` + update references | Naming consistency with skill rename |
| `plugins/nmg-sdlc/skills/upgrade-project/SKILL.md` | Reads/writes `.claude/upgrade-exclusions.json`; auto-migrates existing `migration-exclusions.json` on first run | AC6 rename with graceful migration |
| `plugins/nmg-sdlc/skills/start-issue/SKILL.md` | Add legacy-layout detection at Step 0; exit with instructive message when detected | AC3 hard gate |
| `plugins/nmg-sdlc/skills/{write-spec,write-code,verify-code,open-pr,run-retro,draft-issue}/SKILL.md` | Add short precondition check: "If `steering/` or `specs/` exists, exit with the same `/upgrade-project` pointer" OR document that `/start-issue` is the canonical gate | AC3 + AC5 coverage beyond start-issue |
| `plugins/nmg-sdlc/.claude-plugin/plugin.json` | `"version": "6.1.0"` | MINOR — automated upgrade handles directory-convention change |
| `.claude-plugin/marketplace.json` | plugin entry `"version": "6.1.0"` | Marketplace index must match |
| `README.md` | Rewrite 3 path refs and every `/migrate-project` reference | Public docs must match behavior |
| `CHANGELOG.md` | Add `## [Unreleased]` entries | Conventional changelog |
| `steering/{product,tech,structure}.md` (this repo) | Update any path references | Steering docs in this repo also reference `specs/` / `steering/` conventions |
| `scripts/sdlc-runner.mjs`, `scripts/__tests__/sdlc-runner.test.mjs` | Audit + update any path or filename refs | Keep runner consistent with new layout |

### Blast Radius

- **Direct impact**: All 11 SDLC skills, their templates, the one subagent, both plugin manifests, README, CHANGELOG, in-repo steering docs, and the runner scripts. Every line that names `.claude/specs`, `.claude/steering`, `migrate-project`, or `migration-exclusions.json` is touched.
- **Indirect impact**: Every downstream user project that has created steering or specs under the old paths must run `/upgrade-project` once before continuing. This is the intended, breaking behavior.
- **Runtime state**: Zero — `.claude/unattended-mode` and `.claude/sdlc-state.json` paths are not changed. The runner reads/writes these directly in Node.js, not through Claude's Edit/Write, so they are unaffected by the directory protection.
- **Risk level**: **Medium.** The changes are mechanical but broad. The primary risks are (a) missing a reference during the sweep and (b) introducing inconsistency between skills and templates. Both are mitigated by the AC5 grep check.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A skill still references `specs/` or `steering/` after the sweep and silently fails on a fresh project | Medium | AC5 grep check in verification; exercise the full pipeline on a scratch project (AC7) |
| Legacy-layout gate in `/start-issue` is missed by other entry-points (user invokes `/write-spec` directly without going through `/start-issue`) | Medium | Add precondition checks to every pipeline skill, not just `/start-issue` (FR7) |
| `upgrade-project` migration fails midway (e.g., `specs/` partially moved) leaving the project in a worse state than before | Low | Use `git mv` — atomic and reversible via `git checkout`. Document rollback in the skill. |
| Cross-references inside moved spec files (e.g., `**Related Spec**: specs/feature-foo/`) become broken paths after the move | High (if unfixed) | Upgrade workflow rewrites every `specs/` and `steering/` string inside moved files during the `git mv` step |
| Users who invoke `/migrate-project` (deprecated name) see a generic "skill not found" error and can't discover the new name | Medium | FR12 deprecation stub — a thin `/migrate-project` shim that prints "renamed to /upgrade-project" and invokes it |
| `migration-exclusions.json` → `upgrade-exclusions.json` rename loses user's declined-section data | Low | Auto-migrate on first `/upgrade-project` run (AC6) |
| This repo's own specs get orphaned during upgrade (we're dogfooding on the repo that is writing the upgrade) | Low | Exercise the upgrade in a disposable test project first, only run on this repo as the final verification step (FR11) |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| **A: Make `specs/` and `steering/` symlinks to project-root directories** | Keep the published paths unchanged; resolve to new locations via symlink | Windows requires elevated privileges for symlinks; violates cross-platform contracts in `structure.md` |
| **B: Dual-read compatibility — try new path, fall back to old path** | Skills read both locations; new writes go to the new location | Doubles the path logic in every skill; encourages users to stay on the old layout indefinitely; undermines the fix |
| **C: Move runtime artifacts out of `.claude/` too** | Relocate `unattended-mode`, `sdlc-state.json`, `upgrade-exclusions.json` to project root for consistency | These aren't blocked by the protection (they're not authored by Edit/Write); moving them adds churn without fixing any bug; out of scope per the issue |
| **D: Keep the `migrate-project` name** | Relocate without renaming the skill | Misses an opportunity to fix a name that never described the skill's job; rename cost is low (14 files touched) while clarity gain is meaningful |
| **E (selected): Relocate + rename with hard gate** | This design | Minimal, targeted fix that removes the blocking behavior, renames for clarity, and forces legacy projects through a deterministic upgrade path |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references (17 affected files under `plugins/nmg-sdlc/`, plus README, CHANGELOG, steering, runner)
- [x] Fix is minimal — no unrelated refactoring (scope bounded to directory relocation + skill rename + gate)
- [x] Blast radius is assessed (direct, indirect, and runtime-state impacts enumerated)
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns — uses `git mv` per `tech.md` portability constraints, and keeps skills stack-agnostic per `structure.md`
