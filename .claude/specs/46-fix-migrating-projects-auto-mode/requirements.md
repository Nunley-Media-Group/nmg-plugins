# Defect Report: migrating-projects Respects auto-mode Despite Spec Excluding It

**Issue**: #46
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `.claude/specs/25-add-migration-skill/`

---

## Reproduction

### Steps to Reproduce

1. Scaffold a test project with outdated steering docs (missing sections relative to current templates)
2. Add `.claude/auto-mode` to the project directory
3. Run `/migrating-projects`
4. Observe that the skill applies all changes without presenting them for user review

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (macOS, Linux, Windows) |
| **Version / Commit** | nmg-sdlc plugin with migrating-projects skill at current HEAD |
| **Configuration** | `.claude/auto-mode` file present in project directory |

### Frequency

Always — whenever `.claude/auto-mode` exists in the project directory.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | `/migrating-projects` always presents proposed changes for interactive review via `AskUserQuestion` before modifying any files, regardless of whether `.claude/auto-mode` exists |
| **Actual** | When `.claude/auto-mode` exists, the skill skips the interactive review gate (AC4 from issue #25) and applies all changes without user approval |

### Error Output

No error output — the skill silently proceeds past the review gate when auto-mode is detected.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Review Gate Is Always Interactive

**Given** a project with `.claude/auto-mode` present and outdated steering docs
**When** `/migrating-projects` runs and identifies changes to merge
**Then** proposed changes are presented for review via `AskUserQuestion` before any files are modified

**Example**:
- Given: A project with `.claude/auto-mode` and a `product.md` missing the `## Product Principles` section
- When: `/migrating-projects` is run
- Then: The skill displays the migration summary and asks the user to approve or reject before applying any changes

### AC2: No Regression — Review Gate Still Works Without auto-mode

**Given** a project without `.claude/auto-mode` and outdated steering docs
**When** `/migrating-projects` runs and identifies changes to merge
**Then** proposed changes are presented for review via `AskUserQuestion` before any files are modified (existing behavior preserved)

### AC3: No Regression — Other Skills Still Respect auto-mode

**Given** a project with `.claude/auto-mode` present
**When** any other SDLC skill with auto-mode support runs (e.g., `/writing-specs`)
**Then** that skill's review gates are correctly skipped per the auto-mode convention

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | The `/migrating-projects` skill MUST always use `AskUserQuestion` for the review gate, regardless of `.claude/auto-mode` | Must |
| FR2 | The skill's prompt text must explicitly instruct Claude to ignore auto-mode for this skill's review gate | Must |
| FR3 | Changes must not affect how other SDLC skills handle auto-mode | Should |

---

## Out of Scope

- Adding auto-mode support to `/migrating-projects` (the original spec explicitly excludes it)
- Refactoring other skills' auto-mode handling
- Changes to the auto-mode detection mechanism itself

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC2, AC3)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
