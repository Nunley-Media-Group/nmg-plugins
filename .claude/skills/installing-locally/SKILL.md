---
name: installing-locally
description: "Install or update all nmg-plugins marketplace plugins locally for the current user."
argument-hint: ""
allowed-tools: Read, Bash(git:*), Bash(cp:*), Bash(mkdir:*), Bash(date:*), Bash(jq:*), Bash(chmod:*), Bash(rsync:*)
---

# Installing Locally

Install or update all plugins from the nmg-plugins marketplace to the local user's Claude Code plugin cache.

## When to Use

- After pushing new commits to the nmg-plugins repo and wanting to test locally
- When the installed plugin version is behind the repo version
- When doing a fresh install of all marketplace plugins for a new user

## Key Paths

| Path | Purpose |
|------|---------|
| `~/.claude/plugins/known_marketplaces.json` | Registry of marketplace sources and clone locations |
| `~/.claude/plugins/marketplaces/nmg-plugins/` | Local git clone of the marketplace repo |
| `~/.claude/plugins/cache/nmg-plugins/{plugin}/{version}/` | Versioned snapshot of each installed plugin |
| `~/.claude/plugins/installed_plugins.json` | Registry of installed plugins (scope, version, path, git SHA) |

## Workflow Overview

```
/installing-locally
    │
    ├─ 1. Pull latest marketplace repo
    ├─ 2. Discover plugins from marketplace.json
    ├─ 3. For each plugin, sync to cache
    ├─ 4. Update installed_plugins.json
    └─ 5. Report results
```

---

## Step 1: Pull Latest Marketplace Repo

Update the local marketplace clone to the latest commit:

```bash
cd ~/.claude/plugins/marketplaces/nmg-plugins && git pull origin main
```

Capture the current HEAD SHA for use in Step 4:

```bash
cd ~/.claude/plugins/marketplaces/nmg-plugins && git rev-parse HEAD
```

## Step 2: Discover Plugins

Read `~/.claude/plugins/marketplaces/nmg-plugins/.claude-plugin/marketplace.json`.

For each entry in the `"plugins"` array, extract:
- `name` — plugin identifier (e.g., `nmg-sdlc`)
- `source` — relative path to plugin source (e.g., `./plugins/nmg-sdlc`)
- `version` — current version string (e.g., `1.7.0`)

Also read each plugin's own manifest at `{source}/.claude-plugin/plugin.json` and verify the version matches the marketplace entry. If they differ, warn the user — the marketplace.json version is authoritative.

## Step 3: Sync Each Plugin to Cache

For each discovered plugin:

### 3a. Create the cache directory

```bash
mkdir -p ~/.claude/plugins/cache/nmg-plugins/{plugin-name}/{version}
```

### 3b. Copy plugin source into cache

Copy the full plugin directory from the marketplace clone into the versioned cache location, excluding `.DS_Store` files:

```bash
rsync -a --delete --exclude='.DS_Store' \
  ~/.claude/plugins/marketplaces/nmg-plugins/plugins/{plugin-name}/ \
  ~/.claude/plugins/cache/nmg-plugins/{plugin-name}/{version}/
```

Using `rsync --delete` ensures removed files are cleaned up (e.g., deleted hook scripts). The trailing slashes are important.

### 3c. Ensure hook scripts are executable

```bash
chmod +x ~/.claude/plugins/cache/nmg-plugins/{plugin-name}/{version}/hooks/*.sh 2>/dev/null || true
```

## Step 4: Update installed_plugins.json

Read `~/.claude/plugins/installed_plugins.json`.

For each plugin synced in Step 3, update or create its entry in the `"plugins"` object. The key format is `{plugin-name}@nmg-plugins`.

Each entry is an array of installation scopes. For user-level installs, ensure there is an entry with:

```json
{
  "scope": "user",
  "installPath": "~/.claude/plugins/cache/nmg-plugins/{plugin-name}/{version}",
  "version": "{version}",
  "installedAt": "{original-install-date-or-now}",
  "lastUpdated": "{current-ISO-8601-timestamp}",
  "gitCommitSha": "{HEAD-SHA-from-step-1}"
}
```

Rules:
- Use the **full expanded path** (not `~`) for `installPath` (e.g., `/Users/rnunley/.claude/plugins/cache/...`)
- Preserve the original `installedAt` if the plugin was previously installed; only update `lastUpdated`
- If this is a new install, set both `installedAt` and `lastUpdated` to the current timestamp
- Generate the ISO 8601 timestamp:

```bash
date -u +"%Y-%m-%dT%H:%M:%S.000Z"
```

Write the updated JSON back to `~/.claude/plugins/installed_plugins.json` using `jq` or direct file write, preserving the `"version": 2` schema field.

## Step 5: Report Results

Output a summary:

```
--- Plugins Installed ---
Marketplace: nmg-plugins (commit {short-SHA})
  {plugin-name}: v{version} → ~/.claude/plugins/cache/nmg-plugins/{plugin-name}/{version}/
  ...

Restart Claude Code for changes to take effect.
```

If any plugin had a version mismatch between marketplace.json and its own plugin.json, include a warning:

```
⚠ Version mismatch: {plugin-name} marketplace.json says {v1} but plugin.json says {v2}
```
