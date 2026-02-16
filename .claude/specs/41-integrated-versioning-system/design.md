# Design: Integrated Versioning System

**Issue**: #41
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude (nmg-sdlc)

---

## Overview

This feature weaves versioning into three existing skills (`/creating-issues`, `/creating-prs`, `/setting-up-steering`) and one existing skill (`/migrating-projects`), plus adds a new tech.md template section. The design follows the existing pattern: skills are Markdown prompts that instruct Claude to use `gh` CLI, file I/O, and `AskUserQuestion` at decision points.

The core data flow is: a plain-text `VERSION` file is the single source of truth for the current version. `/creating-issues` reads it for milestone defaults. `/creating-prs` reads it, applies the semver classification matrix, writes the new version back, and updates `CHANGELOG.md` and any stack-specific files declared in `tech.md`. `/migrating-projects` bootstraps or reconciles both `VERSION` and `CHANGELOG.md` from git history. The steering doc bridge (`tech.md` Versioning section) maps the universal `VERSION` to project-specific manifests.

No runtime code (JavaScript/scripts) is modified. All changes are to SKILL.md files and one template file — consistent with the prompt-based architecture.

---

## Architecture

### Component Diagram

```
                        VERSION file (plain text semver)
                         ▲         ▲              ▲
                    read │    read/write      create/update
                         │         │              │
┌────────────────┐  ┌────────────────┐  ┌──────────────────┐
│ /creating-     │  │ /creating-prs  │  │ /migrating-      │
│  issues        │  │                │  │  projects         │
│                │  │  reads labels  │  │                   │
│ reads VERSION  │  │  reads VERSION │  │ reads git history │
│ → milestone    │  │  → bump type   │  │ → CHANGELOG.md    │
│   default      │  │  → new version │  │ → VERSION         │
│                │  │  writes:       │  │                   │
│ creates/       │  │  - VERSION     │  └──────────────────┘
│ assigns        │  │  - CHANGELOG   │
│ milestone      │  │  - stack files │
└────────────────┘  └───────┬────────┘
                            │ reads
                            ▼
                    ┌──────────────────┐
                    │ tech.md          │
                    │ Versioning       │
                    │ section          │
                    │ (stack-specific  │
                    │  file mappings)  │
                    └──────────────────┘
                            ▲
                            │ template adds section
                    ┌──────────────────┐
                    │ /setting-up-     │
                    │  steering        │
                    └──────────────────┘
```

### Data Flow

```
1. /creating-issues reads VERSION → extracts major version → presents as milestone default
2. /creating-issues creates milestone via gh api if needed → assigns issue
3. /creating-prs reads issue labels → classifies bump type (bug→patch, enhancement→minor)
4. /creating-prs reads milestone → checks if this PR closes last open issue → proposes major
5. /creating-prs reads VERSION → applies bump → writes new VERSION
6. /creating-prs reads CHANGELOG.md → moves [Unreleased] under new version heading
7. /creating-prs reads tech.md Versioning section → updates declared stack-specific files
8. /migrating-projects reads git log + git tags → generates/updates CHANGELOG.md → derives VERSION
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

## Skill Modifications

### 1. `/creating-issues` — Milestone Assignment

**Location**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`

**Insertion point**: After **Step 2** (Classify Issue Type), before **Step 3** (Investigate Codebase). New step becomes **Step 2b: Assign Milestone**.

**New step logic**:

```
Step 2b: Assign Milestone

1. Check if VERSION file exists in project root:
   - If yes: read it, extract major version (e.g., "2.3.1" → "2")
   - If no: default major version is "0"

2. [Manual mode] Ask developer via AskUserQuestion:
   - Question: "Which milestone should this issue be assigned to?"
   - Options: "v{major} (current)" as default, with text input for a different number
   - Accept a single number (e.g., "3") → normalize to "v3"

3. [Auto-mode] Default to "v{major}" without prompting

4. Check if milestone "v{N}" exists:
   gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.title=="v{N}") | .number'
   - If exists: capture milestone number
   - If not: create it:
     gh api repos/{owner}/{repo}/milestones --method POST -f title="v{N}"
     Capture returned milestone number

5. Pass milestone number to Step 7 (Create the Issue) via --milestone flag:
   gh issue create ... --milestone "v{N}"
```

**Affected auto-mode section**: Add milestone defaulting (read VERSION → v{major}) to the auto-mode path that currently skips Steps 2-4.

### 2. `/creating-prs` — Version Bumping & Artifact Updates

**Location**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`

**Insertion point**: Between existing **Step 1** (Read Context) and **Step 2** (Generate PR Content). New steps become **Step 1b: Determine Version Bump** and **Step 1c: Update Version Artifacts**.

**Step 1b: Determine Version Bump**

```
1. Check if VERSION file exists in project root:
   - If no: skip all version bumping (versioning not initialized for this project)
   - If yes: read current version string (e.g., "2.3.1")

