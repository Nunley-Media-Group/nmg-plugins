# Defect Report: /migrate-project Lacks Auto-Mode Support

**Issue**: #81
**Date**: 2026-02-23
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `specs/feature-migrate-project-skill/`

---

## Reproduction

### Steps to Reproduce

1. Set up an SDLC runner configured to run the full SDLC cycle
2. Ensure `.claude/unattended-mode` exists in the project directory
3. Runner invokes `/migrate-project` during a headless session
4. Skill calls `AskUserQuestion` for every consolidation/migration decision (Steps 4d, 9 Part A, 9 Part B)
5. Session hangs indefinitely — no user is present to answer

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (macOS, Linux, Windows) |
| **Version / Commit** | nmg-sdlc v1.26.0 |
| **Browser / Runtime** | Claude Code CLI via SDLC runner's `claude -p` subprocess |
| **Configuration** | `.claude/unattended-mode` present; headless execution |

### Frequency

Always — every invocation in a headless unattended-mode session hangs.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | When `.claude/unattended-mode` exists, `/migrate-project` should apply non-destructive changes automatically (frontmatter migration, defect cross-ref updates, spec section additions, config key additions, changelog/version fixes) and skip destructive operations (spec consolidation/merges, directory renames/deletes) with a summary of what was skipped and why |
| **Actual** | The skill always calls `AskUserQuestion` regardless of `.claude/unattended-mode`, causing headless sessions to hang indefinitely at the first interactive prompt |

### Error Output

```
No error output — the session hangs waiting for user input that never arrives.
The SDLC runner eventually times out the step.
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Non-Destructive Changes Apply Automatically in Auto-Mode

**Given** `.claude/unattended-mode` exists in the project directory
**And** `/migrate-project` detects non-destructive changes (frontmatter migration, spec section additions, config key additions, Related Spec corrections, changelog/version fixes)
**When** the skill reaches the approval gate (Step 9)
**Then** all non-destructive changes are applied without calling `AskUserQuestion`
**And** for steering doc sections, all proposed sections are applied (no per-section selection in unattended-mode)

**Example**:
- Given: `.claude/unattended-mode` exists; `tech.md` is missing a `## Testing Standards` section; a feature spec has singular `**Issue**` frontmatter
- When: `/migrate-project` runs
- Then: Both changes are applied automatically without any interactive prompts

### AC2: Destructive Operations Skipped in Auto-Mode

**Given** `.claude/unattended-mode` exists in the project directory
**And** `/migrate-project` detects destructive operations (spec directory consolidation, legacy directory renames/deletes from Steps 4b–4e)
**When** the skill reaches the consolidation approval gate (Step 4d) or the overall approval gate (Step 9)
**Then** those operations are skipped entirely
**And** the skill outputs a human-readable summary of what was skipped and why (e.g., "Skipped consolidation of 42-add-dark-mode/ + 71-dark-mode-toggle/ — destructive operations require interactive approval")

### AC3: Machine-Readable Skipped Operations List

**Given** `/migrate-project` runs in unattended-mode and skips destructive operations
**When** the skill completes
**Then** the output includes a machine-readable list of skipped operations in a structured format (e.g., markdown table or code block with one operation per line)
**And** each entry includes the operation type, affected paths, and reason for skipping
**And** the runner can parse this to surface skipped operations in its status log

### AC4: Interactive Mode Behavior Unchanged

**Given** `.claude/unattended-mode` does NOT exist in the project directory
**When** `/migrate-project` is invoked
**Then** all existing interactive behavior is preserved unchanged — `AskUserQuestion` is called at every approval gate as before
**And** no auto-approval logic is triggered

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Check for `.claude/unattended-mode` existence at skill start and set unattended-mode flag for the session | Must |
| FR2 | In unattended-mode, apply all non-destructive changes (frontmatter updates, section merges, config key additions, Related Spec corrections, changelog/version fixes) without calling `AskUserQuestion` | Must |
| FR3 | In unattended-mode, skip all destructive operations (spec directory consolidation, renames, deletes from Steps 4b–4e) with a human-readable summary of what was skipped | Must |
| FR4 | In unattended-mode, output a machine-readable list of skipped destructive operations at skill completion | Should |
| FR5 | Preserve all existing interactive-mode behavior when `.claude/unattended-mode` is absent | Must |
| FR6 | In unattended-mode, apply all proposed steering doc sections (equivalent to selecting all in Part A) rather than skipping them | Must |
| FR7 | In unattended-mode, skip persisting declined sections to `.claude/migration-exclusions.json` (nothing is declined in unattended-mode) | Should |

---

## Out of Scope

- Changing interactive-mode behavior (existing prompts remain when unattended-mode is absent)
- Adding new migration capabilities (this is purely about unattended-mode support)
- Changing the classification of which operations are destructive vs non-destructive
- Making spec consolidation work in unattended-mode (it is intentionally destructive and skipped)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #81 | 2026-02-23 | Initial defect spec |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC4)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
