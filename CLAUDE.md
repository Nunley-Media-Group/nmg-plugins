# CLAUDE.md

## Project Overview

Claude Code plugin marketplace repository for Nunley Media Group. Each listed plugin lives in its own GitHub repository and is referenced from `.claude-plugin/marketplace.json`. Currently listed:

- [`nmg-sdlc`](https://github.com/Nunley-Media-Group/nmg-sdlc) — BDD spec-driven development workflow (issues, specs, verification, PRs).
- [`obsidian-memory`](https://github.com/Nunley-Media-Group/obsidian-memory) — Cross-session memory backed by an Obsidian vault.

## Repository Structure

```
.claude-plugin/marketplace.json   — Marketplace index (lists plugins and their external repos)
README.md                         — Public docs: how to add the marketplace, plugin pointers
```

## Maintaining the Marketplace

When adding or removing a plugin:

1. Edit `.claude-plugin/marketplace.json`:
   - Add a new entry to the `plugins` array, or remove an existing one
   - For external plugins, use a `source` object: `{"source": "github", "repo": "owner/name"}`
   - Do NOT add a `version` field to plugin entries — Claude Code reads the version from the plugin's own `plugin.json` at install time. Duplicating it here just creates drift.
2. Update `README.md` to list the plugin and its source repo
3. Open a PR — there is no marketplace-level CI yet

Version bumps to a plugin happen entirely in that plugin's own repo; this marketplace file does not need to change.

Plugin development (skills, agents, tests, releases) happens entirely in each plugin's own repo. This repo is intentionally thin — it only points users at the plugins that make up the marketplace.
