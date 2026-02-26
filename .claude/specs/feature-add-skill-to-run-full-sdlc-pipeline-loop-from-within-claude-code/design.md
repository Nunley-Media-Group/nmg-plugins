# Design: Running SDLC Loop Skill

**Issues**: #107
**Date**: 2026-02-25
**Status**: Draft
**Author**: Claude Code

---

## Overview

This feature adds a new Claude Code skill (`running-sdlc-loop`) to the nmg-sdlc plugin that orchestrates the full SDLC pipeline from within an active Claude Code session. Instead of reimplementing orchestration logic, the skill invokes the existing `sdlc-runner.mjs` script — the same deterministic orchestrator that OpenClaw uses — by unsetting the `CLAUDECODE` environment variable so it can spawn `claude -p` subprocesses.

The skill is a thin wrapper: it locates or generates a config file, then runs `CLAUDECODE="" node sdlc-runner.mjs --config <path>`. The runner already handles issue selection, phase sequencing, precondition/postcondition validation, retry logic, failure detection, and state management. This reuse avoids duplicating proven orchestration logic.

To support single-issue mode, the runner gains a new `--issue N` CLI flag that restricts processing to a single specified issue number and exits after one cycle (no loop).

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│               running-sdlc-loop (SKILL.md)                  │
│                                                             │
│  Step 1: Locate/generate sdlc-config.json                  │
│  Step 2: Resolve runner path from config.pluginsPath        │
│  Step 3: Invoke runner with CLAUDECODE=""                   │
│  Step 4: Report results                                     │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Bash: CLAUDECODE="" node sdlc-runner.mjs
               │       --config <path> [--issue N]
               ▼
┌─────────────────────────────────────────────────────────────┐
│               sdlc-runner.mjs (existing)                     │
│                                                             │
│  Step 1: startCycle  — checkout main, pull                  │
│  Step 2: startIssue  — select + branch + set In Progress   │
│  Step 3: writeSpecs  — write BDD specifications             │
│  Step 4: implement   — implement from specs                 │
│  Step 5: verify      — verify implementation                │
│  Step 6: commitPush  — commit + push changes                │
│  Step 7: createPR    — create pull request + version bump   │
│  Step 8: monitorCI   — poll CI, fix failures                │
│  Step 9: merge       — merge PR to main                     │
│                                                             │
│  [Loop] → back to Step 1 for next issue                    │
│  [--issue N] → exit after Step 9 (single cycle)            │
│                                                             │
│  Built-in: preconditions, postconditions, retries,          │
│  soft failure detection, escalation, state management       │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Spawns claude -p subprocesses
               ▼
