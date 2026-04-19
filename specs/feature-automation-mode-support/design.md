# Design: Unattended Mode Support

**Issues**: #11, #71, #118
**Date**: 2026-04-16
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

Automation mode is a cross-cutting concern that modifies the behavior of every SDLC skill. When `.claude/unattended-mode` exists, each skill conditionally skips interactive steps: AskUserQuestion calls, EnterPlanMode requests, and human review gates. The implementation is skill-level awareness rather than hook-level blocking, because hook-based approaches caused infinite retry loops where Claude would endlessly attempt blocked tools.

The design is intentionally simple: a single flag file (`.claude/unattended-mode`) triggers headless behavior. Each skill's SKILL.md includes an "Unattended Mode" section that documents exactly which steps are skipped and what alternative behavior is used. Skills output "Done. Awaiting orchestrator." instead of next-step suggestions, providing a clean handoff signal for external orchestrators like the SDLC runner.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────┐
│            .claude/unattended-mode (flag file)          │
└────────────────────┬────────────────────────────┘
                     │ checked by
                     ▼
┌─────────────────────────────────────────────────┐
│              All SDLC Skills                      │
├─────────────────────────────────────────────────┤
│  /draft-issue  → skip interview, infer ACs   │
│                    → apply `automatable` label    │
│  /start-issue  → filter by `automatable`     │
│                    → auto-select oldest eligible  │
│  /write-spec    → skip 3 review gates          │
│  /write-code → skip EnterPlanMode         │
│  /verify-code  → skip approval gates          │
│  /open-pr     → output orchestrator signal   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         GitHub `automatable` Label                │
├─────────────────────────────────────────────────┤
│  Color: #0E8A16 (green)                          │
│  Description: "Suitable for automated SDLC       │
│                processing"                        │
│  Applied by: /draft-issue (Step 8)           │
│  Filtered by: /start-issue (Step 1)          │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
1. Skill is invoked
2. Skill checks for .claude/unattended-mode file existence
3. If unattended-mode:
   a. Skip interactive prompts (AskUserQuestion)
   b. Skip plan mode (EnterPlanMode)
   c. Skip review gates (proceed immediately)
   d. Use alternative behavior (infer, auto-select, etc.)
   e. Output "Done. Awaiting orchestrator." at completion
4. If not unattended-mode:
   a. Normal interactive behavior
   b. Suggest next steps at completion
```

### Automatable Label Flow (`/draft-issue`)

```
1. Interview phase runs (or unattended-mode infers criteria)
2. After interview, before synthesizing issue body:
   a. Interactive mode: Ask "Is this issue suitable for automation?" (Yes/No)
   b. Unattended-mode: Default to Yes (all auto-created issues are automatable)
3. Ensure `automatable` label exists in the repo:
   a. Run `gh label list --search automatable --json name --jq '.[].name'`
   b. If not found: `gh label create "automatable" --description "Suitable for automated SDLC processing" --color "0E8A16"`
4. Issue creation (Step 8):
   a. If automatable=Yes: add `automatable` to the `--label` list (e.g., `--label "enhancement,automatable"`)
   b. If automatable=No: omit `automatable` from labels
5. Postcondition check:
   a. Run `gh issue view #N --json labels --jq '.labels[].name'`
   b. Verify `automatable` is present (if it should be)
   c. If missing despite intent, warn in output
```

### Automatable Label Filter Flow (`/start-issue`)

```
1. Unattended-mode issue fetch:
   a. Add `--label automatable` to all `gh issue list` commands:
      - With milestone: `gh issue list -s open -m "<milestone>" --label automatable -L 10 --json number,title,labels`
      - Without milestone: `gh issue list -s open --label automatable -L 10 --json number,title,labels`
   b. If result is empty: report "No automatable issues found" and exit gracefully
2. Interactive mode issue fetch:
   a. Fetch issues WITHOUT label filter (all issues visible)
   b. When presenting options in Step 2, append "(automatable)" indicator to description
      for issues that have the `automatable` label
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
| `plugins/nmg-sdlc/skills/draft-issue/SKILL.md` | Modify | Add Unattended Mode section; add automatable question (new Step 5b); update Step 8 to conditionally include `automatable` label; add label auto-creation; add postcondition check |
| `plugins/nmg-sdlc/skills/start-issue/SKILL.md` | Modify | Add Unattended Mode section; add `--label automatable` filter in unattended-mode issue fetching; add empty-set handling; add automatable indicator in interactive mode |
| `plugins/nmg-sdlc/skills/write-spec/SKILL.md` | Modify | Add Unattended Mode section |
| `plugins/nmg-sdlc/skills/write-code/SKILL.md` | Modify | Add Unattended Mode section |
| `plugins/nmg-sdlc/skills/verify-code/SKILL.md` | Modify | Add Unattended Mode section |
| `plugins/nmg-sdlc/skills/open-pr/SKILL.md` | Modify | Add orchestrator signal output |