2. Read issue labels:
   gh issue view #N --json labels --jq '.labels[].name'

3. Read issue milestone:
   gh issue view #N --json milestone --jq '.milestone.title // empty'

4. Classify bump type using matrix:
   - If "bug" label → PATCH (x.y.Z)
   - If "enhancement" label → MINOR (x.Y.0)
   - If neither → MINOR (default for unlabeled changes)

5. Check for milestone completion (major bump override):
   If milestone is set:
     a. Get milestone number: gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.title=="vN") | .number'
     b. Count open issues: gh api repos/{owner}/{repo}/issues?milestone={number}&state=open --jq 'length'
     c. If open count == 1 (this is the last issue):
        - Override bump type to MAJOR (X.0.0)

6. Calculate new version:
   - PATCH: increment Z (2.3.1 → 2.3.2)
   - MINOR: increment Y, reset Z (2.3.1 → 2.4.0)
   - MAJOR: increment X, reset Y and Z (2.3.1 → 3.0.0)

7. [Manual mode] Present classification to developer via AskUserQuestion:
   - "Version bump: {current} → {new} ({bump_type}). Override?"
   - Options: "Accept {bump_type}", "Patch", "Minor", "Major"

8. [Auto-mode] Apply classified bump without confirmation
```

**Step 1c: Update Version Artifacts**

```
1. Write new version string to VERSION file (overwrite)

2. Update CHANGELOG.md:
   a. Read current CHANGELOG.md
   b. Find ## [Unreleased] heading
   c. Insert new heading after [Unreleased]: ## [{new_version}] - {YYYY-MM-DD}
   d. Move all content between [Unreleased] and the next ## heading under the new version heading
   e. Leave [Unreleased] heading empty (ready for future changes)

3. Check tech.md for stack-specific version files:
   a. Read .claude/steering/tech.md
   b. Look for ## Versioning section
   c. If present: parse table rows for file:path mappings
   d. For each mapping:
      - Read the target file
      - Update the version value at the declared path
      - Write the file back
   e. If no Versioning section: skip (no stack-specific files declared)

4. Stage all version-related file changes for inclusion in the PR
```

**Integration with existing Step 2 (Generate PR Content)**: The PR body should include a "Version" section noting the bump type and new version.

### 3. `/setting-up-steering` — Tech.md Versioning Section

**Location**: `plugins/nmg-sdlc/skills/setting-up-steering/templates/tech.md`

**Insertion point**: After the **Technology Stack** section (after External Services table), before **Technical Constraints**.

**New section**:

```markdown
## Versioning

The nmg-sdlc versioning system uses a universal `VERSION` file (plain text semver) as the single source of truth. Stack-specific version files are updated automatically by `/creating-prs` based on the mappings below.

If your project has stack-specific files that contain a version string, declare them here so `/creating-prs` can update them alongside `VERSION`.

| File | Path | Notes |
|------|------|-------|
| <!-- e.g., package.json --> | <!-- e.g., version --> | <!-- npm package version --> |
| <!-- e.g., Cargo.toml --> | <!-- e.g., package.version --> | <!-- Rust crate version --> |

<!-- TODO: Add your project's version files. Remove this comment and the example rows. -->
<!-- Leave this table empty if VERSION is your only version file. -->

### Path Syntax

- **JSON files**: Use dot-notation for nested keys (e.g., `version` or `package.version`)
- **TOML files**: Use dot-notation section paths (e.g., `package.version`)
- **Plain text**: Use `line` if the version is the entire file content (like VERSION itself)
```

### 4. `/migrating-projects` — CHANGELOG & VERSION Bootstrapping

**Location**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`

**Insertion point**: New steps after the existing **Step 6** (Check OpenClaw Skill Version) and before **Step 7** (Present Findings). New steps become **Step 6b: Analyze CHANGELOG.md** and **Step 6c: Analyze VERSION File**.

**Step 6b: Analyze CHANGELOG.md**

