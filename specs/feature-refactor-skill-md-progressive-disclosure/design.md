# Design: Refactor SKILL.md via Progressive Disclosure

**Issues**: #138, #145, #146
**Date**: 2026-04-19
**Status**: Draft
**Author**: Rich Nunley

---

## Overview

This refactor splits every nmg-sdlc SKILL.md into a lean body (trigger + workflow skeleton) and on-demand reference material loaded from two new layers: a **plugin-shared `references/`** for content that today appears verbatim in multiple skills, and a **per-skill `references/`** for variant-specific or rarely-executed branches. The pattern is already proven in-repo by `verify-code`, which has `checklists/` + `references/`; this work generalizes that layout plugin-wide and adds a deterministic content-inventory audit script so AI-authored rewrites cannot silently drop directives.

The scope is mechanical: move content, leave behavior alone. Every observable property of every skill — the frontmatter, the slash command surface, the generated artifacts under exercise — must be byte- or spec-equivalent to the pre-refactor baseline. The audit script, an exercise-testing rubric, and a staged 4-PR rollout form the safety net.

A permanent audit script at `scripts/skill-inventory-audit.mjs` plus a baseline inventory JSON committed with the refactor guards every future SKILL.md edit against silent content loss, turning AC6 into a CI-enforced invariant rather than a one-shot check.

---

## Architecture

### New Directory Layout

```
plugins/nmg-sdlc/
├── references/                          ← NEW: plugin-shared references
│   ├── legacy-layout-gate.md
│   ├── unattended-mode.md
│   ├── feature-naming.md
│   ├── versioning.md
│   ├── steering-schema.md
│   └── spec-frontmatter.md
└── skills/
    ├── draft-issue/
    │   ├── SKILL.md                     ← ≤ 300 lines (was 1087)
    │   └── references/                  ← NEW: per-skill references
    │       ├── multi-issue.md
    │       ├── design-url.md
    │       ├── interview-depth.md
    │       ├── feature-template.md
    │       └── bug-template.md
    ├── write-spec/
    │   ├── SKILL.md                     ← ≤ 250 lines (was 516)
    │   ├── templates/                   ← unchanged
    │   └── references/
    │       ├── discovery.md
    │       ├── amendment-mode.md
    │       ├── defect-variant.md
    │       └── review-gates.md
    ├── verify-code/
    │   ├── SKILL.md                     ← ≤ 220 lines (was 437)
    │   ├── checklists/                  ← unchanged (existing split)
    │   └── references/                  ← expanded
    ...
scripts/
├── skill-inventory-audit.mjs            ← NEW: deterministic content-inventory check
├── skill-inventory.baseline.json        ← NEW: committed pre-refactor inventory
└── __tests__/
    └── skill-inventory-audit.test.js    ← NEW: unit tests for the audit script
```

### Content-Flow Diagram

```
┌───────────────────────────────┐
│  Claude Code loads SKILL.md   │
│  (trigger + workflow skeleton)│
└──────────┬────────────────────┘
           │
           │  workflow reaches a branch that needs detail
           ▼
┌───────────────────────────────────────────┐
│  Pointer: Read `references/{name}.md`     │
│  when {explicit triggering condition}     │
└──────────┬────────────────────────────────┘
           │
           ├─► plugins/nmg-sdlc/references/{name}.md    (shared across skills)
           └─► plugins/nmg-sdlc/skills/{skill}/references/{name}.md  (this skill only)
```

A skill always loads its own body. Reference files are loaded only when a pointer fires, which is what earns the "progressive disclosure" context savings.

### Layer Responsibilities

| Layer | Holds | Does Not Hold |
|-------|-------|---------------|
| SKILL.md body | Trigger, workflow skeleton, gate structure, pointer lines | Full variant branches, exhaustive examples, duplicated cross-skill rules |
| Plugin-shared `references/` | Rules repeated ≥ 3 skills verbatim or near-verbatim | Skill-specific workflow steps |
| Per-skill `references/` | Variant branches, extended examples, long-form walkthroughs | Content other skills consume |
| `templates/` (existing) | Declarative output structures | Conditional logic |
| `checklists/` (existing, verify-code only) | Scoring rubrics | Workflow steps |