---

## Issue #118 Addendum: Flag Rename to `.claude/unattended-mode`

### Motivation

Claude Code's March 2026 release introduced a native **Auto Mode** permission feature. When active, Claude Code injects a `<system-reminder>` into the model's context with instructions to "execute immediately," "minimize interruptions," and "prefer action over planning." Semantically this overlaps with the plugin's `.claude/unattended-mode` behavior (skip `AskUserQuestion`, skip `EnterPlanMode`, proceed unattended), and the language is near-identical. The model sees two overlapping "unattended-mode" signals governing different things and is at risk of applying plugin-style gate suppression based on CC Auto Mode's system-reminder alone — even when `.claude/unattended-mode` does not exist.

Renaming the plugin's concept to **unattended-mode** (a long-established sysadmin term for non-interactive execution) breaks the lexical overlap entirely and makes the two conditions independently addressable.

### Approach: Clean-Cut Mechanical Rename

- **Rename the path** `.claude/unattended-mode` → `.claude/unattended-mode` (file flag used by runner + skills).
- **Rename the prose** "unattended-mode" → "unattended-mode" everywhere it appears (preserving case: `Unattended-mode` → `Unattended-mode`, `AUTO_MODE` → `UNATTENDED_MODE` if any).
- **No dual-name support.** The old name is dropped. Users who manually `touch .claude/unattended-mode` must switch to the new path — documented in CHANGELOG migration note.
- **No behavior change.** Every skill's conditional logic continues to work identically once the string is updated.

This is safe as a mechanical rename because every reference in the codebase is a **literal string** — no dynamic path construction, no template interpolation, no string concatenation. The audit below confirms 100% of references.

### Blast Radius (Audit of All Occurrences)

| Category | Files | Occurrences | Change Type |
|---|---|---|---|
| **Live code** | `scripts/sdlc-runner.mjs` | 8 | Rename path literal + substring in soft-failure regex + log messages |
| **Live tests** | `scripts/__tests__/sdlc-runner.test.mjs` | 16 | Rename path literals + prose |
| **Live config** | `.gitignore` | 1 | Replace `.claude/unattended-mode` with `.claude/unattended-mode` |
| **User-facing docs** | `README.md` | 6 | Rename prose + headings; add disambiguation note |
| **Steering docs** | `steering/product.md`, `tech.md`, `structure.md`, `retrospective.md` | 4 + 5 + 1 + 2 = 12 | Rename prose |
| **Plugin skills (live)** | `plugins/nmg-sdlc/skills/*/SKILL.md` for `draft-issue`, `start-issue`, `write-spec`, `write-code`, `verify-code`, `open-pr`, `run-loop`, `migrate-project`, `run-retro` + `migrate-project/references/migration-procedures.md` | 9 + 13 + 10 + 9 + 5 + 3 + 4 + 22 + 3 + 1 = 79 | Rename path literal + prose in conditional-logic blocks |
| **CHANGELOG** | `CHANGELOG.md` | 31 | Historical entries reference old name; these are historical — **do NOT rewrite**. Add a new `[Unreleased]` entry under the new name (see FR23). |
| **Historical specs (bodies)** | `specs/*/` — ~60 files | ~700 | Rewrite bodies to use new term; **keep directory names unchanged** |
| **Plugin manifests** | `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | 0 (today) | Bump `version` field in both (FR25) |

**Total live-code files touched: ~27. Total occurrences rewritten in live code: ~140.**
**Total historical spec body files rewritten: ~60, ~700 occurrences (prose only).**

### Specific Hotspots in `scripts/sdlc-runner.mjs`

| Line | Current | Replacement |
|---|---|---|
| 549 | `const RUNNER_ARTIFACTS = ['.claude/sdlc-state.json', '.claude/unattended-mode'];` | `'.claude/unattended-mode'` |
| 599 | `fs.unlinkSync(path.join(PROJECT_PATH, '.claude', 'unattended-mode'));` | `'unattended-mode'` |
| 600 | `log('Removed .claude/unattended-mode flag');` | prose update |
| 1062 | `{ pattern: /AskUserQuestion.*unattended-mode/i, label: 'AskUserQuestion in unattended-mode' }` | Update regex **and** label to `unattended-mode` |
| 1220 | Comment: `// Reset state for next cycle (keep unattended-mode flag …)` | Update comment prose |
| 1869–1875 | `const autoModePath = path.join(PROJECT_PATH, '.claude', 'unattended-mode'); … log('Created .claude/unattended-mode flag');` | Rename variable (`unattendedModePath`), rename path, update log prose |

