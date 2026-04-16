---
name: run-loop
description: "Run the full SDLC pipeline loop from within an active Claude Code session. Use when user says 'run the SDLC loop', 'run loop', 'run SDLC for #N', 'process issue end-to-end', 'run pipeline', 'how do I run the SDLC loop', or 'kick off automation'. Invokes sdlc-runner.mjs as a subprocess with CLAUDECODE unset to enable nested claude sessions. Orchestrates the full pipeline: /draft-issue → /start-issue → /write-spec → /write-code → /verify-code → /open-pr."
argument-hint: "[#issue-number]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(env:*), Bash(CLAUDECODE:*), Bash(test:*), Bash(git:*), Skill
---

# Run Loop

Run the full SDLC pipeline from within an active Claude Code session. This skill invokes the deterministic `sdlc-runner.mjs` as a subprocess, enabling the entire development cycle (issue selection, spec writing, implementation, verification, PR creation, CI monitoring, and merge) without leaving the current session.

## When to Use

- Processing a specific issue end-to-end: `/run-loop #42`
- Running the continuous SDLC loop on all open issues: `/run-loop`

## How It Works

The skill shells out to the existing `sdlc-runner.mjs` with `CLAUDECODE=""` set in the environment. This is required because Claude Code refuses to launch nested sessions when the `CLAUDECODE` environment variable is set. The runner then spawns its own `claude -p` subprocesses for each SDLC step.

## Step 1: Parse Arguments

Parse `$ARGUMENTS` to determine the mode:

- **No argument** → continuous loop mode (process all open issues)
- **`#N` or `N`** (where N is a number) → single-issue mode (process only issue #N, then exit)

Extract the issue number if provided. Strip any leading `#`.

## Step 2: Locate or Generate Config

Check for `sdlc-config.json` at the project root:

```bash
test -f "$(git rev-parse --show-toplevel)/sdlc-config.json"
```

- **If found** → proceed to Step 3.
- **If not found** → invoke the config generator:
  ```
  Skill("nmg-sdlc:init-config")
  ```
  Then verify the config was created before proceeding.

## Step 3: Read Config and Locate Runner

Read the config file and extract the `pluginsPath` value using the Read tool on `sdlc-config.json`.

Derive the runner script path:
```
<pluginsPath>/scripts/sdlc-runner.mjs
```

Verify the runner exists:
```bash
test -f "<pluginsPath>/scripts/sdlc-runner.mjs"
```

If the runner is not found, report the error and stop.

## Step 4: Execute the Runner

Build the command. The `CLAUDECODE=""` prefix is **mandatory** — without it, the runner's `claude -p` subprocesses will refuse to start.

**Single-issue mode** (argument provided):
```bash
CLAUDECODE="" node <runner-path> --config <config-path> --issue <N>
```

**Continuous loop mode** (no argument):
```bash
CLAUDECODE="" node <runner-path> --config <config-path>
```

Run the command and stream its output. The runner handles all orchestration:
- Auto-mode flag management (`.claude/auto-mode`)
- Step sequencing and precondition validation
- Retry logic and escalation
- Clean exit after completion

## Step 5: Report Results

After the runner exits, report:

- **Exit code 0** → success. State what was accomplished (issue processed, PR merged, etc.)
- **Exit code 1** → failure. Report the exit code and suggest checking the runner log for details. The log path follows the pattern: `<os.tmpdir()>/sdlc-logs/<project-name>/sdlc-runner.log`

## Auto-Mode

The runner creates and manages `.claude/auto-mode` automatically. When this file exists, all SDLC skills skip interactive prompts and run headlessly. The runner removes the file on exit (success or failure).

Do **not** create or remove `.claude/auto-mode` manually — the runner handles the full lifecycle.

## Integration with SDLC Workflow

This skill runs the SDLC pipeline from within Claude Code:

```
/run-loop #42     →  Processes issue #42 through the full pipeline
/run-loop          →  Processes all open issues in a continuous loop
```

The underlying runner (`sdlc-runner.mjs`) can also be invoked directly:

```bash
node scripts/sdlc-runner.mjs --config sdlc-config.json
```
