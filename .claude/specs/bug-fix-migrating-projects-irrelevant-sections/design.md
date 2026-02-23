# Root Cause Analysis: /migrating-projects Adding Irrelevant Template Sections

**Issue**: #66
**Date**: 2026-02-20
**Status**: Draft
**Author**: Claude

---

## Root Cause

The `migrating-projects` skill's Step 3 (Analyze Steering Docs) performs a blind heading-diff: it extracts all `## ` headings from the template, compares them against the project file's headings, and treats every missing heading as a migration candidate. There is no mechanism to assess whether a template section is relevant to the project.

When `/setting-up-steering` creates steering docs, it pre-fills what's discoverable from the codebase and intentionally omits irrelevant sections (e.g., "Database Standards" for a project with no database). But `/migrating-projects` later interprets those intentional omissions as gaps, proposing placeholder content (`[convention]`, `[example]`) that adds noise without value.

The problem is compounded by the lack of persistence — if a user manually dismisses the migration summary (by selecting "No, cancel migration"), the same irrelevant sections are re-proposed on every subsequent run because there's no record of prior decisions.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | Step 3 (lines ~79–96) | Steering doc heading-diff — no relevance filtering |
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | Step 9 (lines ~189–231) | Presents all-or-nothing approval with no per-section granularity |

### Triggering Conditions

- The project has steering docs created by `/setting-up-steering` that intentionally omit template sections irrelevant to the project (e.g., no database, no REST API, no UI)
- `/migrating-projects` is run after a plugin update (or any time)
- Template files contain sections with placeholder content (e.g., `## Database Standards` with `[convention]`, `[example]` placeholders)

---

## Fix Strategy

### Approach

Add three capabilities to the `migrating-projects` skill:

1. **Relevance filtering (Step 3 modification)**: After identifying missing headings via the heading-diff, apply a codebase relevance check before including them in the migration proposal. Define a heuristic table mapping section heading keywords to glob patterns that indicate codebase evidence. If a section matches a keyword and no evidence is found, exclude it. Unknown sections (no keyword match) are conservatively included.

2. **Per-section approval (Step 9 modification)**: Replace the binary "Apply all changes / Cancel" question with a `multiSelect: true` `AskUserQuestion` that lists each proposed section individually, letting the user approve or decline per-section.

3. **Exclusion persistence (new Step 3b + Step 9 modification)**: Before proposing sections, load `.claude/migration-exclusions.json` and skip any previously declined sections. After the user makes selections, persist newly declined sections to this file. The file stores `{ "excludedSections": { "filename.md": ["Section Heading", ...] } }`. Only exact heading matches are suppressed — new template sections added in future updates are not affected.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | Add relevance heuristic table after Step 3 instructions | Provides codebase-aware filtering before proposing sections |
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | Add Step 3b: load `.claude/migration-exclusions.json` and filter already-declined sections | Prevents re-proposing sections the user previously declined |
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | Modify Step 9: use `multiSelect: true` with individual sections as options | Enables per-section approval instead of all-or-nothing |
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | Modify Step 10: after applying approved sections, persist declined sections to `.claude/migration-exclusions.json` | Stores decline decisions for future runs |

### Relevance Heuristic Table

The heuristic table maps section heading keywords to glob patterns. This is defined in the skill instructions so Claude can evaluate at runtime:

| Section Heading Pattern | Codebase Evidence (Glob Patterns) |
|------------------------|----------------------------------|
| `Database` | `**/migrations/**`, `**/schema.*`, `**/*database*`, `**/*prisma*`, `**/knexfile*`, `**/sequelize*`, `**/typeorm*`, `**/drizzle*`, `**/*.sql`, `**/models/**` (with ORM imports) |
| `API / Interface Standards` | `**/routes/**`, `**/controllers/**`, `**/api/**`, `**/endpoints/**`, `**/*router*`, `**/swagger*`, `**/openapi*` |
| `Design Tokens` or `UI Standards` | `**/components/**`, `**/*.css`, `**/*.scss`, `**/*.styled.*`, `**/theme*`, `**/tokens*`, `**/*.tsx`, `**/*.vue`, `**/*.svelte` |

**Conservative default:** If a missing section heading does not match any keyword in the table, it is included in the proposal (let the user decide). The table is a filter for known-irrelevant sections, not a whitelist.

### Exclusion File Schema

```json
{
  "excludedSections": {
    "tech.md": ["Database Standards", "API / Interface Standards"],
    "structure.md": ["Design Tokens / UI Standards (if applicable)"]
  }
}
```

- Keys are steering doc filenames (not full paths)
- Values are arrays of exact `## ` heading text (without the `## ` prefix)
- Only sections explicitly declined by the user are stored
- Sections removed from the template in a future update can be cleaned up, but stale entries are harmless

### Blast Radius

- **Direct impact**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` — the only file modified
- **Indirect impact**: Any project that runs `/migrating-projects` will see fewer irrelevant proposals and gain the `.claude/migration-exclusions.json` file if sections are declined
- **Risk level**: Low — the skill's self-updating nature means existing behavior for sections that pass filtering is unchanged; the changes are additive (new filtering and persistence layers)

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Relevant sections incorrectly filtered out | Low | Conservative heuristic — unknown sections always proposed; glob patterns are broad enough to catch common project structures |
| New template sections suppressed by stale exclusions | Low | Exclusion is by exact heading match; new sections won't match prior declines unless heading text is reused |
| Per-section multiSelect confuses users accustomed to all-or-nothing | Low | Migration summary still displays the full list upfront; the multiSelect replaces only the approval mechanism |
| `.claude/migration-exclusions.json` conflicts with other tools | Very Low | File is namespaced to migration concerns; stored in `.claude/` alongside other project config |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Template annotations | Add `<!-- relevance: database -->` markers to templates so the skill reads hints | Requires coordinating changes across templates and the skill; violates the skill's "self-updating" principle where it reads templates as-is |
| Project-type declaration | Add a `projectType` field to steering config (e.g., "cli", "web", "api") | Over-engineered for this fix; requires `/setting-up-steering` changes; doesn't handle edge cases where a project has partial relevance |
| Relevance filtering only (no persistence) | Filter by heuristics but don't store decline decisions | Doesn't satisfy AC3; conservative heuristic may still propose some irrelevant sections that the user must repeatedly dismiss |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
