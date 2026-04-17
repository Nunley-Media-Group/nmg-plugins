# Design: Integrated Versioning System

**Issues**: #41, #87
**Date**: 2026-02-25
**Status**: Draft
**Author**: Claude (nmg-sdlc)

---

## Overview

This feature weaves versioning into three existing skills (`/draft-issue`, `/open-pr`, `/setup-steering`) and one existing skill (`/migrate-project`), plus adds a new tech.md template section. The design follows the existing pattern: skills are Markdown prompts that instruct Claude to use `gh` CLI, file I/O, and `AskUserQuestion` at decision points.

The core data flow is: a plain-text `VERSION` file is the single source of truth for the current version. `/draft-issue` reads it for milestone defaults. `/open-pr` reads it, applies the semver classification matrix, writes the new version back, and updates `CHANGELOG.md` and any stack-specific files declared in `tech.md`. `/migrate-project` bootstraps or reconciles both `VERSION` and `CHANGELOG.md` from git history. The steering doc bridge (`tech.md` Versioning section) maps the universal `VERSION` to project-specific manifests.

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
│ /creating-     │  │ /open-pr  │  │ /migrating-      │
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
1. /draft-issue reads VERSION → extracts major version → presents as milestone default
2. /draft-issue creates milestone via gh api if needed → assigns issue
3. /open-pr reads issue labels → classifies bump type (bug→patch, enhancement→minor, default→minor)
4. /open-pr presents classification to developer → developer can override to major (manual only)
5. /open-pr reads VERSION → applies bump → writes new VERSION
6. /open-pr reads CHANGELOG.md → moves [Unreleased] under new version heading
7. /open-pr reads tech.md Versioning section → updates declared stack-specific files
8. /migrate-project reads git log + git tags → generates/updates CHANGELOG.md → derives VERSION
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

### 1. `/draft-issue` — Milestone Assignment

**Location**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`

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

3. [Unattended-mode] Default to "v{major}" without prompting

4. Check if milestone "v{N}" exists:
   gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.title=="v{N}") | .number'
   - If exists: capture milestone number
   - If not: create it:
     gh api repos/{owner}/{repo}/milestones --method POST -f title="v{N}"
     Capture returned milestone number

5. Pass milestone number to Step 7 (Create the Issue) via --milestone flag:
   gh issue create ... --milestone "v{N}"
```

**Affected unattended-mode section**: Add milestone defaulting (read VERSION → v{major}) to the unattended-mode path that currently skips Steps 2-4.

### 2. `/open-pr` — Version Bumping & Artifact Updates

**Location**: `plugins/nmg-sdlc/skills/open-pr/SKILL.md`

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

5. Calculate new version:
   - PATCH: increment Z (2.3.1 → 2.3.2)
   - MINOR: increment Y, reset Z (2.3.1 → 2.4.0)
   - MAJOR: increment X, reset Y and Z (2.3.1 → 3.0.0)

6. [Manual mode] Present classification to developer via AskUserQuestion:
   - "Version bump: {current} → {new} ({bump_type}). Override?"
   - Options: "Accept {bump_type}", "Patch", "Minor", "Major"

7. [Unattended-mode] Apply classified bump without confirmation (patch or minor only)
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

### 3. `/setup-steering` — Tech.md Versioning Section

**Location**: `plugins/nmg-sdlc/skills/setup-steering/templates/tech.md`

**Insertion point**: After the **Technology Stack** section (after External Services table), before **Technical Constraints**.

**New section**:

