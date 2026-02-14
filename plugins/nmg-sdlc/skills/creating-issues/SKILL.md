---
name: creating-issues
description: "Interview user about a feature need, create groomed GitHub issue with BDD acceptance criteria."
argument-hint: "[brief description of the need]"
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
- Skip the interview (Step 2) — use the provided argument as the feature description. Read `.claude/steering/product.md` for product context. Generate 3–5 Given/When/Then acceptance criteria covering the happy path, one alternative path, and one error case.
- Skip the review (Step 4) — do not call `AskUserQuestion`. Proceed directly to creating the issue.

## Workflow

### Step 1: Gather Context

If an argument was provided (e.g., `/creating-issues "add dark mode"`), use it as the starting point. Otherwise, ask the user what they need.

Read `.claude/steering/product.md` if it exists to understand:
- Product vision and mission
- Target users and personas
- Feature prioritization (MoSCoW)
- Existing user journeys

### Step 2: Interview the User

Ask questions adaptively to refine the need. If the user's initial description already covers a topic, skip it. Group related questions when natural — aim for 2–3 rounds, not 6 sequential questions.

Topics to cover (skip any already answered):

1. **Who is the user?** What role or persona benefits from this?
2. **What's the problem?** What pain point or gap exists today?
3. **What's the desired outcome?** What should happen when this is done?
4. **What are the key acceptance criteria?** Guide toward Given/When/Then format:
   - "Given [some context], when [something happens], then [expected result]"
   - Encourage specific, testable criteria
5. **What's in scope vs out of scope?** Set clear boundaries.
6. **What's the priority?** Must / Should / Could / Won't (MoSCoW)

Adapt questions based on the type of work:
- **Feature**: Focus on user story, acceptance criteria, UI/UX needs
- **Bug fix**: Focus on reproduction and diagnosis:
  - "What are the exact steps to reproduce this bug?"
  - "What do you expect to happen vs what actually happens?"
  - "What environment does this occur in?" (OS, browser, version, configuration)
  - "How often does it happen?" (always, intermittent, one-time)
  - "Are there any error messages, stack traces, or log output?"
  - "When did this start? Was there a recent change that might have caused it?"
- **Enhancement**: Focus on current behavior, desired improvement, impact

### Step 3: Synthesize into Issue Body

Choose the appropriate template based on the type of work identified in Step 2.

#### Feature / Enhancement Template

Draft the issue using this structure:

```markdown
## User Story

**As a** [specific user type/persona]
**I want** [action or capability]
**So that** [benefit or value]

## Background

[1-2 paragraphs: why this is needed, what problem it solves, any relevant context]

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

### Step 4: Present Draft for Review

Show the complete issue draft to the user. Ask:
- "Does this capture what you're looking for?"
- "Any acceptance criteria to add or modify?"
- "Is the scope right?"

Iterate until the user approves.

### Step 5: Create the Issue

1. **Check labels**: Run `gh label list` to see existing labels
2. **Create missing labels** if needed:
   ```
   gh label create "label-name" --description "Description" --color "hex-color"
   ```
3. **Determine labels** based on issue type:
   - Feature → `enhancement`
   - Bug → `bug`
   - Other project-specific labels as appropriate
4. **Create the issue**:
   ```
   gh issue create --title "[concise, action-oriented title]" --body "[issue body]" --label "label1,label2"
   ```

### Step 6: Output

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
