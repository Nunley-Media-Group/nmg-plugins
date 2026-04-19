# Tasks: /end-loop Skill

**Issues**: #122
**Date**: 2026-04-18
**Status**: Planning
**Author**: Claude Code

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [ ] |
| Backend | 0 | — (no runtime code) |
| Frontend | 0 | — (no UI) |
| Integration | 3 | [ ] |
| Testing | 3 | [ ] |
| **Total** | 7 | |

This feature has no backend services or frontend components — it is a prompt-based skill. "Integration" covers writing the skill file and registering the skill with the plugin. "Setup" covers the directory scaffolding. "Testing" covers Gherkin scenarios, exercise tests, and verification that the skill cooperates with `sdlc-runner.mjs`.

---

## Phase 1: Setup

### T001: Scaffold skill directory

**File(s)**: `plugins/nmg-sdlc/skills/end-loop/`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] Directory `plugins/nmg-sdlc/skills/end-loop/` exists
- [ ] Empty `SKILL.md` placeholder is created (content added in T002)

**Notes**: Follow the `run-loop` skill's directory layout. No `templates/` subdirectory is needed for this skill.

---

## Phase 2: Backend Implementation

*Not applicable — the skill is a Markdown prompt, not a runtime component.*

---

## Phase 3: Frontend Implementation

*Not applicable — CLI skill with no UI.*

---

## Phase 4: Integration

### T002: Write `SKILL.md` prompt

**File(s)**: `plugins/nmg-sdlc/skills/end-loop/SKILL.md`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Frontmatter matches design spec (name, description, argument-hint, disable-model-invocation, allowed-tools per `design.md` §API)
- [ ] Allowed tools include `Read`, `Glob`, `Bash(test:*)`, `Bash(node:*)`, `Bash(rm:*)`, `Bash(ls:*)` — no more
- [ ] Step-by-step instructions cover the full workflow from `design.md` §Data Flow: directory check, artifact check, state parse, PID validation (must be positive integer), liveness probe via `node -e "process.kill(<pid>, 0)"`, SIGTERM via `node -e "process.kill(<pid>, 'SIGTERM')"`, file deletion, summary output
- [ ] Each AC in `requirements.md` maps to an explicit instruction path in the skill (no orphaned ACs)
- [ ] Cross-platform constraints respected — all file paths use forward slashes; no Bash-only syntax (`[[ ]]`, `<<<`, associative arrays)
- [ ] Skill references `scripts/sdlc-runner.mjs:552` (`RUNNER_ARTIFACTS`) and `scripts/sdlc-runner.mjs:600` (`removeUnattendedMode`) so future changes to those locations prompt a skill review
- [ ] Unattended-mode behaviour: the skill always runs non-interactively — no `AskUserQuestion` calls, no gates
- [ ] Includes an "Integration with SDLC Workflow" section per project convention
- [ ] Output format for each exit path matches the contract in `design.md` §API Output Contract

**Notes**: The skill is prompt text, not code. Validation is a close read of the prompt quality criteria in `steering/tech.md` §Prompt Quality Verification.

### T003: Register skill in plugin manifest (if required)

**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`
**Type**: Verify / Modify
**Depends**: T002
**Acceptance**:
- [ ] Verify whether `plugin.json` enumerates skills explicitly; if it does, add `end-loop` to the list
- [ ] If skills are auto-discovered from the `skills/` directory (current convention — confirm by inspecting `plugin.json` and comparing against existing skills like `run-loop`), no change is required; document the "no change needed" finding in the task notes
- [ ] No unrelated fields are modified

**Notes**: Based on the current `plugin.json`, skills are directory-scanned — this task may be a no-op. Check before modifying.

### T004: Update `README.md` skills reference

**File(s)**: `README.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] `/end-loop` is listed alongside `/run-loop` in the skills reference section
- [ ] Description matches the skill frontmatter's description field
- [ ] A short usage example is present (e.g., "Run `/end-loop` to stop an active SDLC loop and clean up runner artifacts")
- [ ] `CHANGELOG.md` `[Unreleased]` section gains an entry: `### Added — /end-loop skill to cleanly disable unattended mode (#122)`

