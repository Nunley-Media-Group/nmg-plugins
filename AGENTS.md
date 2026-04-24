# AGENTS.md

## Project Overview

Codex plugin marketplace repository for Nunley Media Group. Each listed plugin lives in its own GitHub repository and is referenced from `.agents/plugins/marketplace.json` using Git-backed marketplace entries. Currently listed:

- [`nmg-sdlc`](https://github.com/Nunley-Media-Group/nmg-sdlc) — BDD spec-driven development workflow (issues, specs, verification, PRs).

## Repository Structure

```
.agents/plugins/marketplace.json  — Codex marketplace index (Git-backed plugin entries)
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
2. Update `README.md` to list the plugin and its source repo
3. Open a PR — there is no marketplace-level CI yet

Version bumps happen entirely in each plugin's own repo; this marketplace file only changes when a plugin is added, removed, renamed, or repointed to a different ref or URL.

Plugin development (skills, agents, tests, releases) happens entirely in each plugin's own repo. This repo is intentionally thin — it only points users at the plugins that make up the marketplace.
