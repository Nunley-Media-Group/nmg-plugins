# Tasks: Refactor SKILL.md via Progressive Disclosure

**Issues**: #138
**Date**: 2026-04-19
**Status**: Planning
**Author**: Rich Nunley

---

## Summary

The 5 phases below map 1:1 to the 4-PR rollout from the design, with Phase 5 (Testing) threaded across every PR as exercise tests and the BDD feature file.

| Phase | Tasks | Status | PR |
|-------|-------|--------|----|
| 1: Setup (Additive Infrastructure) | 8 | [ ] | PR 1 |
| 2: Pilot Refactor (draft-issue) | 4 | [ ] | PR 2 |
| 3: Bulk Refactor (3 skills) | 3 | [ ] | PR 3 |
| 4: Remainder Refactor + Release | 7 | [ ] | PR 4 |
| 5: Testing (BDD + Exercise Suite) | 3 | [ ] | threaded |
| **Total** | **25** | | |

> **Skill-edit authoring note:** `steering/structure.md` lists "Skills must be authored via `/skill-creator`" as an architectural invariant. For this content-moving refactor, each `SKILL.md` edit task routes through `/skill-creator` per the invariant; the frontmatter is unchanged (AC5), so the `/skill-creator` session focuses on body restructuring. If `/skill-creator`'s interview-driven flow becomes impractical at scale, the implementer may hand-edit with a PR-body note documenting the exception — the architectural invariant is a floor, not a ceiling for bulk mechanical moves.

---

## Phase 1: Setup (Additive Infrastructure) — PR 1

### T001: Create Plugin-Shared References Directory with 6 Files

**File(s)**: `plugins/nmg-sdlc/references/legacy-layout-gate.md`, `plugins/nmg-sdlc/references/unattended-mode.md`, `plugins/nmg-sdlc/references/feature-naming.md`, `plugins/nmg-sdlc/references/versioning.md`, `plugins/nmg-sdlc/references/steering-schema.md`, `plugins/nmg-sdlc/references/spec-frontmatter.md`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] All 6 files exist with content consolidated from the consuming skills per the design's "Shared-Reference Contents" table
- [ ] Each file has a TOC in its first 30 lines if it exceeds 300 lines (AC8)
- [ ] The legacy-layout-gate message is reworded reasoning-first per FR5 (no `ERROR:` prefix required)
- [ ] No SKILL.md files are edited in this task — the references are additive

**Notes**: Consuming SKILL.md files are not updated yet; they continue to inline their existing copies until later phases update their pointers. This keeps PR 1 purely additive.

### T002: Create Content-Inventory Audit Script

**File(s)**: `scripts/skill-inventory-audit.mjs`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] Zero external dependencies (Node built-ins only, per `steering/tech.md`)
- [ ] Supports `--baseline`, `--check` (default), `--diff`, and `--output <path>` modes per design
- [ ] Extracts inventory items per the extraction rules in design's "Inventory Extraction Rules"
- [ ] Normalizes and hashes each item (SHA-1, 12-char prefix ID)
- [ ] Writes JSON in the data shape from design
- [ ] `--check` exits 0 on clean scan, 1 on unmapped items, with human-readable stderr

### T003: Create Canary Fixtures and Jest Tests for Audit Script

**File(s)**: `scripts/__fixtures__/audit-canary/good/SKILL.md`, `scripts/__fixtures__/audit-canary/good/references/*.md`, `scripts/__fixtures__/audit-canary/bad/SKILL.md`, `scripts/__tests__/skill-inventory-audit.test.js`
**Type**: Create
**Depends**: T002
**Acceptance**:
- [ ] `good/` fixture passes `--check` (exit 0)
- [ ] `bad/` fixture fails `--check` (exit 1) — contains a deliberately dropped inventory item
- [ ] Jest unit tests cover: extraction rules per heading type, normalization idempotence, hash stability, mode flag behavior, exit codes, normalization-collision handling
- [ ] Jest integration test round-trips the baseline against a temporary clone of the fixture
- [ ] `cd scripts && npm test` passes locally

### T004: Generate and Commit Pre-Refactor Baseline

**File(s)**: `scripts/skill-inventory.baseline.json`
**Type**: Create
**Depends**: T002
**Acceptance**:
- [ ] Run `node scripts/skill-inventory-audit.mjs --baseline` against current checkout
- [ ] Commit the generated JSON verbatim — no hand edits
- [ ] `node scripts/skill-inventory-audit.mjs --check` reports zero drift against the committed baseline
- [ ] Baseline file is deterministic (same input produces identical JSON across runs; `generated_at` timestamp is the only non-deterministic field — document this in the JSON schema)

