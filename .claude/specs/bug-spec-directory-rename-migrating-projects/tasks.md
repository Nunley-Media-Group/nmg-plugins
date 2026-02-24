# Tasks: Missing Spec Directory Rename in /migrating-projects

**Issue**: #83
**Date**: 2026-02-24
**Status**: Planning
**Author**: Claude (spec agent)

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix the SKILL.md instructions for solo renames and auto-mode classification | [ ] |
| T002 | Add regression test scenarios | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the SKILL.md Instructions

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Automation Mode section (lines 25–27): "legacy directory renames (solo)" moved from destructive to non-destructive list; consolidation and directory deletes remain destructive
- [ ] Auto-mode bullet points (lines 29–33): Step 4d description updated to reflect that solo renames are auto-applied while consolidation is skipped
- [ ] Step 4d (line 187): Auto-mode logic split — solo renames proceed automatically (execute `git mv` and cross-reference updates without `AskUserQuestion`), consolidation groups recorded as skipped operations
- [ ] Step 4e solo feature rename (lines 207–210): "Rename the directory" replaced with explicit `git mv .claude/specs/{issue#}-{slug}/ .claude/specs/feature-{slug}/` instruction; cross-reference update expanded to: use `Grep` across all spec directories for `**Related Spec**` fields pointing to the old path, filter to defect specs by checking for `# Defect Report:` heading, use `Edit` to update each reference, follow chain resolution through intermediate defect specs with visited set for cycle detection
- [ ] Step 4e solo bug rename (lines 212–215): Same explicit `git mv` and expanded cross-reference instructions as the feature rename path
- [ ] No changes to Step 4e multi-spec consolidation logic (lines 197–205)
- [ ] No changes to Steps 1–4a or Steps 5–10 (outside the fix scope)

**Notes**: The fix is entirely within the Automation Mode section and Steps 4d–4e. Keep changes minimal — expand existing instructions rather than restructuring the workflow. Ensure the expanded solo rename cross-reference logic matches the level of detail already present in the consolidation cross-reference logic (line 204).

### T002: Add Regression Test Scenarios

**File(s)**: `.claude/specs/bug-spec-directory-rename-migrating-projects/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario for AC1: legacy directory detection by `{digits}-{slug}` pattern
- [ ] Gherkin scenario for AC2: interactive rename with `AskUserQuestion` confirmation
- [ ] Gherkin scenario for AC3: auto-mode applies solo renames automatically, skips consolidation
- [ ] Gherkin scenario for AC4: cross-reference updates after rename
- [ ] All scenarios tagged `@regression`
- [ ] Feature file is valid Gherkin syntax

### T003: Verify No Regressions

**File(s)**: [existing SKILL.md and spec files]
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] Multi-spec consolidation logic (Step 4e lines 197–205) is unchanged
- [ ] Interactive mode behavior (Step 4d non-auto-mode path, lines 189–191) is unchanged
- [ ] Steps 1–4a and Steps 5–10 are unmodified
- [ ] Existing steering doc migration, spec section migration, OpenClaw config, CHANGELOG, and VERSION analysis steps are unaffected
- [ ] Auto-mode still skips consolidation and records it in "Skipped Operations" output

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #83 | 2026-02-24 | Initial defect tasks |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