┌─────────────────────────────────────────────────────────────┐
│  Claude Code sessions (one per step)                        │
│  Each session loads nmg-sdlc plugin and invokes the         │
│  appropriate skill (starting-issues, writing-specs, etc.)   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User invokes /nmg-sdlc:running-sdlc-loop [#N]
2. Skill checks for sdlc-config.json at project root
3. If missing, invokes /generating-openclaw-config to create it
4. Reads config to resolve pluginsPath
5. Derives runner path: <pluginsPath>/openclaw/scripts/sdlc-runner.mjs
6. Builds command:
   - Loop mode:    CLAUDECODE="" node <runner> --config <config>
   - Single issue: CLAUDECODE="" node <runner> --config <config> --issue N
7. Executes runner via Bash tool (long-running, may take hours)
8. Reports runner exit status and any failure diagnostics
```

---

## Skill Interface

### SKILL.md Frontmatter

```yaml
---
name: running-sdlc-loop
description: "Run the full SDLC pipeline loop for automatable issues. Use when user says 'run SDLC loop', 'run the pipeline', 'process all issues', 'run SDLC for #N', or 'automate the milestone'. Do NOT use for individual phases (writing-specs, implementing-specs, etc.)."
argument-hint: "[#issue-number]"
model: sonnet
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(test:*), Bash(cat:*), Skill
---
```

**Tool rationale:**

| Tool | Purpose |
|------|---------|
| `Read` | Read config file, check auto-mode |
| `Glob` | Find config files |
| `Grep` | Search config for paths |
| `Bash(node:*)` | Invoke the runner: `CLAUDECODE="" node sdlc-runner.mjs ...` |
| `Bash(test:*)` | File existence checks (`test -f sdlc-config.json`) |
| `Bash(cat:*)` | Read runner output / logs if needed |
| `Skill` | Invoke `/generating-openclaw-config` if config is missing |

**Note**: The model is `sonnet` because the skill's own logic is lightweight (config resolution + runner invocation). The runner spawns its own Claude sessions with their own model settings from the config file.

### Arguments

| Argument | Format | Behavior |
|----------|--------|----------|
| None | `/nmg-sdlc:running-sdlc-loop` | Loop mode — runner processes all automatable issues continuously |
| Issue number | `/nmg-sdlc:running-sdlc-loop #107` or `107` | Single-issue mode — runner processes only this issue then exits |

---

## Runner Enhancement: `--issue N` Flag

### Change to `sdlc-runner.mjs`

Add a new `--issue` CLI option that restricts the runner to a single specified issue:

#### CLI Parsing

```javascript
// Add to parseArgs options:
'issue': { type: 'string' },

// After parsing:
let SINGLE_ISSUE_NUMBER = args.issue ? parseInt(args.issue, 10) : null;
```

#### Behavior When `--issue N` Is Provided

| Aspect | Default (no flag) | With `--issue N` |
|--------|-------------------|------------------|
| Issue selection (Step 2) | Prompt Claude to select next automatable issue | Prompt Claude to start issue #N specifically |
| Loop behavior | After step 9, loop back to step 1 for next issue | After step 9, exit with code 0 (single cycle) |
| Escalation | Escalate + move to next issue | Escalate + exit with non-zero code |
| `hasOpenIssues` check | Controls loop continuation | Skipped — single issue doesn't need it |

#### Step 2 Prompt Modification

When `SINGLE_ISSUE_NUMBER` is set, the step 2 prompt changes from:

```
"Select and start the next GitHub issue from the current milestone..."
```

to:

```
"Start issue #N. Create a linked feature branch and set the issue to In Progress."
```

#### Main Loop Exit Condition

After step 9 completes successfully with `--issue`:

```javascript
if (result === 'ok' && step.number === 9 && SINGLE_ISSUE_NUMBER) {
  log(`Single-issue mode: issue #${SINGLE_ISSUE_NUMBER} complete. Exiting.`);
  break; // Exit the main while loop
}
```

#### Escalation Behavior

When `--issue` is set, escalation should exit the runner (not loop to next issue):

```javascript
if (SINGLE_ISSUE_NUMBER) {
  // Single-issue mode: don't loop, just exit
  removeAutoMode();
  process.exit(1);
}
```

---

## Config File Resolution

### Location Strategy

The skill checks for config in this order:

1. `sdlc-config.json` at project root (standard location from `/generating-openclaw-config`)
2. If not found: invoke `Skill("nmg-sdlc:generating-openclaw-config")` to create it
3. Re-read the newly created config

### Runner Path Derivation

From the config file:

```json
{
  "pluginsPath": "/Users/user/.claude/plugins/marketplaces/nmg-plugins",
  ...
}
```

Runner path = `<pluginsPath>/openclaw/scripts/sdlc-runner.mjs`

Verify the runner exists before invoking:

```bash
test -f "<pluginsPath>/openclaw/scripts/sdlc-runner.mjs"
```

If missing, report error: "Runner script not found. Ensure nmg-plugins marketplace is cloned."

---

## CLAUDECODE Unset Pattern

Claude Code sets the `CLAUDECODE` environment variable in all child processes. The `claude` CLI refuses to start inside another Claude Code session when this is set. Unsetting it allows the runner to spawn `claude -p` subprocesses:

```bash
CLAUDECODE="" node <runner-path> --config <config-path>
```

This is a known and documented pattern (see memory: "Exercise Testing Skills" section).

---

## Auto-Mode Behavior

The runner **automatically creates `.claude/auto-mode`** on startup (line 1917-1923 of `sdlc-runner.mjs`). This means:

- The skill does NOT need to manage auto-mode — the runner handles it
- The runner removes auto-mode on exit (`removeAutoMode()`)
- Phase skills inside the runner's `claude -p` subprocesses will detect auto-mode and skip interactive prompts

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Use Skill tool for in-session invocation** | Invoke each phase skill directly via Skill tool within the same session | Shared context; no subprocess spawning | Reimplements orchestration logic (preconditions, retries, state, soft failures); context window exhaustion over multiple issues; no CI monitoring or merge steps | Rejected — duplicates proven logic |
| **B: Invoke sdlc-runner.mjs with CLAUDECODE=""** | Run the same runner script OpenClaw uses, unsetting CLAUDECODE to enable subprocess spawning | Reuses all existing orchestration; battle-tested retry/escalation/state logic; includes CI monitoring and merge; isolated contexts per step prevent exhaustion | Requires long Bash timeout; adds `--issue` flag to runner | **Selected** — maximizes reuse, minimizes risk |
| **C: Use Task tool to spawn runner in background** | Run the runner via Task tool's background mode | Doesn't block the session | Task tool results are limited; harder to stream progress | Rejected — Bash with long timeout is simpler |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bash timeout for long-running runner | Medium | High — runner killed mid-cycle | Use `run_in_background: true` or set timeout to maximum (600000ms) with clear documentation |
| Config file missing or incorrect | Low | Medium — runner fails to start | Skill checks for config first and generates via `/generating-openclaw-config` if missing |
| Runner path resolution fails | Low | High — skill can't invoke runner | Verify path exists before invocation; provide clear error message |
| `CLAUDECODE=""` pattern breaks in future Claude Code versions | Low | High — subprocess spawning fails | Pattern is documented and used by exercise testing; would affect all testing too |
| `--issue` flag introduces regressions in runner | Low | Medium | Runner has existing test suite in `openclaw/scripts/__tests__/`; add tests for new flag |

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| SKILL.md | Prompt quality review | Unambiguous instructions, correct tool refs, complete workflow paths |
| SKILL.md | `/doing-skills-right` validation | Frontmatter, allowed-tools, auto-mode, integration section (AC5) |
| `sdlc-runner.mjs` | Unit tests (Jest) | New `--issue` flag behavior: single-cycle exit, prompt modification, escalation exit |
| Feature | Exercise testing | Load plugin, invoke skill against a test project; verify runner starts and processes issue |
| Integration | End-to-end | Process 1 issue in single-issue mode, verify PR created; process 2+ in loop mode |

---

## File Changes

| File | Change | Purpose |
|------|--------|---------|
| `plugins/nmg-sdlc/skills/running-sdlc-loop/SKILL.md` | **New** | The skill definition — thin wrapper around runner invocation |
| `openclaw/scripts/sdlc-runner.mjs` | **Modify** | Add `--issue N` CLI flag for single-issue mode |
| `openclaw/scripts/__tests__/sdlc-runner.test.mjs` | **Modify** | Add tests for `--issue` flag behavior |
| `README.md` | **Update** | Document new skill in skills reference |
| `CHANGELOG.md` | **Update** | Add entry under `[Unreleased]` |

---

## Open Questions

- (none — design builds on established patterns)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #107 | 2026-02-25 | Initial feature spec |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`) — SKILL.md in `skills/{name}/` directory
- [x] All interface changes documented — SKILL.md frontmatter, runner CLI flag
- [x] No database/storage changes needed
- [x] State management handled by existing runner (`sdlc-state.json`)
- [x] No UI components needed (CLI skill)
- [x] Security considerations addressed — uses existing auth; `--dangerously-skip-permissions` already used by runner
- [x] Performance impact analyzed — runner runs in subprocess, doesn't exhaust parent session context
- [x] Testing strategy defined — skill validation + runner unit tests + exercise testing
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
