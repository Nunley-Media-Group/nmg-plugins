---
name: write-spec
description: "Create BDD specifications from a GitHub issue: requirements, technical design, and task breakdown. Use when user says 'write specs', 'create specifications', 'spec this issue', 'spec #N', 'formalize requirements', 'how do I write specs', 'how to spec a feature', 'design this feature', or 'plan the implementation'. Do NOT use for creating issues, implementing code, or verifying implementations. Produces requirements.md, design.md, tasks.md, and feature.gherkin with human review gates. Third step in the SDLC pipeline — follows /start-issue and precedes /write-code."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Task, Write, Edit, WebFetch, WebSearch, Bash(gh:*)
model: opus
effort: xhigh
---

# Write Spec

Create BDD specifications from a GitHub issue through three phases: requirements, technical design, and implementation tasks. Each phase has a human review gate.

## Core Principles

| Principle | Description |
|-----------|-------------|
| **Spec-First** | Write specifications before implementation |
| **Issue-Driven** | Every spec traces back to a GitHub issue |
| **Human-in-Loop** | Validate specs at phase gates before proceeding |
| **BDD Tests Required** | Every acceptance criterion becomes a Gherkin test |

## When to Use

- After creating a GitHub issue with `/draft-issue`
- When starting implementation of an existing issue
- When requirements need to be formalized before coding

## Unattended Mode

If the file `.claude/unattended-mode` exists in the project directory, all Human Review Gates in this workflow are **pre-approved**. Do NOT call `AskUserQuestion` at any gate — proceed directly from each phase to the next without stopping for user input.

## Feature Name Convention

The `{feature-name}` used in `specs/{feature-name}/` is derived from the **issue type and title**:

1. Take the issue title (e.g., "Add dark mode toggle to settings")
2. Lowercase, replace spaces and special characters with hyphens
3. Remove leading/trailing hyphens, collapse consecutive hyphens
4. Determine prefix from issue labels:
   - If issue has `bug` label → prefix `bug-`
   - Otherwise → prefix `feature-`
5. Result: `feature-add-dark-mode-toggle-to-settings` or `bug-login-crash-on-timeout`

The directory name contains **no issue number** — issue numbers are tracked in spec frontmatter only. Note that branch names still use the `N-feature-name` format (e.g., `71-add-dark-mode-toggle`); this mismatch is intentional since multiple issues can contribute to a single feature spec.

**Fallback:** If the feature-name cannot be determined from context, use `Glob` to find `specs/*/requirements.md` and match against the current issue number by reading the `**Issues**` frontmatter field (plural). Fall back to the legacy `**Issue**` field (singular) for older specs. If no frontmatter match, try matching the issue number or branch name keywords against the directory name.

**Examples:**
- New convention: `feature-dark-mode/`, `bug-login-crash-on-timeout/`
- Legacy convention (still supported): `42-add-dark-mode-toggle/`

## Workflow Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  DISCOVER   │────▶│   SPECIFY   │────▶│    PLAN     │────▶│    TASKS    │
│ find/create │     │ requirements│     │  technical  │     │   atomic    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           ↑                  ↑                   ↑
                       Human Review      Human Review        Human Review
