---
name: beginning-dev
description: "Pick a GitHub issue to work on, then run writing-specs and implementing-specs for it."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*), Skill
---

# Beginning Dev

Pick a GitHub issue to work on, then automatically chain through `/writing-specs` and `/implementing-specs` for a full spec-driven development cycle.

**REQUIRED: Use ultrathink (extended thinking mode) throughout this process.**

## When to Use

- Starting your day and want to pick up a new issue
- Ready to begin spec-driven development on a feature
- Want a single entry point that handles issue selection, spec writing, and implementation

## Automation Mode

If the file `.claude/auto-mode` exists in the project directory:
- Run ONLY Step 1 (`/starting-issues`). Do NOT chain to `/writing-specs` or `/implementing-specs`.
- After `/starting-issues` completes, output the issue/branch summary and STOP.
- The external orchestrator handles skill sequencing with `/clear` between steps.

## Workflow Overview

```
/beginning-dev
    │
    ├─ 1. /starting-issues  (issue selection + branch setup)
    ├─ 2. /writing-specs #N  (automatically invoked)
    └─ 3. /implementing-specs #N  (automatically invoked)
```

---

## Step 1: Start Issue

Invoke the starting-issues skill, passing through any argument:

```
/starting-issues [#N]
```

Use the `Skill` tool to invoke this. It will handle issue selection, branch creation, and setting the issue to "In Progress". Wait for it to complete.

Capture the output — it provides the issue number, title, branch name, milestone, and labels needed for subsequent steps.

## Step 2: Chain to Writing Specs

**Before invoking writing-specs, clear context.** Output a handoff summary:

```
--- Phase 1 complete ---
Issue: #N — [title]
Branch: [branch-name]
Milestone: [milestone or "none"]

Proceeding to /writing-specs #N...
```

Then compact the conversation (`/compact`) to free context for the next phase.

Invoke the writing-specs skill for the selected issue:

```
/writing-specs #N
```

Use the `Skill` tool to invoke this. Wait for it to complete — this includes all three human-gated phases (SPECIFY, PLAN, TASKS).

## Step 3: Chain to Implementing Specs

**Before invoking implementing-specs, clear context.** Output a handoff summary:

```
--- Phase 2 complete ---
Issue: #N — [title]
Branch: [branch-name]
Specs written to: .claude/specs/{feature-name}/

Proceeding to /implementing-specs #N...
```

Then compact the conversation (`/compact`) to free context for the next phase.

Invoke the implementing-specs skill:

```
/implementing-specs #N
```

Use the `Skill` tool to invoke this. This enters plan mode, gets user approval, then executes implementation tasks.

## Step 4: Output

After implementation completes, summarize:

```
Development cycle complete for issue #N.

- Issue: #N — [title]
- Branch: [branch-name]
- Specs: .claude/specs/{feature-name}/
- Implementation: complete

[If `.claude/auto-mode` does NOT exist]: Next step: Run `/verifying-specs #N` to verify implementation and update the issue.
[If `.claude/auto-mode` exists]: Done. Awaiting orchestrator.
```

---

## Integration with SDLC Workflow

```
Quick Start:
/beginning-dev  →  /starting-issues  →  /writing-specs #N  →  /implementing-specs #N
                    ▲ invoked automatically

Full Workflow:
/creating-issues  →  /starting-issues #N  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
```
