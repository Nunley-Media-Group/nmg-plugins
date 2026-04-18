---
name: draft-issue
description: "Interview user about a feature need, create groomed GitHub issue with BDD acceptance criteria. Use when user says 'create issue', 'new feature', 'report a bug', 'log a bug', 'request a feature', 'I need a...', 'file an issue', 'draft an issue', 'how do I create an issue', or 'how to file a feature request'. Do NOT use for writing specs, implementing code, or creating PRs. Supports feature and bug templates with codebase investigation and milestone assignment. First step in the SDLC pipeline — followed by /start-issue."
argument-hint: "[brief description of the need]"
allowed-tools: Read, Glob, Grep, Bash(gh:*), WebSearch, WebFetch
---

# Draft Issue

Interview the user to understand their need, then create a well-groomed GitHub issue with BDD acceptance criteria. The skill adapts its interview depth to issue complexity and plays back its understanding before drafting so the result is aligned with intent before a single byte lands in GitHub.

## Core Principles

| Principle | Description |
|-----------|-------------|
| **Interactive-Only** | Issue drafting is a human-judgment activity — the skill always runs the full interactive workflow |
| **Interview-First** | Gather context before drafting; play back understanding before synthesis |
| **Adaptive Depth** | Scale interview depth to issue complexity; let the user override |
| **Readable Gates** | Review-gate summaries are legible without opening files |
| **BDD-Ready Output** | Every acceptance criterion is written as Given/When/Then |

## When to Use

- Starting new work on a feature, bug fix, or enhancement
- The user has an idea but hasn't formalized it yet
- You need a trackable GitHub issue before writing specs

> As of v6.0.0, `/draft-issue` no longer honors `.claude/unattended-mode`. Issue drafting requires interactive input.

