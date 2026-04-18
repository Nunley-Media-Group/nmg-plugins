# Defect Report: Relocate specs and steering out of `.claude/` to restore SDLC pipeline under new Claude Code directory protection

**Issues**: #121
**Date**: 2026-04-18
**Status**: Draft
**Author**: Rich Nunley
**Severity**: Critical
**Related Spec**: `specs/feature-migrate-project-skill/`

---

## Reproduction

### Steps to Reproduce

1. Install `nmg-sdlc` 5.2.0 under a current Claude Code release that enforces `.claude/` directory write protection.
2. In a project with existing `steering/` and `specs/` directories, run any SDLC skill that writes to those paths — for example `/setup-steering` (enhancement flow), `/write-spec #N`, or `/verify-code #N` (when it needs to update `tasks.md`).
3. Observe the Write/Edit tool being refused because the target path is under the protected `.claude/` directory — even when Claude was launched with `--dangerously-skip-permissions`.
4. The skill cannot complete; unattended runs bail out; the pipeline halts.

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS, Windows, Linux (all affected) |
| **Version / Commit** | `nmg-sdlc` 5.2.0; any current Claude Code release enforcing `.claude/` protection |
| **Browser / Runtime** | Claude Code CLI, with or without `--dangerously-skip-permissions` |
| **Configuration** | Any project with prior nmg-sdlc state under `steering/` or `specs/` |

### Frequency

Always — the block is structural and applies to every SDLC skill that authors files under `.claude/`.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | SDLC skills author steering docs and spec artifacts at project-root paths that Claude Code is willing to write to. Runtime artifacts remain under `.claude/`. Legacy projects can be brought forward with a single command. |
| **Actual** | Writes to `steering/**` and `specs/**` are refused by Claude Code regardless of `--dangerously-skip-permissions`. The SDLC pipeline halts mid-run with a generic tool refusal and no instructive upgrade path. |

### Error Output

