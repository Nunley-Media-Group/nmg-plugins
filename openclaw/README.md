# OpenClaw Automation — nmg-sdlc

You have the `/running-sdlc` skill available. It launches a background process that autonomously drives the full SDLC cycle for a project: issue selection, spec writing, implementation, verification, PR creation, CI monitoring, and merge — looping continuously until no open issues remain.

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

Gracefully stops the runner. It finishes its current operation, commits work, and posts to Discord before exiting.

## Additional Flags

These can be appended after `start`:

- `--resume` — Resume from existing state after a crash or manual stop
- `--dry-run` — Log actions without executing
- `--step N` — Run only step N (1–9) then exit

## Logs

Runner output is at `/tmp/sdlc-runner.log`.
