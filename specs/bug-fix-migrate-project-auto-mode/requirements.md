# Defect Report: migrate-project Respects unattended-mode Despite Spec Excluding It

**Issue**: #46
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `specs/feature-migration-skill/`

---

## Reproduction

### Steps to Reproduce

1. Scaffold a test project with outdated steering docs (missing sections relative to current templates)
2. Add `.claude/unattended-mode` to the project directory
3. Run `/migrate-project`
4. Observe that the skill applies all changes without presenting them for user review

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (macOS, Linux, Windows) |
| **Version / Commit** | nmg-sdlc plugin with migrate-project skill at current HEAD |
| **Configuration** | `.claude/unattended-mode` file present in project directory |

### Frequency

Always — whenever `.claude/unattended-mode` exists in the project directory.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | `/migrate-project` always presents proposed changes for interactive review via `AskUserQuestion` before modifying any files, regardless of whether `.claude/unattended-mode` exists |
| **Actual** | When `.claude/unattended-mode` exists, the skill skips the interactive review gate (AC4 from issue #25) and applies all changes without user approval |

### Error Output

No error output — the skill silently proceeds past the review gate when unattended-mode is detected.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Review Gate Is Always Interactive

**Given** a project with `.claude/unattended-mode` present and outdated steering docs
**When** `/migrate-project` runs and identifies changes to merge
**Then** proposed changes are presented for review via `AskUserQuestion` before any files are modified

**Example**:
- Given: A project with `.claude/unattended-mode` and a `product.md` missing the `## Product Principles` section
- When: `/migrate-project` is run
- Then: The skill displays the migration summary and asks the user to approve or reject before applying any changes

### AC2: No Regression — Review Gate Still Works Without unattended-mode

**Given** a project without `.claude/unattended-mode` and outdated steering docs
**When** `/migrate-project` runs and identifies changes to merge
**Then** proposed changes are presented for review via `AskUserQuestion` before any files are modified (existing behavior preserved)

### AC3: No Regression — Other Skills Still Respect unattended-mode

**Given** a project with `.claude/unattended-mode` present
**When** any other SDLC skill with unattended-mode support runs (e.g., `/write-spec`)
**Then** that skill's review gates are correctly skipped per the unattended-mode convention

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | The `/migrate-project` skill MUST always use `AskUserQuestion` for the review gate, regardless of `.claude/unattended-mode` | Must |
| FR2 | The skill's prompt text must explicitly instruct Claude to ignore unattended-mode for this skill's review gate | Must |
| FR3 | Changes must not affect how other SDLC skills handle unattended-mode | Should |

---

## Out of Scope

- Adding unattended-mode support to `/migrate-project` (the original spec explicitly excludes it)
- Refactoring other skills' unattended-mode handling
- Changes to the unattended-mode detection mechanism itself

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
