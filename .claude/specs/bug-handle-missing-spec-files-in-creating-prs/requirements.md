# Defect Report: Handle Missing Spec Files Gracefully in /creating-prs

**Issue**: #82
**Date**: 2026-02-23
**Status**: Draft
**Author**: Claude Code
**Severity**: High
**Related Spec**: `.claude/specs/feature-creating-prs-skill/`

---

## Reproduction

### Steps to Reproduce

1. Create a GitHub issue and start work on it with `/starting-issues`
2. Make code changes directly without running `/writing-specs`
3. Run `/creating-prs` to create a pull request
4. Skill fails when trying to read non-existent spec files in `.claude/specs/{feature}/`

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (macOS, Linux, Windows) |
| **Version / Commit** | nmg-sdlc plugin v2.15.0 |
| **Runtime** | Claude Code CLI |
| **Configuration** | Standard SDLC workflow; specs skipped for simple changes |

### Frequency

Always — reproducible whenever spec files do not exist for the current feature branch.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | When spec files don't exist, `/creating-prs` falls back to extracting acceptance criteria from the GitHub issue body and creates the PR successfully |
| **Actual** | The skill fails when attempting to read spec files that don't exist, blocking PR creation entirely |

### Error Output

```
The Read tool fails when attempting to access `.claude/specs/{feature}/requirements.md`,
`.claude/specs/{feature}/design.md`, or `.claude/specs/{feature}/tasks.md` because the
files do not exist. The skill has no conditional check or fallback path.
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Fallback to Issue Body When Specs Missing

**Given** the spec directory `.claude/specs/{feature}/` does not exist
**When** `/creating-prs` is invoked
**Then** the skill falls back to extracting acceptance criteria from the GitHub issue body

### AC2: PR Body Adapted for Missing Specs

**Given** specs do not exist and the skill falls back to the issue body
**When** the PR is created
**Then** the PR body omits the "Specs" section
**And** "Acceptance Criteria" is labeled "From issue body" instead of "From requirements.md"

### AC3: Warning Included in PR Body

**Given** specs do not exist
**When** the PR is created
**Then** a warning is included in the PR body: "No spec files found — acceptance criteria extracted from issue body"

### AC4: Existing Behavior Preserved When Specs Exist

**Given** the spec directory exists with valid spec files (`requirements.md`, `design.md`, `tasks.md`)
**When** `/creating-prs` is invoked
**Then** behavior is unchanged from current implementation (specs are read and referenced in the PR body)

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Check for spec directory existence before reading spec files | Must |
| FR2 | Fall back to GitHub issue body for acceptance criteria when specs are missing | Must |
| FR3 | Adapt PR body template: omit "Specs" section and label ACs "From issue body" when specs are missing | Must |
| FR4 | Include warning "No spec files found — acceptance criteria extracted from issue body" in PR body when specs are missing | Should |
| FR5 | Preserve current behavior when specs exist — no changes to the happy path | Must |

---

## Out of Scope

- Validating spec file content structure (covered by a separate concern)
- Auto-generating specs when they're missing
- Partial spec support (e.g., requirements.md exists but design.md doesn't)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #82 | 2026-02-23 | Initial defect spec |

---

## Validation Checklist

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC4)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
