# Tasks: Starting Issues Skill

**Issues**: #10, #89
**Date**: 2026-02-25
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 1 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| Enhancement — Issue #89 | 2 | [x] |
| **Total** | **6** | |

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

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter with name, description, argument-hint, allowed-tools
- [x] Documents 4-step workflow (identify, select, confirm, branch/status)
- [x] Milestone-scoped issue listing with fallback
- [x] Automation mode behavior documented
- [x] GraphQL API usage for project status updates documented
- [x] Output summary format documented

---

## Phase 3: Integration

### T003: Configure Allowed Tools

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*)

---

## Phase 4: Testing

### T004: Create BDD Feature File

**File(s)**: `.claude/specs/10-starting-issues-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 5 acceptance criteria have corresponding scenarios

---

## Phase 5: Enhancement — Issue #89

### T005: Add Diagnostic Query and Output to Auto-Mode Empty Result Handling

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] The "Auto-Mode: Empty Result Handling" section in Step 1 is updated to include a diagnostic query
- [x] When zero automatable issues are found, the skill instructs a second `gh issue list` call without `--label automatable` (preserving same milestone scope) to get total open issue count
- [x] When total open > 0: output includes count and a suggestion to check label assignment (AC6, AC7)
- [x] When total open = 0: output indicates no open issues without suggesting label checks (AC8)
- [x] The diagnostic query uses `--json number --jq 'length'` to count efficiently
- [x] Output still ends with `Done. Awaiting orchestrator.` for runner compatibility

**Notes**: Modify only the "Auto-Mode: Empty Result Handling" sub-section. The diagnostic flow has two branches based on total open count. Ensure scope matching — if the original query was milestone-scoped, the diagnostic query must use the same milestone filter.

### T006: Add BDD Scenarios for Diagnostic Output

**File(s)**: `.claude/specs/feature-starting-issues-skill/feature.gherkin`
**Type**: Modify
**Depends**: T005
**Status**: Complete
**Acceptance**:
- [x] Scenario for AC6: diagnostic context included in zero-result output
- [x] Scenario for AC7: label suggestion when open issues exist without label
- [x] Scenario for AC8: no misleading suggestion when genuinely no open issues
- [x] All scenarios are valid Gherkin syntax

---

## Dependency Graph

```
T001 ──▶ T002 ──▶ T003 ──▶ T004
                  │
                  └──▶ T005 ──▶ T006
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #10 | 2026-02-15 | Initial feature spec |
| #89 | 2026-02-25 | Add diagnostic tasks for zero automatable issues (T005–T006) |

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