### T005: Create GitHub Actions Workflow for Audit Enforcement

**File(s)**: `.github/workflows/skill-inventory-audit.yml`
**Type**: Create
**Depends**: T002, T003, T004
**Acceptance**:
- [ ] Workflow triggers on PRs touching any `plugins/nmg-sdlc/skills/**/SKILL.md`, any `plugins/nmg-sdlc/**/references/**`, or `scripts/skill-inventory.baseline.json`
- [ ] Job steps: (1) run canary fixture tests, (2) run `--check` against the committed baseline, (3) run baseline-freshness diff (fresh baseline vs committed, ignoring PR-touched files), (4) lint PR body for `### Inventory Removals` heading when baseline file is modified
- [ ] All steps fail the workflow on non-zero exit — no `continue-on-error`
- [ ] Workflow is a required status check on `main` (documented in PR description for repo admin to enable in branch protection)

### T006: Wire Audit into /verify-code Verification Gates

**File(s)**: `steering/tech.md` (Verification Gates table), `plugins/nmg-sdlc/skills/verify-code/SKILL.md` (unchanged in body; this task only adds the gate declaration referenced by `tech.md`)
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] `steering/tech.md`'s Verification Gates table has a new row: Gate="Skill inventory audit", Condition="Any `plugins/nmg-sdlc/skills/**/SKILL.md` or `plugins/nmg-sdlc/**/references/**` changed", Action="`node scripts/skill-inventory-audit.mjs --check`", Pass Criteria="Exit code 0"
- [ ] No other `tech.md` content changes beyond this row
- [ ] `verify-code`'s Verification Gates section is re-read unchanged — the gate comes from `tech.md` so verify-code inherits it automatically

### T007: Add Claude Code GitHub App Review Workflow

**File(s)**: `.github/workflows/claude-review.yml`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] Workflow invokes `anthropics/claude-code-action@v1`
- [ ] Triggers: `pull_request` on `opened` and `synchronize`, plus `issue_comment` on `created` gated by `contains(github.event.comment.body, '@claude')`
- [ ] Permissions set: `contents: read`, `pull-requests: write`, `issues: write`
- [ ] Uses org-level `ANTHROPIC_API_KEY` secret (already provisioned — no repo secret to add)
- [ ] Concurrency group keyed by PR/issue number with `cancel-in-progress: true`
- [ ] Checkout step uses `fetch-depth: 0` so Claude can read full git history
- [ ] On PR 1 itself, the workflow posts an automated review (self-dogfood) — verify before requesting human review

### T008: PR 1 Smoke Test

**File(s)**: *(no file changes)*
**Type**: Verify
**Depends**: T001, T002, T003, T004, T005, T006, T007
**Acceptance**:
- [ ] One skill is loaded via `claude --plugin-dir ./plugins/nmg-sdlc` locally and its existing behavior is unchanged (no SKILL.md edits have shipped yet — this is a pre-refactor sanity check)
- [ ] CI workflow runs green on a trial PR containing only T001–T007
- [ ] Audit baseline round-trips without drift
- [ ] Claude Code review posts a comment on PR 1

---

## Phase 2: Pilot Refactor (draft-issue) — PR 2

### T009: Extract draft-issue Variant Content into Per-Skill References

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/references/multi-issue.md`, `plugins/nmg-sdlc/skills/draft-issue/references/design-url.md`, `plugins/nmg-sdlc/skills/draft-issue/references/interview-depth.md`, `plugins/nmg-sdlc/skills/draft-issue/references/feature-template.md`, `plugins/nmg-sdlc/skills/draft-issue/references/bug-template.md`
**Type**: Create
**Depends**: T001 (shared references exist)
**Acceptance**:
- [ ] All 5 files exist with content lifted from `draft-issue/SKILL.md`
- [ ] Each file < 300 lines, or has a TOC in its first 30 lines if larger (AC8)
- [ ] ≤ 5 files total in `draft-issue/references/` (AC8 budget)
- [ ] Normative intent of each extracted passage is preserved (AC9)

### T010: Refactor draft-issue/SKILL.md to ≤ 300 Lines

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T001, T009
**Acceptance**:
- [ ] `wc -l plugins/nmg-sdlc/skills/draft-issue/SKILL.md` reports ≤ 300
- [ ] Frontmatter is byte-identical to pre-refactor (AC5) — verify with `diff` of extracted frontmatter blocks
- [ ] Every pointer follows the AC7 grammar: `Read \`references/{name}.md\` when {trigger}.` (or `../../references/` for shared references)
- [ ] Slash command surface unchanged (AC4)
- [ ] Shared-reference pointers target `../../references/{name}.md`; per-skill pointers target `references/{name}.md`
- [ ] No duplication of shared-reference content remains in the body (AC3)