**Notes**: Per `CLAUDE.md`, any change that affects how users interact with the plugin must update README.md.

---

## Phase 5: BDD Testing (Required)

### T005: Create Gherkin feature file

**File(s)**: `specs/feature-add-end-loop-skill-to-cleanly-disable-unattended-mode/feature.gherkin`
**Type**: Create
**Depends**: T002
**Acceptance**:
- [ ] All 8 ACs from `requirements.md` are Gherkin scenarios
- [ ] Uses Given/When/Then format
- [ ] Happy path (AC1), already-disabled (AC2, AC7), error handling (AC5, AC8), edge cases (AC3, AC4, AC6) are all covered
- [ ] Feature file is valid Gherkin syntax

**Notes**: Already created as part of this spec phase. T005 is primarily a verification task — confirm the file exists and is in sync with `requirements.md`.

### T006: Exercise-test the skill against a disposable test project

**File(s)**: N/A — exercise test run, no files written
**Type**: Verify
**Depends**: T002, T005
**Acceptance**:
- [ ] Scaffold a disposable test project in `/tmp/` per `steering/tech.md` §Test Project Pattern
- [ ] Load the modified plugin: `claude --plugin-dir ./plugins/nmg-sdlc --project-dir /tmp/<test-project>`
- [ ] Exercise each AC:
  - AC1: create both artifacts, spawn a live benign background process, point `runnerPid` at it, run `/end-loop`, assert files removed and process signalled (confirm via `ps`)
  - AC2: no artifacts present, run `/end-loop`, assert "already disabled" output
  - AC3: create `sdlc-state.json` with a `runnerPid` of a known-dead PID (e.g., `99999`), run `/end-loop`, assert no SIGTERM error and files removed
  - AC4: remove `.claude/` entirely, run `/end-loop`, assert "not a runner project" output
  - AC5: simulate SIGTERM failure (document the approach — may require root-owned process or OS-specific trick; if infeasible in the test environment, mark as manually verified and document)
  - AC6: write invalid JSON to `sdlc-state.json`, run `/end-loop`, assert file still removed and no parse error raised
  - AC7: run `/end-loop` twice in sequence, assert second run reports "already disabled"
  - AC8: `chmod 000` on the `.claude/` directory (or equivalent), run `/end-loop`, assert non-zero exit and specific-file error message; restore permissions afterwards
- [ ] Clean up the test project after verification

**Notes**: Per `steering/tech.md`, exercise-based verification is the primary validation method for this project. Unit tests do not apply — the skill is a prompt.

### T007: Verify no regressions in `/run-loop` or `sdlc-runner.mjs`

**File(s)**: N/A — verification only
**Type**: Verify
**Depends**: T002
**Acceptance**:
- [ ] `sdlc-runner.mjs` `removeUnattendedMode()` still functions unchanged (the skill is a parallel cleanup path, not a replacement)
- [ ] `/run-loop` still creates and removes `.claude/unattended-mode` via the runner — no interaction between the two skills
- [ ] Runner unit tests in `scripts/__tests__/` pass: `cd scripts && npm test`
- [ ] `RUNNER_ARTIFACTS` array in `sdlc-runner.mjs:552` is unchanged (the skill reads it as a reference, does not modify it)

**Notes**: Because the skill operates on the same artifacts as the runner, a non-regression check is needed to confirm the runner's own lifecycle is untouched.

---

## Dependency Graph

```
T001 ──▶ T002 ──┬──▶ T003
                ├──▶ T004
                ├──▶ T005 ──▶ T006
                └──▶ T007
```

T002 is the critical path. T005 can run in parallel with T003/T004 once T002 is complete. T006 depends on both T002 and T005 (requires the skill + the Gherkin scenarios to cross-check against).

**Critical path**: T001 → T002 → T005 → T006

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #122 | 2026-04-18 | Initial feature spec |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T005, T006, T007)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
