# Design: Detect Existing Steering Enhancement Flow

**Issue**: #26
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## Overview

This feature modifies the `/setting-up-steering` skill to detect existing steering documents and branch into an enhancement flow rather than always running the bootstrap flow. The change is entirely within a single Markdown file (`SKILL.md`) — no new files, templates, or tool permissions are needed.

The skill currently has a linear 4-step workflow (scan → generate → write → prompt). This design introduces a detection step at the top that checks for existing steering files and conditionally routes to either the existing bootstrap flow or a new enhancement flow. The enhancement flow reads existing files, asks the user what they want to change, applies the requested modifications, and confirms the result.

Since nmg-sdlc skills are prompt-based Markdown (not executable code), the "branching" is implemented as conditional instructions to Claude — similar to how the `writing-specs` skill branches between feature and defect variants based on issue labels.

---

## Architecture

### Component Diagram

```
/setting-up-steering SKILL.md (modified)
    │
    ├── Step 0: Detect existing steering files (NEW)
    │       │
    │       ├── Files found → Enhancement Flow (NEW)
    │       │       ├── Step E1: Report findings
    │       │       ├── Step E2: Ask what to enhance
    │       │       ├── Step E3: Read, modify, write
    │       │       └── Step E4: Confirm changes
    │       │
    │       └── No files found → Bootstrap Flow (EXISTING)
    │               ├── Step 1: Scan the Codebase
    │               ├── Step 2: Generate Steering Documents
    │               ├── Step 3: Write Files
    │               └── Step 4: Prompt User
    │
    └── Templates (UNCHANGED)
        ├── product.md
        ├── tech.md
        └── structure.md
```

### Data Flow

```
1. User invokes /setting-up-steering
2. Claude checks for .claude/steering/{product,tech,structure}.md via Glob
3a. IF files exist → Enhancement flow:
    3a.1. Report which files were found
    3a.2. Ask user what enhancement they want (open-ended question)
    3a.3. Read relevant steering file(s)
    3a.4. Apply requested changes using Edit tool
    3a.5. Confirm what was modified
3b. IF no files exist → Bootstrap flow (unchanged Steps 1-4)
```

---

## Detailed Design

### Detection Logic

The detection step uses `Glob` to check for the three steering files:

```
Glob: .claude/steering/product.md
Glob: .claude/steering/tech.md
Glob: .claude/steering/structure.md
```

If **at least one** file is found, the skill enters the enhancement flow. If **none** are found, the bootstrap flow executes as today.

### Enhancement Flow Steps

#### Step E1: Report Findings

Tell the user which steering files were found. Example output:

```
Found existing steering documents:
  - product.md ✓
  - tech.md ✓
  - structure.md ✓

These documents contain your project-specific customizations.
```

#### Step E2: Ask What to Enhance

Ask an open-ended question using `AskUserQuestion` or direct prompting:

> "What would you like to update or improve in your steering documents?"

No predefined menu — the user describes what they want in their own words.

#### Step E3: Read, Modify, Write

1. Read the relevant steering file(s) based on the user's request
2. Apply the requested changes using `Edit` (not `Write`) to preserve existing content
3. Only modify sections related to the user's request

#### Step E4: Confirm Changes

Summarize what was modified:

```
Updated steering documents:
  - tech.md — Added Redis to the Technology Stack table

All other content preserved unchanged.
```

### SKILL.md Modifications

| Section | Change |
|---------|--------|
| Frontmatter `description` | Change from "Run once per project" to reflect iterative use |
| "When to Use" | Add "When you want to enhance or update existing steering documents" |
| Intro paragraph | Change from "Run this once per project" to describe both bootstrap and enhancement |
| Workflow | Add Step 0 (detection) before existing steps; add Enhancement Flow section |
| "What Gets Created" | Rename to "What Gets Created / Modified" — note that enhancement modifies existing files |
| Integration section | Update "one-time setup step" language to "setup and maintenance" |

### What Does NOT Change

- The three template files (`templates/product.md`, `templates/tech.md`, `templates/structure.md`)
- The bootstrap flow logic (Steps 1-4)
- The `allowed-tools` in frontmatter (Read, Glob, Grep, Task, Write, Edit, Bash already include everything needed)
- The output file locations (`.claude/steering/`)

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Separate skill** | Create a new `/enhancing-steering` skill | Clean separation; no risk to bootstrap flow | Doubles maintenance surface; users must discover a new command; duplicates tool permissions | Rejected — unnecessary complexity |
| **B: Branching within existing skill** | Add detection + conditional flow to SKILL.md | Single entry point; minimal new surface; familiar invocation; consistent with how writing-specs branches | Longer SKILL.md | **Selected** |
| **C: Menu-driven enhancement** | Offer preset enhancement options (add persona, update stack, etc.) | More guided | Limits flexibility; more maintenance; violates "open-ended question" requirement | Rejected — per issue requirements |

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Skill behavior | BDD (Gherkin) | All 5 acceptance criteria |
| Verification | `/verifying-specs` | Spec-to-implementation fidelity check |
| Manual | Install plugin locally | Run both bootstrap and enhancement flows |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Enhancement flow accidentally overwrites content | Medium | High | Design specifies `Edit` over `Write`; AC4 explicitly tests preservation |
| SKILL.md becomes too long (>500 lines) | Low | Low | Enhancement flow is ~40 lines of instructions; total will remain well under 500 |
| Bootstrap flow regressed | Low | High | AC5 explicitly verifies bootstrap still works; existing steps are not modified |

---

## Open Questions

- None

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`)
- [x] Branching pattern matches existing skill conventions (e.g., writing-specs defect variant)
- [x] No new files or templates needed
- [x] No new tool permissions needed
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
- [x] Testing strategy defined
