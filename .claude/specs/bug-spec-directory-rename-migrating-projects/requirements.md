# Defect Report: Missing Spec Directory Rename in /migrating-projects

**Issue**: #83
**Date**: 2026-02-24
**Status**: Draft
**Author**: Claude (spec agent)
**Severity**: Medium
**Related Spec**: `.claude/specs/feature-migration-skill/`

---

## Reproduction

### Steps to Reproduce

1. Have existing spec directories with legacy `{issue#}-{slug}/` naming (e.g., `42-add-dark-mode/`, `15-fix-login/`)
2. Run `/migrating-projects`
3. Observe that the skill does not detect or propose renaming these directories to `feature-{slug}/` or `bug-{slug}/`
4. Directories remain with old naming convention

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (macOS, Linux, Windows) |
| **Version / Commit** | nmg-sdlc v2.17.0 |
| **Browser / Runtime** | Claude Code CLI |
| **Configuration** | Any project with legacy-named spec directories |

### Frequency

Always — the rename instructions in Steps 4b–4e exist in the SKILL.md (added by #72) but are insufficiently explicit for Claude to execute reliably, and auto-mode incorrectly classifies simple renames as destructive operations.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | `/migrating-projects` detects legacy `{issue#}-{slug}/` spec directories and renames them to `feature-{slug}/` or `bug-{slug}/` based on spec type, with interactive confirmation in manual mode and automatic application for non-destructive solo renames in auto-mode |
| **Actual** | Steps 4b–4e instructions lack explicit tool usage for directory operations (no `git mv` specified), auto-mode classifies all rename operations as destructive (skipping them), and the clustering algorithm at Step 4c does not clearly separate solo renames from multi-spec consolidation |

### Error Output

No error — the skill either silently skips the rename step or fails to execute it because the instructions don't specify which tool to use for directory operations. Legacy directories remain with their old naming convention.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Detect Legacy Spec Directory Names

**Given** spec directories exist with legacy `{issue#}-{slug}/` naming convention (e.g., `42-add-dark-mode/`, `15-fix-login/`)
**When** `/migrating-projects` is invoked
**Then** the skill detects these directories by matching the `{digits}-{slug}` pattern against all `.claude/specs/*/` directory names
**And** classifies each as a feature or bug rename candidate based on the first `# ` heading of `requirements.md` (`# Requirements:` → `feature-`, `# Defect Report:` → `bug-`)
**And** only directories under `.claude/specs/` are considered — not arbitrary directories elsewhere in the project

### AC2: Interactive Rename Confirmation

**Given** legacy spec directories are detected
**And** `.claude/auto-mode` does NOT exist
**When** the skill presents rename proposals
**Then** each rename is presented to the user via `AskUserQuestion` with options to approve or skip
**And** approved renames execute using `git mv` to rename the directory
**And** frontmatter in feature spec files is updated (`**Issue**: #N` → `**Issues**: #N`)
**And** bug spec frontmatter retains the singular `**Issue**: #N` field

### AC3: Auto-Mode Applies Non-Destructive Renames

**Given** legacy spec directories are detected
**And** `.claude/auto-mode` exists
**When** `/migrating-projects` is invoked
**Then** solo directory renames (single directory → `feature-{slug}/` or `bug-{slug}/`) are applied automatically as non-destructive operations
**And** multi-spec consolidation (merging multiple directories) remains classified as destructive and is skipped with a "Skipped Operations" entry
**And** the auto-mode section of the SKILL.md explicitly distinguishes solo renames (non-destructive) from consolidation (destructive)

### AC4: Cross-Reference Updates After Rename

**Given** a legacy spec directory `{issue#}-{slug}/` has been renamed to `feature-{slug}/` or `bug-{slug}/`
**And** other defect specs have `**Related Spec**` fields pointing to the old directory path
**When** the rename operation completes
**Then** `Grep` is used to discover all `**Related Spec**` fields referencing the old path across all spec directories
**And** `Edit` is used to update each discovered reference to point to the new path
**And** chain resolution follows defect-to-defect `Related Spec` links (with a visited set for cycle detection) when resolving indirect references

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Detect legacy `{issue#}-{slug}/` spec directory naming by matching the `{digits}-{slug}` pattern against `.claude/specs/*/` directories only | Must |
| FR2 | Determine correct prefix (`feature-` or `bug-`) from the spec's first `# ` heading (`# Requirements:` → feature, `# Defect Report:` → bug), consistent with existing Step 4c logic | Must |
| FR3 | Execute directory renames using `git mv` (within the skill's `Bash(git:*)` allowed tools) with per-directory user confirmation in interactive mode | Must |
| FR4 | Update `**Related Spec**` cross-references in other spec files after rename, using `Grep` to discover and `Edit` to update, with chain resolution for defect-to-defect traversal | Must |
| FR5 | Reclassify solo directory renames as non-destructive in auto-mode (auto-applied), while keeping multi-spec consolidation as destructive (skipped) | Should |

---

## Out of Scope

- Spec consolidation (merging multiple specs into one) — already handled by #72
- Changing spec file content during rename (only directory name, frontmatter, and cross-references change)
- Renaming directories that already use the `feature-` or `bug-` prefix
- Introducing new tool permissions beyond the skill's existing `Bash(git:*)` allowance

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #83 | 2026-02-24 | Initial defect spec |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC3 preserves consolidation as destructive)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
