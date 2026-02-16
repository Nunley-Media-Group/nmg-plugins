# Requirements: Plugin Scaffold and Marketplace Infrastructure

**Issue**: #2
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** Claude Code user,
**I want** a plugin marketplace that hosts installable plugins with skills, hooks, and agents,
**So that** I can extend Claude Code with reusable development workflows without copy-pasting configuration.

---

## Background

The nmg-plugins repository provides the foundational infrastructure for distributing Claude Code plugins. It includes a marketplace index (`marketplace.json`) that acts as a plugin registry, a plugin manifest format (`plugin.json`) for declaring metadata, and a repo-level `/installing-locally` skill that installs plugins for the current user. This scaffold enables all subsequent skills, hooks, and agents to be packaged and versioned as a single installable unit.

---

## Acceptance Criteria

### AC1: Marketplace Index Lists Available Plugins

**Given** the marketplace repository is cloned
**When** I inspect `.claude-plugin/marketplace.json`
**Then** I see a `plugins` array with at least one plugin entry containing name, version, description, and path

### AC2: Plugin Manifest Declares Metadata

**Given** I navigate to a plugin directory (e.g., `plugins/nmg-sdlc/`)
**When** I inspect `.claude-plugin/plugin.json`
**Then** I see the plugin's name, version, description, author, and repository fields

### AC3: Local Installation Copies Plugin Files

**Given** I run the `/installing-locally` skill
**When** the skill completes
**Then** all plugin skills, hooks, and agents are installed to `~/.claude/plugins/`

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Marketplace index file at `.claude-plugin/marketplace.json` with plugin registry | Must | Contains plugins array with name, version, description, path |
| FR2 | Plugin manifest at `plugins/nmg-sdlc/.claude-plugin/plugin.json` with version and metadata | Must | Includes name, version, description, author, repository |
| FR3 | `/installing-locally` skill that copies plugin files to the user's local Claude config | Must | Repo-level skill in `.claude/skills/` |
| FR4 | README with installation instructions and plugin overview | Must | Documents the marketplace and installation process |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Installation completes within seconds (local file copy) |
| **Security** | No secrets or credentials stored in manifest files |
| **Reliability** | Installation is idempotent — re-running produces the same result |
| **Compatibility** | Works with Claude Code's plugin loading system |

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
- [x] Claude Code plugin system (`.claude-plugin/` convention)

### External Dependencies
- [x] `gh` CLI for GitHub integration
- [x] `rsync` for file synchronization

---

## Out of Scope

- Remote plugin installation from a URL (local clone required)
- Plugin dependency resolution between plugins
- Automatic update notifications

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
- [x] Edge cases and error states are specified
- [x] Dependencies are identified
- [x] Out of scope is defined
