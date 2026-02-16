# Tasks: Add Migration Skill

**Issue**: #25
**Date**: 2026-02-15
**Status**: Planning
**Author**: Claude

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [ ] |
| Backend (Skill Implementation) | 1 | [ ] |
| Integration | 3 | [ ] |
| Testing | 1 | [ ] |
| **Total** | **6** | |

---

## Phase 1: Setup

### T001: Create migrating-projects skill directory

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] Directory `plugins/nmg-sdlc/skills/migrating-projects/` exists
- [ ] `SKILL.md` file is created (content comes in T002)

---

## Phase 2: Skill Implementation

### T002: Write the SKILL.md for `/migrating-projects`

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] SKILL.md follows the standard skill structure (title, When to Use, Workflow steps, Integration with SDLC Workflow)
- [ ] Skill is not user-invocable with arguments (no `$ARGUMENTS` — operates on current project)
- [ ] Step 1: Resolve template paths — locate `setting-up-steering/templates/`, `writing-specs/templates/`, `openclaw/scripts/sdlc-config.example.json` from the installed plugin
- [ ] Step 2: Scan project files — use `Glob` to find steering docs, spec files, and `sdlc-config.json`
- [ ] Step 3: Analyze steering docs — read each template, extract headings from the code block, compare against existing steering docs, identify missing `##`-level sections
- [ ] Step 4: Analyze spec files — for each spec directory, detect variant (feature vs defect) by checking first `#` heading, compare against correct template variant, identify missing `##`-level sections
- [ ] Step 5: Analyze OpenClaw config — read `sdlc-config.json` and template, identify missing keys at root and `steps` level
- [ ] Step 6: Check OpenClaw skill version — compare `~/.openclaw/skills/running-sdlc/` against source in marketplace clone
- [ ] Step 7: Present findings — display per-file summary of proposed additions for interactive review
- [ ] Step 8: Apply changes — if approved, use `Edit` to insert missing sections at correct positions; for JSON config, merge missing keys
- [ ] Step 9: Output summary — report all changes made
- [ ] No auto-mode support (skill is always interactive)
- [ ] Heading extraction instructions explain how to parse template code blocks (content between ` ```markdown ` and ` ``` `)
- [ ] Insertion logic instructions explain positioning (insert after the predecessor section in template order)
- [ ] Variant detection instructions explain how to identify feature vs defect specs
- [ ] JSON merge instructions explain key-level diffing (add missing keys, never overwrite existing values)
- [ ] `feature.gherkin` files explicitly excluded from migration
- [ ] Includes handling for "already up to date" case
- [ ] Includes handling for missing project files (skip, don't create)
- [ ] Allowed tools include `Read`, `Glob`, `Grep`, `Edit`, `Bash(gh:*)`, `AskUserQuestion`

**Notes**: This is the core deliverable. The SKILL.md must contain clear, unambiguous instructions for Claude to execute the heading-based section diffing algorithm. Include concrete examples of heading extraction, comparison, and insertion. The skill must be self-updating — all template knowledge comes from reading files at runtime, never hardcoded.

---

## Phase 3: Integration

### T003: Update README.md with new skill

**File(s)**: `README.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] `/migrating-projects` added to the SDLC Skills table in the Skills Reference section
- [ ] Description matches the skill purpose: "Update project specs, steering docs, and configs to latest template standards"
- [ ] Positioned logically in the table (after `/setting-up-steering` since it's a maintenance skill)

### T004: Update CHANGELOG.md

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] Entry added under `[Unreleased]` → `### Added` section
- [ ] Entry describes the new `/migrating-projects` skill with key capabilities
- [ ] Follows existing changelog style (bold skill name, em-dash, description)

### T005: Bump plugin version (2.6.0 → 2.7.0)

**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] `plugins/nmg-sdlc/.claude-plugin/plugin.json` → `"version"` updated to `"2.7.0"`
- [ ] `.claude-plugin/marketplace.json` → plugin entry `"version"` updated to `"2.7.0"`
- [ ] `metadata.version` in `marketplace.json` is NOT changed (it's the collection version)

---

## Phase 4: BDD Testing

### T006: Create BDD feature file

**File(s)**: `.claude/specs/25-add-migration-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Acceptance**:
- [ ] All 9 acceptance criteria from requirements.md have corresponding scenarios
- [ ] Uses Given/When/Then format
- [ ] Scenarios are independent and self-contained
- [ ] Includes happy paths, edge cases, and error handling
- [ ] Valid Gherkin syntax

---

## Dependency Graph

```
T001 ──▶ T002 ──┬──▶ T003
                ├──▶ T004
                ├──▶ T005
                └──▶ T006
```

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T006)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
