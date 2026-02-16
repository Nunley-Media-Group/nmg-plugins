# Tasks: Detect Existing Steering Enhancement Flow

**Issue**: #26
**Date**: 2026-02-15
**Status**: Planning
**Author**: Claude

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 0 | N/A |
| Backend | 0 | N/A |
| Frontend | 0 | N/A |
| Integration | 2 | [ ] |
| Testing | 1 | [ ] |
| Release | 2 | [ ] |
| **Total** | **5** | |

> This feature modifies a single Markdown skill file. The traditional 5-phase breakdown is compressed because there is no database, backend, frontend, or setup work — only skill definition changes and BDD testing.

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

## Phase 4: Integration

### T001: Add detection step and enhancement flow to SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] A new "Step 0: Detect Existing Steering Files" is added before the current Step 1
- [ ] Step 0 instructs Claude to use `Glob` to check for `.claude/steering/product.md`, `.claude/steering/tech.md`, `.claude/steering/structure.md`
- [ ] When at least one file is found, the workflow branches to the Enhancement Flow
- [ ] When no files are found, the workflow continues to the existing Bootstrap Flow (Steps 1-4)
- [ ] Enhancement Flow contains 4 steps: Report Findings (E1), Ask What to Enhance (E2), Read/Modify/Write (E3), Confirm Changes (E4)
- [ ] Step E2 asks an open-ended question (no predefined menu)
- [ ] Step E3 instructs use of `Edit` tool to preserve existing content
- [ ] Step E4 summarizes what was modified and in which file(s)
- [ ] Existing Bootstrap Flow steps (1-4) are unchanged in substance

**Notes**: Follow the branching pattern used in `writing-specs/SKILL.md` for defect detection — a conditional check early in the workflow that routes to different instruction blocks.

### T002: Update skill metadata and documentation sections

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Frontmatter `description` changes from "Run once per project" to reflect both bootstrap and enhancement use
- [ ] Intro paragraph below the H1 heading reflects that the skill supports both initial setup and iterative enhancement
- [ ] "When to Use" section adds a bullet for enhancing existing steering documents
- [ ] "What Gets Created" section is renamed to "What Gets Created / Modified" and notes that enhancement modifies existing files
- [ ] "Integration with SDLC Workflow" section updates "one-time setup step" language to "setup and maintenance"
- [ ] No changes to `allowed-tools` in frontmatter
- [ ] No changes to template files

**Notes**: Keep the language concise. The skill description is read by Claude Code to decide when to suggest the skill.

---

## Phase 5: BDD Testing (Required)

### T003: Create BDD feature file

**File(s)**: `.claude/specs/26-detect-existing-steering-enhancement-flow/feature.gherkin`
**Type**: Create
**Depends**: T001, T002
**Acceptance**:
- [ ] All 5 acceptance criteria from requirements.md are represented as scenarios
- [ ] Uses Given/When/Then format
- [ ] Includes happy path (detection + enhancement), alternative path (bootstrap), and edge cases
- [ ] Feature file is valid Gherkin syntax
- [ ] Scenarios are independent and self-contained

---

## Phase 6: Release

### T004: Bump plugin version to 2.8.0

**File(s)**:
- `plugins/nmg-sdlc/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
**Type**: Modify
**Depends**: T001, T002
**Acceptance**:
- [ ] `plugins/nmg-sdlc/.claude-plugin/plugin.json` → `"version"` is `"2.8.0"`
- [ ] `.claude-plugin/marketplace.json` → plugin entry `"version"` in the `"plugins"` array is `"2.8.0"`
- [ ] `metadata.version` in `marketplace.json` is NOT changed (that's the collection version)

**Notes**: Per CLAUDE.md — both files must be updated together.

### T005: Update CHANGELOG.md

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T001, T002
**Acceptance**:
- [ ] New entries added under the existing `[Unreleased]` section
- [ ] Entry describes the enhancement flow added to `/setting-up-steering`
- [ ] Uses the project's existing changelog format (### Changed section)

**Notes**: Add under `[Unreleased]` — version heading is applied at release time.

---

## Dependency Graph

```
T001 ──▶ T002 ──┬──▶ T003
                ├──▶ T004
                └──▶ T005
```

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test task is included (T003)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
