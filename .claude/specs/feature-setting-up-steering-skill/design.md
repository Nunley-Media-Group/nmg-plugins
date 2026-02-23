# Design: Setting Up Steering Skill

**Issues**: #3, #26
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/setting-up-steering` skill performs a comprehensive codebase analysis to generate three steering documents that serve as shared context for all downstream SDLC skills. The skill scans for package manifests, dependency files, test frameworks, CI configuration, and existing documentation to populate templates with project-specific information.

The three output documents — `product.md`, `tech.md`, and `structure.md` — are written to `.claude/steering/` and provide the foundation that `/creating-issues`, `/writing-specs`, `/implementing-specs`, and `/verifying-specs` all reference for project-specific context. The skill also creates an empty `.claude/specs/` directory for future spec storage.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────┐
│        /setting-up-steering Skill             │
├──────────────────────────────────────────────┤
│  Step 1: Scan codebase                        │
│    ├── Package files (package.json, etc.)     │
│    ├── Source directories                     │
│    ├── Test frameworks                        │
│    ├── CI configuration                       │
│    └── Existing docs (README, CLAUDE.md)      │
│                                               │
│  Step 2: Generate from templates              │
│    ├── templates/product.md → product.md      │
│    ├── templates/tech.md → tech.md            │
│    └── templates/structure.md → structure.md   │
│                                               │
│  Step 3: Write to .claude/steering/           │
│  Step 4: Prompt user for customization        │
└──────────────────────────────────────────────┘
```

### Data Flow

```
1. Skill invoked by user
2. Glob/Grep/Read scan for package files, deps, config
3. Template files read from skills/setting-up-steering/templates/
4. Templates populated with discovered data
5. Three documents written to .claude/steering/
6. Empty .claude/specs/ directory created
7. User prompted to review and customize
```

---

## API / Interface Changes

### New Endpoints / Methods

| Endpoint / Method | Type | Auth | Purpose |
|-------------------|------|------|---------|
| [path or signature] | [GET/POST/etc or method] | [Yes/No] | [description] |

### Request / Response Schemas

#### [Endpoint or Method Name]

**Input:**
```json
{
  "field1": "string",
  "field2": 123
}
```

**Output (success):**
```json
{
  "id": "string",
  "field1": "string",
  "createdAt": "ISO8601"
}
```

**Errors:**

| Code / Type | Condition |
|-------------|-----------|
| [error code] | [when this happens] |

---

## Database / Storage Changes

### Schema Changes

| Table / Collection | Column / Field | Type | Nullable | Default | Change |
|--------------------|----------------|------|----------|---------|--------|
| [name] | [name] | [type] | Yes/No | [value] | Add/Modify/Remove |

### Migration Plan

```
-- Describe the migration approach
-- Reference tech.md for migration conventions
```

### Data Migration

[If existing data needs transformation, describe the approach]

---

## State Management

Reference `structure.md` and `tech.md` for the project's state management patterns.

### New State Shape

```
// Pseudocode — use project's actual language/framework
FeatureState {
  isLoading: boolean
  items: List<Item>
  error: string | null
  selected: Item | null
}
```

### State Transitions

```
Initial → Loading → Success (with data)
                  → Error (with message)

User action → Optimistic update → Confirm / Rollback
```

---

## UI Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| [name] | [path per structure.md] | [description] |

### Component Hierarchy

```
FeatureScreen
├── Header
├── Content
│   ├── LoadingState
│   ├── ErrorState
│   ├── EmptyState
│   └── DataView
│       ├── ListItem × N
│       └── DetailView
└── Actions
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md` | Create | Skill definition with 4-step workflow |
| `plugins/nmg-sdlc/skills/setting-up-steering/templates/product.md` | Create | Product steering template |
| `plugins/nmg-sdlc/skills/setting-up-steering/templates/tech.md` | Create | Technical steering template |
| `plugins/nmg-sdlc/skills/setting-up-steering/templates/structure.md` | Create | Code structure template |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Manual document creation | User writes steering docs from scratch | Rejected — too much upfront effort |
| **Codebase-scanned templates** | Auto-populate templates from scanning | **Selected** — fast bootstrap with customization |

