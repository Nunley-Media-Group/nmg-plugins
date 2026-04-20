# CLAUDE.md

## Project Overview

Claude Code plugin marketplace repository for Nunley Media Group. Contains the `nmg-sdlc` plugin (BDD spec-driven development toolkit).

## Repository Structure

```
.claude-plugin/marketplace.json   — Marketplace index (plugin registry)
.claude/skills/                   — Repo-level utility skills (not part of the plugin)
plugins/nmg-sdlc/                 — The nmg-sdlc plugin
  .claude-plugin/plugin.json      — Plugin manifest
  skills/                         — Skill definitions (one directory per skill)
  agents/                         — Subagent definitions (architecture-reviewer)
scripts/                          — SDLC runner script, config template, and tests
CHANGELOG.md                      — Keep an [Unreleased] section for pending changes
README.md                         — Public docs: workflow, installation, skills reference
```

## README Updates

When making changes that affect how users interact with the plugin (new skills, changed workflows, new steering documents, etc.), update `README.md` accordingly. The README is the primary public documentation — it must stay in sync with actual capabilities.
