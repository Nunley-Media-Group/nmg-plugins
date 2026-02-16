# Requirements: Setting Up Steering Skill

**Issue**: #3
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

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Codebase scanning via Glob/Grep/Read to gather project context | Must | Scans package files, READMEs, source directories |
| FR2 | Generation of `product.md` from templates with domain-specific content | Must | Pre-fills from README/package.json |
| FR3 | Generation of `tech.md` from templates with stack and architecture details | Must | Pre-fills discovered tech stack |
| FR4 | Generation of `structure.md` from templates with directory layout | Must | Pre-fills actual project structure |
| FR5 | Templates provided for each steering document type | Must | In `skills/setting-up-steering/templates/` |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Codebase scan completes within a single skill invocation |
| **Security** | No secrets or credentials captured in steering documents |
| **Reliability** | Works on any codebase regardless of language or framework |

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

### External Dependencies
- [x] Claude Code tool access (Read, Glob, Grep, Write)

---

## Out of Scope

- Automatic re-generation when the codebase changes
- Integration with external documentation systems
- Multi-repo project steering

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| [metric] | [target value] | [how to measure] |

---

## Open Questions

- [ ] [Question needing stakeholder input]
- [ ] [Technical question to research]
- [ ] [UX question to validate]

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