---

## Security Considerations

- [x] No secrets captured from environment variables or config files
- [x] Steering docs contain only structural/architectural information
- [x] Read-only access to codebase during scanning

---

## Performance Considerations

- [x] Glob/Grep scans are bounded to known file patterns
- [x] Single-pass scanning — no redundant reads
- [x] Template population is string-based, no heavy processing

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Skill Workflow | BDD | Scenarios for document generation |
| Template Output | Manual | Verify populated content matches project |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [risk] | Low/Med/High | Low/Med/High | [approach] |

---

## Open Questions

- None

---

### From Issue #26

## Overview (Enhancement Flow)

This feature modifies the `/setting-up-steering` skill to detect existing steering documents and branch into an enhancement flow rather than always running the bootstrap flow. The change is entirely within a single Markdown file (`SKILL.md`) — no new files, templates, or tool permissions are needed.

The skill currently has a linear 4-step workflow (scan → generate → write → prompt). This design introduces a detection step at the top that checks for existing steering files and conditionally routes to either the existing bootstrap flow or a new enhancement flow. The enhancement flow reads existing files, asks the user what they want to change, applies the requested modifications, and confirms the result.

Since nmg-sdlc skills are prompt-based Markdown (not executable code), the "branching" is implemented as conditional instructions to Claude — similar to how the `writing-specs` skill branches between feature and defect variants based on issue labels.

### From Issue #26

## Architecture (Enhancement Flow)

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

### From Issue #26

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

### From Issue #26

## Alternatives Considered (Enhancement Flow)

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Separate skill** | Create a new `/enhancing-steering` skill | Clean separation; no risk to bootstrap flow | Doubles maintenance surface; users must discover a new command; duplicates tool permissions | Rejected — unnecessary complexity |
| **B: Branching within existing skill** | Add detection + conditional flow to SKILL.md | Single entry point; minimal new surface; familiar invocation; consistent with how writing-specs branches | Longer SKILL.md | **Selected** |
| **C: Menu-driven enhancement** | Offer preset enhancement options (add persona, update stack, etc.) | More guided | Limits flexibility; more maintenance; violates "open-ended question" requirement | Rejected — per issue requirements |

### From Issue #26

## Risks & Mitigations (Enhancement Flow)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Enhancement flow accidentally overwrites content | Medium | High | Design specifies `Edit` over `Write`; AC4 explicitly tests preservation |
| SKILL.md becomes too long (>500 lines) | Low | Low | Enhancement flow is ~40 lines of instructions; total will remain well under 500 |
| Bootstrap flow regressed | Low | High | AC5 explicitly verifies bootstrap still works; existing steps are not modified |

### From Issue #26

## Testing Strategy (Enhancement Flow)

| Layer | Type | Coverage |
|-------|------|----------|
| Skill behavior | BDD (Gherkin) | All 5 acceptance criteria from issue #26 |
| Verification | `/verifying-specs` | Spec-to-implementation fidelity check |
| Manual | Install plugin locally | Run both bootstrap and enhancement flows |

---

## Change History

| Date | Issue | Description |
|------|-------|-------------|
| 2026-02-15 | #3 | Initial design: 4-step bootstrap workflow for steering document generation |
| 2026-02-15 | #26 | Enhancement design: detection step + conditional enhancement flow added to SKILL.md |

---

## Validation Checklist

- [x] Architecture follows existing plugin skill patterns
- [x] File changes documented
- [x] Security considerations addressed
- [x] Performance impact analyzed
- [x] Alternatives considered
- [x] Branching pattern matches existing skill conventions (e.g., writing-specs defect variant)
- [x] No new files or templates needed (for #26)
- [x] No new tool permissions needed (for #26)
- [x] Risks identified with mitigations
