---
name: write-code
description: "Read specs for current branch, enter plan mode, then execute implementation tasks sequentially. Use when user says 'implement the spec', 'start coding', 'build the feature', 'implement issue #N', 'resume implementation', 'how do I implement this', 'how to start coding', 'write the code', or 'build it'. Do NOT use for writing specs, verifying implementations, or creating PRs. Reads requirements, design, and tasks from specs/ and executes them in order. Fourth step in the SDLC pipeline — follows /write-spec and precedes /verify-code."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Task, Write, Edit, WebFetch, WebSearch, EnterPlanMode, Bash(gh:*), Bash(git:*)
model: opus
effort: xhigh
---

# Write Code

Read the specifications for the current branch's issue, enter plan mode to design the implementation approach, then execute tasks sequentially.

## When to Use

- After specs have been written and approved via `/write-spec`
- When ready to begin coding a specified feature
- To resume implementation of a partially completed spec

## Unattended Mode

If the file `.claude/unattended-mode` exists in the project directory:
- **Do NOT call `EnterPlanMode`.** Still perform Steps 1–3 (identify context, read specs, read steering docs), then design the implementation approach internally in your thinking and proceed to Step 5 (Execute Tasks). Only Step 4 is skipped — calling `EnterPlanMode` in a headless session will fail because there is no user to approve the plan.
- All approval gates are pre-approved. Do NOT call `AskUserQuestion` — proceed without stopping for user input.

## Prerequisites

1. Specs exist at `specs/{feature-name}/` (created by `/write-spec`). The `{feature-name}` is the spec directory name. For specs created with v1.25.0+, this follows the `feature-{slug}` or `bug-{slug}` convention (e.g., `feature-dark-mode`). Legacy specs use `{issue#}-{slug}` (e.g., `42-add-precipitation-overlay`). **Fallback:** Use `Glob` to find `specs/*/requirements.md`. For each result, read the `**Issues**` (or legacy `**Issue**`) frontmatter field and match against the current issue number. If no frontmatter match, try matching the issue number or branch name keywords against the directory name.
2. A feature branch exists for this issue (or will be created)
3. Steering documents exist at `steering/`
4. The project uses the current directory layout — no `.claude/steering/` or `.claude/specs/` content remains. See the **Legacy-Layout Precondition** below.

### Legacy-Layout Precondition

Before Step 1, run `Glob` for `.claude/steering/*.md` and `.claude/specs/*/requirements.md`. If either returns a match, abort and print:

```
ERROR: This project uses the legacy `.claude/steering/` and/or `.claude/specs/` directory layout, which current Claude Code releases refuse to write to. Run `/upgrade-project` first, then re-run `/write-code`.
```

The gate fires in both interactive and unattended mode — do not silently implement against a mixed layout.

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
specs/{feature-name}/
├── requirements.md    — Acceptance criteria, functional requirements
├── design.md          — Architecture, data flow, component design
├── tasks.md           — Phased implementation tasks with dependencies
└── feature.gherkin    — BDD test scenarios
```

If specs don't exist:

**If `.claude/unattended-mode` exists:** Output:

```
No specs found for issue #N. The `/write-spec` step must run first.

[Missing: no spec directory found for this issue, or required files (requirements.md, design.md, tasks.md, feature.gherkin) are absent]

Done. Awaiting orchestrator.
```

Then stop — do not proceed to subsequent steps.

**If `.claude/unattended-mode` does NOT exist:** Use `AskUserQuestion` to prompt: "No specs found. Run `/write-spec #N` first."

### Step 3: Read Steering Documents

Load project conventions:

```
steering/
├── tech.md        — Stack, testing standards, coding conventions
└── structure.md   — Directory layout, naming, patterns
```

These tell you *how* this project implements things (frameworks, patterns, file locations).

### Step 4: Design Implementation Approach

**If `.claude/unattended-mode` exists:** Skip `EnterPlanMode` entirely — it will fail in a headless session. Instead, design the approach internally in your thinking, covering the points below, then go straight to Step 5.

