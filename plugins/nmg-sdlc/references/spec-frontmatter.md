# Spec Frontmatter

**Consumed by**: `write-spec`, `verify-code`, `run-retro`.

Every spec file (`requirements.md`, `design.md`, `tasks.md`) begins with a bolded-list frontmatter block — not YAML. The block is human-readable prose, not a machine contract, but consumer skills grep specific fields and the field names must be exact.

## Fields

| Field | Format | Purpose |
|-------|--------|---------|
| `**Issues**` | `**Issues**: #N` or `**Issues**: #N, #M, #K` — plural, comma-separated | Lists every issue that contributed to this spec. Used by `/write-spec`'s parent-link resolution, `/open-pr`'s spec lookup, and `/run-retro`'s defect-origin trace. |
| `**Date**` | `**Date**: YYYY-MM-DD` | Most recent amendment date (ISO 8601). Initial creation date on first write; overwritten when the spec is amended. |
| `**Status**` | `**Status**: Draft` / `Approved` / `Amended` | Tracks the spec's lifecycle. |
| `**Author**` | `**Author**: Full Name` | Original author. |
| `**Related Spec**` | `**Related Spec**: specs/feature-{slug}/` (defect specs only) | Points a defect spec at the feature spec it relates to. Feature specs omit this field. Value is the directory path relative to the repo root, trailing slash included. `N/A` is a permitted value when no feature spec applies. |

Feature specs use `**Issues**` (plural). Defect specs use singular `**Issue**` (see "Defect-spec frontmatter" below). Both also carry `**Date**`, `**Status**`, `**Author**`.

## Plural `**Issues**` vs legacy singular `**Issue**`

Feature specs track multiple contributing issues because the same feature can accumulate enhancements over time. The field is always plural on new feature specs — even when only one issue has contributed so far (`**Issues**: #42`).

The singular `**Issue**: #N` form is the **legacy** frontmatter shape used before the feature/bug directory split. It remains valid **only** on defect specs (which are per-issue and never amended). Feature specs that still carry singular `**Issue**` are from before the convention change and should be migrated — `/upgrade-project` Step 4f does this migration.

Consumers that look up specs by issue number should fall back from `**Issues**` to singular `**Issue**` so un-upgraded projects still resolve. `references/feature-naming.md` → "Fallback discovery" documents the chain.

## Amendment rules

Feature specs are amendable when a subsequent issue contributes to the same feature. The `/write-spec` amendment path drives the updates:

1. Append the new issue number to `**Issues**` (comma-separated).
2. Overwrite `**Date**` with today's date (ISO 8601).
3. Set `**Status**: Amended` (unless the spec is still Draft).
4. Append a new row to the `## Change History` table (see below).
5. Append new ACs / FRs / design sections (never rewrite existing ones).

Defect specs are not amended. A second occurrence opens a new defect spec (or re-handles the existing one via a new ticket); history does not accumulate across reports.

## `## Change History` table

Every spec file ends with a `## Change History` section. Amendments append rows; they do not rewrite prior rows. Schema:

```markdown
## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #42 | 2026-03-01 | Initial feature spec |
| #71 | 2026-04-12 | Added dark-mode toggle to settings screen |
```

Rules:
- One row per contributing issue.
- `Issue` is the issue number (not the spec directory or branch name).
- `Date` is the commit date of the amendment in ISO 8601.
- `Summary` is a one-line change description — keep it short; the full rationale belongs in the spec body.
- For the **initial** row, use `Initial feature spec` (feature) or `Initial defect report` (defect) as the summary.

The Change History is the audit log. `/run-retro` reads it when tracing defect-derived learnings back to the feature spec that introduced the underlying code.

## Defect-spec frontmatter

Defect specs use a reduced schema:

```markdown
# Defect Report: {title}

**Issue**: #N
**Date**: YYYY-MM-DD
**Status**: Investigating | Fixed | Closed
**Author**: Full Name
**Related Spec**: specs/feature-{slug}/
```

Key differences from feature specs:

- Singular `**Issue**` (defect specs are per-issue; never amended).
- `**Related Spec**` is required and points to the feature spec that introduced the affected code, or `N/A` when no feature spec applies. `/upgrade-project` Step 4a validates these links and resolves defect-to-defect chains to their root feature spec.
- `**Status**` values differ (`Investigating` / `Fixed` / `Closed` vs. `Draft` / `Approved` / `Amended`).
