# Versioning

**Consumed by**: `open-pr`, `draft-issue` (the `VERSION`-file read during Step 3 milestone assignment).

## Single source of truth

The `VERSION` file at the project root holds the current semver string (`X.Y.Z`). Stack-specific files are derived from it. When a skill needs the current version, it reads `VERSION`.

If `VERSION` is absent or does not parse as semver, `/open-pr` skips the version-bump steps entirely and warns in the output; `/draft-issue` skips milestone assignment (omits `--milestone` from `gh issue create`).

## Bump classification matrix

Version bumps are classified from the GitHub issue's labels. The matrix lives in `steering/tech.md` under `## Versioning` → `### Version Bump Classification` — that's the authoritative source. Skills read the matrix at runtime and do not hardcode the rows.

Matching rules (not captured in the table itself):
- Case-insensitive label comparison; backticks are stripped before matching.
- First matching row wins.
- No matching row → default to `minor`.

## Major bumps are manual-only

Major-version bumps are not triggered by labels, milestones, or breaking-change annotations. A developer opts in explicitly on the `/open-pr` invocation:

```
/open-pr #N --major
```

The `--major` flag forces bump type `major` (`X.Y.Z → (X+1).0.0`) regardless of the classified type. When the flag is absent, `/open-pr` can only produce a patch or minor bump.

**Unattended-mode escalation.** When `.claude/unattended-mode` exists AND `--major` is present, `/open-pr` prints:

```
ESCALATION: --major flag requires human confirmation — unattended mode cannot apply a major version bump
```

…and exits non-zero without reading or writing any version file. A major-version bump is a deliberate release decision that a headless runner cannot make on a human's behalf.

## Dual-file update

Every version bump touches **both** of the following:

1. `plugins/nmg-sdlc/.claude-plugin/plugin.json` — plugin manifest `version`
2. `.claude-plugin/marketplace.json` — the plugin's entry `version` in the `plugins` array (not `metadata.version`, which is the collection version and remains untouched by a plugin bump)

Updating only one of the two leaves the marketplace index stale. The architectural invariant is documented in `steering/structure.md` under "Version and Release Contracts".

Projects may declare additional stack-specific files in `steering/tech.md` under `## Versioning` (e.g., `package.json`, `Cargo.toml`, plain-text files). `/open-pr` reads that table and updates every listed file in lock-step with `VERSION`.

## CHANGELOG conventions

`CHANGELOG.md` follows the [Keep a Changelog](https://keepachangelog.com/) format with an always-present `## [Unreleased]` section. The bump workflow moves items from `[Unreleased]` under a new version heading dated with the bump day:

```
## [Unreleased]

## [1.53.0] - 2026-04-19

### Added
- …items moved from [Unreleased]
```

### Breaking changes

Breaking changes still use a **minor** bump — the bump type is classification-driven, not severity-driven. A `### Changed (BREAKING)` sub-section does not override the classified bump type; communicate the breaking nature via the CHANGELOG conventions spelled out in `steering/tech.md` → Versioning → Breaking changes (sub-section headings, `**BREAKING CHANGE:**` bullet prefix, `### Migration Notes`).

## Epic-child bump downgrade

For epic children (issues linked as `Depends on: #{epic}` under an issue labeled `epic`), `/open-pr` downgrades the bump when at least one sibling child issue is still incomplete. The rule:

- Every sibling complete (merged) → classification stands (`siblingClass = 'final'`).
- At least one sibling incomplete → force `bump_type = 'patch'` (`siblingClass = 'intermediate'`).
- Not an epic child → classification stands (`siblingClass = 'non-epic'`).

The downgrade prevents partial epic deliveries from advancing the minor version mid-rollout. The PR body and CHANGELOG entry are annotated with the sibling class so the release notes reflect the partial delivery.
