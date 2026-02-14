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
   - The nmg-plugins scripts directory: `<pluginsPath>/scripts/sdlc-runner.mjs` (read `pluginsPath` from the config)

5. Launch the runner as a background process:
   ```bash
   nohup node <runner-path>/sdlc-runner.mjs --config <config-path> > /tmp/sdlc-runner.log 2>&1 &
   echo $!
   ```

6. Post to Discord: "SDLC runner started for [project name]. PID: [pid]. Logs: /tmp/sdlc-runner.log"

7. Report the PID to the user. The runner is now autonomous — it handles all step sequencing, retries, Discord updates, and error recovery.

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

- **`--dry-run`** — Logs every action without executing. Useful for validating step sequencing.
- **`--step N`** — Run only step N (1-9) then exit. Useful for debugging a single step.
- **`--resume`** — Resume from existing `sdlc-state.json` instead of starting fresh. Use after a crash or manual stop.

Example: `start --config /path/to/config.json --resume`

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