```

## Prerequisites

1. A GitHub issue exists (created via `/draft-issue` or manually)
2. Steering documents exist in `steering/` (create with `/onboard-project` if missing)
3. The project uses the current directory layout (`steering/` and `specs/` at the project root). If `.claude/steering/` or `.claude/specs/` still exists, run `/upgrade-project` first — see the **Legacy-Layout Precondition** block below.

### Legacy-Layout Precondition

Before Phase 1 does any work, run `Glob` for `.claude/steering/*.md` and `.claude/specs/*/requirements.md`. If either glob returns a match, abort and print:

```
ERROR: This project uses the legacy `.claude/steering/` and/or `.claude/specs/` directory layout, which current Claude Code releases refuse to write to. Run `/upgrade-project` first, then re-run `/write-spec`.
```

The gate fires in both interactive and unattended mode — do not silently write specs against a mixed layout.

## Defect Detection

After reading the issue in Phase 1, check whether the issue has the **`bug`** label:

```bash
gh issue view #N --json labels --jq '.labels[].name'
```

If any label is `bug`, this is a **defect issue**. All three phases use the **Defect Variant** from their respective templates instead of the full feature template:

| Phase | Feature (default) | Defect (bug label) |
|-------|-------------------|--------------------|
| SPECIFY | Full requirements template | Defect Requirements Variant — reproduction, expected vs actual, 2–3 ACs |
| PLAN | Full design template | Defect Design Variant — root cause analysis, fix strategy, blast radius |
| TASKS | 5-phase, 17-task breakdown | Defect Tasks Variant — flat 2–4 tasks: fix, regression test, verify |

> **Complexity escape hatch:** For complex bugs involving architectural changes, supplement the defect variant with sections from the full template as needed. The defect variant is a floor, not a ceiling.

---

## Spec Discovery

**This section runs only for non-bug issues.** Before creating a new spec, search for an existing feature spec that this issue may be enhancing.

### Process

#### Step 0: Parent-Link Resolution (runs first — before keyword discovery)

Child issues of an epic MUST resolve their parent spec by **issue link**, not by keyword match. Step 0 runs before anything else in Spec Discovery; only if it yields no candidates does control fall through to keyword-based matching.

1. **Extract body cross-refs.** Run `gh issue view #N --json body` and parse the body for all `Depends on: #NNN` and `Blocks: #NNN` lines using the case-insensitive regex `/(?:Depends on|Blocks):\s*#(\d+)\b/gi`. Collect each match as a candidate parent issue number.
2. **Query the GitHub sub-issue parent field.** Run `gh issue view #N --json parent`. If the `parent` object is non-null and has a numeric `number`, add that number to the candidate set. If `gh` does not support `--json parent` (older CLI), treat the field as null and log a single-line warning: `parent-link resolution: gh version does not expose sub-issue parent field — falling back to body cross-refs only`.
3. **Deduplicate** the candidate set and preserve insertion order for determinism.
4. **Cycle detection.** Maintain a visited-set of issue numbers. Start the visited set with the current issue number. When resolving transitively (e.g., a candidate parent itself has a parent that also has a parent), abort with a cycle-detected error if the same issue number reappears. Concretely: if issue `#A` lists `Depends on: #B` and `#B` lists `Depends on: #A`, writing the spec for either issue aborts with:

   ```
   ERROR: cycle detected in parent-link graph — #A and #B depend on each other. Break the cycle by removing one of the Depends on: lines and re-run /write-spec.
   ```

5. **Match candidates to spec directories.** For each candidate `#P`:
   - `Glob` `specs/*/requirements.md` to enumerate spec directories.
   - For each match, read the file's `**Issues**` frontmatter field (format: `**Issues**: #A, #B, #C`).
   - If `#P` appears in the Issues list, record that spec directory as the resolved parent spec.
6. **Handle the three outcomes:**
   - **Match found** → enter **amendment mode** against the matched spec directory. Append the current issue number to the spec's `**Issues**` frontmatter (comma-separated), add a Change History row with today's date and a one-line summary, and skip directly to Phase 1 using the existing spec as the working document.
   - **Candidate found but no matching spec directory** → abort with the loud failure (AC7c):

     ```
     ERROR: Parent spec for #P not found — run '/write-spec #P' and seal the spec before starting child work.
     ```

     Do not create any spec files for the child. Exit non-zero in unattended mode (escalate via runner sentinel).
   - **No candidates at all** → fall through to the keyword-based discovery below.

Step 0 is stateless — it derives everything fresh from `gh` state on each invocation. It runs identically in interactive and unattended modes; the only difference is that unattended aborts emit the error to stderr and exit non-zero rather than prompting.

#### Step 1: Keyword-Based Discovery (fallback)