## Workflow Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   /draft-issue Skill                         │
├──────────────────────────────────────────────────────────────┤
│  Step 1: Gather Context                                      │
│  Step 2: Classify Issue Type (Feature | Bug)                 │
│  Step 3: Assign Milestone                                    │
│  Step 4: Investigate Codebase  →  investigation signals      │
│  Step 5: Interview the User (adaptive depth)                 │
│    ├── Core interview (3 rounds)                             │
│    └── Extended interview (4 rounds: +NFR/edge/related)      │
│  Step 5b: Automation Eligibility Label                       │
│  Step 5c: Playback and Confirm  ◀── Human Review Gate        │
│  Step 6: Synthesize into Issue Body                          │
│  Step 7: Present Draft for Review  ◀── Human Review Gate     │
│    ├── Inline structured summary                             │
│    └── [1] Approve / [2] Revise menu (loop)                  │
│  Step 8: Create the Issue                                    │
│  Step 9: Output                                              │
└──────────────────────────────────────────────────────────────┘
```

## Workflow

### Step 0: Legacy-Layout Precondition

Before Step 1, run `Glob` for `.claude/steering/*.md` and `.claude/specs/*/requirements.md`. If either returns a match, abort and print:

```
ERROR: This project uses the legacy `.claude/steering/` and/or `.claude/specs/` directory layout, which current Claude Code releases refuse to write to. Run `/upgrade-project` first, then re-run `/draft-issue`.
```

The gate fires in both interactive and unattended mode — do not silently draft an issue against a mixed layout.

### Step 1: Gather Context

#### Input

- Optional CLI argument (e.g., `/draft-issue "add dark mode"`)
- `steering/product.md` (if it exists)

#### Process

1. If an argument was provided, use it as the starting description. Otherwise, ask the user what they need.
2. Read `steering/product.md` to understand:
   - Product vision and mission
   - Target users and personas
   - Feature prioritization (MoSCoW)
   - Existing user journeys

#### Output

- An initial description string
- Product context loaded into the session

---

### Step 2: Classify Issue Type

#### Input

- Initial description from Step 1

#### Process

Use `AskUserQuestion` to ask the user what type of issue this is. This is always the first question after gathering context.

Options:

- **Bug** — "Something is broken or behaving incorrectly"
- **Enhancement / Feature** — "New capability or improvement to existing behavior"

#### Output

- `classification` ∈ {`feature`, `bug`}

---

### Step 3: Assign Milestone

#### Input

- Project root `VERSION` file (if present)
- GitHub milestones via `gh api`

#### Process

1. **Read the current version**: If a `VERSION` file exists in the project root, read it and verify it contains a valid semver string (X.Y.Z). Extract the major version number (e.g., `2.11.0` → `2`). If no `VERSION` file exists or the content is not valid semver, skip milestone assignment entirely (omit the `--milestone` flag from `gh issue create` in Step 8).
2. **Ask the user** via `AskUserQuestion`:
   ```
   question: "Which milestone should this issue be assigned to?"
   options:
     - "v{major} (current major version)" — e.g., "v2 (current major version)"
     - "v{major+1} (next major version)" — e.g., "v3 (next major version)"
   ```
3. **Ensure the milestone exists**: Run `gh api repos/{owner}/{repo}/milestones --jq '.[].title'`. If the chosen milestone does not exist, create it:
   ```
   gh api repos/{owner}/{repo}/milestones --method POST --field title="v{N}"
   ```
   If creation fails (permission denied, API error), proceed without milestone assignment and note the failure in Step 9 output.

#### Output

- `milestone` — e.g., `"v2"`, or `null` if skipped

---

### Step 4: Investigate Codebase

#### Input

- `classification` from Step 2
- Relevant source, specs, and steering docs

#### Process

Perform a targeted codebase investigation before the interview. The investigation also produces **signals** that Step 5 uses to select interview depth.

##### If Enhancement / Feature

1. **Explore existing specs**: Use `Glob` for `specs/*/requirements.md` and read any that relate to the area described by the user
2. **Explore source code**: Use `Glob` and `Grep` to find files related to the enhancement area (e.g., the relevant SKILL.md, templates, hooks, or application code)
3. **Read steering docs**: Read `steering/tech.md` and `steering/structure.md` (if they exist) and note any technical or architectural constraints relevant to the enhancement area
4. **Summarize findings**: Produce a "Current State" summary capturing:
   - What exists today (relevant code, patterns, specs)
   - How the current implementation works
   - What patterns should be preserved or built upon
   - Relevant constraints from steering docs

If no relevant code or specs are found, note that this appears to be a greenfield addition and move on.

##### If Bug

1. **Search for related code**: Use `Grep` to find code related to the bug description (error messages, function names, file patterns the user mentioned)
2. **Trace code paths**: `Read` the relevant files and follow the logic through the affected paths
3. **Read steering docs**: Read `steering/tech.md` and `steering/structure.md` (if they exist) and note any constraints relevant to the bug's domain
4. **Form hypothesis**: Formulate a root cause hypothesis describing:
   - What code is involved
   - What the incorrect behavior or assumption is
   - Why it manifests as the reported bug
   - Any steering doc constraints that inform the fix approach
5. **Confirm with user** via `AskUserQuestion`:
   - "Yes, that matches"
   - "Not quite — let me clarify"

   If "not quite", ask a follow-up clarifying question and revise the hypothesis.

If investigation is inconclusive, note what is known and proceed with the user's description alone.

##### Compute Investigation Signals

Before exiting Step 4, capture three numeric signals used by Step 5's adaptive-depth heuristic:

| Signal | Source | Type |
|--------|--------|------|
| `filesFound` | count of `Grep`/`Glob` hits examined | integer |
| `componentsInvolved` | count of distinct top-level dirs or skills/modules matched | integer |
| `descriptionVagueness` | ratio of vague tokens (pronouns, "stuff", "things", "something", "somehow") to total tokens in the initial description | float 0–1 |

#### Output

- `investigation.summary` — Current State (feature) or Root Cause hypothesis (bug)
- `investigation.filesFound`, `investigation.componentsInvolved`, `investigation.descriptionVagueness`

---

### Step 5: Interview the User

#### Input

- `classification` from Step 2
- `investigation.*` signals from Step 4
- Initial description from Step 1

#### Process

##### 5.1 Select Interview Depth (Adaptive-Depth Heuristic)

Compute `depth` from the Step 4 signals:

| Depth | Condition | Rounds |
|-------|-----------|--------|
| Core | `filesFound ≤ 3` **and** `componentsInvolved ≤ 1` **and** `descriptionVagueness < 0.10` | 3 rounds |
| Extended (borderline bias) | `descriptionVagueness ∈ [0.10, 0.15)` **or** (`componentsInvolved == 1` **and** `filesFound > 8`) | 4 rounds |
| Extended | otherwise (multi-component, many files, or vague description) | 4 rounds |

The borderline row intentionally biases ambiguous cases to the deeper interview — running extended for a small issue costs a few extra probes; running core for an under-specified issue costs a downstream spec amendment.

##### 5.2 Log the Depth Decision

Emit a one-sentence user-visible log line explaining the selection, for example:

- Extended: `"This touches 4 components across 2 skills — I'll ask deeper scope questions."`
- Core: `"Small scoped change — running a core interview."`

##### 5.3 Offer Depth Override

Immediately after the log line, call `AskUserQuestion` with two options:

```
question: "Which interview depth would you like to use?"
options:
  - "[1] Use {heuristic_pick} interview (recommended)"
    description: "Keep the heuristic's default for this issue"
  - "[2] Use {other_depth} interview"
    description: "Override the heuristic"
```

If the user selects `[2]`, switch `depth` to the other value and emit a one-line session note before the interview begins — e.g., `"(heuristic chose core, user selected extended)"`. This visible trail lets future threshold tuning build on concrete evidence.

##### 5.4 Run the Probe Rounds

Skip any topics already answered by the initial description or the Step 4 investigation. Group related questions when natural. Use multi-question `AskUserQuestion` rounds rather than individual questions.

###### If Feature / Enhancement

| Round | Core (3 rounds) | Extended (4 rounds) |
|-------|-----------------|---------------------|
| R1 Persona & outcome | Who benefits? What pain point? What desired outcome? | Same as core |
| R2 ACs, scope, priority | Key ACs in G/W/T format; in-scope / out-of-scope; MoSCoW priority | Key ACs in G/W/T format; in-scope / out-of-scope (priority moves to R4) |
| R3 NFRs & edge cases | *(omitted)* | Performance / accessibility / security / i18n relevance; edge cases and error states beyond the happy path |
| R4 Related features & priority | *(folded into R2)* | Existing related features to maintain consistency with; MoSCoW priority |

###### If Bug

| Round | Probes |
|-------|--------|
| R1 Repro | Exact reproduction steps; expected vs actual |
| R2 Env & recency | Environment (OS, browser, version); frequency; error output; when it started |
| R3 Edge cases & regression risk | Edge/error states beyond the primary repro; related behavior that must not regress |

Reproduction remains the bug-path primary focus. R3 is always asked, regardless of depth — bugs benefit from edge-case probing even when scoped tightly.

##### 5.5 End-of-Interview "Anything I Missed?" Probe

Regardless of classification or depth, the **final** round ends with a single free-text probe:

> "Before I play back my understanding, is there anything I haven't asked that matters here?"

A non-empty answer is folded into the understanding block that feeds Step 5c.

#### Output

- `depth` ∈ {`core`, `extended`}
- `depthOverridden` — true if the user chose the non-recommended option
- `interviewAnswers` — map of round → answers
- `anythingMissed` — free-text answer or `null`

---

### Step 5b: Automation Eligibility

#### Input

- `classification` and interview answers from Step 5

#### Process

Ask whether this issue is suitable for fully automated processing downstream. Use `AskUserQuestion` with a body that explains what "automatable" controls:

```
question: "Is this issue suitable for hands-off automation?"
body: |
  The `automatable` label tells the downstream SDLC pipeline
  (/write-spec, /write-code, /verify-code, /open-pr) that it can
  progress this issue without human judgment at the review gates.
  It does NOT affect /draft-issue itself — issue drafting always
  requires interactive human input.
options:
  - "Yes — suitable for hands-off automation"
    description: "An AI agent can handle spec writing, implementation, verification, and PR creation without human intervention"
  - "No — requires human judgment"
    description: "This issue needs human decision-making during implementation (e.g., UX choices, ambiguous requirements, complex trade-offs)"
```

#### Output

- `automatable` ∈ {`true`, `false`}

---

### Step 5c: Playback and Confirm

#### Input

- Interview answers from Step 5 + automatable answer from Step 5b + `anythingMissed` probe

#### Process

Play back a structured understanding block whose length is **proportional to the interview depth**. This matches friction to stakes.

##### Core-depth playback (one-line confirm)

```
Drafting an issue for {persona} that {outcome}.
  In-scope: {bullets joined by commas}
  Out-of-scope: {bullets joined by commas}
```

##### Extended-depth playback (full structured block)

```
Understanding check:
  Persona:   [type]
  Outcome:   [action + benefit]
  ACs:       [numbered one-line outline]
  Scope in:  [bullets]
  Scope out: [bullets]
```

After rendering the playback, call `AskUserQuestion`:

```
question: "Does this match your intent?"
options:
  - "[1] Looks right — draft the issue"
  - "[2] Something's off — let me clarify"
```

If the user selects `[2]`, ask one free-text clarification, revise the understanding, and re-render the playback at the same depth-proportional length. Loop until the user selects `[1]`.

#### Output

- `understanding` — confirmed persona, outcome, AC outline, scope in/out
- `understandingConfirmed` — must be true before Step 6

#### Human Review Gate

This gate blocks Step 6 (synthesis) until the user confirms the playback. The skill does not draft the issue body until `understandingConfirmed = true`.

---

### Step 6: Synthesize into Issue Body

#### Input

- Confirmed `understanding` from Step 5c
- `classification` from Step 2
- `investigation.summary` from Step 4

#### Process

Choose the appropriate template based on `classification`. The two templates differ significantly in structure — the reference table below contrasts them:

##### Feature vs Bug Template Comparison

| Section | Feature Template | Bug Report Template |
|---------|------------------|---------------------|
| Opening | User Story (As a / I want / So that) | Bug Report (1–2 sentence summary) |
| Context | Background + Current State | Root Cause Analysis + User Confirmed flag |
| Reproduction | N/A | Reproduction Steps (numbered) + Environment table |
| Expected vs Actual | N/A | Expected Behavior / Actual Behavior |
| AC count guidance | 3+ (happy path, alternative, error) | 2 (Bug Is Fixed + No Regression) |
| FR priority | MoSCoW (Must/Should/Could) | Typically Must only |
| Out of Scope | Scope boundaries for the feature | Related improvements not part of this fix |

##### Feature / Enhancement Template

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

##### Bug Report Template

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

#### Output

- `draft` — fully composed issue body (markdown string)
- `title` — concise, action-oriented issue title starting with a verb

---

### Step 7: Present Draft for Review

#### Input

- `draft` and `title` from Step 6
- Planned labels from Step 8 (pre-computed so the summary can show them)

#### Process

##### 7.1 Render the Inline Review Summary

After Step 6 synthesis, render an inline markdown block structured exactly as:

```
Issue Draft Summary — [title]

User Story: [one-liner]

Acceptance Criteria ([N] total):
  AC1: [Name] — Given [...] When [...] Then [...]
  AC2: ...

Functional Requirements:
  FR1: [req] (Must)
  FR2: [req] (Should)
  ...

Out of Scope: [comma-separated list]
Labels: [applied labels]
```

For bug reports, substitute the User Story line with `Bug Summary: [one-liner]`.

##### 7.2 Present the Review Menu

Call `AskUserQuestion` with exactly two options:

```
question: "Approve this draft?"
options:
  - "[1] Approve — create the issue"
  - "[2] Revise — I'll describe what to change"
```

##### 7.3 Handle Revise

On `[2]`, ask one free-text follow-up: `"What would you like to change?"`. Apply the changes to the draft (replacing it wholesale — revise iterations do **not** preserve previous drafts as diffs). Re-render the summary and menu. Loop until `[1]`.

##### 7.4 Track Consecutive Revises (Soft Guard)

Maintain a counter `consecutiveRevises` that:

- Starts at `0`
- Increments on each `[2] Revise` (two-option menu) or `[1] Keep revising` (expanded menu)
- Resets to `0` on any selection that exits or restarts the loop: two-option `[1] Approve`, expanded `[2] Reset and re-interview`, or expanded `[3] Accept as-is`

##### 7.5 Expand the Menu After Three Consecutive Revises

When `consecutiveRevises == 3`, the **next** review round (i.e., the fourth review round) expands its menu to three options:

```
question: "You've revised three times — how would you like to proceed?"
options:
  - "[1] Keep revising — I have more changes"
  - "[2] Reset and re-interview — this draft isn't salvageable"
  - "[3] Accept as-is — create the issue with the current draft"
```

- `[1]` returns to the two-option menu on the next round; `consecutiveRevises` continues incrementing
- `[2]` returns the skill to Step 5 (re-entering the interview with `classification` and `milestone` preserved); `consecutiveRevises` resets to `0`
- `[3]` proceeds to Step 8 as if Approve was selected

The skill does not auto-terminate the loop. The user remains in control.

#### Output

- `approved` — true after `[1] Approve` or `[3] Accept as-is`
- Final `draft` and `title`

#### Human Review Gate

This gate blocks Step 8 (issue creation) until `approved = true`.

---

### Step 8: Create the Issue

#### Input

- Approved `draft`, `title`, `labels`, `milestone`, `automatable`

#### Process

1. **Check labels**: Run `gh label list` to see existing labels
2. **Create missing labels** if needed:
   ```
   gh label create "label-name" --description "Description" --color "hex-color"
   ```
3. **Ensure the `automatable` label exists** if Step 5b answered "Yes":
   - Check: `gh label list --search automatable --json name --jq '.[].name'`
   - If not found, create it: `gh label create "automatable" --description "Suitable for automated SDLC processing" --color "0E8A16"`
4. **Determine labels** based on issue type and automation eligibility:
   - Feature → `enhancement`
   - Bug → `bug`
   - If Step 5b answered "Yes" → also include `automatable`
   - Other project-specific labels as appropriate
5. **Create the issue** (include `--milestone` if Step 3 assigned one):
   ```
   gh issue create --title "[concise, action-oriented title]" --body "[issue body]" --label "label1,label2" --milestone "v{N}"
   ```
6. **Verify automatable label** (if intended):
   ```
   gh issue view #N --json labels --jq '.labels[].name'
   ```
   If `automatable` is missing from the output, warn in Step 9 output: "Warning: automatable label was not applied — verify manually."

#### Output

- `issueNumber`, `issueUrl`, `appliedLabels`

---

### Step 9: Output

#### Input

- `issueNumber`, `issueUrl`, `appliedLabels`, and any warnings from Step 8

#### Process

Render the final status block.

#### Output

```
Issue #N created: [title]
URL: [issue URL]
Labels: [labels applied]
[If automatable label verification failed]: Warning: automatable label was not applied — verify manually.

Next step: Run `/start-issue #N` to create a feature branch and begin working on this issue.
```

## Guidelines

- **Title**: Concise, action-oriented, starts with a verb (e.g., "Add precipitation overlay to map")
- **Acceptance criteria**: Always in Given/When/Then format — these become Gherkin tests later
- **Scope**: Be explicit about what's out of scope to prevent creep
- **Priority**: Use MoSCoW (Must/Should/Could/Won't) for requirements
- **No implementation details**: The issue describes *what*, not *how*

## Integration with SDLC Workflow

```
/draft-issue  →  /start-issue #N  →  /write-spec #N  →  /write-code #N  →  /verify-code #N  →  /open-pr #N
     ▲ You are here
```
