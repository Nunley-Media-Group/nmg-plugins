# Design: Installing OpenClaw Skill

**Issue**: #14
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/installing-openclaw-skill` skill provides a 5-step workflow for deploying the OpenClaw running-sdlc skill locally: create destination directory, copy skill files from the marketplace clone, run the CLI hang patch, restart the gateway, and report results. The skill sources all files from `~/.claude/plugins/marketplaces/nmg-plugins/openclaw/`.

A standalone installer script (`openclaw/scripts/install-openclaw-skill.sh`) provides the same functionality outside of Claude Code, with an additional `--link` mode that symlinks instead of copying — useful for development where you want changes to reflect immediately.

The CLI hang patch (`patch-openclaw-message-hang.mjs`) is an idempotent script that fixes a known Discord.js WebSocket hang bug in the `openclaw message send` command. It checks whether the patch is already applied, the bug is fixed upstream, or openclaw isn't installed.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────┐
│    /installing-openclaw-skill                  │
├──────────────────────────────────────────────┤
│  Step 1: mkdir -p ~/.openclaw/skills/running-sdlc
│  Step 2: cp SKILL.md, sdlc-runner.mjs, config │
│  Step 3: node patch-openclaw-message-hang.mjs  │
│  Step 4: openclaw gateway restart              │
│  Step 5: Report results                        │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│    install-openclaw-skill.sh (standalone)      │
│  --link mode: symlink instead of copy          │
└──────────────────────────────────────────────┘
```

### Data Flow

```
1. Create destination directory
2. Copy SKILL.md, sdlc-runner.mjs, sdlc-config.example.json
3. Run CLI hang patch (idempotent)
4. Source nvm and restart OpenClaw gateway
5. Report success/warnings
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/installing-openclaw-skill/SKILL.md` | Create | Skill definition with 5-step workflow |
| `openclaw/scripts/install-openclaw-skill.sh` | Create | Standalone installer with --link mode |

---

## Security Considerations

- [x] Sources from local marketplace clone only
- [x] No remote downloads during installation
- [x] Gateway restart uses authenticated `openclaw` CLI

---

## Performance Considerations

- [x] File copy is instant
- [x] Patch script is idempotent and fast
- [x] Gateway restart is the only potentially slow operation

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Installation | BDD | Scenarios for copy, patch, restart |
| Standalone Script | BDD | Scenario for --link mode |

---

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] File changes documented
- [x] Security considerations addressed
