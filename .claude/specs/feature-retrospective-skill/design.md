# Design: Spec Retrospective Skill

**Issues**: #1, #67
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## Overview

This feature adds a new `/running-retrospectives` skill to the nmg-sdlc plugin and a small integration point in `/writing-specs`. The skill scans all defect specs in `.claude/specs/`, identifies those with `Related Spec` links back to feature specs, analyzes the gap between what the feature spec covered and what the defect revealed, classifies findings into three pattern types, and writes a structured `.claude/steering/retrospective.md` steering document. The `/writing-specs` skill then reads this document during Phase 1 alongside the existing steering docs.

The design is intentionally simple: the skill is a prompt-based workflow (SKILL.md) with one template for the output document. No agents, hooks, or scripts are needed. The skill uses Glob/Grep/Read to scan specs, then Write to produce the output. The heavy lifting — pattern analysis and learning extraction — is done by the LLM following structured instructions in the SKILL.md.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    nmg-sdlc Plugin                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Skills (existing)                                          │
│  ┌─────────────────┐                                        │
│  │ /writing-specs  │──reads──▶ .claude/steering/*           │
│  └────────┬────────┘          (product, tech, structure,    │
│           │                    + NEW: retrospective.md)     │
│           │                                                 │
│  Skills (new)                                               │
│  ┌──────────────────────────┐                               │
│  │ /running-retrospectives  │                               │
│  └────────┬─────────────────┘                               │
│           │                                                 │
│           ├──reads──▶ .claude/specs/*/requirements.md        │
│           │           (scan for defect specs with            │
│           │            Related Spec links)                   │
│           │                                                 │
│           ├──reads──▶ .claude/specs/{related}/requirements.md│
│           │           (read the linked feature spec)         │
│           │                                                 │
│           ├──reads──▶ .claude/steering/retrospective-state.json │
│           │           (state tracking from issue #67)        │
│           │                                                 │
│           ├──writes─▶ .claude/steering/retrospective.md     │
│           │           (structured learnings by pattern type) │
│           │                                                 │
│           └──writes─▶ .claude/steering/retrospective-state.json │
│                       (content hashes for skip optimization) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User invokes /running-retrospectives
2. Skill scans .claude/specs/*/requirements.md for defect indicators
   (Severity: field identifies defect specs)
3. Filters to defect specs that have a Related Spec: field
4. For each eligible defect spec:
   a. Read the defect requirements.md (reproduction, ACs, root cause context)
   b. Read the related feature spec's requirements.md
   c. Compare: what did the feature spec cover vs what the defect revealed?
   d. Classify the gap into a pattern type
5. Aggregate learnings across all defect specs
6. Read existing retrospective.md (if it exists) for incremental update
7. Write .claude/steering/retrospective.md with structured learnings
8. Output summary to user
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

### New Files

| File | Purpose |
|------|---------|
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | Skill definition — workflow, automation mode, integration |
| `plugins/nmg-sdlc/skills/running-retrospectives/templates/retrospective.md` | Template for the output steering document |

### Modified Files

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | Add `retrospective.md` to Phase 1 steering doc reads | FR7 — writing-specs consumes retrospective learnings |
| `README.md` | Add `/running-retrospectives` to the SDLC Skills Reference table | Discoverability — all skills listed in the README |
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | Add Step 1.5 (load state + hash), modify Steps 2/3 (partition by change status), modify Step 7 (carry-forward extraction), add Step 8.5 (write state file), modify Step 9 (updated summary) | Issue #67 — state tracking and skip optimization |

---

## SKILL.md Design

### Metadata

```yaml
---
name: running-retrospectives
description: "Analyze defect specs to identify spec-writing gaps and produce actionable learnings."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(gh:*)
---
```

### Workflow Steps

| Step | Action | Tools Used |
|------|--------|------------|
| 1 | Scan `.claude/specs/*/requirements.md` for defect specs (contain `Severity:` field) | Glob, Grep |
| 1.5 | Load state file and compute content hashes | Read, Bash |
| 2 | Filter to defect specs with `Related Spec:` field (new/modified only) | Read (each candidate) |
| 3 | For each eligible defect: read defect spec + linked feature spec (new/modified only) | Read |
| 4 | Analyze gap between feature spec coverage and defect finding | LLM analysis |
| 5 | Classify each learning into pattern type | LLM analysis |
| 6 | Read existing `retrospective.md` if present (for incremental update + carry-forward) | Read |
| 7 | Extract carried-forward learnings from existing `retrospective.md` | LLM analysis |
| 8 | Write/update `.claude/steering/retrospective.md` using template | Write |
| 8.5 | Write state file | Write |
| 9 | Output summary | Console output |

### Defect Spec Detection Strategy

Defect specs are identified by scanning for the `**Severity**:` field in `requirements.md` files. This field is unique to the defect requirements template and does not appear in feature specs. The detection approach:

```
1. Glob: .claude/specs/*/requirements.md
2. Grep each file for "Severity:" — matches are defect specs
3. Read matched files, extract Related Spec field
4. Skip files without Related Spec (no feature spec to correlate)
```

### Pattern Classification

The skill classifies each learning into exactly one of three categories:

| Pattern Type | Description | Example |
|-------------|-------------|---------|
| **Missing Acceptance Criteria** | The feature spec lacked ACs for the scenario that caused the bug | Feature spec for login had no AC for session timeout expiry |
| **Undertested Boundaries** | The feature spec had related ACs but didn't cover the boundary condition | Feature spec tested valid inputs but not empty string or max-length |
| **Domain-Specific Gaps** | The feature spec missed domain knowledge that should have been captured | Financial feature spec didn't consider rounding rules for currency |

### Learning Filtering Logic

The skill EXCLUDES learnings that fall outside spec-writing scope:

| Exclude Category | Rationale | Example |
|-----------------|-----------|---------|
| Implementation bugs | Code-level errors, not spec gaps | Off-by-one error, wrong variable name |
| Tooling issues | Build/CI/toolchain problems | Webpack config error, dependency conflict |
| Infrastructure failures | Environment/deployment issues | Server timeout, DNS misconfiguration |
| Process failures | Workflow/communication gaps | Missing code review, skipped testing |

The heuristic: if the defect could have been prevented by a better-written feature spec (more ACs, tighter boundary definitions, deeper domain analysis), it produces a learning. If not, it's excluded.

---

## Retrospective Document Format

### Template Structure

```markdown
# Spec Retrospective

**Last Updated**: [YYYY-MM-DD]
**Defect Specs Analyzed**: [count]
**Learnings Generated**: [count]

---

## How to Use This Document

This document is automatically generated by `/running-retrospectives` and read by
`/writing-specs` during Phase 1 (SPECIFY). When writing new feature specs, consult
the relevant sections below to avoid repeating past spec gaps.

---

## Missing Acceptance Criteria

Defects caused by scenarios that the original feature spec did not cover at all.

| Learning | Source Defect | Related Feature Spec | Recommendation |
|----------|--------------|---------------------|----------------|
| [description] | .claude/specs/[defect]/ | .claude/specs/[feature]/ | [actionable guidance] |

---

## Undertested Boundaries

Defects caused by boundary conditions the original feature spec addressed
insufficiently.

| Learning | Source Defect | Related Feature Spec | Recommendation |
|----------|--------------|---------------------|----------------|
| [description] | .claude/specs/[defect]/ | .claude/specs/[feature]/ | [actionable guidance] |

---

## Domain-Specific Gaps

Defects caused by domain knowledge the original feature spec failed to capture.

| Learning | Source Defect | Related Feature Spec | Recommendation |
|----------|--------------|---------------------|----------------|
| [description] | .claude/specs/[defect]/ | .claude/specs/[feature]/ | [actionable guidance] |
```

### Design Decisions for Format

- **Tables per section**: Structured for machine readability (writing-specs can parse) and human readability
- **Source traceability**: Every learning links back to its defect spec and related feature spec
- **Actionable recommendations**: Each learning includes a concrete "when writing specs for X, also consider Y" guidance
- **Three fixed sections**: Matches the three pattern types; writing-specs can scan for the relevant section heading

---

## Writing-Specs Integration Design

### Change to `/writing-specs` Phase 1

The modification is minimal — add one read step and one instruction to the existing Phase 1 process:

**Current Phase 1 Process (step 3):**
```
3. Read `.claude/steering/product.md` for user context and product vision
```

**Updated Phase 1 Process (add after step 3):**
```
3. Read `.claude/steering/product.md` for user context and product vision
4. If `.claude/steering/retrospective.md` exists, read it and apply relevant
   learnings when drafting acceptance criteria — especially for features in
   domains where past defects revealed spec gaps
```

Subsequent step numbers shift by 1. The retrospective is read but does not change the template structure — it provides additional context that influences the LLM's AC generation.

### Why Conditional Read (Not Required)

The retrospective doc is optional because:
- New projects won't have defect specs yet
- Projects without defect patterns shouldn't be blocked
- The skill should work identically to today when no retrospective exists

---

### From Issue #67

## State File Schema

### `retrospective-state.json`

```json
{
  "version": 1,
  "specs": {
    ".claude/specs/17-fix-auto-mode-cleanup-on-exit/requirements.md": {
      "hash": "a1b2c3d4e5f6...",
      "lastAnalyzed": "2026-02-22"
    },
    ".claude/specs/20-fix-monitorci-step8/requirements.md": {
      "hash": "f6e5d4c3b2a1...",
      "lastAnalyzed": "2026-02-20"
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | integer | Schema version (currently `1`). Enables future migration if schema evolves. |
| `specs` | object | Map of spec file paths → metadata. Keys are relative paths from project root. |
| `specs[path].hash` | string | SHA-256 hex digest of the spec file's content at time of last analysis. |
| `specs[path].lastAnalyzed` | string | ISO 8601 date (YYYY-MM-DD) when the spec was last analyzed. |

### Hash Computation

The skill instructs Claude to compute SHA-256 using the Bash tool:

```bash
shasum -a 256 .claude/specs/{defect}/requirements.md
```

This is POSIX-compatible (`shasum` ships with macOS and most Linux distributions). The skill uses the hex digest portion of the output (first 64 characters).

**Cross-platform note**: `shasum` is available on macOS and Linux. On Windows with Git Bash or WSL, `shasum` is also available. For environments where `shasum` is missing, `sha256sum` (GNU coreutils) is an equivalent fallback. The skill should try `shasum -a 256` first and fall back to `sha256sum` if the first command fails.

### Workflow Modifications (from Issue #67)

#### Step 1.5: Load State and Compute Hashes (NEW)

Inserted after Step 1 (Scan for Defect Specs) and before Step 2 (Filter to Eligible).

**Instructions for the skill:**
1. Read `.claude/steering/retrospective-state.json` if it exists
2. If the file exists but is malformed JSON or has an unrecognized `version` field (not `1`), log a warning and treat as absent (full re-analysis)
3. Compute SHA-256 hash for each defect spec found in Step 1
4. Compare hashes against state file entries:
   - **New**: spec path not in state file
   - **Modified**: spec path in state file but hash differs
   - **Unchanged**: spec path in state file and hash matches
   - **Deleted**: path in state file but spec no longer exists on disk
5. Report the partition counts (e.g., "Found 2 new, 1 modified, 4 unchanged, 1 deleted defect specs")

#### Step 2 Modification: Filter Only New/Modified

The existing Step 2 (Filter to Eligible Defect Specs and Resolve Feature Spec Links) currently processes all defect specs. With state tracking:
- Apply eligibility filtering and chain resolution **only to new and modified specs**
- Unchanged specs are already known to be eligible (they were analyzed in a previous run)
- Deleted specs are removed from consideration entirely

#### Step 3 Modification: Analyze Only New/Modified

The existing Step 3 (Analyze Each Eligible Defect) currently processes all eligible specs. With state tracking:
- Analyze **only new and modified eligible specs**
- Unchanged specs are skipped entirely — their learnings will be carried forward in Step 7

#### Step 7 Modification: Extract Carried-Forward Learnings

The existing Step 7 reads the previous `retrospective.md` for the incremental update strategy. With state tracking, this step gains carry-forward extraction:

1. Read `.claude/steering/retrospective.md` if it exists
2. Parse each table row in the three pattern-type sections (Missing Acceptance Criteria, Undertested Boundaries, Domain-Specific Gaps)
3. For each learning row, extract the evidence spec paths from the "Evidence (defect specs)" column
4. **Carry forward** a learning if ALL of its evidence spec paths are in the "unchanged" set
5. **Do not carry forward** a learning if ANY of its evidence specs are in the "new", "modified", or "deleted" sets — those learnings will be re-derived from fresh analysis in Step 3

The carried-forward learnings join the freshly analyzed learnings as input to Step 4 (Aggregate).

#### Step 4 Modification: Aggregate Combined Set

Step 4 (Aggregate Cross-Cutting Patterns) currently operates on a single run's analysis. With carry-forward:
- Input is now: freshly analyzed learnings (from new/modified specs) + carried-forward learnings (from unchanged specs)
- The deduplication/merging logic applies across the combined set
- A carried-forward learning may be merged with a fresh learning if they share a root pattern

#### Step 8.5: Write State File (NEW)

Inserted after Step 8 (Write Retrospective Document) and before Step 9 (Output Summary).

**Instructions for the skill:**
1. Build the state object:
   - For each analyzed spec (new + modified): record the computed hash and today's date
   - For each unchanged spec: preserve the existing hash and `lastAnalyzed` date from the loaded state
   - Omit deleted specs (they are not in the current defect spec set)
2. Set `version` to `1`
3. Write `.claude/steering/retrospective-state.json` as formatted JSON (2-space indent)

#### Step 9 Modification: Updated Summary

The output summary gains additional detail:

```
Retrospective complete.

Defect specs: [total] total ([new] new, [modified] modified, [unchanged] skipped, [deleted] removed)
Learnings generated: [total] ([new_count] new, [carried_count] carried forward)

  Missing Acceptance Criteria: [count]
  Undertested Boundaries: [count]
  Domain-Specific Gaps: [count]

Written to .claude/steering/retrospective.md
State saved to .claude/steering/retrospective-state.json
```

### Carry-Forward Strategy (from Issue #67)

The key design decision is how learnings from unchanged specs are preserved without re-analysis.

#### Approach: Parse Existing `retrospective.md`

Learnings are carried forward by parsing the existing `retrospective.md` markdown tables. Each learning row has three columns: Learning, Recommendation, Evidence. The evidence column contains comma-separated spec directory paths.

**Parsing logic:**
1. Read `.claude/steering/retrospective.md`
2. Identify the three section tables (by section heading: "Missing Acceptance Criteria", "Undertested Boundaries", "Domain-Specific Gaps")
3. For each table row (skip header and separator rows), extract:
   - Learning text (column 1)
   - Recommendation text (column 2)
   - Evidence paths (column 3, split on `,` and trim whitespace)
4. Classify each learning as carry-forward or re-derive based on evidence spec status

**Why not store learnings in the state file?** The requirements explicitly exclude caching learning text in the state file (Out of Scope). Parsing the existing `retrospective.md` is the appropriate approach — it's the source of truth for current learnings.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Subagent-based analysis** | Create a dedicated agent (like architecture-reviewer) to analyze defect specs | Reusable analysis; could be invoked from other contexts | Over-engineered for prompt-based analysis; adds complexity | Rejected — SKILL.md with LLM analysis is sufficient |
| **B: Per-defect incremental mode** | Process one defect at a time as they're filed | Lower latency per invocation | Complex state management; harder to identify cross-defect patterns | Rejected — batch mode captures patterns across defects (per issue scope) |
| **C: Inline in writing-specs** | Build analysis directly into `/writing-specs` Phase 1 | No new skill needed | Violates single-responsibility; makes writing-specs slower; can't run analysis independently | Rejected — separate skill is cleaner |
| **D: Structured SKILL.md + template** | New skill with workflow steps, output template, and writing-specs integration | Simple, follows existing patterns, separately invocable | Requires manual invocation (not automatic) | **Selected** |
| **E: Store learnings in state file** | Cache each learning's text alongside the hash | Eliminates need to parse retrospective.md; self-contained | Out of scope per requirements; bloats state file; two sources of truth for learning text | Rejected — explicitly excluded |
| **F: Parse retrospective.md for carry-forward** | Extract learnings from existing output by parsing markdown tables | Respects out-of-scope constraint; state file stays small; retrospective.md remains single source of truth | Requires markdown table parsing (fragile if format changes) | **Selected** — aligns with requirements |
| **G: Re-derive all learnings every run** | Keep hashing but only use it for the summary ("skipped N unchanged") | Simplest implementation; no carry-forward complexity | Defeats the purpose — still does full LLM analysis | Rejected — doesn't satisfy FR17 |

---

## Security Considerations

- [ ] **Authentication**: [How auth is enforced]
- [ ] **Authorization**: [Permission checks required]
- [ ] **Input Validation**: [Validation approach]
- [ ] **Data Sanitization**: [How data is sanitized]
- [ ] **Sensitive Data**: [How sensitive data is handled]

---

## Performance Considerations

- [ ] **Caching**: [Caching strategy]
- [ ] **Pagination**: [Pagination approach for large datasets]
- [ ] **Lazy Loading**: [What loads lazily]
- [ ] **Indexing**: [Database indexes or search indexes needed]

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Skill workflow | BDD (Gherkin) | All 5 base acceptance criteria become scenarios |
| Defect detection | BDD scenario | Correctly identifies defect specs via Severity field |
| Pattern classification | BDD scenario | Correctly classifies learnings into 3 types |
| Learning filtering | BDD scenario | Excludes non-spec learnings |
| Incremental update | BDD scenario | Preserves existing learnings, adds new, removes outdated |
| Writing-specs integration | BDD scenario | Phase 1 reads and applies retrospective when present |
| Graceful degradation | BDD scenario | Handles missing Related Spec, no defect specs, empty specs |
| First-run behavior | Exercise testing | No state file → full analysis → state file created |
| Incremental run | Exercise testing | State file exists → unchanged specs skipped → carry-forward works |
| Malformed state file | Exercise testing | Invalid JSON → warning → full re-analysis → valid state file written |
| Deleted spec cleanup | Exercise testing | Remove a defect spec → run → state entry removed |
| Deduplication | Exercise testing | Near-duplicate learnings merged across new + carried-forward |
| Cross-platform hash | Manual verification | `shasum -a 256` works on macOS/Linux; `sha256sum` fallback documented |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM misclassifies learning pattern type | Medium | Low | Three-type taxonomy is simple; examples in SKILL.md guide classification |
| Defect spec lacks enough detail for analysis | Medium | Low | Skill warns about sparse defect specs; produces best-effort learnings |
| Retrospective doc grows unwieldy over many runs | Low | Medium | Incremental update removes outdated learnings; human curation encouraged |
| Writing-specs ignores retrospective learnings | Low | Medium | Explicit instruction in SKILL.md to apply learnings; examples provided |
| Related Spec link points to deleted/moved spec | Low | Low | Skill warns about broken links; skips that defect spec |
| Markdown table parsing breaks if retrospective template format changes | Low | Medium | Template is stable and explicitly out-of-scope for changes in this issue; parsing is tied to the known format |
| `shasum` not available on some platforms | Low | Low | Fallback to `sha256sum`; both are widely available on macOS/Linux/Git Bash |
| Carried-forward learnings become stale if feature specs change (not tracked) | Medium | Low | Documented as open question in requirements; full re-analysis remains available by deleting state file |
| State file and retrospective.md get out of sync (e.g., manual edit to retrospective.md) | Low | Low | State file only tracks hashes; if retrospective.md is manually edited, carry-forward may miss changes, but next full run (after any spec change) will re-derive affected learnings |

---

## Open Questions

- None remaining for issue #1 — all design decisions resolved.
- [ ] Should the state file track the hash of the related feature spec in addition to the defect spec? (Carried forward from issue #67 — deferred to future enhancement if needed)

---

## Change History

| Date | Issue | Summary |
|------|-------|---------|
| 2026-02-15 | #1 | Initial design: SKILL.md + template architecture, pattern classification, writing-specs integration, retrospective doc format |
| 2026-02-22 | #67 | Added state file schema, hash computation approach, workflow step modifications (1.5, 2, 3, 7, 8.5, 9), carry-forward strategy, updated alternatives and risks |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`)
- [x] All file changes documented
- [x] No database/storage changes needed (file-based output)
- [x] State management N/A (stateless skill, file output)
- [x] UI components N/A (CLI skill, console output)
- [x] Security considerations N/A (no auth, no external services beyond existing gh CLI)
- [x] Performance impact minimal (batch scan of local files; unchanged specs skipped)
- [x] Testing strategy defined (BDD scenarios for all ACs)
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
