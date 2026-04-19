---
name: start-issue
description: "Select a GitHub issue, create a linked feature branch, and set the issue to In Progress. Use when user says 'start issue', 'pick up issue', 'begin working on #N', 'start #N', 'what should I work on', 'how do I start an issue', 'how to begin work on an issue', or 'kick off issue #N'. Do NOT use for creating issues, writing specs, or implementing code. Fetches milestones, presents issue selection, creates branch via gh issue develop, and updates project board status. Second step in the SDLC pipeline — follows /draft-issue and precedes /write-spec."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*)
---

> **CRITICAL (Headless/Unattended-Mode):** If `.claude/unattended-mode` exists, **NEVER** call `AskUserQuestion`. Select issues automatically and skip all confirmation steps. Calling `AskUserQuestion` in pipe mode will be denied and waste all turns.

# Start Issue

Select a GitHub issue to work on, create a linked feature branch, and set the issue to "In Progress" in any associated GitHub Project.

## When to Use

- Starting work on a specific GitHub issue
- Picking up the next issue from your milestone
- Setting up a feature branch linked to an issue before writing specs or implementing

## Unattended Mode

If the file `.claude/unattended-mode` exists in the project directory:
- If an issue number was provided as an argument, **skip Steps 2–3** (selection and confirmation) — go directly to Step 4.
- If no issue number was provided, **select the first unblocked `automatable` issue in topological order** (ties broken by issue number ascending) from the first viable milestone (sorted alphabetically) (or all open issues if no viable milestone exists) **without calling `AskUserQuestion`**. **Skip Step 3 confirmation.** Blocked issues (any issue whose declared dependencies include an open issue) are never selected, even if they have the lowest issue number — see Step 1a: Dependency Resolution.
- **Only issues with the `automatable` label are eligible.** Add `--label automatable` to all `gh issue list` commands in unattended mode. If no automatable issues are found, run a diagnostic query (see "Unattended-Mode: Empty Result Handling") and exit without creating a branch.

## Workflow Overview

```
/start-issue [#N]
    │
    ├─ 1.  Fetch milestones & issues
    ├─ 1a. Dependency resolution (filter blocked, topological sort)
    ├─ 2.  Present issue selection (AskUserQuestion)
    ├─ 3.  Confirm selected issue
    └─ 4.  Create linked feature branch & set issue to In Progress
         ├─ Precondition: working tree must be clean
         └─ Create branch, update status
```

---

## Step 0: Legacy-Layout Gate

**Before any other work**, check whether this project still uses the legacy `.claude/steering/` or `.claude/specs/` directory layout. Current Claude Code releases protect the project-level `.claude/` directory from Edit/Write, so SDLC skills can no longer author files under those paths. Canonical SDLC artifacts must live at `steering/` and `specs/` at the project root.

1. Run `Glob` for `.claude/steering/*.md` and `.claude/specs/*/requirements.md`.
2. If either glob returns at least one match, the project uses the legacy layout. **Abort immediately without creating a branch, updating issue status, or modifying anything.**

Print the following message and exit:

```
ERROR: This project uses the legacy `.claude/steering/` and/or `.claude/specs/` directory layout, which current Claude Code releases refuse to write to. The SDLC pipeline cannot proceed until the project is upgraded.

Run `/upgrade-project` first. It will:
  - Relocate `.claude/steering/` → `steering/`
  - Relocate `.claude/specs/` → `specs/`
  - Rewrite intra-file cross-references
  - Preserve runtime artifacts (`.claude/unattended-mode`, `.claude/sdlc-state.json`) unchanged

Then re-run `/start-issue`.
```

**Unattended-mode:** The gate still fires. Automation on a legacy-layout project must halt — do not silently write to a mixed state. Output the same message (framed as an orchestrator escalation) and exit without creating a branch.

If the glob returns no matches, proceed to Step 1.

---

## Step 1: Identify Issue

If an argument was provided (e.g., `/start-issue #42`), skip to Step 3 using that issue number.

Otherwise, discover available issues:

### Fetch Viable Milestones

Fetch milestones that have at least one open issue, sorted alphabetically:

```bash
gh api repos/{owner}/{repo}/milestones --jq '[.[] | select(.open_issues > 0) | {title: .title, open_issues: .open_issues}] | sort_by(.title)'
```

If this call fails (network error, auth failure, or no milestones endpoint), treat as zero viable milestones and fall back to all open issues.

### Select Milestone and Fetch Issues

Apply deterministic selection based on the number of viable milestones:

- **Zero viable milestones:** Fall back to all open issues:
  ```bash
  # Interactive mode:
  gh issue list -s open -L 10 --json number,title,labels
  # Unattended-mode:
  gh issue list -s open --label automatable -L 10 --json number,title,labels
  ```

- **One viable milestone:** Auto-select it and fetch its issues:
  ```bash
  # Interactive mode:
  gh issue list -s open -m "<milestone>" -L 10 --json number,title,labels
  # Unattended-mode:
  gh issue list -s open -m "<milestone>" --label automatable -L 10 --json number,title,labels
  ```

- **Multiple viable milestones:**
  - **Interactive mode:** Present the filtered milestone list via `AskUserQuestion` (label: milestone title, description: "N open issues"), then fetch issues from the selected milestone.
  - **Unattended-mode:** Select the first milestone alphabetically and fetch its issues (with `--label automatable`).

#### Unattended-Mode: Empty Result Handling

After fetching issues in unattended mode, if the result is an empty array (`[]`):

1. **Run a diagnostic query** to count total open issues in the same scope, **without** the `--label automatable` filter. The diagnostic query MUST match the same scope as the original query:

   - If the original query was milestone-scoped (`-m "<milestone>"`):
     ```bash
     gh issue list -s open -m "<milestone>" --json number --jq 'length'
     ```
   - If the original query was repo-wide (no milestone):
     ```bash
     gh issue list -s open --json number --jq 'length'
     ```

2. **Output based on the total open count:**

   - **If total open > 0:**
     ```
     No automatable issues found (N open issues exist without the automatable label).
     Consider adding the automatable label to issues that should be picked up automatically.
     Done. Awaiting orchestrator.
     ```
   - **If total open = 0:**
     ```
     No automatable issues found. 0 open issues in scope.
     Done. Awaiting orchestrator.
     ```

3. Exit immediately — do **not** create a branch, do **not** fall back to non-automatable issues.

After the raw candidate set is produced by Step 1 (and the empty-result handler has not fired), **proceed to Step 1a before any presentation or auto-selection**.

## Step 1a: Dependency Resolution

Filter out blocked issues and topologically order the remainder so parents appear before their descendants. This runs in **both interactive and unattended mode**, on the candidate set produced by Step 1. Emit a session note reporting the filtered count before presentation/auto-selection, even when the count is zero.

### Fetch Dependency Metadata (single GraphQL batch)

Issue a single `gh api graphql` call that requests `parent`, `subIssues`, `state`, and `body` for every candidate issue in one round-trip. Use one aliased field per issue number inside a single query (e.g. `issue127: issue(number: 127) { ... }`), passed as a `-f query='...'` argument to `gh api graphql`. The query shape per issue:

```graphql
issue(number: N) {
  number
  state
  parent { number state }                       # tracked-by link
  subIssues(first: 50) { nodes { number state } }
  body
}
```

Any parent whose `state` is not `CLOSED` (including `OPEN`) is treated as an unresolved dependency.

If `parent` or `subIssues` fields return `null` or `[]` but the GraphQL call itself succeeded (HTTP 200), treat the native contribution for that issue as an empty set and continue — **this is not a fallback condition**.

### Parse Body Cross-Refs

Scan each issue body **line-by-line, case-insensitive, line-anchored**:

| Pattern | Meaning |
|---------|---------|
| `^\s*Depends on:\s*(#\d+(?:\s*,\s*#\d+)*)` | Current issue depends on the listed issues (they are parents) |
| `^\s*Blocks:\s*(#\d+(?:\s*,\s*#\d+)*)` | Current issue blocks the listed issues (they depend on current) |

Extract issue numbers with `#?(\d+)`. **Normalize**: a `Blocks: #Y` on issue `X` is recorded as a `Depends on: #X` on issue `Y`. Cross-repo references (e.g. `owner/repo#N`) are ignored.

### Build Graph

Construct `parentsOf: Map<issue_number, Set<parent_number>>` by merging the native links (parent + inverse sub-issues) with the body-cross-ref data. An issue declared as a parent in both formats counts once (set deduplication).

Native link normalization: a `parent` entry on issue `C` with `{number: P}` adds `P` to `parentsOf[C]`; a `subIssues` entry on issue `P` with node `{number: C}` adds `P` to `parentsOf[C]` (inverse — the sub-issue's parent is `P`).

### Blocked Filter

An issue `I` is **blocked** and dropped from the candidate set if any element of `parentsOf[I]` is not in `CLOSED` state. Parents that are missing, deleted, or cross-repo are treated as closed (fail-open) so typos or deleted refs do not halt the pipeline.

### Topological Sort (Kahn's algorithm)

1. Compute in-degree counting only parents that are **also in the candidate set** (external parents are already closed by precondition).
2. Seed a priority queue with all zero-in-degree nodes, ordered by **issue number ascending**.
3. Pop the lowest-numbered zero-in-degree node, append it to the output, decrement in-degrees of its children, and enqueue newly-zero children.
4. Repeat until the queue drains.

Ties between sibling zero-in-degree nodes always break by issue number ascending to preserve predictable ordering.

### Cycle Handling

If any candidate remains un-emitted after the queue drains, those nodes form a cycle. **Do not abort**:

1. Emit a warning naming the participants:
   ```
   WARNING: Dependency cycle detected among issues #A, #B, #C — placing at end of list in issue-number order.
   ```
2. Append the cycle members to the output list in **issue-number ascending order**.
3. Continue.
4. In unattended mode, this warning is informational only — the runner does not escalate based on cycles.

### Fallback Chain

| Failure | Fallback |
|---------|----------|
| GraphQL batch query fails (network/auth/preview unavailable) | Re-fetch bodies only via `gh issue view --json body` per issue; parse body cross-refs only; emit `WARNING: Native dependency links unavailable; using body cross-refs only.` |
| Body fetch also fails | Skip dependency resolution entirely; emit `WARNING: Dependency resolution unavailable; preserving legacy ordering.`; preserve legacy issue-number-ascending ordering; do not abort |

### Session Note

Before presentation (interactive) or auto-selection (unattended), emit exactly one line to stdout:

```
Filtered N blocked issues from selection.
```

Emit the line **even when `N == 0`** — it confirms dependency resolution ran (observability per FR14).

### Output

The topologically-ordered, blocked-filtered list from Step 1a is what Steps 2 and the unattended auto-pick consume.

## Step 2: Present Issue Selection

> **Unattended-mode:** If `.claude/unattended-mode` exists, skip this step entirely — do NOT call `AskUserQuestion`.

Use `AskUserQuestion` to present up to 4 issues as options, drawn from the **topologically-ordered, blocked-filtered list produced by Step 1a** (not the raw Step 1 fetch).

- Each option label: `#N: Title`
- Each option description: labels (comma-separated), or "No labels" if none. If the issue has the `automatable` label, append `(automatable)` to the description.
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

### Precondition: Working Tree Check

Before any branch operation, verify the working tree is clean:

```bash
git status --porcelain
```

**Filter SDLC runner artifacts** before evaluating the output. Remove any lines whose file path ends with `.claude/sdlc-state.json` or `.claude/unattended-mode` — these are runtime artifacts managed by the SDLC runner and are not real working-tree dirt.

- **If the filtered output is empty** (clean tree): proceed to branch creation below.
- **If the filtered output is non-empty** (dirty tree): abort immediately. Do **not** call `gh issue develop`.

**Interactive mode** — output an error and stop:

```
ERROR: Working tree is not clean. Cannot create feature branch.

Dirty files:
[paste the git status --porcelain output here]

Please resolve these changes (commit, stash, or discard) before running /start-issue again.
```

**Unattended-mode** (`.claude/unattended-mode` exists) — report as an escalation reason for the runner:

```
Working tree is not clean. Cannot create feature branch.

Dirty files:
[paste the git status --porcelain output here]

Resolve these changes before retrying. Done. Awaiting orchestrator.
```

Then exit — do **not** proceed to branch creation or any subsequent steps.

### Create Branch

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

[If `.claude/unattended-mode` does NOT exist]: Next step: Run `/write-spec #N` to create specifications for this issue.
[If `.claude/unattended-mode` exists]: Done. Awaiting orchestrator.
```

This summary serves as the handoff contract for downstream skills like `/write-spec` and `/write-code`.

---

## Integration with SDLC Workflow

```
/draft-issue  →  /start-issue #N  →  /write-spec #N  →  /write-code #N  →  /verify-code #N  →  /open-pr #N
                          ▲ You are here
```
