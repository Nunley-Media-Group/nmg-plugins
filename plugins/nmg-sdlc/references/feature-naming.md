# Feature Naming Convention

**Consumed by**: `draft-issue`, `start-issue`, `write-spec`, `verify-code`, `open-pr`.

Spec directories under `specs/` identify a feature by a human-readable kebab-case slug with a classifier prefix, not by issue number. Branch names still carry the issue number. This split lets a single spec span multiple issues (initial feature plus enhancements) while branches remain 1:1 with issues.

## Slug derivation

Derive the slug from the GitHub issue title:

1. Lowercase the title.
2. Replace spaces and any character outside `[a-z0-9-]` with a hyphen.
3. Collapse consecutive hyphens and strip leading/trailing hyphens.

Examples:

| Issue title | Slug |
|-------------|------|
| `Add dark mode toggle to settings` | `add-dark-mode-toggle-to-settings` |
| `Fix login crash on timeout` | `fix-login-crash-on-timeout` |

## Classifier prefix

The slug is prefixed with `feature-` or `bug-` based on issue labels:

- Any label equal to `bug` → `bug-{slug}` (singular `**Issue**:` frontmatter; never amended)
- Otherwise → `feature-{slug}` (plural `**Issues**:` frontmatter; amendable)

Examples: `feature-add-dark-mode-toggle-to-settings/`, `bug-fix-login-crash-on-timeout/`.

## Branch vs spec-directory mismatch

Branches follow GitHub's default `gh issue develop` format: `{issue#}-{slug}` (e.g., `71-add-dark-mode-toggle`). Spec directories omit the issue number. This mismatch is intentional — an enhancement issue that amends an existing feature spec produces a new branch but reuses the existing `feature-{slug}/` directory.

## Fallback discovery

When a consuming skill needs to locate the spec directory for an issue but cannot derive it from context (e.g., resuming work, ambiguous branch name), use this fallback chain in order:

1. `Glob` `specs/*/requirements.md` to enumerate candidates.
2. For each match, read the `**Issues**` frontmatter field (plural, comma-separated list). If the current issue number appears, that directory is the match.
3. If no `**Issues**` hit, fall back to the legacy singular `**Issue**` field on older specs.
4. If still no frontmatter match, try matching the issue number or branch-name keywords against the directory name itself (legacy `{issue#}-{slug}/` directories carry the number directly).

## Legacy `{issue#}-{slug}/` directories

The legacy convention `{issue#}-{slug}/` (e.g., `42-add-precipitation-overlay/`) predates the `feature-`/`bug-` split. It remains supported for read-through compatibility — skills must locate and consume legacy directories via the fallback above. New specs must never be created in the legacy format; `/upgrade-project` migrates legacy directories to the current convention.
