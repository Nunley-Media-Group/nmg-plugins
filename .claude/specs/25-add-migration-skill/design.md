# Design: Add Migration Skill

**Issue**: #25
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## Overview

The migration skill (`/migrating-projects`) is a prompt-based SKILL.md workflow that brings existing project files up to current plugin standards. Like all nmg-sdlc skills, it is a Markdown document that guides Claude through a structured process — no runtime code is required.

The skill follows a **scan → analyze → present → approve → apply** pattern. It reads the latest templates at runtime from the plugin's template directories, compares their heading structure against existing project files, identifies missing sections, and presents proposed additions for user review before modifying any files.

The core algorithm is **heading-based section diffing for Markdown files** and **key-level diffing for JSON configs**. The skill never rewrites existing content — it only inserts missing sections at the correct position with template placeholder content.

---

## Architecture

### Component Diagram

```
/migrating-projects (SKILL.md)
    │
    ├── Step 1: Locate Templates
    │   ├── Steering templates:  setting-up-steering/templates/*.md
    │   ├── Spec templates:      writing-specs/templates/*.md
    │   └── Config template:     openclaw/scripts/sdlc-config.example.json
    │
    ├── Step 2: Scan Project Files
    │   ├── Steering docs:       .claude/steering/*.md
    │   ├── Spec directories:    .claude/specs/*/{requirements,design,tasks}.md
    │   └── Config:              sdlc-config.json (project root)
    │
    ├── Step 3: Analyze Differences
    │   ├── Markdown files → Heading-based section diffing (## level)
    │   └── JSON configs   → Key-level diffing (root + steps)
    │
    ├── Step 4: Present Changes (Interactive Review Gate)
    │   └── Per-file summary of proposed additions
    │
    ├── Step 5: Apply Changes
    │   └── Insert missing sections / merge missing keys
    │
    └── Step 6: OpenClaw Skill Version Check
        └── Compare ~/.openclaw/skills/running-sdlc/ against source
```

### Data Flow

```
1. Skill resolves template directory paths from the installed plugin
2. Glob finds existing project files (steering docs, specs, config)
3. Read loads each template and its corresponding project file
4. Claude parses ## headings from both and identifies missing sections
5. For each missing section, Claude extracts the template content between headings
6. Proposed changes are presented as a per-file summary
7. User approves or rejects
8. If approved, Claude uses Edit to insert missing sections at correct positions
9. Summary report is output
```

---

## API / Interface Changes

### New Skill

| Skill | Location | Purpose |
|-------|----------|---------|
| `/migrating-projects` | `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | Migrate project files to latest template standards |

### Skill Invocation

**Input:** No arguments required. The skill operates on the current project directory.

**Output:** Summary report listing all files analyzed and changes made.

**Errors:**

| Condition | Behavior |
|-----------|----------|
| No `.claude/steering/` directory found | Skip steering migration, report "no steering docs found" |
| No `.claude/specs/` directory found | Skip spec migration, report "no specs found" |
| No `sdlc-config.json` found | Skip config migration, report "no config found" |
| Template directories not resolvable | Error: "Cannot find plugin templates — is nmg-sdlc installed?" |
| User rejects changes | Abort with no modifications |

---

## Database / Storage Changes

No database or schema changes. This skill operates on local Markdown and JSON files only.

---

## State Management

No persistent state. The skill is stateless — it performs a full comparison on every invocation. There is no version tracking or migration history.

---

## UI Components

Not applicable — this is a CLI skill with text-based interaction.

---

## Detailed Design

### Section Diffing Algorithm (Markdown)

The core migration logic for Markdown files uses **heading-level comparison**:

1. **Parse headings** — Extract all `##`-level headings from both the template and the existing file
2. **Identify missing** — Find headings present in the template but absent in the existing file
3. **Determine insertion point** — For each missing heading, find the preceding heading (in template order) that exists in the project file; the missing section inserts after that section's content
4. **Extract template content** — The content for each missing section is the text between its heading and the next heading in the template (placeholder guidance, tables, etc.)

**Heading extraction approach:**
```
Template headings:  [## Mission, ## Target Users, ## Core Value, ## Product Principles, ## Success Metrics]
Existing headings:  [## Mission, ## Target Users, ## Success Metrics]
Missing:            [## Core Value, ## Product Principles]
```

**Insertion logic:**
- `## Core Value` → insert after `## Target Users` section content (predecessor in template order)
- `## Product Principles` → insert after `## Core Value` section content (which was just inserted)

**Template content boundaries:**
- Each template file contains the template inside a Markdown code block (` ```markdown ... ``` `)
- The skill must parse the **content inside the code block**, not the surrounding instructional text
- For templates with two variants (feature + defect), the feature variant is the first code block and the defect variant follows after a `# Defect` heading

### Spec Variant Detection

For spec files (`requirements.md`, `design.md`, `tasks.md`), the skill must determine whether to compare against the feature or defect template variant:

1. **Content-based detection (primary):** Check the first heading in the existing file:
   - `# Requirements:` or `# Design:` or `# Tasks:` → feature variant
   - `# Defect Report:` or `# Root Cause Analysis:` → defect variant
2. **No fallback to gh CLI needed** — the file heading is definitive since `/writing-specs` always uses these heading patterns

### JSON Config Diffing

For `sdlc-config.json`, the approach differs from Markdown:

1. **Read both files** — Parse the project's `sdlc-config.json` and the template `sdlc-config.example.json`
2. **Compare at root level** — Identify top-level keys in the template that are absent from the project config
3. **Compare at steps level** — Identify step keys (`steps.*`) in the template absent from the project config
4. **Merge strategy:**
   - Missing root keys → add with template default values
   - Missing step keys → add with template default values
   - Existing keys → preserve user values (never overwrite)
   - New keys within existing steps (e.g., a new `skill` field added to an existing step) → add with template default

### OpenClaw Skill Version Check

1. **Read installed files** at `~/.openclaw/skills/running-sdlc/`
2. **Read source files** at `openclaw/skills/running-sdlc/` in the marketplace clone
3. **Compare content** — If any file differs, warn the user and suggest running `/installing-openclaw-skill`
4. **If not installed** — Skip with a note that OpenClaw skill is not installed locally

### Gherkin Files (feature.gherkin)

Gherkin files in `.claude/specs/*/feature.gherkin` are **excluded from section migration**. Unlike Markdown specs, Gherkin files contain project-specific scenarios that are not structurally comparable to the template. The template is a placeholder guide, not a structural standard. Migration of Gherkin files would risk corrupting hand-written test scenarios.

### Template Resolution

Templates are resolved at runtime from the installed plugin directory. The skill uses `Glob` to locate:

```
plugins/nmg-sdlc/skills/setting-up-steering/templates/*.md  → steering templates
plugins/nmg-sdlc/skills/writing-specs/templates/*.md         → spec templates
openclaw/scripts/sdlc-config.example.json                    → config template
```

The skill uses `${CLAUDE_PLUGIN_ROOT}` or resolves paths relative to the skill's own location within the plugin directory tree.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Full file regeneration** | Re-run `/setting-up-steering` and `/writing-specs` to regenerate files from scratch | Simple, always produces latest format | Destroys all user-written content; requires re-filling every section | Rejected — violates content preservation requirement |
| **B: Heading-based section diffing** | Parse headings, identify missing sections, insert at correct position | Preserves user content; self-updating; lightweight | Requires careful heading parsing; can't detect renamed sections | **Selected** — best balance of safety and effectiveness |
| **C: Line-by-line diff/merge** | Full text diff between template and existing file | Catches every difference including within sections | Would flag all user customizations as "differences"; high false positive rate | Rejected — too noisy; would try to overwrite user content |
| **D: Version-tagged migrations** | Track template version in a metadata field, apply incremental patches per version | Precise; handles renames and reorganizations | Requires maintaining migration scripts per version; not self-updating | Rejected — violates self-updating design principle |

---

## Security Considerations

- [x] **Authentication**: No external auth required; operates on local files only
- [x] **Authorization**: Interactive review gate prevents unauthorized file modifications
- [x] **Input Validation**: Template paths resolved from known plugin directories; no user-supplied paths
- [x] **Data Sanitization**: Existing file content is never reprocessed or re-interpreted
- [x] **Sensitive Data**: No secrets or credentials involved; operates on Markdown and JSON config files

---

## Performance Considerations

- [x] **Caching**: Not needed — single-pass analysis within one skill invocation
- [x] **Pagination**: Not applicable
- [x] **Lazy Loading**: Templates loaded only for file types that exist in the project
- [x] **Indexing**: Not applicable

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Section diffing | BDD | Missing sections detected and inserted correctly |
| Content preservation | BDD | Existing content unchanged after migration |
| Variant detection | BDD | Feature vs defect templates applied correctly |
| JSON config diffing | BDD | Missing keys merged, existing values preserved |
| Edge cases | BDD | Already up-to-date, missing files, no project files |
| OpenClaw check | BDD | Outdated skill detected and reported |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Heading parsing misidentifies section boundaries | Low | Medium | Use `## ` prefix matching (standard ATX headings); validate against known template headings |
| Template code block parsing extracts wrong content | Low | High | Templates follow a consistent pattern (instructional text + single code block per variant); test with all current templates |
| Inserted sections break document flow | Low | Medium | Insert with proper `---` separators matching template style; user reviews before apply |
| JSON merge overwrites user-customized step values | Low | High | Only add missing keys; never modify existing key values |
| Renamed template sections cause false "missing" | Low | Low | Acceptable trade-off — skill inserts the new-name section; user can manually remove the old-name section during review |

---

## Open Questions

- [x] Should `feature.gherkin` files be migrated? — **No**, they contain project-specific scenarios not structurally comparable to the template
- [x] How should template code blocks be parsed? — Extract content between ` ```markdown ` and ` ``` ` delimiters; first block is feature variant, content after `# Defect` heading is defect variant
- [x] What about `### ` (H3) level headings? — Only compare at `## ` level for section presence; H3 subheadings are part of their parent section's content and get included when a missing `## ` section is inserted

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`) — SKILL.md in `skills/migrating-projects/`
- [x] All API/interface changes documented with schemas — skill input/output/errors defined
- [x] Database/storage changes planned with migrations — N/A (no database)
- [x] State management approach is clear — stateless, full comparison each run
- [x] UI components and hierarchy defined — N/A (CLI skill)
- [x] Security considerations addressed — interactive gate, no auth needed
- [x] Performance impact analyzed — single-pass, no external APIs
- [x] Testing strategy defined — BDD scenarios per acceptance criterion
- [x] Alternatives were considered and documented — 4 options evaluated
- [x] Risks identified with mitigations — 5 risks documented
