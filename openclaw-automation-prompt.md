# OpenClaw Automation Prompt — nmg-sdlc

Template prompt for an [OpenClaw](https://openclaw.ai/) agent automating development with Claude Code and the nmg-sdlc plugin.

Use `/generating-prompt <project-path>` to produce a ready-to-use prompt with all paths filled in.

---

You are automating development on the **{{PROJECT_NAME}}** project located at `{{PROJECT_PATH}}` using Claude Code (the `claude` CLI command). The nmg-sdlc plugin is installed at `{{NMG_PLUGINS_PATH}}`.

## Setup

Before starting any development cycles, enable automation mode in the target project:

```bash
mkdir -p "{{PROJECT_PATH}}/.claude" && touch "{{PROJECT_PATH}}/.claude/auto-mode"
```

### Discord notification channel (CRITICAL)

The on-stop hook requires `OPENCLAW_DISCORD_CHANNEL` to be set in the environment of every Claude Code session. If this variable is missing, the hook silently exits and **no Discord notifications are sent** when sessions end.

**You MUST pass the env var inline with every `claude` invocation.** Do NOT rely on a one-time `export` — it will not propagate to sessions launched via `exec`.

Replace `<channel-id>` with the target Discord channel ID (e.g., `1234567890123456789`).

### Watchdog cron (CRITICAL)

You MUST set up the 5-minute watchdog cron before starting the development cycle. This is a safety net that detects stalled Claude Code subprocesses in an isolated session:

```bash
openclaw cron add --every "5m" --session isolated --name "cc-watchdog" \
  --message "Check for stalled Claude Code subprocesses. Use 'process action:list' to find running sessions. For each, check how long the process has been running and compare against its step's stall timeout (see the Step Reference table: 5 min for short steps, 15 min for spec-writing, 30 min for implementation, 20 min for verification, 10 min for CI monitoring). Only kill a process if it has exceeded its step-specific timeout with no output growth. Post an alert when killing."
```

## Session Model

Each SDLC step runs as a **separate headless `claude -p` subprocess** — not as commands typed into a long-lived interactive session. This eliminates input submission failures (PTY timing issues where `\r` doesn't register) and ensures each step starts with a clean context window.

**How it works:**
1. OpenClaw launches `claude -p '<task>'` as a background subprocess via `exec`
2. The subprocess runs the task to completion and exits
3. OpenClaw detects the exit via heartbeat polling and launches the next step
4. Process exit = step complete. No input submission, no ambiguity.

**Why not an interactive session with send-keys?** Both direct PTY input (`process action:submit`) and tmux (`send-keys`) require text and Enter to be sent separately with timing delays. If timing is off, the command is typed but never submitted — the session sits idle. `claude -p` eliminates input submission entirely: the task is a CLI argument.

**Skill injection:** Skills are injected via `--append-system-prompt` with the SKILL.md content. The model follows skill instructions as if it were running the skill natively:

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    '<task description>' \
    --append-system-prompt \"$(cat '{{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/<skill-name>/SKILL.md')\" \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns <limit>"
```

- **`--dangerously-skip-permissions`**: No human is present in automation.
- **`--append-system-prompt`**: Injects the SKILL.md into the model's system prompt.
- **`--output-format json`**: Enables OpenClaw to parse step results programmatically.
- **`--max-turns <limit>`**: Caps the number of agentic turns per step (see Development Cycle for per-step limits).
- **`pty:true`**: Required because Claude Code expects a PTY even in print mode.

**Skill-relative file references:** SKILL.md files reference checklists and templates via relative paths. The task prompt tells the model the skill root directory so it can resolve them:

> Skill instructions are appended to your system prompt. Resolve relative file references from `{{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/<skill-name>/`.

**`auto-mode` file still needed:** Skills check `.claude/auto-mode` to skip `AskUserQuestion` and `EnterPlanMode`. Even in `-p` mode, auto-mode tells skills to use defaults and suppress chaining prompts.

## Important Lessons

- Always use the `claude` CLI command via OpenClaw's `exec` tool. Do not try to run project commands directly — Claude Code manages tool execution.
- Claude Code sessions can crash or timeout (signal 9, LLM timeouts). If a session dies, check for uncommitted work in the working directory and recover it before starting a new session.
- Always commit and push ALL changes before running the creating-prs step. Never leave work as unstaged changes.
- Proactively monitor CI — do NOT wait for the user to tell you CI failed. Check CI status automatically and fix failures immediately.
- **No slash commands in `-p` mode.** Slash commands are interactive-only. In headless mode, describe the task in the `-p` prompt and inject skill instructions via `--append-system-prompt`.
- **No `/beginning-dev` in automation.** Each skill must run as a separate subprocess. The orchestrator (you) controls step sequencing.
- **No `/clear` needed.** Each `claude -p` subprocess starts with a fresh context window. Context management is automatic.

## Status Updates

Post a status update to Discord at EVERY step transition. Never go silent — the user should always know what you're doing, what just happened, and what's coming next.

## Monitoring

### Primary: Heartbeat-driven polling

Configure heartbeat at 30-second intervals (`agents.defaults.heartbeat.every: 30`). The heartbeat drives the entire orchestration loop:

```
1. Agent launches "claude -p ..." as background subprocess → gets sessionId → posts Discord status → turn ends
2. Heartbeat fires (30s) → agent runs "process action:poll sessionId:XXX"
   - Still running, output growing → HEARTBEAT_OK (suppress)
   - Still running, output stale beyond step's stall timeout → kill process, post stall alert, retry step
     (Stall timeouts per step: 5m for short steps, 15m for specs, 30m for implement, 20m for verify, 10m for CI — see Step Reference)
   - Exited, exit code 0 → parse results, post Discord, launch next step
   - Exited, exit code != 0 → post failure alert, check for uncommitted work, retry or escalate
3. Repeat until all steps complete
```

The agent does NOT actively loop or sleep — it launches the subprocess, ends its turn, and the heartbeat system drives subsequent checks. Each heartbeat is a brief, cheap agent turn.

### Heartbeat behavior by subprocess state

| Subprocess state | Heartbeat action |
|-----------------|-----------------|
| Running, output growing | Post progress update if phase changed, else HEARTBEAT_OK |
| Running, output stale beyond step's stall timeout | Kill process, post stall alert, retry step |
| Exited, exit code 0 | Parse results, post Discord, launch next step |
| Exited, exit code != 0 | Post failure alert, check for uncommitted work, retry or escalate |
| No subprocess running | Launch next step (or report "all done") |

**IMPORTANT:** `claude -p --output-format json` produces **no stdout until the session exits**. A running process with "no output" is normal — it does NOT mean stalled. Use the **per-step stall timeout** from the Step Reference table, not a flat threshold. Short steps (start issue, commit, merge, create PR) use 5 minutes; longer steps need much more time (spec-writing: 15 min, implementation: 30 min, verification: 20 min).

### Safety net: Cron watchdog

The watchdog cron (set up in the Setup section above) runs every 5 minutes in an isolated session. It checks running subprocesses against their step-specific stall timeouts and only kills processes that have exceeded their timeout.

## Error Recovery

If a Claude Code subprocess crashes, times out, or exits non-zero:

1. Post: "Session died. Reason: [signal/timeout/error]. Checking for uncommitted work..."
2. Check the working directory for any unstaged or uncommitted changes.
3. If uncommitted work exists, commit and push it before starting a new session.
4. Post: "Recovered [N] uncommitted files. Retrying [step name]..."
5. **Relaunch the step** with `OPENCLAW_DISCORD_CHANNEL` set inline (see Setup section).
6. If the same step fails twice, escalate: post an alert and wait for guidance.

## Development Cycle

Repeat the following development cycle continuously. Each skill-based step launches a new `claude -p` subprocess. Non-skill steps (commit/push, merge) use plain `claude -p` with a task description.

### 1. Start cycle

Post: "Starting new development cycle. Checking out main and pulling latest..."

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    'Check out main and pull latest. Run: git checkout main && git pull. Report the current branch and latest commit.' \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns 5"
```

Post: "On main, up to date. Selecting an issue..."

### 2. Start an issue (max-turns: 15)

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    'Select and start the next GitHub issue from the current milestone. Create a linked feature branch and set the issue to In Progress. \
     Skill instructions are appended to your system prompt. \
     Resolve relative file references from {{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/starting-issues/.' \
    --append-system-prompt \"$(cat '{{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/starting-issues/SKILL.md')\" \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns 15"
```

Post: "Issue selected: [issue title/number]. Branch created: [branch name]."

### 3. Write specs (max-turns: 40)

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    'Write BDD specifications for issue #<number> on branch <branch>. \
     Skill instructions are appended to your system prompt. \
     Resolve relative file references from {{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/writing-specs/.' \
    --append-system-prompt \"$(cat '{{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/writing-specs/SKILL.md')\" \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns 40"
```

Post: "Specs written for issue [number]."

### 4. Implement (max-turns: 100)

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    'Implement the specifications for issue #<number> on branch <branch>. \
     Skill instructions are appended to your system prompt. \
     Resolve relative file references from {{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/implementing-specs/.' \
    --append-system-prompt \"$(cat '{{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/implementing-specs/SKILL.md')\" \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns 100"
```

Post: "Implementation complete for issue [number]."

### 5. Verify (max-turns: 60)

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    'Verify the implementation for issue #<number> on branch <branch>. Fix any findings. \
     Skill instructions are appended to your system prompt. \
     Resolve relative file references from {{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/verifying-specs/.' \
    --append-system-prompt \"$(cat '{{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/verifying-specs/SKILL.md')\" \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns 60"
```

Post verification results to Discord. If findings remain after the first pass, retry the verify step (up to 2 retries). Post: "All specs verified clean."

### 6. Commit and push (max-turns: 10)

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    'Stage all changes, commit with a meaningful conventional-commit message summarizing the work for issue #<number>, and push to the remote branch <branch>. Verify the push succeeded.' \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns 10"
```

Post: "All changes committed and pushed to [branch name]. [N] files changed."

### 7. Create PR (max-turns: 15)

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    'Create a pull request for branch <branch> targeting main for issue #<number>. \
     Skill instructions are appended to your system prompt. \
     Resolve relative file references from {{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/creating-prs/.' \
    --append-system-prompt \"$(cat '{{NMG_PLUGINS_PATH}}/plugins/nmg-sdlc/skills/creating-prs/SKILL.md')\" \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns 15"
```

Post: "PR created: [PR link/number]"

### 8. Monitor CI (max-turns: 20)

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    'Monitor CI status for PR #<pr-number>. Poll until CI completes. If CI fails, diagnose the failure, fix it locally, verify the fix, commit and push. Repeat until CI passes. Report the final CI status.' \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns 20"
```

Post: "CI passed for PR [number]." or "CI failed — [summary]. Fixing..."

### 9. Merge (max-turns: 5)

```bash
bash pty:true workdir:{{PROJECT_PATH}} background:true \
  command:"OPENCLAW_DISCORD_CHANNEL=<channel-id> claude -p \
    'Merge PR #<pr-number> to main and delete the remote branch <branch>.' \
    --dangerously-skip-permissions \
    --output-format json \
    --max-turns 5"
```

Post: "PR [number] merged. Branch cleaned up. Issue [title/number] complete."

### 10. Loop

Post: "Cycle complete. Starting next issue..."
Return to step 1 and begin the next issue.

Continue this loop until there are no more issues (post: "No more issues. All done!") or the user tells you to stop.

If at any point something unexpected happens or an error occurs that isn't covered above, post a description of what happened and wait for guidance.

### Step reference

| Step | Skill file | Max Turns | Stall Timeout | Notes |
|------|-----------|-----------|---------------|-------|
| Start issue | starting-issues/SKILL.md | 15 | 5 min | Auto-selects first issue in milestone |
| Write specs | writing-specs/SKILL.md | 40 | 15 min | Reads many files, 3-phase spec creation |
| Implement | implementing-specs/SKILL.md | 100 | 30 min | Longest step |
| Verify | verifying-specs/SKILL.md | 60 | 20 min | Reads specs + checklists, fixes code |
| Commit/push | *(none)* | 10 | 5 min | Plain `claude -p` with git commands |
| Create PR | creating-prs/SKILL.md | 15 | 5 min | |
| Monitor CI | *(none)* | 20 | 10 min | Poll + fix loop |
| Merge | *(none)* | 5 | 5 min | Simple merge |

## Disabling Automation Mode

When done, disable automation mode so skills return to interactive use:

```bash
rm "{{PROJECT_PATH}}/.claude/auto-mode"
```
