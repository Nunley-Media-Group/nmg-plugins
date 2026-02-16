# Requirements: Detect Existing Steering Enhancement Flow

**Issue**: #26
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## User Story

**As a** developer using the nmg-sdlc workflow
**I want** the `/setting-up-steering` skill to detect existing steering documents and ask me what enhancement I'd like to make
**So that** I can iteratively improve my steering docs without regenerating from scratch and losing customizations

---

## Background

The `/setting-up-steering` skill is currently a one-time bootstrap tool. It scans the codebase, generates `product.md`, `tech.md`, and `structure.md` from templates, and writes them to `.claude/steering/`. If invoked again after steering documents already exist, it would overwrite the user's customizations with freshly generated defaults.

Developers need to evolve their steering documents over time — adding new user personas, updating the tech stack after a migration, refining coding standards, etc. Today there is no supported path for this; users must manually edit the files or risk losing their work by re-running the skill.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Existing Steering Files Are Detected

**Given** the `.claude/steering/` directory exists and contains at least one of `product.md`, `tech.md`, or `structure.md`
**When** the user invokes `/setting-up-steering`
**Then** the skill detects the existing files and enters the enhancement flow instead of the bootstrap flow

**Example**:
- Given: `.claude/steering/product.md` and `.claude/steering/tech.md` exist with user customizations
- When: User runs `/setting-up-steering`
- Then: The skill reports which files were found and enters the enhancement flow

### AC2: User Is Asked What Enhancement They Want

**Given** the skill has detected existing steering files
**When** the enhancement flow begins
**Then** the skill asks the user an open-ended question about what enhancement they'd like to make to their steering documents

**Example**:
- Given: All three steering files exist
- When: Enhancement flow begins
- Then: The skill asks something like "What would you like to update or improve in your steering documents?"

### AC3: Enhancement Is Implemented Per User Instructions

**Given** the user has described the enhancement they want
**When** the skill processes their request
**Then** the skill reads the relevant existing steering file(s), makes the requested changes following the user's instructions, and writes the updated file(s)

**Example**:
- Given: User says "Add a new user persona for QA engineers to product.md"
- When: The skill processes the request
- Then: The skill reads `product.md`, adds the QA engineer persona in the Target Users section, and writes the updated file

### AC4: Existing Customizations Are Preserved

**Given** the user has customized their steering documents with project-specific content
**When** the skill makes an enhancement
**Then** all existing content not related to the requested change is preserved unchanged

**Example**:
- Given: `tech.md` has custom coding standards and BDD testing configuration
- When: User asks to update the tech stack table with a new dependency
- Then: The tech stack table is updated, but coding standards and BDD testing sections remain untouched

### AC5: Bootstrap Flow Still Works for New Projects

**Given** the `.claude/steering/` directory does not exist or contains none of the three steering files
**When** the user invokes `/setting-up-steering`
**Then** the existing bootstrap flow (scan → generate → write → prompt) executes as it does today

**Example**:
- Given: No `.claude/steering/` directory exists
- When: User runs `/setting-up-steering`
- Then: The full codebase scan, template generation, and file writing occurs as before

### Generated Gherkin Preview

```gherkin
Feature: Detect Existing Steering Enhancement Flow
  As a developer using the nmg-sdlc workflow
  I want the setting-up-steering skill to detect existing steering documents
  So that I can iteratively improve my steering docs without losing customizations

  Scenario: Existing steering files are detected
    Given the ".claude/steering/" directory contains at least one steering file
    When the user invokes "/setting-up-steering"
    Then the skill detects the existing files
    And the skill enters the enhancement flow instead of the bootstrap flow

  Scenario: User is asked what enhancement they want
    Given the skill has detected existing steering files
    When the enhancement flow begins
    Then the skill asks an open-ended question about what enhancement to make

  Scenario: Enhancement is implemented per user instructions
    Given the user has described the enhancement they want
    When the skill processes their request
    Then the skill reads the relevant existing steering files
    And makes the requested changes following the user's instructions
    And writes the updated files

  Scenario: Existing customizations are preserved
    Given the user has customized their steering documents
    When the skill makes an enhancement
    Then all existing content not related to the requested change is preserved

  Scenario: Bootstrap flow still works for new projects
    Given the ".claude/steering/" directory does not exist
    When the user invokes "/setting-up-steering"
    Then the existing bootstrap flow executes as it does today
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Detect existence of `product.md`, `tech.md`, `structure.md` in `.claude/steering/` at skill start | Must | Check at the beginning of the workflow, before scanning |
| FR2 | Branch to enhancement flow when at least one existing steering file is found | Must | The presence of any one of the three files triggers enhancement mode |
| FR3 | Ask user an open-ended question about what they want to enhance | Must | Use `AskUserQuestion` or direct prompt; no predefined menu |
| FR4 | Read existing steering file(s) relevant to the user's request, apply changes, write updated files | Must | Use `Read` then `Edit` to preserve existing content |
| FR5 | Preserve all existing content not related to the requested change | Must | Never overwrite or regenerate unchanged sections |
| FR6 | Maintain the existing bootstrap flow for projects without steering files | Must | When no steering files found, execute current Steps 1-4 unchanged |
| FR7 | Update skill description and "When to Use" section to reflect iterative use | Must | Change "Run once per project" language |
| FR8 | Update skill metadata description to reflect enhancement capability | Must | Frontmatter `description` field |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Compatibility** | Must work with Claude Code's plugin system; no new tool permissions needed beyond existing `allowed-tools` |
| **Idempotency** | Running the enhancement flow multiple times should be safe; each run applies only the requested change |
| **Cross-platform** | No platform-specific assumptions; the skill is Markdown-based so this is inherently satisfied |

---

## UI/UX Requirements

| Element | Requirement |
|---------|-------------|
| **Detection feedback** | When existing files are detected, report which files were found before asking for the enhancement |
| **Question clarity** | The open-ended question should make it clear the user can request changes to any of the three steering documents |
| **Completion feedback** | After making changes, summarize what was modified and in which file(s) |

---

## Dependencies

### Internal Dependencies
- [x] Existing `setting-up-steering` skill (`plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`)
- [x] Steering document templates (`plugins/nmg-sdlc/skills/setting-up-steering/templates/`)

### External Dependencies
- None

### Blocked By
- None

---

## Out of Scope

- Auto-mode support for the enhancement flow (interactive only)
- A menu of predefined enhancement options (the question is open-ended)
- Automatic detection of what needs updating (e.g., drift between code and steering docs)
- Multi-round conversation beyond the initial question and implementation
- Creating missing steering files during enhancement flow (if only 1 of 3 exist, enhancement only touches existing files)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Enhancement preserves existing content | Zero unintended modifications to untouched sections | Manual review during verification |
| Bootstrap flow unaffected | Existing bootstrap behavior identical when no steering files exist | Verification against AC5 |

---

## Open Questions

- None — the issue is well-specified

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
