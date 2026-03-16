# Defect Report: Skills Force Opus Model, Causing API Rate Limits on Opus 4.6 1M

**Issues**: #111
**Date**: 2026-03-15
**Severity**: High
**Related Spec**: N/A

---

## Reproduction

1. Install the nmg-sdlc plugin (v4.0.0) in Claude Code
2. Set Claude Code model to Opus 4.6 with 1M context
3. Use any SDLC skill workflow (e.g., `/writing-specs`, `/implementing-specs`)
4. Observe API rate limit errors during normal usage

## Expected Behavior

Skills should not force Opus model usage beyond what the user's session provides. Skills only invoked via explicit slash commands should not contribute to always-in-context token overhead.

## Actual Behavior

- 5 skills hardcode `model: opus` in SKILL.md frontmatter, forcing Opus usage regardless of session model
- Only 3 of 12 skills have `disable-model-invocation: true`, meaning 9 skill descriptions are included in every API call
- Users on Opus 4.6 1M (which has tight rate limits) hit rate limit errors during normal workflows

## Root Cause

The `model: opus` frontmatter field was set on skills during initial development when Opus rate limits were more generous. The Opus 4.6 1M tier has significantly tighter rate limits, and forcing Opus on 5 skills unnecessarily consumes that quota. Additionally, skills that are only invoked via explicit slash commands (like `/running-sdlc-loop`, `/installing-openclaw-skill`) were missing `disable-model-invocation: true`, causing their descriptions to be included in the available skills list on every turn.

---

## Acceptance Criteria

### AC1: No skills force Opus model
**Given** any skill in the nmg-sdlc plugin
**When** the skill's SKILL.md frontmatter is examined
**Then** no skill has `model: opus` — skills either inherit the session model (no `model` field) or use `model: sonnet`

### AC2: Slash-command-only skills have disable-model-invocation
**Given** skills that are only ever invoked via explicit slash commands (`/running-sdlc-loop`, `/installing-openclaw-skill`, `/generating-openclaw-config`, `/running-retrospectives`)
**When** the plugin is loaded
**Then** those skills have `disable-model-invocation: true` and do not appear in the available skills list

### AC3: Session-model inheritance for complex skills
**Given** `implementing-specs` and `writing-specs` (skills that benefit from the best available model)
**When** invoked by the user
**Then** they inherit the user's session model (no `model` field in frontmatter) rather than forcing a specific model

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR1 | Remove `model: opus` from `implementing-specs` — inherit session model |
| FR2 | Remove `model: opus` from `writing-specs` — inherit session model |
| FR3 | Change `model: opus` to `model: sonnet` on `migrating-projects` |
| FR4 | Change `model: opus` to `model: sonnet` on `running-retrospectives` |
| FR5 | Change `model: opus` to `model: sonnet` on `setting-up-steering` |
| FR6 | Add `disable-model-invocation: true` to `running-sdlc-loop` |
| FR7 | Add `disable-model-invocation: true` to `installing-openclaw-skill` |
| FR8 | Add `disable-model-invocation: true` to `generating-openclaw-config` |
| FR9 | Add `disable-model-invocation: true` to `running-retrospectives` |

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #111 | 2026-03-15 | Initial defect spec |
