# Defect Report: Skill `model:` Frontmatter Causes Rate Limit Errors on Opus 4.6 1M

**Issues**: #111
**Date**: 2026-03-15
**Severity**: High
**Related Spec**: N/A

---

## Reproduction

1. Install the nmg-sdlc plugin in Claude Code
2. Set Claude Code model to Opus 4.6 with 1M context
3. Invoke any skill via `/skill-name` — get "API Error: Rate limit reached"
4. Ask Claude to do the same task without `/` — works fine

## Expected Behavior

Skills invoked via `/skill-name` should use the same model as the current session without triggering a model switch or separate rate limit bucket.

## Actual Behavior

Skills with a `model:` frontmatter field trigger a model switch when invoked via `/`. This switch hits a different rate limit bucket, causing "API Error: Rate limit reached" even when the user hasn't exhausted their session model's limits. The error only occurs with `/` invocation — natural invocation (asking Claude to do the task) works fine because no model switch occurs.

## Root Cause

The `model:` frontmatter field in SKILL.md overrides the session model when a skill is invoked via `/`. This model switch causes the API call to hit a different per-model rate limit bucket. A bug was fixed in Claude Code v2.1.70: "Fixed spurious 'Context limit reached' when invoking a skill with `model:` frontmatter on a 1M-context session" — confirming the interaction between skill model overrides and rate limit handling was actively buggy.

The fix is to remove the `model:` field entirely from all skills so they inherit the session model and stay in the same rate limit bucket.

---

## Acceptance Criteria

### AC1: No skill has a model field
**Given** any skill in the nmg-sdlc plugin
**When** the skill's SKILL.md frontmatter is examined
**Then** no skill has a `model:` field — all skills inherit the session model

### AC2: Slash-command-only skills have disable-model-invocation
**Given** skills only invoked via explicit slash commands (`/run-loop`, `/installing-openclaw-skill`, `/generating-openclaw-config`, `/run-retro`)
**When** the plugin is loaded
**Then** those skills have `disable-model-invocation: true`

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR1 | Remove `model:` field from all 12 SKILL.md files |
| FR2 | Add `disable-model-invocation: true` to `run-loop` |
| FR3 | Add `disable-model-invocation: true` to `installing-openclaw-skill` |
| FR4 | Add `disable-model-invocation: true` to `generating-openclaw-config` |
| FR5 | Add `disable-model-invocation: true` to `run-retro` |

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #111 | 2026-03-15 | Initial defect spec |
| #111 | 2026-03-15 | Updated: remove all `model:` fields to prevent model switch on `/` invocation |
