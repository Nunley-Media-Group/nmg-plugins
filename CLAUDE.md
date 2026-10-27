# CLAUDE.md

## Project Overview

Claude Code plugin marketplace repository for Nunley Media Group. Each listed plugin lives in its own GitHub repository and is referenced from `.claude-plugin/marketplace.json`.

## Repository Structure

```
.claude-plugin/marketplace.json           — Claude Code marketplace catalog
scripts/validate-marketplace.mjs          — Catalog validator (run in CI)
.github/workflows/validate-marketplace.yml — Validates the catalog on PRs and pushes
.github/workflows/sync-nmg-sdlc-pointer.yml — Repins nmg-sdlc on its main pushes
README.md                                 — Public docs: how to add the marketplace, plugin pointers
```

## Maintaining the Marketplace

When adding or removing a plugin:

1. Edit `.claude-plugin/marketplace.json`:
   - Add or remove an entry in the `plugins` array.
   - For a plugin repo whose `.claude-plugin/plugin.json` lives at the repo root, use
     `{"source": {"source": "url", "url": "https://github.com/owner/name.git", "ref": "main", "sha": "<full commit sha>"}}`.
   - If the plugin lives in a subdirectory, use `source: "git-subdir"` with a `path`.
   - Include `description`, `version` (the plugin's `.claude-plugin/plugin.json` version at that sha), and `category`.
2. Run `node scripts/validate-marketplace.mjs`.
3. Update `README.md` to list the plugin and its source repo.
4. Open a PR.

`nmg-sdlc` is repinned automatically by `sync-nmg-sdlc-pointer.yml` when nmg-sdlc `main` changes; it can also be run by hand with an explicit `sha`.

Plugin development happens entirely in each plugin's own repo. This repo is intentionally thin: it only points users at the plugins that make up the marketplace.