### T011: Regenerate Baseline with Inventory-Removal Justification

**File(s)**: `scripts/skill-inventory.baseline.json`
**Type**: Modify
**Depends**: T009, T010
**Acceptance**:
- [ ] Run `--diff` to preview the expected destination changes
- [ ] Run `--baseline` to regenerate the file
- [ ] Any items genuinely removed from the plugin are listed under a `### Inventory Removals` heading in PR 2's body, with rationale per item
- [ ] Post-regeneration, `--check` passes with zero drift

### T012: Exercise Test — draft-issue Against Fixture

**File(s)**: `scripts/__fixtures__/skill-exercise/draft-issue/`, `scripts/__fixtures__/skill-exercise/rubrics/draft-issue.md`, `scripts/skill-exercise-runner.mjs`
**Type**: Create
**Depends**: T010
**Acceptance**:
- [ ] Fixture project scaffolded per `steering/structure.md`'s "Test Project Scaffolding" (steering/, src/, README, .gitignore, git-initialized)
- [ ] Rubric describes the deterministic and rubric-graded output properties
- [ ] `scripts/skill-exercise-runner.mjs` spawns `claude -p` with the Agent SDK `canUseTool` callback pattern from `steering/tech.md`
- [ ] Exercise run against refactored draft-issue produces artifacts that pass the rubric compared to a pre-refactor baseline captured on main
- [ ] Deterministic artifacts (slash-command enumeration, frontmatter, file paths written) are byte-equivalent between pre- and post-refactor runs (AC2)

---

## Phase 3: Bulk Refactor (3 skills) — PR 3

### T013: Refactor write-spec to ≤ 250 Lines

**File(s)**: `plugins/nmg-sdlc/skills/write-spec/SKILL.md`, `plugins/nmg-sdlc/skills/write-spec/references/discovery.md`, `plugins/nmg-sdlc/skills/write-spec/references/amendment-mode.md`, `plugins/nmg-sdlc/skills/write-spec/references/defect-variant.md`, `plugins/nmg-sdlc/skills/write-spec/references/review-gates.md`
**Type**: Create + Modify
**Depends**: T001, T010 (pilot pattern established)
**Acceptance**:
- [ ] `wc -l` ≤ 250 (AC1)
- [ ] Frontmatter byte-identical (AC5)
- [ ] Every pointer matches AC7 grammar
- [ ] Shared-reference pointers present for every duplicated block (legacy-layout-gate, unattended-mode, feature-naming, spec-frontmatter — see design's Shared-Reference Contents table)
- [ ] Exercise test passes against fixture; baseline regenerated and justified

### T014: Refactor onboard-project to ≤ 280 Lines

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`, `plugins/nmg-sdlc/skills/onboard-project/references/greenfield.md`, `plugins/nmg-sdlc/skills/onboard-project/references/brownfield.md`, `plugins/nmg-sdlc/skills/onboard-project/references/interview.md`
**Type**: Create + Modify
**Depends**: T001
**Acceptance**:
- [ ] `wc -l` ≤ 280 (AC1)
- [ ] Frontmatter byte-identical (AC5)
- [ ] Every pointer matches AC7 grammar
- [ ] Shared-reference pointers present for steering-schema and unattended-mode
- [ ] Exercise test passes; baseline regenerated

### T015: Refactor upgrade-project to ≤ 250 Lines

**File(s)**: `plugins/nmg-sdlc/skills/upgrade-project/SKILL.md`, `plugins/nmg-sdlc/skills/upgrade-project/references/detection.md`, `plugins/nmg-sdlc/skills/upgrade-project/references/migration-steps.md`, `plugins/nmg-sdlc/skills/upgrade-project/references/verification.md`
**Type**: Create + Modify
**Depends**: T001
**Acceptance**:
- [ ] `wc -l` ≤ 250 (AC1)
- [ ] Frontmatter byte-identical (AC5)
- [ ] Every pointer matches AC7 grammar
- [ ] Shared-reference pointers present for legacy-layout-gate and unattended-mode (upgrade-project is the one skill that *resolves* the gate, so its pointer semantics differ — document in the reference file itself)
- [ ] Exercise test passes; baseline regenerated

---

## Phase 4: Remainder Refactor + Release — PR 4

### T016: Refactor start-issue to ≤ 220 Lines

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`, `plugins/nmg-sdlc/skills/start-issue/references/dirty-tree.md`, `plugins/nmg-sdlc/skills/start-issue/references/milestone-selection.md`
**Type**: Create + Modify
**Depends**: T001
**Acceptance**:
- [ ] `wc -l` ≤ 220 (AC1)
- [ ] Frontmatter byte-identical (AC5)
- [ ] Pointer grammar (AC7), shared-reference pointers (feature-naming, legacy-layout-gate, unattended-mode)
- [ ] Exercise test passes

### T017: Refactor verify-code to ≤ 220 Lines (Including Pointer-Grammar Migration)

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/SKILL.md`, `plugins/nmg-sdlc/skills/verify-code/references/autofix-loop.md`, `plugins/nmg-sdlc/skills/verify-code/references/defect-path.md`
**Type**: Create + Modify
**Depends**: T001
**Acceptance**:
- [ ] `wc -l` ≤ 220 (AC1)
- [ ] Frontmatter byte-identical (AC5)
- [ ] Existing `[text](checklists/...)` and `[text](references/...)` pointers are migrated to the AC7 grammar (`Read \`checklists/...\` when ...`)
- [ ] Shared-reference pointers added for legacy-layout-gate, unattended-mode, feature-naming, steering-schema, spec-frontmatter
- [ ] Exercise test passes

