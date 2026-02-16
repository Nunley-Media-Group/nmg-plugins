---
name: running-sdlc
description: "Launch, monitor, or stop the deterministic SDLC runner for a project."
argument-hint: "start|status|stop [--config <path>]"
allowed-tools: Bash(node:*), Bash(kill:*), Bash(cat:*), Bash(ps:*), Read
---

# Running SDLC

Launch, monitor, or stop the deterministic SDLC orchestrator (`sdlc-runner.mjs`). This script drives the full development cycle — issue selection, spec writing, implementation, verification, PR creation, CI monitoring, and merge — as a continuous loop using `claude -p` subprocesses.

## Commands

### `start` — Launch the SDLC runner

1. Parse the `--config <path>` argument. If not provided, ask the user for the path to their `sdlc-config.json`.

2. Read the config file and extract `projectPath`.

3. Ensure `.claude/auto-mode` exists in the target project:
   ```bash
   mkdir -p "<projectPath>/.claude" && touch "<projectPath>/.claude/auto-mode"
   ```

4. Locate the runner script. Check these paths in order:
   - Same directory as this SKILL.md: `<skill-dir>/sdlc-runner.mjs`
   - The nmg-plugins openclaw directory: `<pluginsPath>/openclaw/scripts/sdlc-runner.mjs` (read `pluginsPath` from the config)

5. Determine the Discord channel ID for status updates. Run:
   ```bash
   openclaw sessions --active 5 --json
   ```
   Find the session whose `key` contains `discord:channel:` and is most recently updated. Extract the channel ID from the key (the numeric segment after `discord:channel:`). If no Discord session is found, check the config for `discordChannelId`. This will be passed to the runner so it can post progress updates back to the originating channel.

6. Launch the runner as a background process, passing the Discord channel ID:
   ```bash
   nohup node <runner-path>/sdlc-runner.mjs --config <config-path> --discord-channel <channel-id> 2>&1 &
   echo $!
   ```
   If no Discord channel ID is available, omit the `--discord-channel` flag (the runner will skip Discord updates).
   The runner writes its own orchestration log to `<logDir>/sdlc-runner.log` (see Logging section below).

7. Post to Discord: "SDLC runner started for [project name]. PID: [pid]. Logs: `<os.tmpdir()>/sdlc-logs/<project-name>/sdlc-runner.log`"

8. Report the PID to the user. The runner is now autonomous — it handles all step sequencing, retries, Discord updates, and error recovery.

### `status` — Check current runner state

1. Read the `sdlc-state.json` file from the project's `.claude/` directory (get `projectPath` from the config).

2. Check if the runner process is alive:
   ```bash
   kill -0 <pid-from-state> 2>/dev/null && echo "alive" || echo "dead"
   ```

3. Report:
   - Runner PID and whether it's alive
   - Current step number and name
   - Current issue number
   - Current branch
   - Retry counts
   - Last transition timestamp

### `stop` — Gracefully stop the runner

1. Read `sdlc-state.json` to get the runner PID.

2. Send SIGTERM to the runner (it handles graceful shutdown: kills the current subprocess, commits/pushes work, posts to Discord, exits):
   ```bash
   kill <pid>
   ```

3. Wait a few seconds and verify the process has exited:
   ```bash
   sleep 3 && kill -0 <pid> 2>/dev/null && echo "still running" || echo "stopped"
   ```

4. Report the result. If still running after 10 seconds, the user can force-kill with `kill -9 <pid>`.

## Additional Flags

The runner supports additional flags that can be passed after `start`:

- **`--discord-channel <id>`** — Discord channel ID for posting status updates. Passed automatically from the invoking channel.
- **`--dry-run`** — Logs every action without executing. Useful for validating step sequencing.
- **`--step N`** — Run only step N (1-9) then exit. Useful for debugging a single step.
- **`--resume`** — Resume from existing `sdlc-state.json` instead of starting fresh. Use after a crash or manual stop.

Example: `start --config /path/to/config.json --discord-channel 1234567890 --resume`

## Process Cleanup

The runner can automatically kill orphaned processes (e.g., headed Chrome) that `claude -p` subprocesses may spawn but fail to clean up. This is configured via the optional `cleanup.processPatterns` field in `sdlc-config.json`:

```json
{
  "cleanup": {
    "processPatterns": ["--remote-debugging-port"]
  }
}
```

- **Format**: An array of strings. Each string is passed to `pgrep -f` / `pkill -f` to match processes by their command line.
- **When it runs**: After every step completes (success or failure), on escalation, and on graceful shutdown (SIGTERM/SIGINT).
- **Safety**: The runner's own PID is always excluded from kills.
- **Backward-compatible**: If `cleanup` is omitted or `processPatterns` is empty, no cleanup occurs.

## Logging

The runner persists logs to an OS-agnostic directory for debugging headless sessions.

### Log directory

Default: `<os.tmpdir()>/sdlc-logs/<project-name>/` (e.g., `/tmp/sdlc-logs/my-app/` on Linux/macOS). Override with the `logDir` config field.

### Files

- **`sdlc-runner.log`** — Orchestration log. Every `log()` call dual-writes to stdout and this file.
- **`<step>-<sessionId>-<timestamp>.log`** — Per-step log containing the full stdout/stderr from each `claude -p` subprocess. Written after every step completes (success or failure). Example: `implement-a1b2c3d4e5f6-2026-02-16T14-30-00.log`.

### Disk limits

The `maxLogDiskUsageMB` config field (default: 500) caps total per-step log disk usage. Before each new step log is written, the runner deletes the oldest step logs until usage is under the threshold. The orchestration log (`sdlc-runner.log`) is never pruned.

### Config fields

| Field | Default | Description |
|---|---|---|
| `logDir` | `<os.tmpdir()>/sdlc-logs/<project-name>/` | Directory for all log files |
| `maxLogDiskUsageMB` | `500` | Max disk usage (MB) for per-step logs |

### Tailing logs

```bash
# Orchestration log
tail -f "$(node -e "const os=require('os');const p=require('path');console.log(p.join(os.tmpdir(),'sdlc-logs','<project-name>','sdlc-runner.log'))")"

# Latest step log
ls -t <logDir>/*.log | head -1 | xargs tail -100
```

## Integration with SDLC Workflow

This skill is the entry point for fully automated SDLC execution. It replaces the prompt-engineered heartbeat loop with a deterministic Node.js script. All SDLC work still executes inside Claude Code via `claude -p` — the script only handles orchestration:

- Step sequencing (deterministic `for` loop)
- Precondition validation (file existence checks, git status)
- Timeout detection (`AbortController` + `setTimeout`)
- State management (atomic JSON writes)
- Discord reporting (at every transition)
- Retry logic (with caps and escalation)
- Error pattern matching (regex on subprocess output)

The individual SDLC skills (`/starting-issues`, `/writing-specs`, `/implementing-specs`, `/verifying-specs`, `/creating-prs`) are injected into each `claude -p` subprocess via `--append-system-prompt`.
