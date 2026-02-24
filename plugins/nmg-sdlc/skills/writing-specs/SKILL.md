---
name: writing-specs
description: "Create BDD specifications from a GitHub issue: requirements, technical design, and task breakdown. Use when user says 'write specs', 'create specifications', 'spec this issue', 'spec #N', or 'formalize requirements'. Do NOT use for creating issues, implementing code, or verifying implementations. Produces requirements.md, design.md, tasks.md, and feature.gherkin with human review gates."
argument-hint: "[#issue-number]"
model: opus
allowed-tools: Read, Glob, Grep, Task, Write, Edit, WebFetch, WebSearch, Bash(gh:*)
---

# Writing Specs

Create BDD specifications from a GitHub issue through three phases: requirements, technical design, and implementation tasks. Each phase has a human review gate.

## Core Principles

| Principle | Description |
|-----------|-------------|
| **Spec-First** | Write specifications before implementation |
| **Issue-Driven** | Every spec traces back to a GitHub issue |
| **Human-in-Loop** | Validate specs at phase gates before proceeding |
| **BDD Tests Required** | Every acceptance criterion becomes a Gherkin test |

## When to Use

- After creating a GitHub issue with `/creating-issues`
- When starting implementation of an existing issue
- When requirements need to be formalized before coding

## Automation Mode

If the file `.claude/auto-mode` exists in the project directory, all Human Review Gates in this workflow are **pre-approved**. Do NOT call `AskUserQuestion` at any gate — proceed directly from each phase to the next without stopping for user input.

## Feature Name Convention

The `{feature-name}` used in `.claude/specs/{feature-name}/` is derived from the **issue type and title**:

1. Take the issue title (e.g., "Add dark mode toggle to settings")
2. Lowercase, replace spaces and special characters with hyphens
3. Remove leading/trailing hyphens, collapse consecutive hyphens
4. Determine prefix from issue labels:
   - If issue has `bug` label → prefix `bug-`
   - Otherwise → prefix `feature-`
5. Result: `feature-add-dark-mode-toggle-to-settings` or `bug-login-crash-on-timeout`

The directory name contains **no issue number** — issue numbers are tracked in spec frontmatter only. Note that branch names still use the `N-feature-name` format (e.g., `71-add-dark-mode-toggle`); this mismatch is intentional since multiple issues can contribute to a single feature spec.

**Fallback:** If the feature-name cannot be determined from context, use `Glob` to find `.claude/specs/*/requirements.md` and match against the current issue number by reading the `**Issues**` frontmatter field (plural). Fall back to the legacy `**Issue**` field (singular) for older specs. If no frontmatter match, try matching the issue number or branch name keywords against the directory name.

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

1. A GitHub issue exists (created via `/creating-issues` or manually)
2. Steering documents exist in `.claude/steering/` (create with `/setting-up-steering` if missing)

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

1. **Extract keywords** from the issue title: tokenize by spaces, then filter out stop words: `a`, `an`, `the`, `to`, `for`, `in`, `on`, `of`, `and`, `or`, `is`, `it`, `as`, `at`, `by`, `with`, `from`, `this`, `that`, `add`, `fix`, `update`, `implement`, `create`
2. **Search for existing feature specs**: Run `Glob` for `.claude/specs/feature-*/requirements.md` to list all feature spec candidates
3. **If no feature specs exist**, skip to the "create new spec" flow below
4. **Score candidates**: For each candidate spec file, run `Grep` using each extracted keyword against the file content. Count total keyword hits per candidate.
5. **Rank and filter**: Sort candidates by total keyword hits. Filter to candidates with at least 2 keyword hits.
6. **If one or more candidates found**:
   - Read the top candidate's first `# ` heading and user story for context
   - Present to the user via `AskUserQuestion`:
     - Option 1: "Amend existing spec: `feature-{slug}`" (with brief description from heading/user story)
     - Option 2: "Create new spec" (derives new `feature-{slug}` from current issue title)
   - **If auto-mode** (`.claude/auto-mode` exists): skip AskUserQuestion entirely and proceed directly in amendment mode (amend the top-scored existing spec)
7. **If no candidates found**: proceed to create new spec without prompting

The result of this step determines whether subsequent phases operate in **amendment mode** (modifying an existing spec) or **creation mode** (writing a new spec from scratch).

---

## Steering Documents

Steering documents provide project-specific context. They live in `.claude/steering/`:

