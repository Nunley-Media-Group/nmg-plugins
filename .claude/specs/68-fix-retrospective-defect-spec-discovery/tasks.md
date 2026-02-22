# Tasks: Fix retrospective defect-spec discovery and Related Spec link validation

**Issue**: #68
**Date**: 2026-02-21
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix running-retrospectives: deterministic discovery + chain resolution | [ ] |
| T002 | Fix writing-specs: filter defect specs from Related Spec search | [ ] |
| T003 | Fix migrating-projects: add Related Spec link validation | [ ] |
| T004 | Add regression test (Gherkin scenarios) | [ ] |

---

### T001: Fix running-retrospectives SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 1 (lines 26-34) rewritten: uses Glob for `.claude/specs/*/requirements.md`, then Read each file's first line to check for `# Defect Report:` heading — no Grep-with-glob dependency
- [ ] Step 2 (lines 36-49) updated: after extracting `Related Spec` from each defect spec, check if the target is a feature spec or defect spec by reading its first heading. If defect, follow the chain recursively with a visited set to detect cycles. If cycle or dead end, warn and skip (AC3). Replace the `Related Spec` value with the resolved feature spec path for Step 3.
- [ ] Step 3 (lines 51-59) updated: "Read the related feature spec" now references the resolved feature spec from Step 2's chain resolution, not the raw `Related Spec` field
- [ ] Graceful Handling table updated: add entry for "Related Spec points to another defect spec" → "Follow chain to root feature spec; if circular or dead end, warn and skip"
- [ ] No unrelated changes to other steps (Steps 4-9)

**Notes**: The key insight is that Glob for `.claude/specs/*/requirements.md` always works correctly (it's a filesystem glob, not a Grep glob parameter). Reading the first line with Read is deterministic. The chain resolution logic should be written as clear instructions (not pseudocode) since this is a Markdown skill file.

### T002: Fix writing-specs SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Phase 1 Step 7, sub-steps for defect variant (lines 119-123) updated: after Grep returns matching spec files, Read each match's first heading and filter to only `# Requirements:` headings (feature specs)
- [ ] New sub-step added: if no feature specs match but defect specs do, follow each matching defect spec's `Related Spec` link to find the root feature spec
- [ ] Fallback preserved: if no spec matches at all (after filtering and chain following), set Related Spec to N/A
- [ ] Instructions are unambiguous — the agent cannot misinterpret which specs to consider
- [ ] No changes to feature variant (non-defect) workflow

**Notes**: This completes the fix started in #58 by adding the missing defect-spec filter. The chain-following logic mirrors T001's approach.

### T003: Fix migrating-projects SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New Step 4a ("Validate Related Spec Links") added after Step 4 and before Step 5: for each defect spec found in Step 2's scan, read the `Related Spec` field, validate the target directory exists and contains a feature spec (heading `# Requirements:`), and follow chains if needed
- [ ] Circular reference detection: if a chain revisits a spec, record the finding as "circular reference"
- [ ] Findings recorded for Step 9 presentation: include the current (invalid) link and a suggested correction (the resolved root feature spec, or "N/A — no feature spec found" if the chain is broken)
- [ ] Step 9 updated: Related Spec findings included in the summary under a new "Related Spec Links" category
- [ ] Step 10 updated: if user approves, the invalid `Related Spec` line in the defect spec's `requirements.md` is corrected via Edit
- [ ] Part B approval scope updated to include Related Spec corrections alongside spec file sections and config keys
- [ ] Step numbering adjusted: Steps 5-10 renumbered to 5a-10a or subsequent steps updated to reference the new step

**Notes**: The validation step reads very few bytes per spec (just the first line of the target), so performance impact is minimal. The correction is a simple Edit to the `**Related Spec**:` line in the defect spec.

### T004: Add Regression Test (Gherkin Scenarios)

**File(s)**: `.claude/specs/68-fix-retrospective-defect-spec-discovery/feature.gherkin`
**Type**: Create
**Depends**: T001, T002, T003
**Acceptance**:
- [ ] All 7 ACs (AC1-AC7) have corresponding `@regression` scenarios
- [ ] Scenarios use concrete, realistic data (spec paths, heading patterns)
- [ ] Feature description states what was broken and what was fixed
- [ ] Scenarios are independent and self-contained
- [ ] Valid Gherkin syntax

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T004)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
