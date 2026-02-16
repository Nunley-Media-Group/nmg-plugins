---
name: starting-issues
description: "Select a GitHub issue, create a linked feature branch, and set the issue to In Progress."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*)
---

> **CRITICAL (Headless/Auto-Mode):** If `.claude/auto-mode` exists, **NEVER** call `AskUserQuestion`. Select issues automatically and skip all confirmation steps. Calling `AskUserQuestion` in pipe mode will be denied and waste all turns.

# Starting Issues

Select a GitHub issue to work on, create a linked feature branch, and set the issue to "In Progress" in any associated GitHub Project.

## When to Use

- Starting work on a specific GitHub issue
- Picking up the next issue from your milestone
- Setting up a feature branch linked to an issue before writing specs or implementing

## Automation Mode

If the file `.claude/auto-mode` exists in the project directory:
- If an issue number was provided as an argument, **skip Steps 2–3** (selection and confirmation) — go directly to Step 4.
- If no issue number was provided, **select the first available issue** (sorted by issue number ascending — oldest first) from the current milestone (or all open issues if no milestone exists) **without calling `AskUserQuestion`**. **Skip Step 3 confirmation.**

## Workflow Overview

```
/starting-issues [#N]
    │
    ├─ 1. Fetch milestones & issues
    ├─ 2. Present issue selection (AskUserQuestion)
    ├─ 3. Confirm selected issue
    └─ 4. Create linked feature branch & set issue to In Progress
```

---

## Step 1: Identify Issue

If an argument was provided (e.g., `/starting-issues #42`), skip to Step 3 using that issue number.

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

> **Auto-mode:** If `.claude/auto-mode` exists, skip this step entirely — do NOT call `AskUserQuestion`.

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

Ask: "Ready to start working on this issue?"

If the user says no, return to Step 2.

## Step 4: Create Feature Branch & Link to Issue

Check if already on a feature branch for this issue:

```bash
git branch --show-current
```

If already on a branch that references the issue number, stay on it and skip branch creation.

If the current branch is `main` or `master`, create a linked feature branch using `gh issue develop`, which both creates the branch AND associates it with the issue in GitHub's "Development" sidebar:

```bash
gh issue develop N --checkout --name N-feature-name
```

Where `N` is the issue number and `feature-name` is a kebab-case slug derived from the issue title.

### Update Issue Status to In Progress

After creating the branch, move the issue to "In Progress" in any associated GitHub Project. Use the GraphQL API to discover the project, field, and option IDs, then update:

1. **Get the issue's project item info:**

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        projectItems(first: 10) {
          nodes {
            id
            project { id title }
            fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                    options { id name }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
' -f owner=OWNER -f repo=REPO -F number=N
```

Replace `OWNER`, `REPO`, and `N` with actual values derived from `gh repo view --json owner,name`.

2. **From the response, extract:**
   - `projectId` — the project's ID
   - `itemId` — the issue's project item ID
   - `fieldId` — the Status field's ID
   - `optionId` — the ID of the "In Progress" option (match by name, case-insensitive)

3. **Update the status:**

```bash
gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }) {
      projectV2Item { id }
    }
  }
' -f projectId=PROJECT_ID -f itemId=ITEM_ID -f fieldId=FIELD_ID -f optionId=OPTION_ID
```

If the issue is not in any project, or no "In Progress" option exists, skip the status update silently and continue.

---

## Output

When complete, output a structured summary:

```
--- Issue Ready ---
Issue: #N — [title]
Branch: [branch-name]
Milestone: [milestone or "none"]
Labels: [labels or "none"]
Status: In Progress
```

This summary serves as the handoff contract for downstream skills like `/writing-specs` and `/implementing-specs`.

---

## Integration with SDLC Workflow

```
Standalone:
/starting-issues #N  →  /writing-specs #N  →  /implementing-specs #N

Full Workflow:
/creating-issues  →  /starting-issues #N  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
```