```
[Claude Code refuses Write/Edit on paths under the project .claude/ directory]
Tool use blocked: target path is inside protected project configuration directory.
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: New Layout Is Canonical

**Given** a user runs `/setup-steering` in a project with no prior nmg-sdlc state
**When** the bootstrap flow completes
**Then** steering docs exist at `steering/product.md`, `steering/tech.md`, and `steering/structure.md` at the project root, and an empty `specs/` directory exists at the project root
**And** nothing is written under `steering/` or `specs/`.

### AC2: Upgrade Migrates Legacy Layout In Place

**Given** a project that has existing `steering/` and `specs/` directories from an older plugin version
**When** the user runs `/upgrade-project`
**Then** the skill moves `steering/` → `steering/` and `specs/` → `specs/` via `git mv` (preserving history)
**And** every cross-reference in the moved files is rewritten to the new paths
**And** the now-empty `steering/` and `specs/` directories are removed
**And** `.claude/unattended-mode` and `.claude/sdlc-state.json` are left untouched.

### AC3: Hard Gate On Legacy Layout

**Given** a project that still has `steering/` or `specs/` present (legacy layout)
**When** the user runs `/start-issue` (or any other SDLC pipeline skill that reads those paths)
**Then** the skill detects the legacy layout, refuses to proceed, and prints an instructive message directing the user to run `/upgrade-project` — including the exact command
**And** the skill exits without creating a branch or modifying state.

### AC4: Skill Rename Is Complete

**Given** a user on the updated plugin
**When** they invoke `/upgrade-project`
**Then** the skill loads and executes the upgrade workflow
**And** invoking `/migrate-project` either no longer resolves or emits a deprecation pointer to `/upgrade-project`
**And** all documentation (README, CHANGELOG, every SKILL.md reference across the plugin, product/tech/structure steering docs in this repo) refers to `/upgrade-project` rather than `/migrate-project`.

### AC5: All Skills Reference New Paths

**Given** the updated plugin is installed
**When** any SDLC skill (`draft-issue`, `start-issue`, `write-spec`, `write-code`, `verify-code`, `open-pr`, `run-retro`, `upgrade-project`, `setup-steering`) reads or writes steering or spec files
**Then** every path referenced in the skill points to the new root-level `steering/` or `specs/` directories
**And** `grep -r "\.claude/specs\|\.claude/steering" plugins/nmg-sdlc/skills/` returns only references in upgrade logic that intentionally name the legacy location for detection purposes.

### AC6: Runtime Artifacts Unchanged (Except Rename)

**Given** the relocation and rename ship
**When** a user runs the SDLC runner or toggles unattended mode
**Then** `.claude/unattended-mode` and `.claude/sdlc-state.json` continue to live under `.claude/` unchanged
**And** `.claude/migration-exclusions.json` is renamed to `.claude/upgrade-exclusions.json`
**And** `/upgrade-project` reads and writes the new filename, and migrates any existing `migration-exclusions.json` to the new name on first run.

### AC7: No Regression In Core Pipeline

**Given** a freshly-upgraded project
**When** the user runs the full SDLC pipeline (`/draft-issue` → `/start-issue` → `/write-spec` → `/write-code` → `/verify-code` → `/open-pr`)
**Then** every step succeeds end-to-end on current Claude Code without any `--dangerously-skip-permissions` override
**And** produces the same artifacts it produced before under the old layout.

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Relocate canonical steering docs to `steering/` at the project root | Must |
| FR2 | Relocate canonical spec directories to `specs/` at the project root | Must |
| FR3 | Update `/setup-steering` bootstrap + enhancement flows to write to the new paths | Must |
| FR4 | Rename skill `migrate-project` → `upgrade-project` (directory, SKILL.md frontmatter name + description, every reference in plugin skills, plugin manifest) | Must |
| FR5 | `/upgrade-project` must detect the legacy `steering/` and `specs/` layout and migrate it via `git mv`, preserving git history and updating cross-references in moved files | Must |
| FR6 | `/start-issue` must hard-gate on the legacy layout and instruct the user to run `/upgrade-project` before proceeding | Must |
| FR7 | All other pipeline skills that read steering or specs must either hard-gate with the same message or document that `/start-issue` is the canonical gate | Must |
| FR8 | Runtime artifacts under `.claude/` (`unattended-mode`, `sdlc-state.json`) remain in place; `migration-exclusions.json` is renamed to `upgrade-exclusions.json` with automatic migration on first `/upgrade-project` run | Must |
| FR9 | Update README, CHANGELOG (`[Unreleased]`), and in-repo steering docs to reflect the new layout and the `upgrade-project` name | Must |
| FR10 | Bump plugin version in both `plugins/nmg-sdlc/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (MAJOR — breaking directory convention change) | Must |
| FR11 | Exercise the upgrade on this very repo (it currently uses `specs/` and `steering/`) as part of verification | Should |
| FR12 | Emit a deprecation stub for `/migrate-project` pointing to `/upgrade-project` for one release | Could |

---

## Out of Scope

- Moving runtime artifacts (`unattended-mode`, `sdlc-state.json`, `upgrade-exclusions.json`) out of `.claude/` — they stay because they are not authored by Edit/Write and are not affected by the protection.
- A dual-read compatibility window (the gate is hard; legacy projects must run `/upgrade-project` before continuing).
- Changes to `/run-loop` or the SDLC runner beyond any path references it may carry.
- Renaming or restructuring any other skill besides `migrate-project` → `upgrade-project`.
- Supporting non-git projects (the upgrade uses `git mv`; non-git projects are a follow-up).

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #121 | 2026-04-18 | Initial defect spec for relocating steering/specs out of `.claude/` and renaming `migrate-project` → `upgrade-project` |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed (Critical — pipeline blocked)
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC7)
- [x] Fix scope is minimal — feature work excluded (see Out of Scope)
- [x] Out of scope is defined
