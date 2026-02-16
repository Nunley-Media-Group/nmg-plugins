# Requirements: Installing Locally Skill

**Issue**: #15
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** plugin developer or user,
**I want** a one-command skill that installs all marketplace plugins to my local Claude Code configuration,
**So that** I can use or test the latest plugin versions without manually copying files.

---

## Background

The `/installing-locally` skill is a repo-level utility (in `.claude/skills/`, not part of any individual plugin) that installs all plugins from the marketplace to the user's local `~/.claude/plugins/` directory. It reads the marketplace index to discover available plugins, copies their skills, hooks, and agents to the appropriate local directories, and handles any necessary cleanup of stale files. It was enhanced to also sync the OpenClaw `running-sdlc` skill to `~/.openclaw/skills/` and restart the OpenClaw gateway, making it a single command for full local development setup.

---

## Acceptance Criteria

### AC1: All Marketplace Plugins Are Installed

**Given** I invoke `/installing-locally` in the nmg-plugins repo
**When** the skill completes
**Then** all plugins listed in `marketplace.json` are installed to `~/.claude/plugins/`

### AC2: Skills, Hooks, and Agents Are Copied

**Given** a plugin has skills, hooks, and agents
**When** installation runs
**Then** all skill directories, hook configurations, and agent definitions are copied to the local plugin directory

### AC3: OpenClaw Skill Is Synced

**Given** the OpenClaw `running-sdlc` skill exists in the repo
**When** `/installing-locally` runs
**Then** the skill is synced to `~/.openclaw/skills/running-sdlc/`

### AC4: Gateway Is Restarted After Sync

**Given** the OpenClaw skill is synced
**When** the sync completes
**Then** the OpenClaw gateway is restarted

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Read marketplace index to discover plugins | Must | From marketplace.json |
| FR2 | Copy plugin skills, hooks, and agents to `~/.claude/plugins/` | Must | Via rsync |
| FR3 | Sync OpenClaw `running-sdlc` skill to `~/.openclaw/skills/` | Must | SKILL.md, runner, config |
| FR4 | Restart OpenClaw gateway after sync | Must | Via `openclaw gateway restart` |
| FR5 | Available as a repo-level skill (not part of any plugin) | Must | In `.claude/skills/` |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | rsync for efficient incremental sync |
| **Security** | Local file operations only; no remote downloads |
| **Reliability** | Non-fatal gateway restart; version mismatch warnings |

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
- [x] Plugin scaffold (#2) for marketplace.json format
- [x] OpenClaw SDLC orchestration (#12) for running-sdlc skill

### External Dependencies
- [x] `rsync` for file synchronization
- [x] `git` for marketplace repo management
- [x] `openclaw` CLI for gateway restart
- [x] `jq` for JSON manipulation

---

## Out of Scope

- Selective plugin installation (all-or-nothing)
- Plugin uninstallation or cleanup of removed plugins
- Version conflict detection between local and marketplace versions

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
