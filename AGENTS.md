# AGENTS.md

## Project Overview

Plugin marketplace repository for Nunley Media Group. Each listed plugin lives in its own GitHub repository and is referenced from host-specific catalogs. No plugins are currently listed.

## Repository Structure

```
.agents/plugins/marketplace.json  — Codex marketplace index (Git-backed plugin entries)
.omp-plugin/marketplace.json      — Preferred Oh My Pi marketplace catalog
.claude-plugin/marketplace.json   — Claude-compatible index consumed by Pi and as OMP fallback
README.md                         — Public docs: how to add the marketplace, plugin pointers
```

## Maintaining the Marketplace

When adding or removing a plugin:

1. Edit `.agents/plugins/marketplace.json`:
   - Add a new entry to the `plugins` array, or remove an existing one
   - For a plugin repo whose `.codex-plugin/plugin.json` lives at the repo root, use:
     `{"source": {"source": "url", "url": "https://github.com/owner/name.git", "ref": "main"}}`
   - If the plugin lives in a subdirectory, use `source: "git-subdir"` with a `path`
   - Include `policy.installation`, `policy.authentication`, and `category` on every entry
2. Keep the matching entries in `.omp-plugin/marketplace.json` and `.claude-plugin/marketplace.json` synchronized for Oh My Pi and Pi compatibility.
3. Run `node scripts/validate-marketplace.mjs`.
4. Update `README.md` to list the plugin and its source repo.
5. Open a PR.

Version bumps happen entirely in each plugin's own repo; this marketplace file only changes when a plugin is added, removed, renamed, or repointed to a different ref or URL.

Plugin development (skills, agents, tests, releases) happens entirely in each plugin's own repo. This repo is intentionally thin — it only points users at the plugins that make up the marketplace.