**If `.claude/unattended-mode` does NOT exist:** Call `EnterPlanMode` to design the approach with user approval.

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

**If `.claude/unattended-mode` exists:** The runner handles implementation directly via its code phase — proceed to execute tasks inline using the approach designed in your thinking.

**If `.claude/unattended-mode` does NOT exist:** After the user approves the plan, delegate implementation to the `spec-implementer` agent via the Task tool. Include the Step 5a skill-routing contract in the delegation prompt so the agent classifies and routes skill tasks:

```
Task(subagent_type="nmg-sdlc:spec-implementer",
     prompt="Implement the specs for issue #N in specs/{feature-name}/. Read requirements.md, design.md, tasks.md, and steering docs in steering/, then execute all tasks sequentially. For each task, apply the SKILL-TASK DETECTOR and Skill-Creator Probe Contract defined in the agent's Routing Skill Tasks Through /skill-creator section — route skill-related tasks through /skill-creator when available; fall back to direct authoring with the verbatim warning when not.")
```

The agent will read all spec and steering documents, execute tasks from `tasks.md` sequentially, and return a completion summary with files created/modified.

If the agent reports partial completion or deviations, review its output and decide whether to re-invoke it for remaining tasks or handle them directly.

**Fallback (inline execution):** If the Task tool is unavailable or the agent fails, implement tasks directly:

For each task in `tasks.md`:

1. **Mark in-progress**: Note which task you're working on
2. **Classify**: Apply the SKILL-TASK DETECTOR from Step 5a. If skill-related, route through `/skill-creator` per the Skill-Creator Probe Contract in Step 5a instead of authoring `SKILL.md` directly with `Write`/`Edit`.
3. **Write code**: Follow the spec's design.md for architecture decisions
   - Use patterns from `structure.md` and `tech.md`
   - Follow existing code style in the project
4. **Self-check**: Compare output against the task's acceptance criteria
5. **Test**: Run relevant tests if specified in `tech.md`
6. **Complete**: Mark task done, move to next

### Bug Fix Implementation

When specs follow the **defect format** (root cause analysis in `design.md`, flat task list in `tasks.md`):

- Follow the fix strategy from `design.md` precisely — it describes the minimal correct change
- The task list is flat (2–4 tasks), not phased — execute linearly: fix → regression test → verify
- Minimize change scope — don't refactor surrounding code, clean up adjacent files, or add features
- Write the regression test (T002) before marking the fix complete — it must fail without the fix and pass with it

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

### Step 5a: Route Skill Tasks Through /skill-creator

Skills are Markdown instructions, and `steering/tech.md` declares an architectural invariant: any time a skill is created or edited — whether by a human or by an SDLC workflow — the work MUST be driven through `/skill-creator`. This step detects skill-related tasks and routes them through `/skill-creator` when available, falling back to direct `Write`/`Edit` authoring with a verbatim warning when it is not.

Apply this step both when delegating to the `spec-implementer` agent (include this contract in the delegation prompt) AND in the inline-fallback path of Step 5. Cache the probe result for the duration of the run.

#### SKILL-TASK DETECTOR

A task is classified as **skill-related** when ANY of the following signals is present:
- The target file path ends with `/SKILL.md` (case-sensitive path match)
- The task description contains `skill`, `SKILL.md`, or `skill definition` (case-insensitive, word-boundary match — `skills` matches, `skillet` does not)
- The issue title or body contains `skill` (case-insensitive, word-boundary match)

Detection is deliberately conservative — any single signal triggers routing (false-positive preferred over false-negative). Non-skill tasks skip the probe entirely and use direct `Write`/`Edit` authoring as today.

#### Skill-Creator Probe Contract