### T018: Refactor run-retro to ≤ 180 Lines

**File(s)**: `plugins/nmg-sdlc/skills/run-retro/SKILL.md`, `plugins/nmg-sdlc/skills/run-retro/references/learning-extraction.md`, `plugins/nmg-sdlc/skills/run-retro/references/transferability.md`
**Type**: Create + Modify
**Depends**: T001
**Acceptance**:
- [ ] `wc -l` ≤ 180 (AC1)
- [ ] Frontmatter byte-identical (AC5)
- [ ] Shared-reference pointer added for spec-frontmatter
- [ ] Exercise test passes

### T019: Refactor open-pr to ≤ 180 Lines

**File(s)**: `plugins/nmg-sdlc/skills/open-pr/SKILL.md`, `plugins/nmg-sdlc/skills/open-pr/references/version-bump.md`, `plugins/nmg-sdlc/skills/open-pr/references/ci-monitoring.md`
**Type**: Create + Modify
**Depends**: T001
**Acceptance**:
- [ ] `wc -l` ≤ 180 (AC1)
- [ ] Frontmatter byte-identical (AC5)
- [ ] Shared-reference pointers added for versioning, feature-naming, steering-schema, legacy-layout-gate, unattended-mode
- [ ] Exercise test passes

### T020: Refactor write-code to ≤ 180 Lines

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md`, `plugins/nmg-sdlc/skills/write-code/references/plan-mode.md`, `plugins/nmg-sdlc/skills/write-code/references/resumption.md`
**Type**: Create + Modify
**Depends**: T001
**Acceptance**:
- [ ] `wc -l` ≤ 180 (AC1)
- [ ] Frontmatter byte-identical (AC5)
- [ ] Shared-reference pointers added for legacy-layout-gate, unattended-mode
- [ ] Exercise test passes

### T021: Update steering/structure.md to Document References Layer

**File(s)**: `steering/structure.md`
**Type**: Modify
**Depends**: None (can run in parallel with T016–T020)
**Acceptance**:
- [ ] Project Layout tree shows `plugins/nmg-sdlc/references/` (plugin-shared)
- [ ] Per-skill layout shows `references/` alongside existing `templates/` and `checklists/`
- [ ] Layer Architecture diagram has a new row for "Plugin-shared references" and "Per-skill references" with their responsibilities
- [ ] Naming Conventions section gains a row for "Reference directories" → `references/`
- [ ] File Templates section gains a pointer-grammar example matching AC7

### T022: Version Bump to 1.53.0 and CHANGELOG Entry

**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`
**Type**: Modify
**Depends**: T016, T017, T018, T019, T020, T021
**Acceptance**:
- [ ] `plugin.json` version = `1.53.0`
- [ ] `marketplace.json` plugin entry version = `1.53.0`
- [ ] `metadata.version` in `marketplace.json` unchanged (plugin-version bump, not marketplace-collection bump)
- [ ] CHANGELOG `[Unreleased]` items moved under `## [1.53.0] - 2026-04-19`
- [ ] CHANGELOG entry names the refactor pattern and lists per-skill line-count reductions (before → after)
- [ ] No other files modified in this commit

