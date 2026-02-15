# Design: Installing Locally Skill

**Issue**: #15
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/installing-locally` skill is a comprehensive 7-step installation workflow that serves as the primary deployment mechanism for the nmg-plugins marketplace. It pulls the latest marketplace repo, discovers plugins from `marketplace.json`, syncs each plugin to a versioned cache directory via `rsync`, updates `installed_plugins.json` with version and SHA tracking, syncs the OpenClaw running-sdlc skill, restarts the OpenClaw gateway, and reports results.

This is a repo-level skill (in `.claude/skills/`, not inside any plugin) because its purpose is to install the plugins themselves — it wouldn't make sense for it to be part of a plugin that needs to be installed. It handles version tracking (preserving `installedAt`, updating `lastUpdated`), version mismatch warnings (marketplace.json vs plugin.json), and non-fatal error handling for the OpenClaw gateway restart.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────┐
│         /installing-locally Skill                  │
├──────────────────────────────────────────────────┤
│  Step 1: git pull marketplace repo                │
│  Step 2: Read marketplace.json → discover plugins │
│  Step 3: rsync each plugin → versioned cache      │
│  Step 4: Update installed_plugins.json            │
│  Step 5: Copy OpenClaw skill files                │
│  Step 6: Restart OpenClaw gateway                 │
│  Step 7: Report results                           │
└──────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌──────────────────────┐
│ ~/.claude/       │  │ ~/.openclaw/          │
│ plugins/         │  │ skills/running-sdlc/  │
│  ├── cache/      │  └──────────────────────┘
│  └── installed_  │
│     plugins.json │
└─────────────────┘
```

### Data Flow

```
1. Pull latest from marketplace git repo
2. Read marketplace.json plugins array
3. For each plugin: rsync source → ~/.claude/plugins/cache/{plugin}/{version}/
4. chmod +x hook scripts
5. Update installed_plugins.json with version, path, SHA, timestamps
6. Copy OpenClaw skill files to ~/.openclaw/skills/running-sdlc/
7. Restart OpenClaw gateway (non-fatal)
8. Report summary with versions and paths
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `.claude/skills/installing-locally/SKILL.md` | Create | Repo-level skill with 7-step workflow |

---

## Security Considerations

- [x] All operations are local file operations
- [x] No remote downloads (marketplace is a local git clone)
- [x] `rsync --delete` safely cleans stale files

---

## Performance Considerations

- [x] `rsync` only copies changed files (incremental sync)
- [x] `git pull` fetches only incremental changes
- [x] Single-pass through plugins array

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Plugin Installation | BDD | Scenarios for plugin sync and OpenClaw sync |
| Registry Update | Manual | Verify installed_plugins.json accuracy |

---

## Validation Checklist

- [x] Architecture follows repo-level skill pattern
- [x] File changes documented
- [x] Security considerations addressed
