# Defect Report: Starting-issues milestone selection iterates through random milestones

**Issue**: #65
**Date**: 2026-02-19
**Status**: Draft
**Author**: Claude Code
**Severity**: Medium
**Related Spec**: `.claude/specs/10-starting-issues-skill/`

---

## Reproduction

### Steps to Reproduce

1. Set up a repo with multiple milestones where only one has open issues (e.g., chrome-cli has 8 milestones: M1–M6, v0, v1, only `v1` has 4 open issues)
2. Run `/starting-issues` without an issue number
3. Observe the agent iterating through milestones one at a time, running `gh issue list -m "<milestone>"` for each until it finds one with results

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (observed), likely all platforms |
| **Version / Commit** | nmg-sdlc v2.12.8 (commit 3e6e257) |
| **Affected repo** | chrome-cli (8 milestones, 1 with open issues) |
| **Configuration** | Default — no special settings |

### Frequency

Always — occurs on any repo with multiple milestones where not all have open issues.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | The skill fetches milestones with `open_issues` count metadata, filters to milestones with open issues > 0, and either auto-selects the only viable milestone or presents the filtered list to the user |
| **Actual** | The skill fetches only milestone titles (no metadata), then guesses which one to use — cycling through milestones sequentially, running `gh issue list -m "<milestone>"` for each until it finds one with results |

### Error Output

No error — the skill eventually works, but wastes agent turns iterating through empty milestones before finding one with open issues.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Bug Is Fixed — Milestones Fetched with Metadata

**Given** a repo with multiple milestones (some with open issues, some without)
**When** `/starting-issues` is invoked without an issue number
**Then** the skill fetches milestones with `open_issues` count and filters to only milestones that have `open_issues > 0`

### AC2: Single Viable Milestone Auto-Selected

**Given** only one milestone has open issues
**When** the filtered milestone list contains exactly one entry
**Then** that milestone is auto-selected without the agent guessing or iterating

### AC3: Multiple Viable Milestones Presented to User

**Given** multiple milestones have open issues
**When** the filtered milestone list contains more than one entry
**Then** the user is presented with the filtered milestones to choose from (or in auto-mode, the milestone with the lowest version/name is selected)

### AC4: No Regression — No Open Milestones Falls Back Gracefully

**Given** a repo where no milestones have open issues (or no milestones exist)
**When** `/starting-issues` is invoked without an issue number
**Then** the skill falls back to listing all open issues without milestone filtering

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Fetch milestones with `open_issues` metadata using `gh api` with appropriate `--jq` filter, not just titles | Must |
| FR2 | Filter milestones to those with `open_issues > 0` before attempting issue lookup | Must |
| FR3 | Auto-select when only one viable milestone exists | Should |
| FR4 | Present filtered list when multiple viable milestones exist; in auto-mode, select first alphabetically | Should |
| FR5 | Graceful fallback when no milestones have open issues or no milestones exist | Must |

---

## Out of Scope

- Changing how milestones are created or managed
- Modifying the issue selection UI within a milestone (Step 2)
- Adding milestone priority/ordering metadata beyond what GitHub provides
- Milestone due-date-based sorting (GitHub API provides this, but it adds complexity beyond the fix)

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC4)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
