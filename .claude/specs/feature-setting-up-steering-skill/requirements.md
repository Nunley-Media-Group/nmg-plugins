# Requirements: Setting Up Steering Skill

**Issues**: #3, #26
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer adopting the nmg-sdlc workflow,
**I want** an automated skill that scans my codebase and generates product, tech, and structure steering documents,
**So that** all subsequent SDLC skills have the context they need to produce high-quality specs and issues.

---

## Background

The `/setting-up-steering` skill performs a one-time codebase analysis to bootstrap three steering documents: `product.md` (domain, users, goals), `tech.md` (stack, architecture, conventions), and `structure.md` (directory layout, key files). These documents are stored in `.claude/steering/` and serve as shared context for every other skill in the plugin — from issue creation to spec writing to verification. Without steering docs, skills lack the project-specific knowledge needed to generate accurate, relevant output.

---

## Acceptance Criteria

### AC1: Steering Documents Are Generated

**Given** I invoke `/setting-up-steering` in a project without existing steering docs
**When** the skill completes its codebase scan
**Then** `product.md`, `tech.md`, and `structure.md` are created in `.claude/steering/`

### AC2: Product Steering Captures Domain Context

**Given** the skill has scanned the codebase
**When** I review `product.md`
**Then** it contains the product's purpose, target users, and key capabilities

### AC3: Tech Steering Captures Architecture

**Given** the skill has scanned the codebase
**When** I review `tech.md`
**Then** it contains the tech stack, frameworks, conventions, and architectural patterns

### AC4: Structure Steering Captures Layout

**Given** the skill has scanned the codebase
**When** I review `structure.md`
**Then** it contains the directory structure, key file locations, and module organization

<!-- From issue #26 -->
### AC5: Existing Steering Files Are Detected

**Given** the `.claude/steering/` directory exists and contains at least one of `product.md`, `tech.md`, or `structure.md`
**When** the user invokes `/setting-up-steering`
**Then** the skill detects the existing files and enters the enhancement flow instead of the bootstrap flow

**Example**:
- Given: `.claude/steering/product.md` and `.claude/steering/tech.md` exist with user customizations
- When: User runs `/setting-up-steering`
- Then: The skill reports which files were found and enters the enhancement flow

<!-- From issue #26 -->
### AC6: User Is Asked What Enhancement They Want

**Given** the skill has detected existing steering files
**When** the enhancement flow begins
**Then** the skill asks the user an open-ended question about what enhancement they'd like to make to their steering documents

**Example**:
- Given: All three steering files exist
- When: Enhancement flow begins
- Then: The skill asks something like "What would you like to update or improve in your steering documents?"

<!-- From issue #26 -->
### AC7: Enhancement Is Implemented Per User Instructions

**Given** the user has described the enhancement they want
**When** the skill processes their request
**Then** the skill reads the relevant existing steering file(s), makes the requested changes following the user's instructions, and writes the updated file(s)

**Example**:
- Given: User says "Add a new user persona for QA engineers to product.md"
- When: The skill processes the request
- Then: The skill reads `product.md`, adds the QA engineer persona in the Target Users section, and writes the updated file

<!-- From issue #26 -->
### AC8: Existing Customizations Are Preserved

**Given** the user has customized their steering documents with project-specific content
**When** the skill makes an enhancement
**Then** all existing content not related to the requested change is preserved unchanged

**Example**:
- Given: `tech.md` has custom coding standards and BDD testing configuration
- When: User asks to update the tech stack table with a new dependency
- Then: The tech stack table is updated, but coding standards and BDD testing sections remain untouched

<!-- From issue #26 -->
### AC9: Bootstrap Flow Still Works for New Projects

**Given** the `.claude/steering/` directory does not exist or contains none of the three steering files
**When** the user invokes `/setting-up-steering`
**Then** the existing bootstrap flow (scan → generate → write → prompt) executes as it does today

