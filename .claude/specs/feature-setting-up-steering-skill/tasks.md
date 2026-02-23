# Tasks: Setting Up Steering Skill

**Issues**: #3, #26
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 1 | [x] |
| Templates/Content | 3 | [x] |
| Integration | 3 | [x] |
| Testing | 2 | [x] |
| Release | 2 | [x] |
| **Total** | **12** | |

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

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists at `plugins/nmg-sdlc/skills/setting-up-steering/`
- [x] `templates/` subdirectory exists for template files

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter with name, description, allowed-tools
- [x] Documents 4-step workflow (scan, generate, write, prompt)
- [x] Lists all file types scanned during codebase analysis
- [x] Includes customization guidance table

---

## Phase 3: Templates/Content

### T003: Create Product Steering Template

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/templates/product.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Template covers product vision, target users, capabilities
- [x] Includes placeholders for user journeys and feature prioritization

### T004: Create Tech Steering Template

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/templates/tech.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Template covers tech stack, frameworks, testing, coding standards
- [x] Includes BDD testing section
- [x] Includes environment variables section

### T005: Create Structure Steering Template

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/templates/structure.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Template covers directory layout, layer architecture, naming conventions
- [x] Includes anti-patterns section

---

## Phase 4: Integration

### T006: Register Skill in Plugin

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Skill is discoverable by Claude Code's plugin system
- [x] Allowed tools are correctly scoped (Read, Glob, Grep, Task, Write, Edit, Bash)

### T007: Add detection step and enhancement flow to SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`
**Type**: Modify
**Depends**: T006
**Status**: Complete
**Acceptance**:
- [x] A new "Step 0: Detect Existing Steering Files" is added before the current Step 1
- [x] Step 0 instructs Claude to use `Glob` to check for `.claude/steering/product.md`, `.claude/steering/tech.md`, `.claude/steering/structure.md`
- [x] When at least one file is found, the workflow branches to the Enhancement Flow
- [x] When no files are found, the workflow continues to the existing Bootstrap Flow (Steps 1-4)
- [x] Enhancement Flow contains 4 steps: Report Findings (E1), Ask What to Enhance (E2), Read/Modify/Write (E3), Confirm Changes (E4)
- [x] Step E2 asks an open-ended question (no predefined menu)
- [x] Step E3 instructs use of `Edit` tool to preserve existing content
- [x] Step E4 summarizes what was modified and in which file(s)
- [x] Existing Bootstrap Flow steps (1-4) are unchanged in substance

**Notes**: Follow the branching pattern used in `writing-specs/SKILL.md` for defect detection — a conditional check early in the workflow that routes to different instruction blocks.

### T008: Update skill metadata and documentation sections

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`
**Type**: Modify
**Depends**: T007
**Status**: Complete
**Acceptance**:
- [x] Frontmatter `description` changes from "Run once per project" to reflect both bootstrap and enhancement use
- [x] Intro paragraph below the H1 heading reflects that the skill supports both initial setup and iterative enhancement
- [x] "When to Use" section adds a bullet for enhancing existing steering documents
- [x] "What Gets Created" section is renamed to "What Gets Created / Modified" and notes that enhancement modifies existing files
- [x] "Integration with SDLC Workflow" section updates "one-time setup step" language to "setup and maintenance"
- [x] No changes to `allowed-tools` in frontmatter
- [x] No changes to template files

**Notes**: Keep the language concise. The skill description is read by Claude Code to decide when to suggest the skill.

---

## Phase 5: Testing

### T009: Create BDD Feature File (Issue #3)

**File(s)**: `.claude/specs/feature-setting-up-steering-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 4 acceptance criteria from issue #3 have corresponding scenarios
- [x] Valid Gherkin syntax

### T010: Create BDD Feature File (Issue #26)

**File(s)**: `.claude/specs/feature-setting-up-steering-skill/feature.gherkin`
**Type**: Modify
**Depends**: T007, T008, T009
**Status**: Complete
**Acceptance**:
- [x] All 5 acceptance criteria from issue #26 are represented as scenarios
- [x] Uses Given/When/Then format
- [x] Includes happy path (detection + enhancement), alternative path (bootstrap), and edge cases
- [x] Feature file is valid Gherkin syntax
- [x] Scenarios are independent and self-contained

---

## Phase 6: Release

### T011: Bump plugin version

**File(s)**:
- `plugins/nmg-sdlc/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
**Type**: Modify
**Depends**: T007, T008
**Status**: Complete
**Acceptance**:
- [x] `plugins/nmg-sdlc/.claude-plugin/plugin.json` → `"version"` updated
- [x] `.claude-plugin/marketplace.json` → plugin entry `"version"` in the `"plugins"` array updated
- [x] `metadata.version` in `marketplace.json` is NOT changed (that's the collection version)

**Notes**: Per CLAUDE.md — both files must be updated together.

### T012: Update CHANGELOG.md

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T007, T008
**Status**: Complete
**Acceptance**:
- [x] New entries added under the existing `[Unreleased]` section (or versioned heading)
- [x] Entries describe both the initial skill (#3) and the enhancement flow (#26)
- [x] Uses the project's existing changelog format

**Notes**: Add under `[Unreleased]` — version heading is applied at release time.

---

## Dependency Graph

```
T001 ──┬──▶ T002 ──┬──▶ T003
       │           ├──▶ T004
       │           ├──▶ T005
       │           └──▶ T006 ──▶ T007 ──▶ T008 ──┬──▶ T009 ──▶ T010
       │                                           ├──▶ T011
       │                                           └──▶ T012
```

---

## Change History

| Date | Issue | Description |
|------|-------|-------------|
| 2026-02-15 | #3 | Initial tasks: T001–T007 for bootstrap skill creation |
| 2026-02-15 | #26 | Appended tasks: T007–T012 for enhancement flow and release |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
- [x] No circular dependencies
- [x] Test task is included (T009, T010)
- [x] Tasks are in logical execution order
