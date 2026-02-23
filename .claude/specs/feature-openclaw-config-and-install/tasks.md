# Tasks: OpenClaw Config Generation and Skill Installation

**Issues**: #13, #14
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup (#13) | 1 | [x] |
| Plugin Files (#13) | 1 | [x] |
| Integration (#13) | 1 | [x] |
| Testing (#13) | 1 | [x] |
| Setup (#14) | 1 | [x] |
| Plugin Files (#14) | 1 | [x] |
| Templates/Content (#14) | 1 | [x] |
| Integration (#14) | 1 | [x] |
| Testing (#14) | 1 | [x] |
| **Total** | **9** | |

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

### T001: Create Skill Directory (Config)

**File(s)**: `plugins/nmg-sdlc/skills/generating-openclaw-config/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition (Config)

**File(s)**: `plugins/nmg-sdlc/skills/generating-openclaw-config/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md with valid frontmatter
- [x] 8-step workflow documented
- [x] Template substitution logic documented
- [x] .gitignore update logic documented

---

## Phase 3: Integration

### T003: Configure Allowed Tools (Config)

**File(s)**: `plugins/nmg-sdlc/skills/generating-openclaw-config/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools: Read, Write, Edit, Bash(basename:*), Bash(realpath:*), Bash(pwd:*), Bash(git:*), Bash(test:*), Bash(grep:*)

---

## Phase 4: Testing

### T004: Create BDD Feature File (Config)

**File(s)**: `.claude/specs/13-generating-openclaw-config-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 4 acceptance criteria have corresponding scenarios

---

## Phase 5: Setup

### T005: Create Skill Directory (Install)

**File(s)**: `plugins/nmg-sdlc/skills/installing-openclaw-skill/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists

---

## Phase 6: Plugin Files

### T006: Create Skill Definition (Install)

**File(s)**: `plugins/nmg-sdlc/skills/installing-openclaw-skill/SKILL.md`
**Type**: Create
**Depends**: T005
**Status**: Complete
**Acceptance**:
- [x] 5-step workflow documented (mkdir, copy, patch, restart, report)
- [x] Key paths table documenting source and destination
- [x] Non-fatal error handling for gateway restart

---

## Phase 7: Templates/Content

### T007: Create Standalone Installer Script

**File(s)**: `openclaw/scripts/install-openclaw-skill.sh`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Shell script with copy and --link modes
- [x] Copies SKILL.md, sdlc-runner.mjs, sdlc-config.example.json
- [x] Supports --link flag for symlink mode

---

## Phase 8: Integration

### T008: Configure Allowed Tools (Install)

**File(s)**: `plugins/nmg-sdlc/skills/installing-openclaw-skill/SKILL.md`
**Type**: Modify
**Depends**: T006
**Status**: Complete
**Acceptance**:
- [x] Allowed tools: Read, Bash(cp:*), Bash(mkdir:*), Bash(source:*), Bash(ls:*), Bash(node:*)

---

## Phase 9: Testing

### T009: Create BDD Feature File (Install)

**File(s)**: `.claude/specs/14-installing-openclaw-skill/feature.gherkin`
**Type**: Create
**Depends**: T006
**Status**: Complete
**Acceptance**:
- [x] All 4 acceptance criteria have corresponding scenarios

---

## Dependency Graph

```
T001 ──▶ T002 ──▶ T003 ──▶ T004

T005 ──▶ T006 ──▶ T008 ──▶ T009
T007 ──▶ T006
```

---

## Change History

| Date | Issue | Description |
|------|-------|-------------|
| 2026-02-15 | #13 | Initial tasks: T001–T004 (config skill) |
| 2026-02-15 | #14 | Added tasks: T005–T009 (install skill) |
| 2026-02-22 | #13, #14 | Consolidated into feature-openclaw-config-and-install; renumbered #14 tasks T001–T005 → T005–T009 |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
