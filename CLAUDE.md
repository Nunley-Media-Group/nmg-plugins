# CLAUDE.md

## Project Overview

Claude Code plugin marketplace repository for Nunley Media Group. Currently lists one plugin: [`nmg-sdlc`](https://github.com/Nunley-Media-Group/nmg-sdlc), hosted in its own repository and referenced from `.claude-plugin/marketplace.json` as a GitHub source.

## Repository Structure

```
.claude-plugin/marketplace.json   — Marketplace index (lists plugins and their external repos)
README.md                         — Public docs: how to add the marketplace, plugin pointers
```

## Maintaining the Marketplace

When adding, removing, or version-bumping a plugin:

1. Edit `.claude-plugin/marketplace.json`:
   - Add a new entry to the `plugins` array, or remove an existing one
   - For external plugins, use a `source` object: `{"source": "github", "repo": "owner/name"}`
   - Keep the `version` field in sync with the plugin's own `plugin.json` version
2. Update `README.md` to list the plugin and its source repo
3. Open a PR — there is no marketplace-level CI yet

Plugin development (skills, agents, tests, releases) happens entirely in each plugin's own repo. This repo is intentionally thin — it only points users at the plugins that make up the marketplace.