The soft-failure regex at line 1062 is detection logic, not state logic — update it to match the new string so the runner still recognizes the diagnostic pattern in skill output.

### CHANGELOG Handling

Historical `CHANGELOG.md` entries that document prior releases (e.g., "Add unattended-mode cleanup on exit") must **not** be rewritten — they are a release log and changing them would distort history. Only the new `[Unreleased]` entry uses the new terminology, with a short disambiguation note and a migration instruction.

### Historical Specs Handling

Per AC21: spec bodies are rewritten to use "unattended-mode" / `.claude/unattended-mode`; directory names (e.g., `feature-automation-mode-support/`, `bug-fix-auto-mode-cleanup-on-exit/`) are preserved as historical identifiers. Git history preserves the original wording. The rewrite is limited to in-body prose and does not alter spec semantics.

### Regression Risk Table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Stale `.claude/unattended-mode` file on disk still triggers headless behavior | Med (if an orphaned flag exists) | High (silent gate suppression) | Clean cut: no code reads `.claude/unattended-mode` after rename. Runner cleanup on exit already covers runner-created flags. |
| Missed occurrence in a SKILL.md block | Low | Med (partial suppression) | Pre-commit grep check for `unattended-mode` (excluding CHANGELOG and historical specs) as part of the verify step |
| Runner soft-failure regex out of sync | Low | Low (diagnostic noise, not functional) | Line 1062 updated in lockstep with flag rename |
| `.gitignore` still ignoring old path, not new | Low | Med (accidental commit of flag) | Line 11 updated |
| User has `.claude/unattended-mode` they manually touched | Low–Med | High (their headless mode silently stops working) | CHANGELOG migration note: "If you manually created `.claude/unattended-mode`, recreate it as `.claude/unattended-mode`." |
| Retrospective learnings reference old name | Low | Low (doc drift) | Updated in `/steering/retrospective.md` as part of steering-docs rewrite |
| Per-step effort config spec references old name | Low | Low (doc drift) | In-body rewrite of `feature-per-step-model-effort-config/` and similar specs |
| Claude Code Auto Mode's system-reminder still overlaps the renamed term | None | — | By design: the rename is the mitigation; no further coupling to CC's Auto Mode exists |

### Version Bump Strategy

