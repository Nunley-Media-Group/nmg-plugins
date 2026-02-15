# Requirements: Installing OpenClaw Skill

**Issue**: #14
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer using OpenClaw for SDLC automation,
**I want** a skill that installs or updates the OpenClaw running-sdlc skill and restarts the gateway,
**So that** I can deploy the latest orchestration skill to my local OpenClaw instance without manual file copying.

---

## Background

The `/installing-openclaw-skill` skill copies the `running-sdlc` skill from the repository's `openclaw/skills/running-sdlc/` directory to `~/.openclaw/skills/running-sdlc/` and restarts the OpenClaw gateway. The standalone installer script (`openclaw/scripts/install-openclaw-skill.sh`) supports both copy and `--link` mode for development. The skill was enhanced to automatically run a patch script that fixes a known `openclaw message send` CLI hang bug where the Discord.js WebSocket never closes after message delivery.

---

## Acceptance Criteria

### AC1: Skill Files Are Installed Locally

**Given** I invoke `/installing-openclaw-skill`
**When** the skill completes
**Then** the `running-sdlc` skill is copied to `~/.openclaw/skills/running-sdlc/`

### AC2: Gateway Is Restarted

**Given** skill files are installed
**When** installation completes
**Then** the OpenClaw gateway is restarted via `openclaw gateway restart`

### AC3: CLI Hang Patch Is Applied

**Given** the openclaw CLI has the message send hang bug
**When** the skill runs
**Then** it automatically runs the patch script to fix the hang issue

### AC4: Standalone Installer Supports Link Mode

**Given** I run `install-openclaw-skill.sh --link`
**When** the script completes
**Then** the skill directory is symlinked instead of copied for development use

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Copy `running-sdlc` skill to `~/.openclaw/skills/running-sdlc/` | Must | SKILL.md, runner, config |
| FR2 | Restart OpenClaw gateway after installation | Must | Via `openclaw gateway restart` |
| FR3 | Auto-run CLI hang patch script | Must | Idempotent patch |
| FR4 | Standalone installer script with `--link` mode support | Must | `install-openclaw-skill.sh` |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | File copy completes instantly |
| **Security** | Sources from authenticated marketplace clone only |
| **Reliability** | Non-fatal gateway restart failure (warn, don't fail) |

---

## Dependencies

### Internal Dependencies
- [x] Plugin scaffold (#2)
- [x] OpenClaw SDLC orchestration (#12) for running-sdlc skill

### External Dependencies
- [x] `openclaw` CLI for gateway restart
- [x] `nvm` for Node.js environment
- [x] `node` for patch script execution

---

## Out of Scope

- Remote skill installation from a registry
- Skill version management or rollback
- OpenClaw gateway health checks after restart

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