---

## Pointer Grammar (satisfies AC7)

Every pointer from a SKILL.md to a reference file follows one of two shapes:

**Shared reference:**
```
Read `../../references/{name}.md` when {triggering-condition}.
```

**Per-skill reference:**
```
Read `references/{name}.md` when {triggering-condition}.
```

Rules:
1. The reference path is in single backticks.
2. The triggering condition is stated in the same sentence, never delegated to surrounding prose.
3. `when` is the only conjunction used (not "if", "on", "where"), so pointers are greppable.
4. Relative paths are always relative to the SKILL.md that contains the pointer — plugin-shared references resolve via `../../references/`.
5. A pointer may optionally append a brief purpose fragment: `Read `references/defect-variant.md` when the issue has the `bug` label — it replaces the full feature template.`

Rule #3 means `grep -rE '^Read \`(\.\./\.\./)?references/[^`]+\.md\` when ' plugins/nmg-sdlc/skills/*/SKILL.md` enumerates every pointer plugin-wide. The audit script depends on this.

---

## Shared-Reference Contents

Each of the six plugin-shared references consolidates content currently duplicated across skills. The design below names what each file must contain — line counts are soft targets, not contracts.

| File | Consolidated from | Sketch of contents |
|------|--------------------|---------------------|
| `legacy-layout-gate.md` | draft-issue, start-issue, write-spec, write-code, verify-code, open-pr, onboard-project, upgrade-project | Glob check for `.claude/steering/*.md` + `.claude/specs/*/requirements.md`; abort message (reworded per FR5 — no `ERROR:` prefix required since no downstream parser depends on it); action: instruct user to run `/upgrade-project`. |
| `unattended-mode.md` | every pipeline skill | Check for `.claude/unattended-mode` file; semantics: skip every `AskUserQuestion` gate; the invariant "interactive mode is default, unattended is opt-in"; how each gate references this file in its own flow. |
| `feature-naming.md` | draft-issue, start-issue, write-spec, verify-code, open-pr | Slug derivation rules; `feature-` vs `bug-` prefix rules; fallback discovery by issue number in `**Issues**` frontmatter; legacy `{issue#}-{slug}/` support. |
| `versioning.md` | open-pr, draft-issue | Plugin version bump matrix (label → bump type); major-bump opt-in (`--major`); dual-file update (plugin.json + marketplace.json); CHANGELOG conventions including `### Changed (BREAKING)` + `### Migration Notes`. |
| `steering-schema.md` | onboard-project, write-spec, verify-code, open-pr | Roster of steering docs (product.md, tech.md, structure.md, retrospective.md); the purpose and read-timing of each; how skills discover and read them. |
| `spec-frontmatter.md` | write-spec, verify-code, run-retro | Frontmatter fields (`**Issues**`, `**Date**`, `**Status**`, `**Author**`, `**Related Spec**`); plural `**Issues**` vs legacy singular `**Issue**`; amendment rules; `Change History` table format. |

---

## Per-Skill Reference Extractions

For each skill, the following content moves out of SKILL.md into per-skill `references/`. The SKILL.md retains a trigger + pointer for each. Exact extraction is refined during implementation, but these are the anchors the design commits to.

| Skill | Extractions → `references/` | Ceiling |
|-------|------------------------------|---------|
| draft-issue | `multi-issue.md`, `design-url.md`, `interview-depth.md`, `feature-template.md`, `bug-template.md` | ≤ 300 |
| upgrade-project | `detection.md`, `migration-steps.md`, `verification.md` | ≤ 250 |
| write-spec | `discovery.md`, `amendment-mode.md`, `defect-variant.md`, `review-gates.md` | ≤ 250 |
| onboard-project | `greenfield.md`, `brownfield.md`, `interview.md` | ≤ 280 |
| start-issue | `dirty-tree.md`, `milestone-selection.md` | ≤ 220 |
| verify-code | `exercise-testing.md` (exists), `autofix-loop.md`, `defect-path.md` | ≤ 220 |
| run-retro | `learning-extraction.md`, `transferability.md` | ≤ 180 |
| open-pr | `version-bump.md`, `ci-monitoring.md` | ≤ 180 |
| write-code | `plan-mode.md`, `resumption.md` | ≤ 180 |

