# Defect Report: /migrating-projects Adding Irrelevant Template Sections to Steering Docs

**Issue**: #66
**Date**: 2026-02-20
**Status**: Draft
**Author**: Claude
**Severity**: Medium
**Related Spec**: `.claude/specs/25-add-migration-skill/`

---

## Reproduction

### Steps to Reproduce

1. Have a project with steering docs created by `/setting-up-steering` that intentionally omit template sections irrelevant to the project (e.g., no "Database Standards" in `tech.md` for a project without a database)
2. Run `/migrating-projects`
3. Observe that the migration summary proposes adding irrelevant sections like "Database Standards", "API / Interface Standards", "Design Tokens / UI Standards"

### Environment

| Factor | Value |
|--------|-------|
| **Plugin version** | 2.12.8+ |
| **Skill** | `migrating-projects` |
| **Affected files** | Steering docs (`.claude/steering/*.md`) |
| **Configuration** | Any project where `/setting-up-steering` intentionally omitted sections |

### Frequency

Always — every run re-proposes the same irrelevant sections.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | The skill only proposes adding sections relevant to the project. Irrelevant sections are automatically filtered via codebase analysis, and the user can decline individual sections with those decisions persisted for future runs. |
| **Actual** | Every template section missing from the project file is proposed for addition, regardless of relevance. The skill uses a blind heading-diff (Step 3) with no relevance filtering. Running the skill repeatedly re-proposes the same irrelevant sections each time. |

### Error Output

```
No error — the skill completes successfully but proposes noisy, irrelevant additions:

## Migration Summary

### Steering Docs
- **tech.md** — Add 3 missing sections: "Database Standards", "API / Interface Standards", "Design Tokens / UI Standards"

All three sections contain placeholder content ([convention], [example]) that adds no value.
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Codebase-aware relevance filtering

**Given** a project with steering docs that omit template sections irrelevant to the project (e.g., no database, no REST API, no UI)
**When** `/migrating-projects` analyzes the steering docs
**Then** it infers section relevance by analyzing the codebase (e.g., checking for DB config/migrations, API route files, UI component directories) and excludes sections that have no codebase evidence of relevance

**Example**:
- Given: A CLI plugin project with no database, no REST API, and no UI components
- When: `/migrating-projects` diffs `tech.md` headings against the template
- Then: "Database Standards", "API / Interface Standards", and "Design Tokens / UI Standards" are excluded from the proposed changes

### AC2: Per-section user approval

**Given** the skill has filtered the missing sections to only those inferred as relevant
**When** it presents the migration summary to the user
**Then** the user can approve or decline each proposed section individually (not just all-or-nothing)

**Example**:
- Given: Two missing sections pass relevance filtering: "Product Principles" and "Brand Voice"
- When: The migration summary is presented
- Then: The user can approve "Product Principles" but decline "Brand Voice"

### AC3: Declined sections are persisted

**Given** the user declines a proposed section during migration
**When** `/migrating-projects` runs again in the future
**Then** the previously declined section is not re-proposed (stored in a project-level config file)

**Example**:
- Given: The user declined "Brand Voice" for `product.md` in a prior migration run
- When: `/migrating-projects` runs again
- Then: "Brand Voice" is not listed in the migration summary for `product.md`

### AC4: New template sections still detected

**Given** a new section is added to a steering template in a plugin update
**When** `/migrating-projects` runs after the update
**Then** the new section is evaluated for relevance and proposed if relevant — the persistence mechanism does not suppress genuinely new sections

**Example**:
- Given: A new "Observability Standards" section was added to the `tech.md` template, and the project has logging config files
- When: `/migrating-projects` runs
- Then: "Observability Standards" is proposed (not suppressed by prior declines of other sections)

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Add codebase analysis to infer relevance of missing template sections before proposing them — use heuristics (file glob patterns, directory existence, config file detection) to determine whether a section topic has evidence in the codebase | Must |
| FR2 | Present filtered missing sections individually for user approve/decline via `AskUserQuestion` with `multiSelect: true` | Must |
| FR3 | Persist declined sections in a project-level config file (`.claude/migration-exclusions.json`) so they are skipped on future runs | Must |
| FR4 | Distinguish between "user-declined" sections and "genuinely new template sections" so new additions aren't suppressed — store the section heading at time of decline, only suppress exact heading matches | Must |
| FR5 | When relevance is uncertain, default to proposing the section (conservative heuristic — let the user decide) | Should |

---

## Out of Scope

- Changes to the steering templates themselves
- Changes to `/setting-up-steering` behavior
- Auto-mode support for this skill (it's always interactive by design)
- Relevance filtering for spec files (only steering docs are affected)
- Refactoring beyond the minimal fix scope

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
