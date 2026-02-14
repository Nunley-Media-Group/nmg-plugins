# OpenClaw Automation — nmg-sdlc

The SDLC orchestration is handled by a deterministic Node.js script (`scripts/sdlc-runner.mjs`), not prompt engineering. This document explains how to set it up.

## Overview

The runner script drives the full development cycle as a continuous loop:

1. **Start cycle** — checkout main, pull latest
2. **Start issue** — select next issue, create feature branch
3. **Write specs** — BDD specifications (requirements, design, tasks, Gherkin)
4. **Implement** — code the solution from specs
5. **Verify** — verify implementation against specs, fix findings
6. **Commit/push** — stage, commit, push to remote
7. **Create PR** — open pull request targeting main
8. **Monitor CI** — poll CI, fix failures
9. **Merge** — merge PR, clean up branch, loop back to step 1

Each step runs as a separate `claude -p` subprocess. The script handles step sequencing, precondition validation, timeout detection, retry logic, Discord reporting (via `openclaw system event`), and escalation — all deterministically in code.

## Setup

### 1. Create a config file

Copy the template and fill in your project paths:

```bash
cp scripts/sdlc-config.example.json ~/my-project-sdlc-config.json
```

Edit the config:

```json
{
  "projectPath": "/path/to/your/project",
  "pluginsPath": "/path/to/nmg-plugins",
  "model": "opus",
  "steps": {
    "startCycle":   { "maxTurns": 5,   "timeoutMin": 5  },
    "startIssue":   { "maxTurns": 15,  "timeoutMin": 5,  "skill": "starting-issues" },
    "writeSpecs":   { "maxTurns": 40,  "timeoutMin": 15, "skill": "writing-specs" },
    "implement":    { "maxTurns": 100, "timeoutMin": 30, "skill": "implementing-specs" },
    "verify":       { "maxTurns": 60,  "timeoutMin": 20, "skill": "verifying-specs" },
    "commitPush":   { "maxTurns": 10,  "timeoutMin": 5  },
    "createPR":     { "maxTurns": 15,  "timeoutMin": 5,  "skill": "creating-prs" },
    "monitorCI":    { "maxTurns": 20,  "timeoutMin": 10 },
    "merge":        { "maxTurns": 5,   "timeoutMin": 5  }
  },
  "maxRetriesPerStep": 3
}
```

Use `/generating-prompt /path/to/project` to generate a config with paths pre-filled.

### 2. Install the OpenClaw skill

```bash
./scripts/install-openclaw-skill.sh
# or, to keep in sync with the repo:
./scripts/install-openclaw-skill.sh --link
```

### 3. Launch via OpenClaw

Message your OpenClaw agent on Discord:

> run sdlc --config /path/to/my-project-sdlc-config.json

The agent matches this to the `/running-sdlc` skill and launches the runner as a background process.

### 4. Monitor and control

- **Status:** Ask the agent "sdlc status" — it reads `sdlc-state.json` and reports current step, issue, and retries.
- **Stop:** Ask the agent "stop sdlc" — it sends SIGTERM to the runner, which gracefully shuts down (commits work, posts to Discord).
- **Logs:** Check `/tmp/sdlc-runner.log` for detailed output.

## Direct usage (without OpenClaw)

You can run the script directly:

```bash
# Full continuous loop
node scripts/sdlc-runner.mjs --config /path/to/config.json

# Dry run — log actions without executing
node scripts/sdlc-runner.mjs --config /path/to/config.json --dry-run

# Run a single step
node scripts/sdlc-runner.mjs --config /path/to/config.json --step 4

# Resume after a crash
node scripts/sdlc-runner.mjs --config /path/to/config.json --resume
```

## What's deterministic (was prompt-driven)

| Concern | Before (prompt) | After (code) |
|---------|-----------------|--------------|
| Step sequencing | LLM interprets "launch next step" | `for` loop over step array |
| Precondition checks | LLM reads table, decides what to check | `fs.existsSync()`, `git status` |
| Timeout detection | LLM compares elapsed time | `AbortController` + `setTimeout` |
| State file updates | LLM writes JSON | `JSON.stringify()` + atomic write |
| Discord posting | LLM remembers to post | `postDiscord()` at every transition |
| Retry counting | LLM reads/increments JSON field | `state.retries[step]++` |
| Escalation | LLM follows protocol | `escalate()` function |
| Spec validation gate | LLM runs `ls` and checks | `fs.existsSync()` for 4 files |
| Continuous loop | LLM told "do NOT stop" | `while` loop |
| Error pattern matching | LLM parses output | `RegExp.test()` on stdout |

## What stays non-deterministic (Claude Code execution)

All actual SDLC work executes inside Claude Code sessions — spec writing quality, implementation approach, verification thoroughness, PR descriptions, CI fix strategies, and issue selection are all LLM-driven and skill-guided.