Each per-skill `references/` directory stays under 5 files (AC8). Any reference exceeding 300 lines prepends a TOC in its first 30 lines.

### Selection Criteria for Extraction

A section moves to `references/` when **any** of these are true:
- It fires only on a specific variant (e.g., `bug` label, amendment mode, `--major`).
- It fires only rarely — not on the typical happy path.
- It duplicates content appearing in ≥ 2 other SKILL.md files (→ plugin-shared).
- It is an extended example or walkthrough the skill can cite rather than inline.

A section **stays inline** when:
- It fires on every invocation.
- Removing it would break the workflow skeleton's readability end-to-end.
- Its removal would require the pointer's trigger clause to carry more than a short phrase's worth of context.

---

## Content-Inventory Audit Script (satisfies AC6 + FR11)

### Purpose

Catch silent content loss when AI agents rewrite SKILL.md bodies. The script is permanent: it runs in CI on every PR that touches any SKILL.md or `references/` file and fails the build when the inventory diverges from the committed baseline without a justification comment in the PR body.

### Location and Shape

- `scripts/skill-inventory-audit.mjs` — Node.js ESM, zero-dependency, follows tech.md conventions.
- `scripts/skill-inventory.baseline.json` — committed inventory file, regenerated only on intentional removals.
- `scripts/__tests__/skill-inventory-audit.test.js` — Jest tests covering the extraction rules.

### Inventory Extraction Rules

An inventory item is a normalized clause from a SKILL.md body. The script walks every `plugins/nmg-sdlc/skills/*/SKILL.md` and every `plugins/nmg-sdlc/**/references/*.md`, extracting items under these headings:

- `## Input` clauses
- `## Process` / `### Step N` clauses
- `## Output` clauses
- `## Human Review Gate` / `### Human Review Gate` clauses
- Any line containing the substring `unattended-mode`

Each extracted item is normalized: trim whitespace, collapse consecutive spaces, strip markdown emphasis (`**`, `_`), lowercase the first 80 characters, and hash (SHA-1) the normalized form. The item ID is the 12-char prefix of the hash.

### Data Shape

```json
{
  "generated_at": "2026-04-19T12:00:00Z",
  "items": [
    {
      "id": "a1b2c3d4e5f6",
      "source_before": "plugins/nmg-sdlc/skills/draft-issue/SKILL.md:142",
      "normalized": "step 3: read steering/product.md for user context",
      "destination": "plugins/nmg-sdlc/skills/draft-issue/SKILL.md:74"
    },
    {
      "id": "f6e5d4c3b2a1",
      "source_before": "plugins/nmg-sdlc/skills/draft-issue/SKILL.md:240",
      "normalized": "defect requirements variant uses reproduction steps...",
      "destination": "plugins/nmg-sdlc/skills/draft-issue/references/bug-template.md:8"
    }
  ]
}
```

### Audit Modes

| Mode | Invocation | Behavior |
|------|-----------|----------|
| `--baseline` | `node scripts/skill-inventory-audit.mjs --baseline` | Scans current checkout and writes `skill-inventory.baseline.json`. Intended for the refactor PR and intentional-removal PRs only. |
| `--check` (default) | `node scripts/skill-inventory-audit.mjs` | Scans current checkout, loads baseline, reports any items missing from the new layout. Exits 0 if clean, 1 if items are unmapped. |
| `--diff` | `node scripts/skill-inventory-audit.mjs --diff` | Prints a human-readable diff of inventory items `source_before` → `destination` for PR review. |

### CI Integration

