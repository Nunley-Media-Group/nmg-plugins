# Tasks: Fix /migrating-projects Adding Irrelevant Template Sections

**Issue**: #66
**Date**: 2026-02-20
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add relevance filtering, per-section approval, and exclusion persistence to SKILL.md | [ ] |
| T002 | Add regression test (Gherkin feature file) | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the Defect

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 3 includes a relevance heuristic table mapping section heading keywords to glob patterns for codebase evidence
- [ ] After the heading-diff in Step 3, a new filtering step checks each missing heading against the heuristic table and excludes sections with no codebase evidence
- [ ] A new Step 3b loads `.claude/migration-exclusions.json` (if it exists) and removes previously-declined sections from the proposal list
- [ ] Step 9 uses `AskUserQuestion` with `multiSelect: true` listing each proposed section individually, allowing per-section approve/decline
- [ ] Step 10 persists newly-declined sections to `.claude/migration-exclusions.json` after applying approved changes
- [ ] Unknown sections (no keyword match in heuristic table) are conservatively included in proposals
- [ ] The exclusion file uses the schema: `{ "excludedSections": { "filename.md": ["Heading Text", ...] } }`
- [ ] The skill's "Key Rules" section is updated to reflect the new filtering and persistence behavior

**Notes**: Follow the fix strategy from design.md. The three capabilities (relevance filtering, per-section approval, exclusion persistence) are all modifications to the single SKILL.md file. Keep the heuristic table extensible — use keyword matching against heading text, not exact heading matches, so it adapts to template heading variations.

### T002: Add Regression Test

**File(s)**: `.claude/specs/66-fix-migrating-projects-irrelevant-sections/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenarios cover all 4 acceptance criteria from requirements.md
- [ ] Scenarios tagged `@regression`
- [ ] Scenarios use concrete examples (e.g., "Database Standards" for a project with no database)
- [ ] Scenarios verify both filtering behavior and persistence behavior

### T003: Verify No Regressions

**File(s)**: [existing skill files]
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] Step 3's heading-diff logic still works correctly for sections that pass filtering
- [ ] Step 4 (spec file analysis) is unaffected by the changes
- [ ] Steps 5–8 (OpenClaw config, CHANGELOG, VERSION) are unaffected
- [ ] The skill's self-updating property is preserved (templates still read at runtime)
- [ ] The "always interactive" rule is preserved (auto-mode still does not apply)

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
