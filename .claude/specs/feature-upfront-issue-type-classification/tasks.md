# Tasks: Upfront Issue Type Classification

**Issues**: #21
**Date**: 2026-02-15
**Status**: Planning
**Author**: Claude

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [ ] |
| Skill Modification | 4 | [ ] |
| Testing | 1 | [ ] |
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

### T001: Update auto-mode section and step numbering scaffold

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Auto-mode section references new step numbers (skip Steps 2, 3, 4 instead of just Step 2; skip Step 6 instead of Step 4)
- [ ] Existing Steps 2–6 renumbered to Steps 4–8 to make room for new Steps 2 and 3
- [ ] All internal step references updated to match new numbering
- [ ] No content changes yet — just structural renumbering

**Notes**: Do this first to establish the correct structure before adding new content. The renumbering is: old Step 2 → Step 4, old Step 3 → Step 5, old Step 4 → Step 6, old Step 5 → Step 7, old Step 6 → Step 8.

---

## Phase 2: Skill Modification

### T002: Add Step 2 — Classify Issue Type

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] New "### Step 2: Classify Issue Type" section inserted after Step 1
- [ ] Uses `AskUserQuestion` with two options: "Bug" and "Enhancement / Feature"
- [ ] Includes descriptions for each option ("Something is broken or behaving incorrectly" / "New capability or improvement to existing behavior")
- [ ] Notes that auto-mode skips this step

### T003: Add Step 3 — Investigate Codebase

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] New "### Step 3: Investigate Codebase" section inserted after Step 2
- [ ] Enhancement sub-path: Glob for `.claude/specs/*/requirements.md`, Grep/Read relevant source code, produce "Current State" summary
- [ ] Bug sub-path: Grep for related code, Read and trace paths, form root cause hypothesis, confirm with user via `AskUserQuestion`
- [ ] Graceful fallback if investigation finds nothing relevant
- [ ] Notes that auto-mode skips this step

### T004: Modify Step 4 — Type-adapted interview questions

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Existing interview step restructured with explicit type-specific question lists
- [ ] Enhancement questions: persona, pain point, desired outcome, ACs (Given/When/Then), scope, priority
- [ ] Bug questions: reproduction steps, expected vs actual, environment, frequency, error output, when it started
- [ ] "Skip any already answered" guidance preserved for both paths
- [ ] Existing adaptive guidance ("Adapt questions based on the type of work") replaced by explicit branches

### T005: Modify Step 5 — Add new sections to issue body templates

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] Feature/Enhancement template gains "## Current State" section between "## Background" and "## Acceptance Criteria"
- [ ] Bug Report template gains "## Root Cause Analysis" section between "## Bug Report" summary and "## Reproduction Steps"
- [ ] Current State section includes placeholder for investigation findings
- [ ] Root Cause Analysis section includes hypothesis text and "User Confirmed: Yes / Partially / Investigation inconclusive" field
- [ ] Both new sections reference Step 3 investigation output

---

## Phase 3: Testing

### T006: Create BDD feature file

**File(s)**: `.claude/specs/21-upfront-issue-type-classification/feature.gherkin`
**Type**: Create
**Depends**: T002, T003, T004, T005
**Acceptance**:
- [ ] All 7 acceptance criteria from requirements.md have corresponding scenarios
- [ ] Feature file uses valid Gherkin syntax
- [ ] Scenarios are independent and self-contained
- [ ] Includes happy path, alternative paths, and edge cases

---

## Dependency Graph

```
T001 (renumber steps)
  ├──▶ T002 (classify) ──▶ T003 (investigate)
  │                              │
  └──▶ T004 (interview)         │
                                 │
               T005 (templates) ◀┘
                    │
                    ▼
              T006 (gherkin)
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #21 | 2026-02-15 | Initial feature spec |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T006 — BDD feature file)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
