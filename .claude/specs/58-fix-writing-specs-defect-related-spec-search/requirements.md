# Defect Report: Writing-specs defect variant does not actively search for related feature specs

**Issue**: #58
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude Code
**Severity**: Medium
**Related Spec**: `.claude/specs/16-defect-spec-handling/`

---

## Reproduction

### Steps to Reproduce

1. Have a bug issue for a component that was originally built from a feature spec (e.g., `cleanupProcesses()` from spec `24-configurable-post-step-process-cleanup`)
2. Run `/writing-specs #N` on the bug issue
3. Observe the **Related Spec** field in the generated `requirements.md`

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | All (skill is Markdown) |
| **Version / Commit** | nmg-sdlc v2.12.x |
| **Component** | `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` (Phase 1, step 7) |
| **Template** | `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md` (Defect variant) |

### Frequency

Always — the agent has no search step, so it consistently defaults to N/A when the connection isn't obvious from issue text alone.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | The agent actively searches `.claude/specs/*/requirements.md` for specs related to the bug (matching by affected file paths, function names, or keywords from the issue) and populates the **Related Spec** field with any match found |
| **Actual** | The agent does not search for related specs. The passive instruction ("if the bug relates to an existing feature spec") provides no discovery mechanism, so the field defaults to N/A |

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Agent actively searches for related feature specs

**Given** the writing-specs skill is processing a defect issue (bug label)
**When** it reaches the Phase 1 defect variant process
**Then** it searches `.claude/specs/*/requirements.md` for specs related to the bug (matching by affected file paths, function names, or keywords from the issue)

**Example**:
- Given: Issue #55 describes bugs in `cleanupProcesses()` and references `sdlc-runner.mjs`
- When: The agent globs `.claude/specs/*/requirements.md` and greps for "cleanup" or "process" keywords
- Then: It finds `.claude/specs/24-configurable-post-step-process-cleanup/requirements.md` as a match

### AC2: Related Spec field is populated when a match is found

**Given** an existing feature spec in `.claude/specs/` relates to the bug being specified
**When** the agent finds a matching spec via the search step
**Then** it populates the **Related Spec** field with the path to the matching spec directory

**Example**:
- Given: `.claude/specs/24-configurable-post-step-process-cleanup/` exists and matches the bug's keywords
- When: The search finds this spec
- Then: The **Related Spec** field is set to `.claude/specs/24-configurable-post-step-process-cleanup/`

### AC3: No false linkage when no related spec exists

**Given** no existing feature spec in `.claude/specs/` relates to the bug
**When** the agent searches and finds no match
**Then** it sets the **Related Spec** field to N/A (current behavior preserved)

**Example**:
- Given: A bug about a typo in README.md with no prior feature spec
- When: The search finds no matching specs
- Then: The **Related Spec** field remains N/A

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Add an explicit search step to Phase 1 defect process that globs `.claude/specs/*/requirements.md` and greps for keywords from the bug issue (file paths, function names, component names) | Must |
| FR2 | Update the defect variant instruction in SKILL.md step 7 from passive ("if the bug relates to") to active ("search for related specs and populate") | Must |
| FR3 | Update the defect requirements template comment to reference the search step rather than relying on agent intuition | Should |

---

## Out of Scope

- Changing the feature variant (only the defect variant is affected)
- Adding automated spec linking to other skills (e.g., implementing-specs, verifying-specs)
- Building a spec index or database for faster lookups
- Changing the structure of the Related Spec field itself

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC3 — preserves N/A when no match)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