```markdown
## Versioning

The nmg-sdlc versioning system uses a universal `VERSION` file (plain text semver) as the single source of truth. Stack-specific version files are updated automatically by `/open-pr` based on the mappings below.

If your project has stack-specific files that contain a version string, declare them here so `/open-pr` can update them alongside `VERSION`.

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

### 4. `/migrate-project` — CHANGELOG & VERSION Bootstrapping

**Location**: `plugins/nmg-sdlc/skills/migrate-project/SKILL.md`

**Insertion point**: New steps after existing migration checks and before **Step 7** (Present Findings). New steps become **Step 6b: Analyze CHANGELOG.md** and **Step 6c: Analyze VERSION File**.

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

## Classification Matrix Deduplication (Issue #87)

### Problem

Both `/open-pr` (SKILL.md Step 2, inline Markdown table) and `sdlc-runner.mjs` (`performDeterministicVersionBump()`, hardcoded if-else at lines 1487-1496) independently implement the same label→bump classification matrix:

| Consumer | Format | Location |
|----------|--------|----------|
| `/open-pr` SKILL.md | Markdown table inline in Step 2 | `plugins/nmg-sdlc/skills/open-pr/SKILL.md:52-58` |
| `sdlc-runner.mjs` | JavaScript if-else chain | `scripts/sdlc-runner.mjs` |

If the matrix changes (e.g., adding a `security` → patch mapping), both locations need independent updates.

### Solution: Steering Document as Single Source of Truth

Add a `### Version Bump Classification` subsection under the existing `## Versioning` section in the tech.md steering template. Both consumers read this section to determine label→bump mappings.

This follows the existing architectural pattern: the runner already parses `tech.md`'s `## Versioning` section to find stack-specific file mappings (lines 1524-1578 of `sdlc-runner.mjs`). Adding a classification subsection extends this pattern rather than introducing a new mechanism.

### New Steering Section: `### Version Bump Classification`

Added under `## Versioning` in the tech.md template:

```markdown
### Version Bump Classification

The `/open-pr` skill and the `sdlc-runner.mjs` deterministic bump postcondition both read this table to classify version bumps. Modify this table to change the classification rules — no skill or script changes are needed.

| Label | Bump Type | Description |
|-------|-----------|-------------|
| `bug` | patch | Bug fix — backwards-compatible |
| `enhancement` | minor | New feature — backwards-compatible |

**Default**: If an issue's labels do not match any row, the bump type is **minor**.

**Major bumps**: Major version bumps are applied manually by the developer via the override prompt in `/open-pr`. They are not triggered automatically.
```

### Consumer Changes

#### 1. `/open-pr` SKILL.md — Step 2 Modification

**Current**: Step 2 item 3 contains an inline classification matrix table.

**Changed**: Step 2 item 3 reads the classification from `tech.md`:

```
3. **Read the classification matrix** from `.claude/steering/tech.md`:
   - Find the `## Versioning` section, then the `### Version Bump Classification` subsection
   - Parse the table rows to extract Label → Bump Type mappings
   - Match the issue's labels against the table rows
   - If no label matches a row, default to **minor**
   - Major bumps are manual-only — the developer can override via the confirmation prompt
```

The rest of Step 2 (milestone completion check, version calculation, user confirmation) is unchanged.

#### 2. `sdlc-runner.mjs` — `performDeterministicVersionBump()` Modification

**Current**: Lines 1487-1496 contain a hardcoded if-else chain:
```javascript
if (labels.includes('bug')) {
  newVersion = `${major}.${minor}.${patch + 1}`;
} else {
  // minor (default) or any other non-patch bump type
  newVersion = `${major}.${minor + 1}.0`;
}
```

**Changed**: Replace with a function that parses the tech.md classification table:

```
1. Read .claude/steering/tech.md
2. Extract the ## Versioning section
3. Within the Versioning section, find the ### Version Bump Classification subsection
4. Parse the table rows: extract Label and Bump Type columns
5. Build a label→bumpType map from the parsed rows
6. Match the issue's labels against the map
7. If no label match → default to minor
8. Calculate newVersion from the resolved bump type (patch or minor only)
```

The table parsing logic reuses the same row-parsing pattern the runner already uses for stack-specific file mappings (line 1532): `row.split('|').map(c => c.trim()).filter(Boolean)`.

### Data Flow (Updated)

```
tech.md ## Versioning
  ├── Stack-specific file mappings (existing)
  │     └── read by: /open-pr Step 3, sdlc-runner.mjs (lines 1524-1578)
  └── ### Version Bump Classification (new)
        ├── read by: /open-pr Step 2 item 3
        └── read by: sdlc-runner.mjs performDeterministicVersionBump()