1. **Extract keywords** from the issue title: tokenize by spaces, then filter out stop words: `a`, `an`, `the`, `to`, `for`, `in`, `on`, `of`, `and`, `or`, `is`, `it`, `as`, `at`, `by`, `with`, `from`, `this`, `that`, `add`, `fix`, `update`, `implement`, `create`
2. **Search for existing feature specs**: Run `Glob` for `specs/feature-*/requirements.md` to list all feature spec candidates
3. **If no feature specs exist**, skip to the "create new spec" flow below
4. **Score candidates**: For each candidate spec file, run `Grep` using each extracted keyword against the file content. Count total keyword hits per candidate.
5. **Rank and filter**: Sort candidates by total keyword hits. Filter to candidates with at least 2 keyword hits.
6. **If one or more candidates found**:
   - Read the top candidate's first `# ` heading and user story for context
   - Present to the user via `AskUserQuestion`:
     - Option 1: "Amend existing spec: `feature-{slug}`" (with brief description from heading/user story)
     - Option 2: "Create new spec" (derives new `feature-{slug}` from current issue title)
   - **If unattended mode** (`.claude/unattended-mode` exists): skip AskUserQuestion entirely and proceed directly in amendment mode (amend the top-scored existing spec)
7. **If no candidates found**: proceed to create new spec without prompting

The result of this step determines whether subsequent phases operate in **amendment mode** (modifying an existing spec) or **creation mode** (writing a new spec from scratch).

---

## Steering Documents

Steering documents provide project-specific context. They live in `steering/`:

| Document | Purpose |
|----------|---------|
| `product.md` | Vision, users, success metrics |
| `tech.md` | Stack, constraints, testing standards |
| `structure.md` | Code organization, naming, patterns |
| `retrospective.md` | Defect-derived learnings for spec writing (generated by `/run-retro`) |

---

## Phase 1: SPECIFY (Requirements)

### Input

Read the GitHub issue to bootstrap requirements:

```bash
gh issue view #N
```

Extract from the issue:
- User story (As a / I want / So that)
- Acceptance criteria (Given/When/Then)
- Functional requirements
- Out of scope

### Process

