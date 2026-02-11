# CLAUDE.md

## Project Overview

Claude Code plugin marketplace repository for Nunley Media Group. Contains the `nmg-sdlc` plugin (BDD spec-driven development toolkit).

## Repository Structure

```
.claude-plugin/marketplace.json   — Marketplace index (plugin registry)
plugins/nmg-sdlc/                 — The nmg-sdlc plugin
  .claude-plugin/plugin.json      — Plugin manifest
  skills/                         — Skill definitions (one directory per skill)
  hooks/                          — PostToolUse hooks
CHANGELOG.md                      — Keep an [Unreleased] section for pending changes
README.md                         — Public docs: workflow, installation, skills reference
```

## Bumping Plugin Versions

When bumping a plugin version, you MUST update BOTH files — the marketplace index is what Claude Code reads when checking for updates:

1. `plugins/nmg-sdlc/.claude-plugin/plugin.json` → `"version"` field
2. `.claude-plugin/marketplace.json` → `"version"` field inside the plugin's entry in the `"plugins"` array

The `metadata.version` in `marketplace.json` is the marketplace collection version, NOT any individual plugin version. Only bump it if the marketplace structure itself changes.

Also update `CHANGELOG.md` — add entries under `[Unreleased]`, then move to a versioned heading on release.

## Commit Style

Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
