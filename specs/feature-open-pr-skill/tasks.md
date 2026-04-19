# Tasks: Creating PRs Skill

**Issues**: #8, #128
**Date**: 2026-04-18
**Status**: In Progress
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 1 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| Phase 5: Enhancement — Issue #128 | 4 | [x] |
| **Total** | **8** | |

---

## Task Format

Each task follows this structure:

```
### T[NNN]: [Task Title]

**File(s)**: `{layer}/path/to/file`
**Type**: Create | Modify | Delete
**Depends**: T[NNN], T[NNN] (or None)
**Acceptance**:
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]

**Notes**: [Optional implementation hints]
```

Map `{layer}/` placeholders to actual project paths using `structure.md`.

---

## Phase 1: Setup

### T001: Create Skill Directory

**File(s)**: `plugins/nmg-sdlc/skills/open-pr/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter with disable-model-invocation: true
- [x] Documents 4-step workflow (read context, generate content, push/create, output)
- [x] PR body template with summary, ACs, test plan, spec links, Closes #N
- [x] Conventional commit prefix for PR titles
- [x] Automation mode completion signal documented

---

## Phase 3: Integration

### T003: Configure Allowed Tools

**File(s)**: `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*)
- [x] No Write/Edit needed (read-only + gh commands)

---

## Phase 4: Testing

### T004: Create BDD Feature File

**File(s)**: `specs/feature-open-pr-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 4 acceptance criteria have corresponding scenarios

---

## Phase 5: Enhancement — Issue #128 (Interactive CI Monitor + Auto-Merge)

### T005: Add Step 7 — Interactive CI Monitor Prompt (Opt-In / Opt-Out)

**File(s)**: `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] New Step 7 section documents the `AskUserQuestion` prompt with two options: "Yes, monitor CI and auto-merge" and "No, I'll handle it"
- [x] Step 7 is explicitly gated by `.claude/unattended-mode` absence — the entire block is skipped when the sentinel is present (no prompt, no polling, no merge invocation) per AC8 and AC9
- [x] Opt-out path ends with the existing Step 6 "Next step: Wait for CI to pass..." output unchanged (AC6)
- [x] Opt-in path transitions to T006 polling logic
- [x] Section cross-references `steering/retrospective.md` for the active-suppression pattern

**Notes**: The existing Step 6 output block already branches on the sentinel — restructure so the opt-out branch reuses that exact text. Do NOT duplicate the "Next step" message.

### T006: Document CI Polling Loop and Merge Success Path

**File(s)**: `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
**Type**: Modify
**Depends**: T005
**Status**: Complete
**Acceptance**:
- [x] Polling loop specifies `gh pr checks <num> --json name,state,link` with 30-second cadence and 30-minute total timeout (constants documented inline)
- [x] Success path invokes `gh pr merge <num> --squash --delete-branch`, then `git checkout main && git branch -D <branch>`
- [x] On all checks passing and successful merge, the skill prints a clean-state completion line (e.g., "Merged and cleaned up — you are back on main")
- [x] Polling cadence matches `scripts/sdlc-runner.mjs` (line 937) — skill instructions cite this for future-proofing
- [x] Handles pre-merge mergeability check via `gh pr view <num> --json mergeable,mergeStateStatus`; non-`CLEAN` states route to T007 failure path

**Notes**: Reference the terminal-state mapping table in `design.md` → "Terminal-State Mapping" so the skill instructions stay aligned with the design.

### T007: Document CI Failure and No-CI Graceful-Skip Paths

**File(s)**: `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
**Type**: Modify
**Depends**: T005
**Status**: Complete
**Acceptance**:
- [x] Failure path (FAILURE, CANCELLED, TIMED_OUT, non-mergeable) prints each failing check's name and details URL (from `--json link`), does NOT invoke `gh pr merge`, and does NOT run `git branch -D` (AC7)
- [x] "no checks reported" path prints "No CI configured — skipping auto-merge" and exits without merging (AC7 + retrospective learning on absent integrations)
- [x] Polling timeout exceeded is treated as a failure with a clear message (not a silent merge)
- [x] Failure output leaves the user on the feature branch so they can investigate

**Notes**: No branch deletion on failure — the user needs the branch intact to push follow-up fixes.

### T008: Add Gherkin Scenarios for AC5–AC9

**File(s)**: `specs/feature-open-pr-skill/feature.gherkin`
**Type**: Modify
**Depends**: T005, T006, T007
**Status**: Complete
**Acceptance**:
- [x] Scenario: User opts in — happy path (AC5)
- [x] Scenario: User opts out — exits with existing Next step output (AC6)
- [x] Scenario: CI fails during monitoring — reports and stops (AC7)
- [x] Scenario: No CI configured — graceful skip (AC7 + retrospective)
- [x] Scenario: Unattended mode suppresses new prompt (AC8)
- [x] Scenario: Unattended mode actively suppresses polling and merge invocations (AC9)
- [x] New scenarios tagged `# Added by issue #128`

---

## Dependency Graph

```
Phase 1–4 (existing):
T001 ──▶ T002 ──▶ T003 ──▶ T004

Phase 5 (Issue #128):
T002 ──▶ T005 ──┬──▶ T006 ──┐
                 └──▶ T007 ──┼──▶ T008
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #8 | 2026-02-15 | Initial feature spec |
| #128 | 2026-04-18 | Add Phase 5 enhancement — Interactive CI monitor + auto-merge (T005–T008) |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
- [x] BDD testing task included (T008)
- [x] No circular dependencies