---

## Phase 5: Testing (threaded across PRs)

### T023: Create feature.gherkin with All 10 Scenarios

**File(s)**: `specs/feature-refactor-skill-md-progressive-disclosure/feature.gherkin`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] One scenario per AC (AC1–AC10)
- [ ] Valid Gherkin syntax
- [ ] Scenarios use concrete data (specific skill names, specific line counts from AC1)
- [ ] Includes a Background for shared preconditions (plugin at `plugins/nmg-sdlc/`, refactor branch merged)

### T024: Exercise-Test Harness for Full Plugin

**File(s)**: `scripts/skill-exercise-runner.mjs` (extend from T012), `scripts/__fixtures__/skill-exercise/rubrics/*.md`
**Type**: Modify + Create
**Depends**: T012
**Acceptance**:
- [ ] Harness can exercise every refactored skill against its fixture with one CLI invocation
- [ ] Rubric files exist for every skill refactored in PRs 2–4
- [ ] Harness emits a pass/fail report per skill and aggregate counts
- [ ] Deterministic-artifact checks and rubric-graded checks are reported separately

### T025: Final Verification Pass — All ACs

**File(s)**: *(no file changes)*
**Type**: Verify
**Depends**: T001–T024
**Acceptance**:
- [ ] AC1 met: every SKILL.md at its line target (structural check)
- [ ] AC2 met: every refactored skill passes exercise test
- [ ] AC3 met: `grep -r` confirms no duplication of the 6 shared blocks outside `plugins/nmg-sdlc/references/`
- [ ] AC4 met: slash-command surface byte-identical (diff pre/post enumeration)
- [ ] AC5 met: frontmatter byte-identical for every skill
- [ ] AC6 met: audit `--check` passes; CI workflow green on every PR
- [ ] AC7 met: every pointer matches the regex `^Read \`(\.\./\.\./)?references/[^\`]+\.md\` when `
- [ ] AC8 met: per-skill `references/` count ≤ 5; TOC present on any file > 300 lines
- [ ] AC9 met: reviewer sign-off that every shared-reference passage preserves the normative intent of every consumer
- [ ] AC10 met: `.github/workflows/claude-review.yml` is present; Claude Code review posted on every refactor PR

---

## Dependency Graph

```
Phase 1 (PR 1)
  T001 ──┬──▶ T009 (Phase 2)
         ├──▶ T013, T014, T015 (Phase 3)
         ├──▶ T016, T017, T018, T019, T020 (Phase 4)
  T002 ──┬──▶ T003
         ├──▶ T004
         ├──▶ T005
         └──▶ T006
  T003, T004, T005, T006, T007 ──▶ T008

Phase 2 (PR 2)
  T001 ──▶ T009 ──▶ T010 ──▶ T011 ──▶ T012

Phase 3 (PR 3) — three parallel tracks, each gated by T001 and following T010's pattern
  T013 ─┐
  T014 ─┤──▶ (PR 3 ready)
  T015 ─┘

Phase 4 (PR 4) — five parallel tracks plus T021 and T022
  T016 ─┐
  T017 ─┤
  T018 ─┼──▶ T022 ──▶ (PR 4 ready)
  T019 ─┤
  T020 ─┘
  T021 ─┘

Phase 5 (threaded)
  T023: runs as part of PR 1 (design artifact, not code)
  T024: extends through PRs 2, 3, 4 as each skill is added
  T025: gate for PR 4 merge
```

**Critical path**: T002 → T003 → T005 → T008 → T009 → T010 → T012 → T013 → T022 → T025

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #138 | 2026-04-19 | Initial feature spec |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Tasks can be completed independently within each PR given their dependencies
- [x] Acceptance criteria are verifiable (line counts, byte-diffs, exit codes, regex matches)
- [x] File paths reference actual project structure per `steering/structure.md`
- [x] Test tasks included (T003 unit + canary, T008 PR 1 smoke, T012 pilot exercise, T023 BDD, T024 harness, T025 final)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
