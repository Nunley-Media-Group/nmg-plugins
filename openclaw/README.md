# OpenClaw Automation — nmg-sdlc

[OpenClaw](https://openclaw.ai/) integration for fully automated SDLC cycles. A deterministic Node.js script (`sdlc-runner.mjs`) orchestrates `claude -p` subprocesses through a 9-step development cycle — issue selection, spec writing, implementation, verification, PR creation, CI monitoring, and merge — looping continuously until no open issues remain.

## Architecture

```
OpenClaw Agent
  └─ /running-sdlc start --config sdlc-config.json
       └─ sdlc-runner.mjs (Node.js orchestrator)
            ├─ Step 1: startCycle    — checkout main, pull latest
            ├─ Step 2: startIssue    — select issue, create branch     (/starting-issues)
            ├─ Step 3: writeSpecs    — BDD specs from issue            (/writing-specs)
            ├─ Step 4: implement     — implement from specs            (/implementing-specs)
            ├─ Step 5: verify        — verify against specs            (/verifying-specs)
            ├─ Step 6: commitPush    — stage, commit, push
            ├─ Step 7: createPR      — create pull request             (/creating-prs)
            ├─ Step 8: monitorCI     — poll CI, fix failures
            └─ Step 9: merge         — merge PR, delete branch
```

Each step runs as a `claude -p` subprocess with the relevant nmg-sdlc skill injected via `--append-system-prompt`. The runner handles step sequencing, precondition validation, timeout detection, retry logic, state management, Discord reporting, and escalation — all in code, not prompts.

## Setup

### 1. Generate a config

From within the target project (must have a `.claude/` directory):

```bash
/generating-openclaw-config
```

This writes `sdlc-config.json` to the project root and adds it to `.gitignore`. The config specifies `projectPath`, `pluginsPath`, per-step `maxTurns` and `timeoutMin`, and which nmg-sdlc skills to inject.

### 2. Install the OpenClaw skill

Three options:

```bash
# Option A: Via the plugin skill (from any project with nmg-sdlc installed)
/installing-openclaw-plugin

# Option B: Via the dev workflow (from within the nmg-plugins repo)
/installing-locally

# Option C: Via the standalone installer
./openclaw/scripts/install-openclaw-skill.sh          # copy mode
./openclaw/scripts/install-openclaw-skill.sh --link    # link mode (stays in sync with repo)
```

All methods install to `~/.openclaw/skills/running-sdlc/` and restart the OpenClaw gateway.

## Commands

### Start

```
/running-sdlc start --config <path-to-sdlc-config.json>
```

Launches the runner. It is fully autonomous after launch — it handles step sequencing, retries, Discord updates, and error recovery on its own.

### Status

```
/running-sdlc status --config <path-to-sdlc-config.json>
```

Reports current step, issue, branch, retry counts, and whether the runner process is alive.

### Stop

```
/running-sdlc stop --config <path-to-sdlc-config.json>
```

Gracefully stops the runner. It sends SIGTERM, which triggers the runner to kill the current subprocess, commit/push work, post to Discord, and exit.

## Additional Flags

These can be appended after `start`:

- `--resume` — Resume from existing state after a crash or manual stop
- `--dry-run` — Log actions without executing
- `--step N` — Run only step N (1-9) then exit

Example: `/running-sdlc start --config sdlc-config.json --resume`

## Running Directly (without OpenClaw)

The runner can be invoked directly without the OpenClaw platform:

```bash
node openclaw/scripts/sdlc-runner.mjs --config /path/to/sdlc-config.json
```

This requires `claude` CLI to be on PATH and the project to have `.claude/auto-mode` set (the runner creates this automatically).

## State & Logs

- **State file**: `<projectPath>/.claude/sdlc-state.json` — tracks current step, issue, branch, retries, runner PID. Atomic writes via rename.
- **Logs**: `/tmp/sdlc-runner.log`
- **Auto-mode flag**: `<projectPath>/.claude/auto-mode` — created by the runner; causes nmg-sdlc skills to skip interactive prompts.

## Error Handling

- **Retries**: Each step retries up to `maxRetriesPerStep` (default 3) before escalating.
- **Precondition checks**: Each step validates its inputs (clean tree, correct branch, spec files exist, etc.) before running.
- **Immediate escalation**: Context window exceeded, SIGKILL, permission denied, or `EnterPlanMode` detected.
- **Rate limiting**: Waits 60s before retrying.
- **Escalation protocol**: Commits partial work, returns to main, posts diagnostic to Discord, resets state.

## File Layout

```
openclaw/
├── README.md                              ← this file
├── scripts/
│   ├── sdlc-runner.mjs                    ← the orchestrator
│   ├── sdlc-config.example.json           ← config template
│   └── install-openclaw-skill.sh          ← standalone installer
└── skills/
    └── running-sdlc/
        └── SKILL.md                       ← OpenClaw skill definition
```
