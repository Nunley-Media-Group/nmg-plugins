---
name: end-loop
description: "Stop unattended mode and clear runner state. Use when user says 'end loop', 'stop loop', 'kill the runner', 'exit unattended mode', 'disable unattended mode', 'cleanup runner artifacts', or 'stop SDLC automation'. Pairs with /run-loop — signals the runner PID (if live) and removes .claude/unattended-mode and .claude/sdlc-state.json."
argument-hint: ""
disable-model-invocation: true
allowed-tools: Read, Bash(test:*), Bash(node:*), Bash(rm:*)
---

# End Loop

Tear down unattended mode and clear SDLC runner state. This is the explicit counterpart to `/run-loop`: one command to stop the loop cleanly, whether the runner is live, crashed, or already gone.

The runner artifacts this skill manages mirror `RUNNER_ARTIFACTS` in `scripts/sdlc-runner.mjs:566` and the delete-best-effort semantics of `removeUnattendedMode()` in `scripts/sdlc-runner.mjs:614`. If those locations change, this skill needs a corresponding update.

## When to Use

- Stopping an active SDLC loop mid-cycle to return to interactive work
- Cleaning up after a crashed runner that left stale `.claude/unattended-mode` or `.claude/sdlc-state.json`
- Idempotent "make sure unattended mode is off" invocation

## Runner Artifacts

The skill operates on exactly two paths, relative to the project root:

- `.claude/unattended-mode` — flag file signalling headless operation
- `.claude/sdlc-state.json` — runner state (may contain a `runnerPid` field)

## Step 1: Check for `.claude/` Directory

```bash
test -d .claude
```

If the directory does not exist, this is not a runner project. Emit exactly:

```
Not a runner project — no .claude directory found.
```

Exit 0. Do not proceed.

## Step 2: Check for Either Artifact

```bash
test -e .claude/unattended-mode || test -e .claude/sdlc-state.json
```

If neither file exists, unattended mode is already disabled. Emit exactly:

```
Unattended mode already disabled — nothing to do.
```

Exit 0. Do not proceed.

## Step 3: Extract `runnerPid` from State (If Present)

If `.claude/sdlc-state.json` exists, attempt to parse it and extract `runnerPid`.

Use the Read tool to load the file contents. Then validate:

1. The file contents parse as JSON.
2. The parsed object has a `runnerPid` field.
3. `runnerPid` is a **positive integer** (`typeof === 'number'`, `Number.isInteger`, `> 0`).

If any of these checks fail — malformed JSON, missing field, non-integer, zero, or negative — skip PID extraction silently. Do not raise a parse error. Treat the file as opaque and continue to Step 6.

**Security note**: the positive-integer check is load-bearing. Negative or non-integer values must never be passed to `process.kill` (e.g., `process.kill(-1, 'SIGTERM')` would broadcast to the entire process group).

## Step 4: Liveness Probe (If Valid PID Extracted)

With a validated positive integer PID, check whether the process is live:

```bash
node -e "try { process.kill(<PID>, 0); } catch { process.exit(1); }"
```

Substitute `<PID>` with the exact integer captured in Step 3. Do not interpolate any other value from the state file into this command.

- Exit code 0 → process is alive → proceed to Step 5.
- Exit code 1 → process is dead (or unreachable) → skip signalling silently and proceed to Step 6. Do not emit anything to stdout or stderr.

## Step 5: Send SIGTERM (If Live)

```bash
node -e "try { process.kill(<PID>, 'SIGTERM'); } catch (e) { console.error(e.code || e.message); process.exit(1); }"
```

Substitute `<PID>` with the exact integer captured in Step 3. Do not interpolate any other value from the state file into this command.

- Success (exit code 0) → record "Signalled runner PID `<PID>` (SIGTERM)" for the summary.
- Failure (non-zero exit) → the command writes a clean error token (e.g., `EPERM`) to stderr. Capture stderr as `<reason>` and record "Failed to signal PID `<PID>`: `<reason>`" for the summary. **Continue to Step 6** — partial cleanup is preferable to no cleanup.

Do not wait for the process to exit. SIGTERM is fire-and-forget.

## Step 6: Delete Artifacts

Remove both files with best-effort semantics. `rm -f` does not error on missing files.

```bash
rm -f .claude/unattended-mode
rm -f .claude/sdlc-state.json
```

If either `rm` exits non-zero **and** the file still exists (check with `test -e`), the deletion failed for a reason other than the file being absent — typically `EACCES`. Capture the specific file path and the OS-level reason. After attempting both deletions, if any deletion failed, emit:

```
Failed to remove <path>: <OS reason>
```

to stderr and exit non-zero. The specific file path in the error message is required so the developer can resolve the permission issue manually.

For each file that was present before the `rm` and is no longer present after, record "Removed `<path>`" for the summary.

## Step 7: Emit Summary

Output format depends on what happened in the preceding steps.

### Happy path — no errors

```
Stopped unattended mode.
  Signalled runner PID <PID> (SIGTERM)
  Removed .claude/unattended-mode
  Removed .claude/sdlc-state.json
```

Omit the "Signalled" line if no live PID was found (dead PID, malformed state, or state file absent). Omit any "Removed" line for a file that was not present.

### Partial failure — SIGTERM denied but files deleted

```
Stopped unattended mode (with warnings).
  Failed to signal PID <PID>: <reason>
  Removed .claude/unattended-mode
  Removed .claude/sdlc-state.json
```

### Deletion failure

Already handled in Step 6 — a deletion failure exits non-zero with a specific-file error on stderr.

## Unattended Mode

This skill always runs non-interactively. It does not call `AskUserQuestion`, does not enter plan mode, and does not gate on any user confirmation. Invocation under `.claude/unattended-mode` behaves identically to invocation without it — which matters because a common use case is to disable unattended mode that the skill itself is currently running under.

## Integration with SDLC Workflow

`/end-loop` pairs with `/run-loop` as the explicit stop command:

```
/run-loop           →  Starts the SDLC pipeline (creates .claude/unattended-mode + state)
/end-loop           →  Stops the pipeline (signals runner, removes both files)
```

The underlying runner (`scripts/sdlc-runner.mjs`) also removes `.claude/unattended-mode` automatically on clean exit via its `removeUnattendedMode()` helper. `/end-loop` is the manual equivalent for mid-cycle stop, crash recovery, or "make sure it's off" idempotent invocations.