```

### Fallback Behavior

If the `### Version Bump Classification` subsection is missing from `tech.md` (e.g., the project hasn't updated its steering docs yet):

| Consumer | Fallback |
|----------|----------|
| `/open-pr` | Use the default classification: `bug` → patch, everything else → minor (same as today) |
| `sdlc-runner.mjs` | Use the same hardcoded default: `bug` → patch, everything else → minor |

This ensures backwards compatibility for projects that haven't migrated their tech.md.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Separate `/bumping-version` skill** | Standalone skill for version management | Clear separation; callable independently | Adds ceremony; user must remember to run it; doesn't integrate into PR flow | Rejected — versioning should be automatic in the PR flow |
| **B: Integrate into existing skills** | Weave versioning into `/draft-issue`, `/open-pr`, `/migrate-project` | Zero new skills; versioning is invisible; happens as part of existing workflow | More complex skill modifications | **Selected** — matches "versioning for free" goal |
| **C: VERSION derived from CHANGELOG only** | No separate VERSION file; parse CHANGELOG for current version | One fewer file to manage | Fragile parsing; CHANGELOG could be malformed; harder for build tools to read | Rejected — plain text VERSION is maximally portable |
| **D: Milestone auto-assigned by label** | Skip milestone interview; assign based on label type | Less interactive | Loses user control; can't plan future milestones | Rejected — milestones are planning decisions |
| **E: Shared JSON config file for classification** | Separate `.claude/versioning.json` file defining label→bump mappings | Machine-parseable without Markdown table parsing | Adds a new file type; diverges from steering doc pattern; the runner already parses tech.md tables | Rejected — steering doc table is consistent with existing patterns |
| **F: Extract classification into a shared JS module** | Node.js module imported by runner, referenced by skill via dynamic context | DRY in the traditional sense; type-safe | Skills are Markdown prompts, not code — they can't import JS modules; adds a build/dependency concern | Rejected — breaks the prompt-based architecture principle |
| **G: Steering doc table in tech.md (selected)** | Add `### Version Bump Classification` subsection under `## Versioning` in tech.md | Follows existing pattern (runner already parses tech.md); single file to update; both consumers can read it; no new file types | Markdown table parsing is simple but not schema-validated | **Selected** — consistent with architecture, minimal change |

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
| Contract preservation | `/verify-code` | Postconditions of modified skills still satisfy downstream consumers |
| Cross-platform | Manual | `gh api` and file operations use POSIX-compatible commands |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CHANGELOG parsing errors on malformed files | Medium | Medium | `/migrate-project` preserves existing content; only adds structure, never deletes |
| Milestone API changes in `gh` CLI | Low | Medium | Use stable `gh api` REST endpoints, not experimental CLI subcommands |
| Stack-specific file updates corrupt non-JSON files | Medium | High | Path syntax is well-defined; TOML support uses dot-notation same as JSON; skill reads full file before writing |
| VERSION file doesn't exist on first `/open-pr` run | High (expected) | Low | Skill checks for VERSION existence and skips versioning gracefully if absent |
| Developer forgets to manually apply major bump | Low | Medium | Milestone tracking and release notes serve as reminders; unattended-mode only applies patch/minor |

---

## Open Questions

- [x] Minor bump semantics: Confirmed as standard semver x.Y.0
- [ ] Should `/open-pr` warn if `VERSION` doesn't exist? Design says: skip silently. Can revisit.
- [ ] Major bumps are manual-only — developer must explicitly choose major in the override prompt.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #41 | 2026-02-16 | Initial feature spec |
| #87 | 2026-02-25 | Deduplicate version bump classification — shared tech.md subsection, consumer modifications |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (skills are Markdown prompts, not code)
- [x] All skill modifications documented with insertion points and logic
- [x] Template changes specified (tech.md Versioning section)
- [x] Unattended-mode handling specified for each skill
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
- [x] Testing strategy defined (BDD + contract verification)
- [x] Cross-platform considerations addressed (POSIX commands, `gh api`)