1. **Probe for availability** — treat the `skill-creator` skill as available if ANY of the following is true:
   - `Glob` finds `~/.claude/skills/skill-creator/SKILL.md`
   - `Glob` finds `~/.claude/plugins/**/skills/skill-creator/SKILL.md`
   - The available-skills list in your system reminder advertises a skill named `skill-creator` (or `*:skill-creator`)
2. **If available**: invoke `/skill-creator` for the task, passing task context (title, acceptance criteria), the target `SKILL.md` path, existing file content (for edits), and a pointer to `steering/` for project conventions. Let `/skill-creator` author or update the `SKILL.md` — do not use `Write`/`Edit` to hand-author it.
3. **If unavailable**: emit the warning verbatim:

   ```
   skill-creator not available — implementing skill directly
   ```

   Then proceed with direct `Write`/`Edit` authoring for that task.

Cache the probe result for the duration of the run so the warning is emitted at most once per run. The probe is a filesystem/system-reminder check, not an `AskUserQuestion` gate — unattended-mode behaviour is preserved.

If `/skill-creator` is available but errors or reports failures, surface those as additional findings and address them before proceeding to Step 5b.

### Step 5b: Simplify Pass

After all tasks are complete and before signalling completion, run the `/simplify` skill over the files changed on this branch. Simplify is a marketplace skill that is NOT bundled with `nmg-sdlc`; use the probe-and-skip pattern below so pipelines without it continue to work.

#### Simplify-Skill Probe Contract

1. **Probe for availability** — treat the `simplify` skill as available if ANY of the following is true:
   - `Glob` finds `~/.claude/skills/simplify/SKILL.md`
   - `Glob` finds `~/.claude/plugins/**/skills/simplify/SKILL.md`
   - The available-skills list in your system reminder advertises a skill named `simplify` (or `*:simplify`)
2. **If available**: invoke `/simplify` against the files returned by `git diff main...HEAD --name-only`. Apply any fixes it returns in-place. Only proceed to Step 6 once findings are cleared.
3. **If unavailable**: emit the warning verbatim:

   ```
   simplify skill not available — skipping simplification pass
   ```

   Then proceed to Step 6 with the same success status you would have had without the simplify pass.

If the `simplify` skill is available but errors or reports failures, surface those as additional findings and address them before proceeding to Step 6.

Unattended-mode behaviour is preserved — the probe is a filesystem/system-reminder check, not an `AskUserQuestion` gate.

### Step 6: Signal Completion

After all tasks are complete and the simplify pass has either run or been gracefully skipped:

```
Implementation complete for issue #N.

Tasks completed: [X/Y]
Files created: [list]
Files modified: [list]

[If `.claude/unattended-mode` does NOT exist]: Next step: Run `/verify-code #N` to verify implementation and update the issue.
[If `.claude/unattended-mode` exists]: Done. Awaiting orchestrator.
```

---

## Resuming Partial Implementation

If implementation was started but not finished:

1. Read `tasks.md` to see which tasks have been completed
2. Check git log for commits related to this feature
3. Resume from the first incomplete task
4. Continue the workflow from Step 5

---

## Examples

### Example 1: Implement by issue number
User says: "/write-code #42"
Actions: Reads specs from `specs/feature-add-auth/` (or legacy `42-add-auth/`), loads steering docs, enters plan mode, executes tasks sequentially
Result: All tasks complete; user prompted to run `/verify-code #42`

### Example 2: Resume partial implementation
User says: "Resume implementing the current feature"
Actions: Detects branch `42-add-auth`, reads `tasks.md`, finds first incomplete task, resumes from there
Result: Remaining tasks completed from where the previous session left off

---

## Integration with SDLC Workflow

```
/draft-issue  →  /start-issue #N  →  /write-spec #N  →  /write-code #N  →  /simplify  →  /verify-code #N  →  /open-pr #N
                                                                         ▲ You are here
```

`/simplify` is an optional external marketplace skill. When installed, it runs between `/write-code` and `/verify-code` (including from inside `/write-code`'s completion step). When not installed, pipeline steps log a warning and proceed without simplification.