| Document | Purpose |
|----------|---------|
| `product.md` | Vision, users, success metrics |
| `tech.md` | Stack, constraints, testing standards |
| `structure.md` | Code organization, naming, patterns |
| `retrospective.md` | Defect-derived learnings for spec writing (generated by `/running-retrospectives`) |

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
3. Read `.claude/steering/product.md` for user context and product vision
4. If `.claude/steering/retrospective.md` exists, read it and apply relevant learnings when drafting acceptance criteria — read each learning as a transferable principle; adapt it to the current feature's domain by mapping the abstract pattern to concrete scenarios relevant to this feature. For example, a learning like "When specifying features that interact with external systems via session-scoped protocols, include ACs for state persistence across invocations" applied to a database connection pool feature becomes: "Given a connection is checked out and used for a query / When the connection is returned to the pool / Then any session-level state (temp tables, variables) is reset before reuse"
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
        2. Run `Glob` for `.claude/specs/feature-*/requirements.md` and `.claude/specs/*/requirements.md` to list all existing specs (covers both new `feature-` naming and legacy `{issue#}-` naming)
        3. Run `Grep` over those spec files using the extracted keywords
        4. Read the **first heading** of each matching file to determine its type:
           - `# Requirements:` → feature spec
           - `# Defect Report:` → defect spec
        5. **If feature specs match** → use the best-matching feature spec. Set **Related Spec** to its directory (e.g., `.claude/specs/feature-dark-mode/`).
        6. **If no feature specs match but defect specs do** → follow each matching defect spec's `**Related Spec**` link to find the root feature spec (same chain-resolution logic: follow `Related Spec` links through defect specs until reaching a `# Requirements:` heading, maintaining a visited set to detect cycles). Use the resolved feature spec.
        7. **If nothing matches** after filtering and chain following → set **Related Spec** to **N/A**.
7. Consult steering docs for project-specific requirements (e.g., accessibility, platform support)

### Output

Write to (or amend) `.claude/specs/{feature-name}/requirements.md`

### Human Review Gate

**[If `.claude/auto-mode` exists]:** Gate is pre-approved — proceed immediately to Phase 2.

**[If `.claude/auto-mode` does NOT exist]:** Present the requirements spec to the user:
- "Does this capture the requirements correctly?"
- "Are all acceptance criteria testable?"
- "Anything missing from scope?"

Do not proceed to Phase 2 until the user approves.

---

## Phase 2: PLAN (Technical Design)

### Input

- Approved `requirements.md` from Phase 1
- `.claude/steering/tech.md` for technical standards
- `.claude/steering/structure.md` for code organization patterns

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

Write to (or amend) `.claude/specs/{feature-name}/design.md`

### Human Review Gate

**[If `.claude/auto-mode` exists]:** Gate is pre-approved — proceed immediately to Phase 3.

**[If `.claude/auto-mode` does NOT exist]:** Present the technical design to the user:
- "Does this architecture align with the project?"
- "Are there concerns about the approach?"
- "Any alternatives to consider?"

Do not proceed to Phase 3 until the user approves.

---

## Phase 3: TASKS (Implementation Plan)

### Input

- Approved `design.md` from Phase 2
- `.claude/steering/structure.md` for file path conventions

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
- `.claude/specs/{feature-name}/tasks.md`
- `.claude/specs/{feature-name}/feature.gherkin`

### Human Review Gate

**[If `.claude/auto-mode` exists]:** Gate is pre-approved — proceed immediately to output.

**[If `.claude/auto-mode` does NOT exist]:** Present the task breakdown to the user:
- "Are the tasks properly scoped?"
- "Are dependencies correct?"
- "Is the phasing logical?"

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
Specs written to (or amended in) `.claude/specs/{feature-name}/`:
- requirements.md — Acceptance criteria and functional requirements
- design.md — Technical architecture and design decisions
- tasks.md — Phased implementation tasks
- feature.gherkin — BDD test scenarios

[If `.claude/auto-mode` does NOT exist]: Next step: Run `/implementing-specs #N` to plan and execute implementation.
[If `.claude/auto-mode` exists]: Done. Awaiting orchestrator.
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
├── steering/           # Project-wide context (from /setting-up-steering)
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
/creating-issues  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
                          ▲ You are here
```

## References

- [Spec-Driven Development (Thoughtworks)](https://www.thoughtworks.com/en-us/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices)
- [How to Write Good Specs (Addy Osmani)](https://addyosmani.com/blog/good-spec/)
- [SDD Tools Comparison (Martin Fowler)](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
