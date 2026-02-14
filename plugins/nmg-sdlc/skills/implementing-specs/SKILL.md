---
name: implementing-specs
description: "Read specs for current branch, enter plan mode, then execute implementation tasks sequentially."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Task, Write, Edit, WebFetch, WebSearch, EnterPlanMode, Bash(gh:*), Bash(git:*)
---

# Implementing Specs

Read the specifications for the current branch's issue, enter plan mode to design the implementation approach, then execute tasks sequentially.

**REQUIRED: Use ultrathink (extended thinking mode) throughout the implementation process.**

## When to Use

- After specs have been written and approved via `/writing-specs`
- When ready to begin coding a specified feature
- To resume implementation of a partially completed spec

## Automation Mode

If the file `.claude/auto-mode` exists in the project directory:
- **Do NOT call `EnterPlanMode`.** Design the implementation approach internally in your thinking based on the specs, then proceed directly to Step 5 (Execute Tasks). Calling `EnterPlanMode` in a headless session will fail because there is no user to approve the plan.
- All approval gates are pre-approved. Do NOT call `AskUserQuestion` — proceed without stopping for user input.

## Prerequisites

1. Specs exist at `.claude/specs/{feature-name}/` (created by `/writing-specs`)
2. A feature branch exists for this issue (or will be created)
3. Steering documents exist at `.claude/steering/`

---

## Workflow

### Step 1: Identify Context

Determine the issue and feature being implemented:

1. **From argument**: If `#N` is provided, use that issue number
2. **From branch name**: Parse the current branch for an issue number
   - Common patterns: `42-feature-name`, `feature/42-name`, `issue-42`
   - Run `git branch --show-current` to get current branch
3. **Read the issue**: `gh issue view #N` for full context

If no issue can be identified, ask the user.

### Step 2: Read Specs

Load all specification documents:

```
.claude/specs/{feature-name}/
├── requirements.md    — Acceptance criteria, functional requirements
├── design.md          — Architecture, data flow, component design
├── tasks.md           — Phased implementation tasks with dependencies
└── feature.gherkin    — BDD test scenarios
```

If specs don't exist, prompt: "No specs found. Run `/writing-specs #N` first."

### Step 3: Read Steering Documents

Load project conventions:

```
.claude/steering/
├── tech.md        — Stack, testing standards, coding conventions
└── structure.md   — Directory layout, naming, patterns
```

These tell you *how* this project implements things (frameworks, patterns, file locations).

### Step 4: Design Implementation Approach

**If `.claude/auto-mode` exists:** Skip `EnterPlanMode` entirely — it will fail in a headless session. Instead, design the approach internally in your thinking, covering the points below, then go straight to Step 5.

**If `.claude/auto-mode` does NOT exist:** Call `EnterPlanMode` to design the approach with user approval.

The implementation approach (whether internal or in plan mode) should:

1. **Map tasks to files**: Take each task from `tasks.md` and map it to actual files in the codebase
   - Use `Glob` and `Grep` to find existing code to build on
   - Reference `structure.md` for directory conventions
2. **Identify reuse**: Find existing code patterns to follow
   - Similar features already implemented
   - Shared utilities, base classes, common patterns
3. **Propose implementation order**: Based on task dependencies
4. **Flag any deviations**: If the codebase has evolved since specs were written
5. **Present the plan** for user approval (interactive only)

### Step 5: Execute Tasks

After the user approves the plan, implement tasks sequentially:

For each task in `tasks.md`:

1. **Mark in-progress**: Note which task you're working on
2. **Write code**: Follow the spec's design.md for architecture decisions
   - Use patterns from `structure.md` and `tech.md`
   - Follow existing code style in the project
3. **Self-check**: Compare output against the task's acceptance criteria
4. **Test**: Run relevant tests if specified in `tech.md`
5. **Complete**: Mark task done, move to next

### Implementation Rules

| Rule | Rationale |
|------|-----------|
| Follow the spec | Reduces deviation and rework |
| One task at a time | Maintains focus and traceability |
| Test after each task | Catches issues early |
| Update spec if needed | Keep specs as living documents |
| Reference steering docs | Ensures consistency with project conventions |

### Handling Deviations

If you discover during implementation that the spec needs changes:

1. **Minor deviation**: Note it and proceed, update spec after
2. **Major deviation**: Stop and discuss with the user
3. **Blocker**: Flag the issue, suggest alternatives

### Step 6: Signal Completion

After all tasks are complete:

```
Implementation complete for issue #N.

Tasks completed: [X/Y]
Files created: [list]
Files modified: [list]

[If `.claude/auto-mode` does NOT exist]: Next step: Run `/verifying-specs #N` to verify implementation and update the issue.
[If `.claude/auto-mode` exists]: Done. Awaiting orchestrator.
```

---

## Resuming Partial Implementation

If implementation was started but not finished:

1. Read `tasks.md` to see which tasks have been completed
2. Check git log for commits related to this feature
3. Resume from the first incomplete task
4. Continue the workflow from Step 5

---

## Integration with SDLC Workflow

```
/creating-issues  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
                                                 ▲ You are here
```