```
1. Check if CHANGELOG.md exists in project root

2. If CHANGELOG.md does NOT exist (create from scratch):
   a. Read git log with conventional commit parsing:
      git log --pretty=format:"%H|%s" --reverse
   b. Read git tags:
      git tag --sort=version:refname
   c. Group commits by tag boundaries:
      - Commits before first tag → [initial version]
      - Commits between tags → tag version heading
      - Commits after latest tag → [Unreleased]
   d. Categorize commits by conventional commit type:
      - feat: → Added
      - fix: → Fixed
      - chore:, refactor:, build: → Changed
      - docs: → Changed (or omit if trivial)
      - BREAKING CHANGE: → Changed (note: triggers major)
      - Uncategorized → Changed
   e. If no tags exist: group all under [0.1.0] with [Unreleased] empty
   f. Generate CHANGELOG.md in Keep a Changelog format:
      - Preamble: "# Changelog\n\nAll notable changes..."
      - ## [Unreleased]
      - ## [tag_version] - YYYY-MM-DD (date from tag)
      - ### Added / ### Changed / ### Fixed subsections
   g. Record as pending change for Step 7

3. If CHANGELOG.md EXISTS (update to match template):
   a. Read existing CHANGELOG.md
   b. Read git log and git tags (same as above)
   c. Check conformance:
      - Has ## [Unreleased] section?
      - Has proper version headings for all tags?
      - Entries categorized under ### Added/Changed/Fixed/etc?
      - Follows Keep a Changelog preamble?
   d. For each gap:
      - Missing [Unreleased]: insert after first heading
      - Missing version headings: insert with commits from that tag range
      - Uncategorized entries: group into appropriate ### subsections
      - Missing preamble: add standard Keep a Changelog preamble
   e. Preserve existing manual entries (do not delete or rewrite content that doesn't map to commits)
   f. Record changes as pending for Step 7
```

**Step 6c: Analyze VERSION File**

```
1. After CHANGELOG analysis is complete (depends on Step 6b output)

2. Determine the expected version:
   a. If CHANGELOG was generated/updated: extract latest versioned heading (e.g., ## [2.4.0])
   b. Else if git tags exist: use latest tag (stripped of 'v' prefix)
   c. Else: use "0.1.0" as default

3. Check if VERSION file exists:
   - If no: record "create VERSION with {expected_version}" as pending change
   - If yes: read current value
     - If matches expected: no change needed
     - If doesn't match: record "update VERSION from {current} to {expected}" as pending change

4. Record all pending changes for Step 7
```

**Integration with Step 7 (Present Findings)**: CHANGELOG and VERSION changes are presented alongside steering doc and spec findings. Same approval gate applies.

**Integration with Step 8 (Apply Changes)**: Write CHANGELOG.md and VERSION using the Write tool. Verify with Read after writing.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Separate `/bumping-version` skill** | Standalone skill for version management | Clear separation; callable independently | Adds ceremony; user must remember to run it; doesn't integrate into PR flow | Rejected — versioning should be automatic in the PR flow |
| **B: Integrate into existing skills** | Weave versioning into `/creating-issues`, `/creating-prs`, `/migrating-projects` | Zero new skills; versioning is invisible; happens as part of existing workflow | More complex skill modifications | **Selected** — matches "versioning for free" goal |
| **C: VERSION derived from CHANGELOG only** | No separate VERSION file; parse CHANGELOG for current version | One fewer file to manage | Fragile parsing; CHANGELOG could be malformed; harder for build tools to read | Rejected — plain text VERSION is maximally portable |
| **D: Milestone auto-assigned by label** | Skip milestone interview; assign based on label type | Less interactive | Loses user control; can't plan future milestones | Rejected — milestones are planning decisions |

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
| Skill modifications | BDD (Gherkin) | All 10+1 acceptance criteria become scenarios |
| Prompt quality | Manual verification | Each modified skill can be followed step-by-step with predictable results |
| Contract preservation | `/verifying-specs` | Postconditions of modified skills still satisfy downstream consumers |
| Cross-platform | Manual | `gh api` and file operations use POSIX-compatible commands |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CHANGELOG parsing errors on malformed files | Medium | Medium | `/migrating-projects` preserves existing content; only adds structure, never deletes |
| Milestone API changes in `gh` CLI | Low | Medium | Use stable `gh api` REST endpoints, not experimental CLI subcommands |
| Stack-specific file updates corrupt non-JSON files | Medium | High | Path syntax is well-defined; TOML support uses dot-notation same as JSON; skill reads full file before writing |
| VERSION file doesn't exist on first `/creating-prs` run | High (expected) | Low | Skill checks for VERSION existence and skips versioning gracefully if absent |
| Major bump triggers on partial milestone (race condition) | Low | Medium | Count uses `state=open` API filter; only triggers when exactly 1 open issue remains |

---

## Open Questions

- [x] Minor bump semantics: Confirmed as standard semver x.Y.0
- [ ] Should `/creating-prs` warn if `VERSION` doesn't exist? Design says: skip silently. Can revisit.
- [ ] Milestone completion detection: Current design counts open issues at PR creation time. If two PRs are created simultaneously for the last two issues, both could see "1 open" — acceptable for now since manual confirmation guards against double-major-bump.

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (skills are Markdown prompts, not code)
- [x] All skill modifications documented with insertion points and logic
- [x] Template changes specified (tech.md Versioning section)
- [x] Auto-mode handling specified for each skill
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
- [x] Testing strategy defined (BDD + contract verification)
- [x] Cross-platform considerations addressed (POSIX commands, `gh api`)
