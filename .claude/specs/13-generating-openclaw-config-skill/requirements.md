# Requirements: Generating OpenClaw Config Skill

**Issue**: #13
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer setting up OpenClaw automation for a project,
**I want** a skill that generates a project-specific SDLC runner configuration file,
**So that** I can configure per-step timeouts, maxTurns, and skill references without manually writing JSON.

---

## Background

The `/generating-openclaw-config` skill generates an `sdlc-config.json` file tailored to the current project. Originally a repo-level skill that generated the old automation prompt, it was converted to generate the runner config format and then moved into the plugin at `plugins/nmg-sdlc/skills/` so it's available in all projects with nmg-sdlc installed. The generated config includes per-step maxTurns, timeouts, skill references, and an optional `discordChannelId` field. The skill also adds `sdlc-config.json` and `.claude/sdlc-state.json` to `.gitignore`.

---

## Acceptance Criteria

### AC1: Config File Is Generated for the Project

**Given** I invoke `/generating-openclaw-config` in a project
**When** the skill completes
**Then** an `sdlc-config.json` file is written to the project root with project-specific settings

### AC2: Config Includes Per-Step Settings

**Given** the config is generated
**When** I inspect `sdlc-config.json`
**Then** each SDLC step has `maxTurns`, `timeout`, and skill reference fields

### AC3: Gitignore Is Updated

**Given** the config is generated
**When** I inspect `.gitignore`
**Then** `sdlc-config.json` and `.claude/sdlc-state.json` are listed

### AC4: Skill Is Available in All nmg-sdlc Projects

**Given** nmg-sdlc is installed in a project
**When** I list available skills
**Then** `/generating-openclaw-config` appears as an available skill

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Generate `sdlc-config.json` with per-step maxTurns, timeouts, and skill references | Must | From template |
| FR2 | Add `sdlc-config.json` and `.claude/sdlc-state.json` to `.gitignore` | Must | Prevents committing local config |
| FR3 | Available as a plugin skill (not repo-level) for all nmg-sdlc projects | Must | In `plugins/nmg-sdlc/skills/` |
| FR4 | Optional `discordChannelId` field in generated config | Must | For Discord integration |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Config generation is instant (template substitution) |
| **Security** | No secrets in generated config file |
| **Reliability** | Idempotent — safe to re-run |

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
- [x] Plugin scaffold (#2)
- [x] OpenClaw SDLC orchestration (#12) for config format

### External Dependencies
- [x] `git` for project root detection

---

## Out of Scope

- Config validation or schema enforcement
- Interactive config editing or wizard
- Multi-environment config profiles

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
