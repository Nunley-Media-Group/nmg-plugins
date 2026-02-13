---
name: writing-specs
description: "Create BDD specifications from a GitHub issue: requirements, technical design, and task breakdown."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Task, Write, Edit, WebFetch, WebSearch, EnterPlanMode, Skill, Bash(gh:*)
---

# Writing Specs

Create BDD specifications from a GitHub issue through three phases: requirements, technical design, and implementation tasks. Each phase has a human review gate.

**REQUIRED: Use ultrathink (extended thinking mode) throughout all specification processes.**

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

## Workflow Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SPECIFY   │────▶│    PLAN     │────▶│    TASKS    │
│ requirements│     │  technical  │     │   atomic    │
└─────────────┘     └─────────────┘     └─────────────┘
       ↑                  ↑                   ↑
   Human Review      Human Review        Human Review
```

## Prerequisites

1. A GitHub issue exists (created via `/creating-issues` or manually)
2. Steering documents exist in `.claude/steering/` (create with `/setting-up-steering` if missing)

## Steering Documents

Steering documents provide project-specific context. They live in `.claude/steering/`:

| Document | Purpose |
|----------|---------|
| `product.md` | Vision, users, success metrics |
| `tech.md` | Stack, constraints, testing standards |
| `structure.md` | Code organization, naming, patterns |

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
2. Read `.claude/steering/product.md` for user context and product vision
3. Create `requirements.md` using [templates/requirements.md](templates/requirements.md)
4. Bootstrap acceptance criteria from the issue body
5. Fill in functional and non-functional requirements
6. Consult steering docs for project-specific requirements (e.g., accessibility, platform support)

### Output

Write to `.claude/specs/{feature-name}/requirements.md`

### Human Review Gate

Present the requirements spec to the user:
- "Does this capture the requirements correctly?"
- "Are all acceptance criteria testable?"
- "Anything missing from scope?"

**Do not proceed to Phase 2 until the user approves.**

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
3. Create `design.md` using [templates/design.md](templates/design.md)
4. Map the feature to the project's architecture layers
5. Design data flow, API changes, database changes, state management
6. Consider alternatives and document the decision

### Output

Write to `.claude/specs/{feature-name}/design.md`

### Human Review Gate

Present the technical design to the user:
- "Does this architecture align with the project?"
- "Are there concerns about the approach?"
- "Any alternatives to consider?"

**Do not proceed to Phase 3 until the user approves.**

---

## Phase 3: TASKS (Implementation Plan)

### Input

- Approved `design.md` from Phase 2
- `.claude/steering/structure.md` for file path conventions

### Process

1. Break the design into atomic, agent-friendly tasks using [templates/tasks.md](templates/tasks.md)
2. Map tasks to actual file paths in the project (reference `structure.md`)
3. Define dependencies between tasks
4. Ensure each task has verifiable acceptance criteria
5. Include BDD testing tasks
6. Create the Gherkin feature file using [templates/feature.gherkin](templates/feature.gherkin)

### Phasing

Tasks should follow this order:

| Phase | Purpose | Examples |
|-------|---------|---------|
| Setup | Foundation | Migrations, types, interfaces |
| Backend | Server-side | Repository, service, controller, routes |
| Frontend | Client-side | Models, state management, UI components |
| Integration | Wiring | Navigation, provider registration, cross-feature |
| Testing | Verification | BDD feature files, step definitions, unit tests |

### Output

Write to:
- `.claude/specs/{feature-name}/tasks.md`
- `.claude/specs/{feature-name}/feature.gherkin`

### Human Review Gate

Present the task breakdown to the user:
- "Are the tasks properly scoped?"
- "Are dependencies correct?"
- "Is the phasing logical?"

---

## After Completion

Output:

```
Specs written to `.claude/specs/{feature-name}/`:
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
    └── {feature-name}/
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
