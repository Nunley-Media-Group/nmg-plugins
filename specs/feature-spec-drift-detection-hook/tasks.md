# Tasks: Spec Drift Detection Hook

**Issues**: #9
**Date**: 2026-02-15
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
| **Total** | **4** | |

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

### T001: Create Hooks Directory

**File(s)**: `plugins/nmg-sdlc/hooks/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists at `plugins/nmg-sdlc/hooks/`

---

## Phase 2: Plugin Files

### T002: Create Hook Configuration

**File(s)**: `plugins/nmg-sdlc/hooks/hooks.json`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Valid JSON with PostToolUse hook definition
- [x] Matcher set to `Write|Edit`
- [x] Command-type gate: `ls specs/*/requirements.md >/dev/null 2>&1`
- [x] Agent-type hook with spec reading and alignment check
- [x] Agent timeout set to 60 seconds
- [x] Agent returns JSON `{ok: true/false, reason: "..."}`

---

## Phase 3: Integration

### T003: Verify Hook Loading

**File(s)**: `plugins/nmg-sdlc/hooks/hooks.json`
**Type**: Verify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Hook is loaded by Claude Code when plugin is installed
- [x] Hook fires on Write and Edit tool calls
- [x] Command gate correctly short-circuits when no specs exist

---

## Phase 4: Testing

### T004: Create BDD Feature File

**File(s)**: `specs/9-spec-drift-detection-hook/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 4 acceptance criteria have corresponding scenarios

---

## Dependency Graph

```
T001 ──┬──▶ T002 ──┬──▶ T003 ──▶ T004 ──▶ T005 ──▶ T006
       │           │
       │           └──▶ T007 ──▶ T008 ──▶ T009 ──▶ T010 ──▶ T011
       │                                    │
       │                                    └──▶ T012, T013 ──▶ T014
       │
       └──▶ T015 ──▶ T016, T017
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #9 | 2026-02-15 | Initial feature spec |

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