A GitHub Actions workflow at `.github/workflows/skill-inventory-audit.yml` runs `--check` on every PR that modifies any `SKILL.md` or any file under `plugins/nmg-sdlc/**/references/`. A failing audit blocks merge. To intentionally remove inventory items, the PR author regenerates the baseline with `--baseline`, commits the updated JSON, and documents the removal in the PR body under a `### Inventory Removals` heading.

### Failure Modes and Recovery

| Failure | Cause | Recovery |
|---------|-------|----------|
| Unmapped item in `--check` | Content silently dropped during a refactor | Restore the content or regenerate baseline with justification |
| Baseline file missing | First run before baseline committed | Run `--baseline` once, commit the output |
| Normalization collision | Two clauses normalize to identical hashes | Extend normalization (e.g., include parent heading); re-baseline |

### Script Lifecycle & Self-Maintenance

The script is only useful if it stays correct and is actually exercised on every SKILL.md edit. Five overlapping mechanisms guard both properties.

#### 1. Canary Fixture (self-test)

- `scripts/__fixtures__/audit-canary/good/` — a known-good SKILL.md + references/ pair that the audit must accept.
- `scripts/__fixtures__/audit-canary/bad/` — a SKILL.md with a deliberately dropped inventory item that the audit must reject (exit 1).
- A Jest test and a CI job run `--check` against both fixtures. If the script's extraction logic ever breaks so drift goes undetected, the `bad/` fixture case fails — loudly.

#### 2. Baseline-Freshness Check

On every PR, the audit workflow:
1. Computes a fresh baseline to a temp file (`node scripts/skill-inventory-audit.mjs --baseline --output /tmp/baseline.json`).
2. Diffs it against `scripts/skill-inventory.baseline.json`, ignoring files touched by the PR.
3. Fails if unrelated items drifted — that means a previous merge rotted the baseline.

This catches the case where a skill edit sneaks through without updating the baseline and subsequent PRs build on stale state.

#### 3. CI Enforcement — Required Check

- The GitHub Actions job at `.github/workflows/skill-inventory-audit.yml` is declared a **required status check** on the `main` branch-protection rules. No merge without green.
- The job runs the canary fixture from #1 before the real audit, so a broken script is reported as "canary failed" rather than "audit passed trivially."

#### 4. `/verify-code` Integration

`/verify-code`'s skill-exercise path invokes the audit script whenever any `plugins/nmg-sdlc/skills/**/SKILL.md` or `plugins/nmg-sdlc/**/references/**` file is in the diff. Implementation: add a new verification gate in `steering/tech.md`'s Verification Gates table that maps the condition to `node scripts/skill-inventory-audit.mjs --check`. Local dev invocations of `/verify-code` exercise the audit automatically — dogfooding the tooling on top of the CI hard gate.

#### 5. Baseline Regeneration Controls

Updates to `scripts/skill-inventory.baseline.json` are special:

- The audit workflow, when it detects a change to the baseline file, lints the PR body for a `### Inventory Removals` heading. Missing heading → fail with a message naming the missing heading. Removal entries under the heading require: the inventory-item ID, the reason for removal, and the author's explicit confirmation that the removal is intentional.
- Commit convention: baseline-regeneration commits use the `chore(inventory):` scope so regens are grep-able in git history.
- Local helper: `node scripts/skill-inventory-audit.mjs --diff` prints the before/after destination map that can be pasted into the PR body as a starting point.

Together these mechanisms make silent content loss require active, deliberate subversion — not possible through normal AI agent-driven edits.

---

## Exercise Testing Approach (satisfies AC2)

AC2 demands that each refactored skill produce the same artifacts as before when exercised against a fixture. Fixtures live at `scripts/__fixtures__/skill-exercise/` (new directory) and the runner at `scripts/skill-exercise-runner.mjs` (new, zero-dependency) spawns `claude -p --plugin-dir ./plugins/nmg-sdlc --project-dir <fixture>` via the Agent SDK pattern already documented in `steering/tech.md`.

For each refactored skill:

