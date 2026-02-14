---
name: installing-openclaw-plugin
description: "Install or update the OpenClaw running-sdlc skill and restart the gateway."
argument-hint: ""
allowed-tools: Read, Bash(cp:*), Bash(mkdir:*), Bash(source:*), Bash(ls:*), Bash(node:*)
---

# Installing OpenClaw Plugin

Copy the OpenClaw running-sdlc skill and its supporting files from the nmg-plugins marketplace clone to `~/.openclaw/skills/running-sdlc/`, then restart the OpenClaw gateway.

## When to Use

- After updating the OpenClaw skill or sdlc-runner script and wanting to test locally
- When setting up OpenClaw on a new machine
- When the installed OpenClaw skill is out of date with the repo

## Key Paths

| Path | Purpose |
|------|---------|
| `~/.claude/plugins/marketplaces/nmg-plugins/openclaw/` | Source (marketplace clone) |
| `~/.openclaw/skills/running-sdlc/` | Installed skill directory |

## Workflow Overview

```
/installing-openclaw-plugin
    │
    ├─ 1. Create destination directory
    ├─ 2. Copy skill files
    ├─ 3. Patch OpenClaw CLI (message-send hang bug)
    ├─ 4. Restart OpenClaw gateway
    └─ 5. Report results
```

---

## Step 1: Create Destination Directory

```bash
mkdir -p ~/.openclaw/skills/running-sdlc
```

## Step 2: Copy Skill Files

Always source from the marketplace clone at `~/.claude/plugins/marketplaces/nmg-plugins`:

```bash
cp ~/.claude/plugins/marketplaces/nmg-plugins/openclaw/skills/running-sdlc/SKILL.md \
   ~/.openclaw/skills/running-sdlc/SKILL.md
cp ~/.claude/plugins/marketplaces/nmg-plugins/openclaw/scripts/sdlc-runner.mjs \
   ~/.openclaw/skills/running-sdlc/sdlc-runner.mjs
cp ~/.claude/plugins/marketplaces/nmg-plugins/openclaw/scripts/sdlc-config.example.json \
   ~/.openclaw/skills/running-sdlc/sdlc-config.example.json
```

## Step 3: Patch OpenClaw CLI (message-send hang bug)

The `openclaw message send` CLI has a known bug where the Node process hangs after delivering a message because the Discord.js WebSocket is never closed ([openclaw/openclaw#16460](https://github.com/openclaw/openclaw/issues/16460)). This causes the SDLC runner to time out and send duplicate Discord messages.

Run the patch script to detect and fix the bug if present:

```bash
source ~/.nvm/nvm.sh 2>/dev/null && node ~/.claude/plugins/marketplaces/nmg-plugins/openclaw/scripts/patch-openclaw-message-hang.mjs
```

The script is idempotent — it checks whether the patch is already applied, the bug is fixed upstream, or openclaw isn't installed, and handles each case gracefully. Non-fatal: if the patch fails or openclaw is not found, warn the user but continue.

## Step 4: Restart OpenClaw Gateway

Restart the OpenClaw gateway so it picks up the updated skill files.

Because `openclaw` is installed via nvm, it is not on PATH in non-interactive shells. Source nvm first:

```bash
source ~/.nvm/nvm.sh 2>/dev/null && openclaw gateway restart
```

If nvm or `openclaw` is not found, or the restart fails, warn the user but do not fail the overall install — the skill files were still copied successfully.

## Step 5: Report Results

Output a summary:

```
--- OpenClaw Skill Synced ---
  running-sdlc → ~/.openclaw/skills/running-sdlc/

--- OpenClaw CLI Patch ---
  [message-send hang fix: applied / already patched / skipped]

--- OpenClaw Gateway ---
  Restarted successfully.
```

If the gateway restart failed, include:

```
⚠ OpenClaw gateway restart failed — run `openclaw gateway restart` manually.
```

## Integration with SDLC Workflow

This skill is a utility for keeping the OpenClaw running-sdlc skill in sync with the repo. The running-sdlc skill is what OpenClaw uses to orchestrate automated SDLC cycles (issue selection → spec writing → implementation → verification → PR → CI → merge).
