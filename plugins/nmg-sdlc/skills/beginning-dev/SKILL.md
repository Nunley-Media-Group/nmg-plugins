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

## Workflow Overview

```
/beginning-dev
    │
    ├─ 1. Fetch milestones & issues
    ├─ 2. Present issue selection (AskUserQuestion)
    ├─ 3. Confirm selected issue
    ├─ 4. Create feature branch
    ├─ 5. /writing-specs #N  (automatically invoked)
    └─ 6. /implementing-specs #N  (automatically invoked)
```

---

## Step 1: Identify Issue

If an argument was provided (e.g., `/beginning-dev #42`), skip to Step 3 using that issue number.

Otherwise, discover available issues:

### Fetch Milestones

```bash
gh api repos/{owner}/{repo}/milestones --jq '.[].title'
```

### Fetch Issues by Milestone

If milestones exist, fetch open issues from the current/next milestone:

```bash
gh issue list -s open -m "<milestone>" -L 10 --json number,title,labels
```

If no milestones are found or no issues exist in any milestone, fall back to all open issues:

```bash
gh issue list -s open -L 10 --json number,title,labels
```

## Step 2: Present Issue Selection

Use `AskUserQuestion` to present up to 4 issues as options.

- Each option label: `#N: Title`
- Each option description: labels (comma-separated), or "No labels" if none
- Include a final option: **"Enter issue number manually"** with description "Type a specific issue number"
- If more than 4 issues exist in the milestone, show the first 4

If the user selects "Enter issue number manually", they will type their issue number via the "Other" free-text input.

## Step 3: Confirm Selection

Read the full issue details:

```bash
gh issue view #N
```

Present a brief summary to the user:
- Issue title and number
- User story (if present)
- Number of acceptance criteria
- Labels and milestone

Ask: "Ready to start spec-driven development on this issue?"

If the user says no, return to Step 2.

## Step 4: Create Feature Branch

Check if already on a feature branch for this issue:

```bash
git branch --show-current
```

If the current branch is `main` or `master`, create and checkout a feature branch:

```bash
git checkout -b N-feature-name
```

Where `N` is the issue number and `feature-name` is a kebab-case slug derived from the issue title.

If already on a branch that references the issue number, stay on it.

## Step 5: Chain to Writing Specs

Invoke the writing-specs skill for the selected issue:

```
/writing-specs #N
```

Use the `Skill` tool to invoke this. Wait for it to complete — this includes all three human-gated phases (SPECIFY, PLAN, TASKS).

## Step 6: Chain to Implementing Specs

After writing-specs completes, invoke the implementing-specs skill:

```
/implementing-specs #N
```

Use the `Skill` tool to invoke this. This enters plan mode, gets user approval, then executes implementation tasks.

## Step 7: Output

After implementation completes, summarize:

```
Development cycle complete for issue #N.

- Issue: #N — [title]
- Branch: [branch-name]
- Specs: .claude/specs/{feature-name}/
- Implementation: complete

Next step: Run `/verifying-specs #N` to verify implementation and update the issue.
```

---

## Integration with SDLC Workflow

```
Quick Start:
/beginning-dev  →  (picks issue)  →  /writing-specs #N  →  /implementing-specs #N
                                      ▲ runs automatically   ▲ runs automatically

Full Workflow:
/creating-issues  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
```