1. Record the pre-refactor output against the fixture on the main branch.
2. Apply the refactor on the topic branch.
3. Re-run the same invocation.
4. Compare:
   - **Deterministic artifacts** (file paths, structural fields, frontmatter, slash-command enumeration): byte-equivalent check.
   - **Model-authored prose** (issue bodies, spec content): graded against a rubric stored at `scripts/__fixtures__/skill-exercise/rubrics/{skill}.md` — same rubric the `/verify-code` pipeline already uses for plugin-scoped skills.

Skills using `AskUserQuestion` use the `canUseTool` callback to auto-select the first option (per `steering/tech.md` → "Automated Exercise Testing via Agent SDK"), keeping runs deterministic.

---

## Claude Code GitHub App Integration (satisfies AC10 + FR14)

The Claude Code GitHub App is already installed org-wide on Nunley-Media-Group with access to this repo; the remaining work is a repo-level workflow that invokes the official action on every PR.

### Workflow

- File: `.github/workflows/claude-review.yml`
- Action: `anthropics/claude-code-action@v1`
- Triggers:
  - `pull_request`: `opened`, `synchronize` — automatic review on every PR and on every push to an open PR.
  - `issue_comment`: `created` — with a `contains(github.event.comment.body, '@claude')` condition so Claude responds to explicit mentions in PR/issue threads.
- Permissions: `contents: read`, `pull-requests: write`, `issues: write`.
- Secrets: `ANTHROPIC_API_KEY` at the org level (already provisioned alongside the app). No repo-level secret configuration required.
- Concurrency: `group: claude-review-${{ github.event.pull_request.number || github.event.issue.number }}`, `cancel-in-progress: true` — coalesces rapid pushes into a single review run to contain cost.

### Context Claude Reads

The action picks up `CLAUDE.md` at the project root automatically. No additional configuration is needed to steer reviews toward the plugin's conventions — `CLAUDE.md` already documents the version-bump matrix, commit style, README-sync rule, and spec-commitment rule.

### Required-Pass Gate

