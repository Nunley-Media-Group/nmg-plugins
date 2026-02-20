# Tasks: Fix starting-issues milestone selection iterating through random milestones

**Issue**: #65
**Date**: 2026-02-19
**Status**: Planning
**Author**: Claude Code

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix the defect — replace milestone fetching and add selection logic | [ ] |
| T002 | Add regression test — Gherkin scenarios for milestone selection | [ ] |
| T003 | Verify no regressions — existing skill behavior preserved | [ ] |

---

### T001: Fix the Defect

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] The `gh api` call in Step 1 "Fetch Milestones" uses `--jq` to include `open_issues` count and filters to milestones with `open_issues > 0`
- [ ] The "Fetch Issues by Milestone" subsection is replaced with deterministic 3-way selection logic:
  - **Zero viable milestones**: Fall back to all open issues (existing fallback preserved)
  - **One viable milestone**: Auto-select it and fetch its issues
  - **Multiple viable milestones**: In interactive mode, present filtered milestones for user selection; in auto-mode, select the first alphabetically
- [ ] The ambiguous "current/next milestone" instruction is removed
- [ ] No changes outside Step 1's milestone discovery subsection (lines 45–63)
- [ ] The Automation Mode section's reference to "current milestone" is updated to match the new deterministic logic

**Notes**: The `gh api repos/{owner}/{repo}/milestones` endpoint already returns `open_issues` — the fix is using a `--jq` filter that preserves it. Use `[.[] | select(.open_issues > 0) | {title: .title, open_issues: .open_issues}] | sort_by(.title)` to filter and sort in one pass. Update the prose instructions to match the new algorithm.

### T002: Add Regression Test

**File(s)**: `.claude/specs/65-fix-starting-issues-milestone-selection/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenarios cover all 4 acceptance criteria from requirements.md
- [ ] All scenarios tagged `@regression`
- [ ] Scenarios use concrete data from the reproduction steps (8 milestones, 1 with open issues)
- [ ] Feature description states what was broken and how it was fixed

### T003: Verify No Regressions

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] Step 2 (issue selection), Step 3 (confirmation), and Step 4 (branch creation) are unchanged
- [ ] The output contract ("Issue Ready" summary) is unchanged
- [ ] Auto-mode behavior still selects issues oldest-first within the chosen milestone
- [ ] The skill still works when invoked with an explicit issue number (skips Step 1 entirely)
- [ ] The fallback path (no milestones → all open issues) is preserved

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure
