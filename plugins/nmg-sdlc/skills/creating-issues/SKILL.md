---
name: creating-issues
description: "Interview user about a feature need, create groomed GitHub issue with BDD acceptance criteria. Use when user says 'create issue', 'new feature', 'report a bug', 'I need a...', or 'file an issue'. Supports feature and bug templates with codebase investigation and milestone assignment."
argument-hint: "[brief description of the need]"
model: sonnet
allowed-tools: Read, Glob, Grep, Bash(gh:*), WebSearch, WebFetch
---

# Creating Issues

Interview the user to understand their need, then create a well-groomed GitHub issue with BDD acceptance criteria.

## When to Use

- Starting new work on a feature, bug fix, or enhancement
- The user has an idea but hasn't formalized it yet
- You need a trackable GitHub issue before writing specs

## Automation Mode

If the file `.claude/auto-mode` exists in the project directory:
- Skip Steps 2, 4, and 5 (classification, investigation, and interview) — use the provided argument as the feature description. Read `.claude/steering/product.md` for product context. Generate 3–5 Given/When/Then acceptance criteria covering the happy path, one alternative path, and one error case.
- **Run Step 3 (Assign Milestone)** non-interactively — read VERSION, default to `v{major}`, do not call `AskUserQuestion`.
- Skip the review (Step 7) — do not call `AskUserQuestion`. Proceed directly to creating the issue.

## Workflow

### Step 1: Gather Context

If an argument was provided (e.g., `/creating-issues "add dark mode"`), use it as the starting point. Otherwise, ask the user what they need.

Read `.claude/steering/product.md` if it exists to understand:
- Product vision and mission
- Target users and personas
- Feature prioritization (MoSCoW)
- Existing user journeys

### Step 2: Classify Issue Type

Use `AskUserQuestion` to ask the user what type of issue this is. This is always the first question after gathering context.

Options:
- **Bug** — "Something is broken or behaving incorrectly"
- **Enhancement / Feature** — "New capability or improvement to existing behavior"

> **Auto-mode**: This step is skipped. Classification is not needed when the interview is skipped.

### Step 3: Assign Milestone

Assign the issue to a version milestone so work is grouped by release.

1. **Read the current version**: If a `VERSION` file exists in the project root, read it and verify it contains a valid semver string (X.Y.Z). Extract the major version number (e.g., `2.11.0` → `2`). If no `VERSION` file exists or the content is not valid semver, skip this step entirely (omit the `--milestone` flag from `gh issue create` in Step 8).
2. **Ask the user** (via `AskUserQuestion`):
   ```
   question: "Which milestone should this issue be assigned to?"
   options:
     - "v{major} (current major version)" — e.g., "v2 (current major version)"
     - "v{major+1} (next major version)" — e.g., "v3 (next major version)"
   ```
3. **Ensure the milestone exists**: Run `gh api repos/{owner}/{repo}/milestones --jq '.[].title'` to list existing milestones. If the chosen milestone does not exist, create it:
   ```
   gh api repos/{owner}/{repo}/milestones --method POST --field title="v{N}"
   ```
   If milestone creation fails (e.g., permission denied, API error), proceed without milestone assignment and note the failure in the output.
4. **Record the milestone** for use in Step 8 (Create the Issue).

> **Auto-mode**: Read VERSION and default to `v{major}` without prompting. Create the milestone if it does not exist.

### Step 4: Investigate Codebase

Based on the classification from Step 2, perform a targeted codebase investigation before the interview.

#### If Enhancement / Feature

1. **Explore existing specs**: Use `Glob` for `.claude/specs/*/requirements.md` and read any that relate to the area described by the user
2. **Explore source code**: Use `Glob` and `Grep` to find files related to the enhancement area (e.g., the relevant SKILL.md, templates, hooks, or application code)
3. **Read steering docs**: Read `.claude/steering/tech.md` and `.claude/steering/structure.md` (if they exist) and note any technical or architectural constraints relevant to the enhancement area
4. **Summarize findings**: Produce a "Current State" summary capturing:
   - What exists today (relevant code, patterns, specs)
   - How the current implementation works
   - What patterns should be preserved or built upon
   - Relevant constraints from steering docs (e.g., required review steps, technology restrictions, structural rules)

If no relevant code or specs are found, note that this appears to be a greenfield addition and move on.

#### If Bug

1. **Search for related code**: Use `Grep` to find code related to the bug description (error messages, function names, file patterns the user mentioned)
2. **Trace code paths**: `Read` the relevant files and follow the logic through the affected paths
3. **Read steering docs**: Read `.claude/steering/tech.md` and `.claude/steering/structure.md` (if they exist) and note any constraints relevant to the bug's domain
4. **Form hypothesis**: Formulate a root cause hypothesis describing:
   - What code is involved
   - What the incorrect behavior or assumption is
   - Why it manifests as the reported bug
   - Any steering doc constraints that inform the fix approach
5. **Confirm with user**: Present the hypothesis via `AskUserQuestion`:
   - "Yes, that matches"
   - "Not quite — let me clarify"

   If the user says "not quite", ask a follow-up clarifying question and revise the hypothesis.

If investigation is inconclusive, note what is known and proceed with the user's description alone.

> **Auto-mode**: This step is skipped.

### Step 5: Interview the User

Ask type-specific questions to refine the need. Skip any topics already answered by the user's initial description or the Step 4 investigation. Group related questions when natural — aim for 2–3 rounds, not 6 sequential questions.

#### If Enhancement / Feature

1. **Who benefits?** What role or persona benefits from this?
2. **What's the pain point?** What gap or friction exists today?
3. **What's the desired outcome?** What should happen when this is done?
4. **What are the key acceptance criteria?** Guide toward Given/When/Then format:
   - "Given [some context], when [something happens], then [expected result]"
   - Encourage specific, testable criteria
5. **What's in scope vs out of scope?** Set clear boundaries.
6. **What's the priority?** Must / Should / Could / Won't (MoSCoW)

#### If Bug

1. **What are the exact reproduction steps?** Walk through the sequence that triggers the bug.
2. **What's expected vs actual?** What should happen, and what actually happens?
3. **What environment?** OS, browser, version, configuration, runtime.
4. **How often?** Always, intermittent, one-time?
5. **Any error output?** Error messages, stack traces, or log output?
6. **When did this start?** Was there a recent change that might have caused it?

### Step 6: Synthesize into Issue Body

Choose the appropriate template based on the issue type classified in Step 2.

#### Feature / Enhancement Template

Draft the issue using this structure:

```markdown
## User Story

**As a** [specific user type/persona]
**I want** [action or capability]
**So that** [benefit or value]

## Background

[1-2 paragraphs: why this is needed, what problem it solves, any relevant context]

## Current State

[Summary from Step 4 investigation — what exists today, relevant code patterns,
existing specs, and how the current implementation works. If no relevant code
was found, state that this is a greenfield addition.]

## Acceptance Criteria

Each criterion uses Given/When/Then format. These become Gherkin BDD test scenarios.

### AC1: [Scenario Name — Happy Path]

**Given** [precondition]
**When** [action]
**Then** [expected outcome]

### AC2: [Scenario Name — Alternative Path]

**Given** [precondition]
**When** [action]
**Then** [expected outcome]

### AC3: [Scenario Name — Error Handling]

**Given** [error precondition]
**When** [action that fails]
**Then** [error handling behavior]

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | [requirement] | Must |
| FR2 | [requirement] | Should |
| FR3 | [requirement] | Could |

## Out of Scope

- [What this does NOT include]
- [Boundaries to prevent scope creep]

## Notes

[Any additional context, links, references, or technical considerations]
```

#### Bug Report Template

For bug fixes, use this structure instead:

```markdown
## Bug Report

[1-2 sentence summary of the bug]

## Root Cause Analysis

[Hypothesis from Step 4 investigation — affected code paths, the incorrect
assumption or logic, and triggering conditions. If investigation was
inconclusive, state what is known and what needs further investigation.]

**User Confirmed**: Yes / Partially / Investigation inconclusive

## Reproduction Steps

1. [First step]
2. [Second step]
3. [Step that triggers the bug]

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens]

## Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | [e.g., macOS 15.2, Ubuntu 24.04] |
| **Version / Commit** | [app version or commit SHA] |
| **Browser / Runtime** | [if applicable] |

## Acceptance Criteria

### AC1: Bug Is Fixed

**Given** [the reproduction precondition]
**When** [the action that previously triggered the bug]
**Then** [the correct expected behavior]

### AC2: No Regression

**Given** [a related scenario that currently works]
**When** [a related action]
**Then** [existing behavior is preserved]

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | [The fix] | Must |

## Out of Scope

- [Related improvements not part of this fix]
```

### Step 7: Present Draft for Review

Show the complete issue draft to the user. Ask:
- "Does this capture what you're looking for?"
- "Any acceptance criteria to add or modify?"
- "Is the scope right?"

Iterate until the user approves.

### Step 8: Create the Issue

1. **Check labels**: Run `gh label list` to see existing labels
2. **Create missing labels** if needed:
   ```
   gh label create "label-name" --description "Description" --color "hex-color"
   ```
3. **Determine labels** based on issue type:
   - Feature → `enhancement`
   - Bug → `bug`
   - Other project-specific labels as appropriate
4. **Create the issue** (include `--milestone` if Step 3 assigned one):
   ```
   gh issue create --title "[concise, action-oriented title]" --body "[issue body]" --label "label1,label2" --milestone "v{N}"
   ```

### Step 9: Output

After creation, output:

```
Issue #N created: [title]
URL: [issue URL]

[If `.claude/auto-mode` does NOT exist]: Next step: Run `/writing-specs #N` to create specifications for this issue.
[If `.claude/auto-mode` exists]: Done. Awaiting orchestrator.
```

## Guidelines

- **Title**: Concise, action-oriented, starts with a verb (e.g., "Add precipitation overlay to map")
- **Acceptance criteria**: Always in Given/When/Then format — these become Gherkin tests later
- **Scope**: Be explicit about what's out of scope to prevent creep
- **Priority**: Use MoSCoW (Must/Should/Could/Won't) for requirements
- **No implementation details**: The issue describes *what*, not *how*

## Integration with SDLC Workflow

```
/creating-issues  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
     ▲ You are here
```