Both the audit workflow and the Claude review workflow are declared **required status checks** on `main`. A failing Claude review blocks merge — it is not advisory. The workflows are still functionally decoupled (a broken audit does not suppress Claude's review, and vice versa) but both must report `success` before merge.

The job is wired to fail on `REQUEST_CHANGES`:

- `anthropics/claude-code-action@v1` emits a review verdict; the workflow maps `APPROVE` / `COMMENT` (without blocking findings) to exit code 0 and `REQUEST_CHANGES` to a non-zero exit.
- A subsequent push that triggers a passing review flips the check back to `success` via the `pull_request: synchronize` event. No manual override is introduced — the gate clears only when Claude posts a passing review against the current HEAD.

### Verdict-To-Exit-Code Mapping

The action by default does not fail the job on `REQUEST_CHANGES`. The workflow adds an explicit post-step that reads the action's output (or the latest PR review by the Claude bot user) and fails when the verdict is `REQUEST_CHANGES`:

```yaml
- name: Enforce Claude review verdict
  if: github.event_name == 'pull_request'
  env:
    GH_TOKEN: ${{ github.token }}
    PR_NUMBER: ${{ github.event.pull_request.number }}
  run: |
    verdict=$(gh api "repos/${{ github.repository }}/pulls/${PR_NUMBER}/reviews" \
      --jq '[.[] | select(.user.type == "Bot")] | last | .state')
    echo "Claude review verdict: ${verdict:-none}"
    if [ "$verdict" = "CHANGES_REQUESTED" ]; then
      echo "::error::Claude requested changes — blocking merge until a passing review is posted."
      exit 1
    fi
```

Issue-comment (`@claude`) runs are not gated — those are ad-hoc interactions rather than PR-level reviews. The enforce-verdict step's `if:` condition scopes it to `pull_request` events only.

---

## Multi-PR Rollout

Four PRs in strict order, each independently mergeable and reverting cleanly. This is also the Delivery Phases table consumed by the epic-support tooling (child-issue batch creation and parent-link resolution).

| Phase | Child Issue | Depends On | Summary |
|-------|-------------|------------|---------|
| **1** | #145 | — | Additive infrastructure: create `plugins/nmg-sdlc/references/` with the 6 shared files; add `scripts/skill-inventory-audit.mjs` + baseline + canary fixtures + CI workflow (required-check) + `/verify-code` integration + `.github/workflows/claude-review.yml` (AC10/FR14). **No SKILL.md edits yet** — audit baseline captures the pre-refactor state. *Gates*: runner tests pass; audit `--check` reports zero drift; canary fixture test passes; `/verify-code` invokes audit on a sample skill edit; Claude Code review posts on PR 1 itself (self-dogfood). |
| **2** | #146 | #145 | `draft-issue` pilot — migrate the biggest skill first and validate the pattern before touching others. Adds per-skill `references/` and updates pointers. *Gates*: AC1 met for `draft-issue`; exercise test against fixture; audit `--check` passes with updated baseline. |
| **3** | #147 | #146 | Bulk refactor: `write-spec` + `onboard-project` + `upgrade-project`. Apply lessons from PR 2. *Gates*: AC1 met for all three; exercise tests pass; audit clean. |
| **4** | #148 | #147 | Remainder: `start-issue`, `verify-code`, `run-retro`, `open-pr`, `write-code`. *Gates*: every skill at target; full audit clean; `steering/structure.md` updated (FR12); version bump to 1.53.0 (FR9); CHANGELOG entry. |

A 5th PR is not planned — FR9 rides on PR 4. This section satisfies FR10.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: One big-bang PR** | Refactor every skill in a single PR. | Simpler review surface; no interim states. | Massive diff; high regression risk; hard to revert a single skill. | Rejected — blast radius is too large for AI-authored markdown edits. |
| **B: Per-skill PRs (9 PRs)** | One PR per skill. | Smallest possible blast radius. | PR-review overhead; shared-references PR must land first; 9 separate reviews. | Rejected — overhead outweighs the marginal blast-radius reduction over 4 PRs. |
| **C: Staged 4-PR rollout** | Additive references first, then pilot, then bulk, then remainder. | Catches pattern flaws in the pilot; each PR is independently revertible; audit script lands before refactor begins. | Requires discipline to not touch unrefactored skills in interim PRs. | **Selected**. |
| **D: One-shot audit (no permanent script)** | Run inventory check once on refactor PRs, delete afterwards. | Less tooling to maintain. | AC6's guarantee evaporates after merge; future skill edits can silently drop content. | Rejected — contradicts FR11 (resolved open question) and the retrospective learning that AI agent compliance is probabilistic. |
| **E: Markdown-link pointer grammar** (`[text](path)`) | Use `verify-code`'s existing markdown-link style. | Consistent with existing skill. | Loses the `when {trigger}` clause; harder to grep; weaker disclosure-intent signal. | Rejected — AC7 specifies the uniform `Read ... when ...` grammar. `verify-code` updates its pointers during PR 4. |

---

## Security Considerations

- [x] **No secrets introduced**: the refactor moves prose between markdown files.
- [x] **No new external services**: audit script is local-only Node.
- [x] **Input validation**: audit script treats file paths from CLI args with `path.resolve` and constrains scans to `plugins/nmg-sdlc/` and its subtree.
- [x] **No shell injection**: script uses `node:fs` for file reads; no `exec` of user-derived strings.

## Performance Considerations

- [x] **Skill triggering latency**: reducing SKILL.md body size should improve latency or leave it unchanged. NFR requires no regression vs baseline.
- [x] **Audit script runtime**: scan of ~13 SKILL.md + ~30 reference files is sub-second; CI cost negligible.
- [x] **On-demand loading**: reference files load only when their pointer fires, reducing context consumption on typical skill runs.

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Audit script | Unit (Jest) | Inventory extraction, normalization, hash stability, mode flags, exit codes |
| Audit script | Integration | End-to-end scan of the actual plugin directory, baseline round-trip |
| Audit script | Canary fixture | `good/` fixture passes, `bad/` fixture exits 1 — fails loudly if extraction logic breaks |
| Audit script | Baseline freshness | Fresh-baseline vs committed-baseline diff, ignoring PR-touched files |
| Refactored skills | Exercise (Agent SDK) | Each refactored skill exercised against its fixture; outputs graded per rubric |
| Frontmatter invariant | Structural | Diff script comparing frontmatter pre/post per skill (AC5) |
| Pointer grammar | Structural | Regex check every pointer matches the grammar from AC7 |
| Reference-file budget | Structural | `ls plugins/nmg-sdlc/skills/*/references/ | wc -l` ≤ 5 per skill |
| Line-count targets | Structural | `wc -l` against the AC1 table; CI gate |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI agent rewrites a skill and silently drops a gate or step | **High** | **High** | Permanent audit script (FR11) runs in CI on every SKILL.md edit; canary fixture catches broken extraction logic; baseline regeneration is an explicit PR-body-documented act guarded by the workflow's `### Inventory Removals` lint. |
| Audit script itself rots or is silently bypassed | Medium | High | Canary fixture + required-check branch protection + baseline-freshness diff + `/verify-code` local invocation form overlapping guards — bypassing one still leaves three. |
| Exercise fixtures go stale or become too coupled to current prose | Medium | Medium | Grade prose against a rubric (not exact match); deterministic-artifact check catches structural drift cheaply. |
| Pointer grammar is inconsistent across the refactor | Medium | Low | Regex check in CI enforces grammar (AC7 structural test). |
| Shared-reference wording change unintentionally alters one consumer's semantics | Medium | Medium | AC9 preserves normative intent; PR review diffs each shared reference against every consuming skill's pre-refactor passages. |
| Reference-file sprawl — too many per-skill files | Low | Medium | AC8 budget of ≤ 5; enforced structurally. |
| verify-code's existing `[text](path)` pointers conflict with new grammar | Medium | Low | PR 4 migrates verify-code's pointers to the new grammar; interim state is acceptable since verify-code is last. |
| Breaking change to downstream tooling depending on the legacy `ERROR:` gate string | **Low** | Low | Resolved open question — no downstream consumer outside the SDLC depends on it. FR5 permits rewording. |

---

## Open Questions

None — both Phase-1 open questions were resolved and codified in requirements.md (FR5, FR11).

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #138 | 2026-04-19 | Initial design |
| #145 | 2026-04-19 | Phase 1 child — additive infrastructure. No design changes; scope is the PR 1 slice of the Multi-PR Rollout (shared `references/` scaffold, audit script + CI, Claude review workflow). Also renamed `## Rollout Plan` → `## Multi-PR Rollout` and restructured its table to the epic-template Delivery Phases schema (`Phase \| Child Issue \| Depends On \| Summary`) populated with #145–#148 and their dependency chain, to conform to the epic-support contract introduced in #149. |
| #145 | 2026-04-19 | Replaced "Scope Boundary" section with "Required-Pass Gate" + "Verdict-To-Exit-Code Mapping" — the Claude review is now a required status check that blocks merge on REQUEST_CHANGES rather than an advisory comment. Added the enforce-verdict workflow step spec. |
| #146 | 2026-04-19 | Phase 2 child — draft-issue pilot. No design changes; the pilot scope was already captured in the Per-Skill Reference Extractions table (draft-issue row: `multi-issue.md`, `design-url.md`, `interview-depth.md`, `feature-template.md`, `bug-template.md`; ceiling ≤ 300) and in the Multi-PR Rollout (PR 2 row). This child issue validates the extraction pattern on the largest skill before Phases 3–4 fire. |

---

## Validation Checklist

- [x] Architecture follows existing project patterns (extends `verify-code`'s `checklists/` + `references/` split)
- [x] All API/interface changes documented (audit-script modes, pointer grammar)
- [x] No database/storage changes (N/A — plugin-internal markdown refactor)
- [x] State management approach clear (N/A — content lives in committed files only)
- [x] UI components and hierarchy defined (N/A — no UI)
- [x] Security considerations addressed
- [x] Performance impact analyzed
- [x] Testing strategy defined
- [x] Alternatives considered and documented
- [x] Risks identified with mitigations