**Example**:
- Given: No `.claude/steering/` directory exists
- When: User runs `/setting-up-steering`
- Then: The full codebase scan, template generation, and file writing occurs as before

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Codebase scanning via Glob/Grep/Read to gather project context | Must | Scans package files, READMEs, source directories |
| FR2 | Generation of `product.md` from templates with domain-specific content | Must | Pre-fills from README/package.json |
| FR3 | Generation of `tech.md` from templates with stack and architecture details | Must | Pre-fills discovered tech stack |
| FR4 | Generation of `structure.md` from templates with directory layout | Must | Pre-fills actual project structure |
| FR5 | Templates provided for each steering document type | Must | In `skills/setting-up-steering/templates/` |
| FR6 | Detect existence of `product.md`, `tech.md`, `structure.md` in `.claude/steering/` at skill start | Must | Check at the beginning of the workflow, before scanning |
| FR7 | Branch to enhancement flow when at least one existing steering file is found | Must | The presence of any one of the three files triggers enhancement mode |
| FR8 | Ask user an open-ended question about what they want to enhance | Must | Use `AskUserQuestion` or direct prompt; no predefined menu |
| FR9 | Read existing steering file(s) relevant to the user's request, apply changes, write updated files | Must | Use `Read` then `Edit` to preserve existing content |
| FR10 | Preserve all existing content not related to the requested change | Must | Never overwrite or regenerate unchanged sections |
| FR11 | Maintain the existing bootstrap flow for projects without steering files | Must | When no steering files found, execute current Steps 1-4 unchanged |
| FR12 | Update skill description and "When to Use" section to reflect iterative use | Must | Change "Run once per project" language |
| FR13 | Update skill metadata description to reflect enhancement capability | Must | Frontmatter `description` field |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Codebase scan completes within a single skill invocation |
| **Security** | No secrets or credentials captured in steering documents |
| **Reliability** | Works on any codebase regardless of language or framework |
| **Compatibility** | Must work with Claude Code's plugin system; no new tool permissions needed beyond existing `allowed-tools` |
| **Idempotency** | Running the enhancement flow multiple times should be safe; each run applies only the requested change |
| **Cross-platform** | No platform-specific assumptions; the skill is Markdown-based so this is inherently satisfied |

---

## UI/UX Requirements

Reference `structure.md` and `product.md` for project-specific design standards.

| Element | Requirement |
|---------|-------------|
| **Interaction** | [Touch targets, gesture requirements] |
| **Typography** | [Minimum text sizes, font requirements] |
| **Contrast** | [Accessibility contrast requirements] |
| **Loading States** | [How loading should be displayed] |
| **Error States** | [How errors should be displayed] |
| **Empty States** | [How empty data should be displayed] |
| **Detection feedback** | When existing files are detected, report which files were found before asking for the enhancement |
| **Question clarity** | The open-ended question should make it clear the user can request changes to any of the three steering documents |
| **Completion feedback** | After making changes, summarize what was modified and in which file(s) |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| [field] | [type] | [rules] | Yes/No |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| [field] | [type] | [what it represents] |

---

## Dependencies

### Internal Dependencies
- [x] Plugin scaffold and marketplace infrastructure (#2)
- [x] Existing `setting-up-steering` skill (`plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`)
- [x] Steering document templates (`plugins/nmg-sdlc/skills/setting-up-steering/templates/`)

### External Dependencies
- [x] Claude Code tool access (Read, Glob, Grep, Write)

---

## Out of Scope

- Automatic re-generation when the codebase changes
- Integration with external documentation systems
- Multi-repo project steering
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
| Bootstrap flow unaffected | Existing bootstrap behavior identical when no steering files exist | Verification against AC9 |

---

## Open Questions

- None — both issues are well-specified

---

## Change History

| Date | Issue | Description |
|------|-------|-------------|
| 2026-02-15 | #3 | Initial spec: bootstrap flow for steering document generation |
| 2026-02-15 | #26 | Enhancement: detect existing steering docs and enter iterative enhancement flow |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