- **Recommended**: **minor** bump (e.g., `1.38.0` → `1.39.0`). The renamed flag is a user-facing contract documented in the README, but programmatic users typically rely on the runner (which is internally consistent) and the change is non-breaking for anyone who never touched the flag manually.
- **Alternative**: **major** bump (`1.38.0` → `1.41.0`) is defensible if the flag's path is considered part of the runner's public contract — this is the more conservative interpretation of semver. Defer to the user at release time.
- Update **both** `plugins/nmg-sdlc/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (per CLAUDE.md and memory entry).

### Disambiguation Note (for README)

Target placement: near the current "Unattended-mode flag" section. Rename the section to **"Unattended-mode flag"** and add a short callout:

> **Not to be confused with Claude Code's native Auto Mode.** Claude Code (since v2.1.83) ships its own "Auto Mode" — a permission feature that auto-approves safe tool calls via a classifier. This plugin's `.claude/unattended-mode` flag is independent: it signals that the SDLC runner is driving the session headlessly and causes skills to skip interactive gates. The two features are orthogonal — you can run either, both, or neither.

### Retrospective Learning Applied

From `retrospective.md`: *"When specifying features that explicitly exclude integration with a system-wide behavior mode (e.g., headless mode, admin mode), stating the exclusion in Out of Scope is insufficient because the agent may still detect and honor the mode. Include a defensive AC stating the feature must actively ignore the excluded mode."*

Applied as **AC19** and **AC25**: both are explicit, testable defensive ACs stating that Claude Code's Auto Mode alone (without `.claude/unattended-mode`) must not suppress plugin gates.

### File Changes for #118 (additive)

| File | Type | Purpose (Issue #118) |
|---|---|---|
| `scripts/sdlc-runner.mjs` | Modify | Rename flag path literal (3 occurrences), rename variable `autoModePath` → `unattendedModePath`, update soft-failure regex + label, update log prose |
| `scripts/__tests__/sdlc-runner.test.mjs` | Modify | Rename all flag-path references (16); tests must pass |
| `.gitignore` | Modify | Replace `.claude/unattended-mode` with `.claude/unattended-mode` |
| `README.md` | Modify | Rename all prose; rename section heading; add disambiguation callout |
| `steering/product.md`, `tech.md`, `structure.md`, `retrospective.md` | Modify | Rename all prose references |
| `plugins/nmg-sdlc/skills/*/SKILL.md` (9 skills) + `plugins/nmg-sdlc/skills/migrate-project/references/migration-procedures.md` | Modify | Rename all flag-path literals + prose in conditional-logic blocks |
| `CHANGELOG.md` | Modify | Add `[Unreleased]` entry; do NOT rewrite historical entries |
| `specs/**/` historical spec bodies | Modify (body only) | Rewrite prose per AC21; keep directory names |
| `plugins/nmg-sdlc/.claude-plugin/plugin.json` | Modify | Bump `version` (FR25) |
| `.claude-plugin/marketplace.json` | Modify | Bump plugin entry's `version` (FR25) |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Hook-based blocking (v1.5.0) | Block AskUserQuestion/EnterPlanMode via hooks | Rejected — caused infinite retry loops |
| Environment variable | Use env var instead of flag file | Rejected — less discoverable than a file |
| **Skill-level awareness** | Each skill checks flag file | **Selected** — clean, no retry issues |
| Filter in sdlc-runner.mjs | Add `--label automatable` in the runner script | Rejected — filtering at skill level is more cohesive; runner stays agnostic to label semantics |
| Separate `automation-eligible` label | Use a different label name | Rejected — `automatable` is shorter, clearer, and matches the concept directly |
| Runner-level `hasAutomatableIssues()` | Add runner function for label checking | Deferred — follow-up issue if runner needs to distinguish "no open issues" from "no automatable issues" |
| (#118) **Clean-cut rename** to `unattended-mode` | Drop `.claude/unattended-mode` entirely; every reference updated atomically | **Selected** — all references are literal strings; low-risk mechanical change; no dual-support burden |
| (#118) Dual-name support | Read both `.claude/unattended-mode` and `.claude/unattended-mode` for a deprecation window | Rejected — adds conditional complexity, extends the collision risk, and no evidence of widespread manual use; a CHANGELOG migration note is sufficient |
| (#118) Keep old name; detect Claude Code Auto Mode and disambiguate behaviorally | Have skills check for CC's Auto Mode system-reminder and branch on it | Rejected — fragile (reminder text could change), requires pattern-matching model context, and doesn't solve the root lexical overlap |
| (#118) Rename to `headless-mode` / `non-interactive-mode` | Alternative disambiguating names | Rejected — "unattended-mode" is a well-established sysadmin term with exact semantic fit; other options are either ambiguous ("headless" also describes browsers/servers) or wordy |

---

## Security Considerations

- [x] Unattended-mode must be activated locally (no remote triggers)
- [x] Flag file is a simple empty file, no configuration surface
- [x] All-or-nothing prevents partial automation confusion

---

## Performance Considerations

- [x] File existence check is sub-millisecond
- [x] No additional overhead when unattended-mode is inactive
- [x] Skills skip steps, so unattended-mode is generally faster

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Auto-Mode Detection | BDD | Scenario for flag file presence |
| Per-Skill Behavior | BDD | Scenarios for each skill's unattended-mode behavior |
| Completion Signal | BDD | Scenario for orchestrator handoff |
| Automatable Question (Interactive) | BDD | Scenario: user asked, answers Yes → label applied; answers No → label omitted |
| Automatable Label (Auto-Mode) | BDD | Scenario: unattended-mode → label applied without prompting |
| Label Auto-Creation | BDD | Scenario: label missing → created with correct color/description |
| Label Postcondition | BDD | Scenario: after issue creation → verify label present |
| Starting-Issues Filter | BDD | Scenario: unattended-mode → only automatable issues returned |
| Starting-Issues Empty Set | BDD | Scenario: no automatable issues → graceful exit |
| Starting-Issues Indicator | BDD | Scenario: interactive mode → automatable indicator shown |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [risk] | Low/Med/High | Low/Med/High | [approach] |

---

## Open Questions

- [ ] [Technical question]
- [ ] [Architecture question]
- [ ] [Integration question]

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #11 | 2026-02-15 | Initial feature spec |
| #71 | 2026-02-22 | Add automatable label gate: data flows for label creation, filtering, postcondition verification; updated file changes for draft-issue and start-issue |
| #118 | 2026-04-16 | Add rename addendum: clean-cut rename `.claude/unattended-mode` → `.claude/unattended-mode`, blast-radius audit (~140 live occurrences across ~27 files + ~700 historical spec occurrences), regression risk table, version bump strategy, disambiguation note from Claude Code's native Auto Mode |

## Validation Checklist

- [x] Architecture follows cross-cutting pattern consistently
- [x] All skill modifications documented
- [x] Security considerations addressed
- [x] Alternatives considered (hook-based approach rejected with clear rationale)