1. Read the issue via `gh issue view #N`
2. **Check for `bug` label** — if present, use the Defect Requirements Variant (see [Defect Detection](#defect-detection)). Bug-labeled issues always create a new `bug-{slug}/` directory — they never amend.
3. Read `steering/product.md` for user context and product vision
4. If `steering/retrospective.md` exists, read it and apply relevant learnings when drafting acceptance criteria — read each learning as a transferable principle; adapt it to the current feature's domain by mapping the abstract pattern to concrete scenarios relevant to this feature. For example, a learning like "When specifying features that interact with external systems via session-scoped protocols, include ACs for state persistence across invocations" applied to a database connection pool feature becomes: "Given a connection is checked out and used for a query / When the connection is returned to the pool / Then any session-level state (temp tables, variables) is reset before reuse"
5. **If amending an existing spec** (determined by [Spec Discovery](#spec-discovery)):
   1. Read the existing `requirements.md`
   2. Parse the `**Issues**` field to get the current issue list
   3. Parse all `### ACN:` headings to find the highest AC number
   4. Parse the FR table to find the highest FR ID
   5. Read the new issue content (from `gh issue view`)
   6. Construct the amendment:
      - Append new issue number to `**Issues**` field (e.g., `**Issues**: #42, #71`)
      - Update `**Date**` to today
      - Append new ACs (starting from next sequential number) under existing ACs
      - Append new FRs (starting from next sequential ID) to existing FR table
      - Append new items to Out of Scope if applicable
      - Add a Change History entry: `| #N | [today] | [brief summary of what this issue adds] |`
   7. Write the amended `requirements.md`
6. **If creating a new spec** (no amendment):
   1. Create `requirements.md` using [templates/requirements.md](templates/requirements.md)
   2. Bootstrap acceptance criteria from the issue body
   3. Use `**Issues**: #N` (plural field name, even for the first issue)
   4. Include an initial Change History entry: `| #N | [today] | Initial feature spec |`
   5. Fill in requirements per the appropriate variant:
      - **Feature**: Full template — user story, ACs, functional/non-functional requirements, UI/UX, data requirements, dependencies, success metrics
      - **Defect**: Defect variant — reproduction steps, expected vs actual, severity, 2–3 acceptance criteria (bug fixed + no regression), lightweight functional requirements. Omit NFRs table, UI/UX table, data requirements, success metrics. To populate the **Related Spec** field, actively search for a related **feature** spec:
        1. Extract keywords from the issue — file paths, function/method names, component names, module names
        2. Run `Glob` for `specs/feature-*/requirements.md` and `specs/*/requirements.md` to list all existing specs (covers both new `feature-` naming and legacy `{issue#}-` naming)
        3. Run `Grep` over those spec files using the extracted keywords
        4. Read the **first heading** of each matching file to determine its type:
           - `# Requirements:` → feature spec
           - `# Defect Report:` → defect spec
        5. **If feature specs match** → use the best-matching feature spec. Set **Related Spec** to its directory (e.g., `specs/feature-dark-mode/`).
        6. **If no feature specs match but defect specs do** → follow each matching defect spec's `**Related Spec**` link to find the root feature spec (same chain-resolution logic: follow `Related Spec` links through defect specs until reaching a `# Requirements:` heading, maintaining a visited set to detect cycles). Use the resolved feature spec.
        7. **If nothing matches** after filtering and chain following → set **Related Spec** to **N/A**.
7. Consult steering docs for project-specific requirements (e.g., accessibility, platform support)

### Output

Write to (or amend) `specs/{feature-name}/requirements.md`

### Human Review Gate

**[If `.claude/unattended-mode` exists]:** Gate is pre-approved — proceed immediately to Phase 2.

**[If `.claude/unattended-mode` does NOT exist]:** Present an inline summary of what was written so the user can evaluate without opening the file. Structure it exactly like this:

---

**Requirements Summary** — `specs/{feature-name}/requirements.md`

**User Story**: As a [type], I want [action] so that [benefit]

**Acceptance Criteria** ([count] total):
- **AC1: [Name]** — Given [precondition], when [action], then [outcome]
- **AC2: [Name]** — Given [precondition], when [action], then [outcome]
- *(list every AC with its one-line Given/When/Then summary)*

**Key Functional Requirements**:
- FR1: [requirement] *(Must)*
- FR2: [requirement] *(Should)*
- *(list all FRs with priority)*

**Out of Scope**: [comma-separated list of excluded items]

**Open Questions**: [list any, or "None"]

---

After the summary, present a numbered menu via `AskUserQuestion`:

```
Select an option:
  [1] Approve — proceed to technical design
  [2] Revise — I'll describe what to change
```

If the user selects 2 (or provides feedback), apply their changes to the file and re-present the summary and menu. Repeat until they select 1.

---

## Phase 2: PLAN (Technical Design)

### Input

- Approved `requirements.md` from Phase 1
- `steering/tech.md` for technical standards
- `steering/structure.md` for code organization patterns

### Process

1. Read steering documents for project architecture and conventions
2. Explore the codebase to understand existing patterns:
   - Use `Glob` and `Grep` to find related code
   - Use `Task` with `subagent_type='Explore'` for deeper investigation
3. **If amending an existing spec** (determined by [Spec Discovery](#spec-discovery)):
   1. Read the existing `design.md`
   2. Identify sections that need additions (new components, new API changes, new considerations)
   3. Append new content to relevant sections rather than replacing existing content
   4. Add the new issue number to the `**Issues**` field
   5. If new alternatives exist, add to Alternatives Considered
   6. Add a Change History entry
   7. Write the amended `design.md`
4. **If creating a new spec** (no amendment):
   1. Create `design.md` using [templates/design.md](templates/design.md), selecting the appropriate variant:
      - **Feature**: Full design template — component diagram, data flow, API schemas, DB schemas/migrations, state management, UI hierarchy, security/performance checklists, testing strategy
      - **Defect**: Defect Design Variant — root cause analysis with affected code references, minimal fix strategy, blast radius assessment, regression risk table. Omit component diagrams, data flow, API schemas, DB migrations, state management, UI components, security/performance checklists.
   2. Use `**Issues**: #N` (plural field name) and include an initial Change History entry
   3. Design the solution per variant:
      - **Feature**: Map to the project's architecture layers; design data flow, API changes, database changes, state management; consider alternatives
      - **Defect**: Identify root cause with specific code references; propose minimal fix; assess blast radius and regression risk; document alternatives only if multiple fix approaches exist

### Output

Write to (or amend) `specs/{feature-name}/design.md`

### Human Review Gate

**[If `.claude/unattended-mode` exists]:** Gate is pre-approved — proceed immediately to Phase 3.

**[If `.claude/unattended-mode` does NOT exist]:** Present an inline summary of the design so the user can evaluate without opening the file. Structure it exactly like this:

---

**Design Summary** — `specs/{feature-name}/design.md`

**Approach**: [2-3 sentence summary of the architectural approach — what components are involved, the key design decision, and why this approach was chosen over alternatives]

**Components Modified**:
- `path/to/file` — [what changes and why]
- `path/to/file` — [what changes and why]
- *(list every file/component being added or modified)*

**New APIs / Interfaces**:
- `[endpoint or method signature]` — [purpose]
- *(list all, or "None")*

**Database / Storage Changes**: [summary of schema changes, or "None"]

**Key Tradeoff**: [the most important architectural tradeoff and why you chose this side of it]

**Risks**: [top 1-2 risks with their mitigations]

---

After the summary, present a numbered menu via `AskUserQuestion`:

```
Select an option:
  [1] Approve — proceed to implementation tasks
  [2] Revise — I'll describe what to change
```

If the user selects 2 (or provides feedback), apply their changes to the file and re-present the summary and menu. Repeat until they select 1.

---

## Phase 3: TASKS (Implementation Plan)

### Input

- Approved `design.md` from Phase 2
- `steering/structure.md` for file path conventions

### Process

1. **If amending an existing spec** (determined by [Spec Discovery](#spec-discovery)):
   - **tasks.md amendment:**
     1. Read the existing `tasks.md`
     2. Parse all `### TNNN:` headings to find the highest task number
     3. Append new tasks starting from the next sequential number
     4. New tasks may form a new phase (e.g., "Phase 6: Enhancement — Issue #71") or be added to existing phases as appropriate
     5. Update the Summary table with new phase/counts
     6. Update the Dependency Graph to include new tasks
     7. Add the new issue number to the `**Issues**` field
     8. Add a Change History entry
     9. Write the amended `tasks.md`
   - **feature.gherkin amendment:**
     1. Read the existing `feature.gherkin`
     2. Append new scenarios at the end
     3. Tag new scenarios with a comment indicating the contributing issue: `# Added by issue #N`
     4. Write the amended `feature.gherkin`
2. **If creating a new spec** (no amendment):
   1. Break the design into tasks using [templates/tasks.md](templates/tasks.md), selecting the appropriate variant:
      - **Feature**: Full 5-phase breakdown (Setup → Backend → Frontend → Integration → Testing) with atomic, agent-friendly tasks
      - **Defect**: Flat 2–4 task list — fix the bug, add regression test, verify no regressions. No phased structure.
   2. Use `**Issues**: #N` (plural field name) and include an initial Change History entry
   3. Map tasks to actual file paths in the project (reference `structure.md`)
   4. Define dependencies between tasks:
      - **Feature**: Map the full dependency graph across phases
      - **Defect**: Dependencies are linear (fix → test → verify)
   5. Ensure each task has verifiable acceptance criteria
   6. Include BDD testing tasks
   7. Create the Gherkin feature file using [templates/feature.gherkin](templates/feature.gherkin):
      - **Feature**: Full feature scenarios with happy path, alternatives, errors, edge cases
      - **Defect**: Regression scenarios tagged `@regression` — bug is fixed + related behavior preserved

### Phasing (Features Only)

For **feature** issues, tasks should follow this order:

| Phase | Purpose | Examples |
|-------|---------|---------|
| Setup | Foundation | Migrations, types, interfaces |
| Backend | Server-side | Repository, service, controller, routes |
| Frontend | Client-side | Models, state management, UI components |
| Integration | Wiring | Navigation, provider registration, cross-feature |
| Testing | Verification | BDD feature files, step definitions, unit tests |

For **defect** issues, skip phasing. Use the flat task list from the Defect Tasks Variant (typically T001: Fix, T002: Regression Test, T003: Verify).

### Output

Write to (or amend):
- `specs/{feature-name}/tasks.md`
- `specs/{feature-name}/feature.gherkin`

### Human Review Gate

**[If `.claude/unattended-mode` exists]:** Gate is pre-approved — proceed immediately to output.

**[If `.claude/unattended-mode` does NOT exist]:** Present an inline summary of the task breakdown so the user can evaluate without opening the file. Structure it exactly like this:

---

**Tasks Summary** — `specs/{feature-name}/tasks.md`

**Phase breakdown**:
| Phase | Tasks | Key work |
|-------|-------|----------|
| Setup | [count] | [1-line summary of what this phase does] |
| Backend | [count] | [1-line summary] |
| Frontend | [count] | [1-line summary] |
| Integration | [count] | [1-line summary] |
| Testing | [count] | [1-line summary] |
| **Total** | **[N] tasks** | |

*(For defects, show the flat task list instead of phases)*

**Task list**:
- **T001**: [title] → `file/path` *(depends: none)*
- **T002**: [title] → `file/path` *(depends: T001)*
- *(list every task with its target file and dependencies)*

**Critical path**: T001 → T003 → T004 → ... → T[last] *(the longest dependency chain)*

**Gherkin scenarios**: [count] scenarios covering [count] acceptance criteria

---

After the summary, present a numbered menu via `AskUserQuestion`:

```
Select an option:
  [1] Approve — specs are complete
  [2] Revise — I'll describe what to change
```

If the user selects 2 (or provides feedback), apply their changes to the file and re-present the summary and menu. Repeat until they select 1.

### Seal-Spec Flow (multi-PR triggered)

After the Phase 3 approval gate, detect whether the design calls for multi-PR delivery. A multi-PR trigger fires if EITHER:

- `design.md` contains a `## Multi-PR Rollout` heading, OR
- Any FR row's Requirement cell contains `multiple PRs` or `multi-PR` (case-insensitive)

When the trigger fires, offer the seal-spec option. Sealing commits the umbrella spec without a version bump, pushes the branch, and (optionally) creates child issues — none of which should happen through `/open-pr`'s normal version-bump path because the umbrella spec is not a shipping change on its own.

#### Step 3b.1: Offer Seal (interactive) or Auto-Execute (unattended)

- **Interactive mode.** Use `AskUserQuestion`:
  - `[1] Seal and transition — commit specs/{feature-name}/, push, offer child issue creation`
  - `[2] Don't seal — I'll handle child-issue creation manually`
- **Unattended mode** (`.claude/unattended-mode` exists): do NOT invoke `AskUserQuestion`. Auto-execute the seal per Step 3b.2. This is the documented deterministic default for this gate (AC8).

#### Step 3b.2: Idempotency Check and Seal Commit

1. Check for an existing seal commit on HEAD: `git log --format=%H --grep="^docs: seal umbrella spec for #{N}$" HEAD`. If the command returns a non-empty SHA, print `Spec already sealed at commit {sha}` and skip directly to Step 3b.3 (child-issue creation).
2. Otherwise, perform the seal:
   ```bash
   git add specs/{feature-name}/
   git commit -m "docs: seal umbrella spec for #{N}"
   git push origin HEAD
   ```
3. **Scope invariants** (violation is a skill-quality finding):
   - `git add` MUST use the explicit `specs/{feature-name}/` path — never `git add -A` or `git add .`.
   - The seal commit MUST NOT touch `plugins/**/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, or `VERSION`. If `git status --porcelain specs/{feature-name}/` shows no changes and other files are staged, abort with a clear error.
   - The commit message MUST exactly match the regex `^docs: seal umbrella spec for #\d+$` — this is the idempotency marker other skills grep for.
4. Record the commit SHA as `session.sealCommitSha` for use by the child-issue creation sub-step.

#### Step 3b.3: Offer Child-Issue Creation

- **Interactive mode.** After a successful seal, use `AskUserQuestion` to ask whether to create child issues now via the `/draft-issue` batch mechanism using the Delivery Phases table from the just-sealed design as the batch input.
  - `[1] Create children now — re-invoke /draft-issue in batch mode using the Delivery Phases`
  - `[2] Not now — I'll create children later`
- **Unattended mode.** Auto-execute child creation (no prompt). The runner already guarantees no interactive gates in unattended mode per AC8.

When children are created, the resulting `session.epicChildIssues` list is used to pick the first-unblocked child for the "Next step" hint in the After Completion block.

#### Step 3b.4: After-Seal Next-Step Hint

Override the default After Completion message to point at the first unblocked child:

```
Umbrella spec sealed at commit {sealCommitSha}.
Children created: #{child1}, #{child2}, ...  (or: "none — create manually later")

Next step: /start-issue #{first-unblocked-child}
```

If no children were created, fall back to the manual hint: `"Create child issues with /draft-issue and then run /start-issue #{child-number}."`

---

## Defect Workflow Summary

Quick reference for the defect path through all three phases:

| Phase | Produces | Key Sections | Typical Size |
|-------|----------|-------------|--------------|
| SPECIFY | `requirements.md` | Reproduction, Expected vs Actual, 2–3 ACs, Lightweight FRs | ~50% of feature spec |
| PLAN | `design.md` | Root Cause, Fix Strategy, Blast Radius, Regression Risk | ~30% of feature design |
| TASKS | `tasks.md` + `feature.gherkin` | Fix (T001), Regression Test (T002), Verify (T003) | 2–4 tasks vs 15–17 |

The pipeline shape is identical to features (SPECIFY → PLAN → TASKS with human review gates). Only the template sections used within each phase differ.

---

## After Completion

Output:

```
Specs written to (or amended in) `specs/{feature-name}/`:
- requirements.md — Acceptance criteria and functional requirements
- design.md — Technical architecture and design decisions
- tasks.md — Phased implementation tasks
- feature.gherkin — BDD test scenarios

[If `.claude/unattended-mode` does NOT exist]: Next step: Run `/write-code #N` to plan and execute implementation.
[If `.claude/unattended-mode` exists]: Done. Awaiting orchestrator.
```

---

## Spec Quality Checklist

### Requirements

- [ ] User story follows "As a / I want / So that" format
- [ ] All acceptance criteria use Given/When/Then format
- [ ] No implementation details in requirements
- [ ] All criteria are testable and unambiguous
- [ ] Edge cases and error states specified
- [ ] Dependencies identified

### Design

- [ ] Architecture follows existing project patterns (per `structure.md`)
- [ ] All API/interface changes documented
- [ ] Database/schema changes planned (if applicable)
- [ ] State management approach clear
- [ ] Security considerations addressed
- [ ] Alternatives considered and documented

### Tasks

- [ ] Each task has single responsibility
- [ ] Dependencies correctly mapped
- [ ] Acceptance criteria are verifiable
- [ ] File paths are specific (reference `structure.md`)
- [ ] BDD test tasks included

---

## File Organization

```
.claude/
├── steering/           # Project-wide context (from /onboard-project)
│   ├── product.md
│   ├── tech.md
│   └── structure.md
└── specs/              # Feature specifications (from this skill)
    ├── feature-dark-mode/       # Feature spec (new convention)
    │   ├── requirements.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── feature.gherkin
    ├── bug-login-crash/         # Bug spec (new convention)
    │   ├── requirements.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── feature.gherkin
    └── 42-add-auth/             # Legacy convention (still supported)
        ├── requirements.md
        ├── design.md
        ├── tasks.md
        └── feature.gherkin
```

---

## Integration with SDLC Workflow

```
/draft-issue  →  /start-issue #N  →  /write-spec #N  →  /write-code #N  →  /simplify  →  /verify-code #N  →  /open-pr #N
                                                  ▲ You are here
```

## References

- [Spec-Driven Development (Thoughtworks)](https://www.thoughtworks.com/en-us/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices)
- [How to Write Good Specs (Addy Osmani)](https://addyosmani.com/blog/good-spec/)
- [SDD Tools Comparison (Martin Fowler)](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
