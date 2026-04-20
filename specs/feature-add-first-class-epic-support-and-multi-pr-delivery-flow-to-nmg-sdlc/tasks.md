# Tasks: First-Class Epic Support and Multi-PR Delivery Flow

**Issues**: #149
**Date**: 2026-04-19
**Status**: Planning
**Author**: Rich Nunley

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 2 | [ ] |
| Backend (sdlc-runner.mjs) | 3 | [ ] |
| Frontend (skill prompts) | 6 | [ ] |
| Integration | 2 | [ ] |
| Testing | 4 | [ ] |
| **Total** | **17** | |

---

## Task Format

Each task uses `T[NNN]: Title` headings, lists explicit file paths (per `steering/structure.md`), a Type (Create/Modify), a `Depends` chain, and verifiable acceptance bullets.

All skill (`SKILL.md`) edits MUST be driven through `/skill-creator` per the `steering/structure.md` architectural invariant "Skills must be authored via `/skill-creator`". Tasks that modify `SKILL.md` files note this explicitly.

---

## Phase 1: Setup

### T001: Scaffold `feature.gherkin` from requirements AC Gherkin Preview

**File(s)**: `specs/feature-add-first-class-epic-support-and-multi-pr-delivery-flow-to-nmg-sdlc/feature.gherkin`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] File exists at the path above
- [ ] All 11 scenarios from `requirements.md` "Generated Gherkin Preview" present, each tagged appropriately
- [ ] Feature block header mirrors the user story verbatim
- [ ] File is valid Gherkin syntax (parses without errors)

**Notes**: Already produced by this spec-writing phase — this task is a placeholder for downstream exercise tests that read the file. If T001 is already satisfied when `/write-code` begins, mark complete and proceed.

### T002: Document `gh` CLI minimum version for `--json parent` in `steering/tech.md`

**File(s)**: `steering/tech.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] "External Services" or "Environment Variables" table includes a minimum `gh` CLI version row (or explicit note) supporting `--json parent` sub-issue queries
- [ ] Fallback behavior documented: if `--json parent` returns empty, parent-link resolution degrades to body-cross-ref parsing only with a warning

**Notes**: No new tooling. This is a documentation-only change so verification treats it as a reference, not a runtime dependency.

---

## Phase 2: Backend Implementation (sdlc-runner.mjs)

### T003: Extract issue-selection into `selectNextIssueFromMilestone()`

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New JS function `selectNextIssueFromMilestone(milestone, config)` defined
- [ ] Function signature matches design: returns `{ issue, blockedIssues }` where `issue` is the chosen issue number (or null) and `blockedIssues` is an array of `{ issue, blockers }` for diagnostic logging
- [ ] Existing inline selection logic from `buildClaudeArgs` (~lines 900–921) delegates to the new function
- [ ] No behavior change yet when no dependencies are present (ordering stays lowest-number-first for ready issues)
- [ ] Function is unit-testable (no hidden global state; accepts milestone via argument)

### T004: Derive dependency graph live from `gh` inside `selectNextIssueFromMilestone()`

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] For each candidate issue, function calls `gh issue view $N --json number,state,body,parent,closedByPullRequestsReferences`
- [ ] Body parsing extracts all `Depends on: #\d+` and `Blocks: #\d+` lines (case-insensitive, multiple per issue allowed)
- [ ] Sub-issue parent field added to candidate edges if non-null
- [ ] Issue treated as "ready" only when every dependency has either (a) `state == CLOSED` AND at least one entry in `closedByPullRequestsReferences` with `mergedAt` non-null, or (b) dependency issue number not in the milestone queue (external dep — assumed satisfied)
- [ ] Graph is built fresh per call — no caching into `sdlc-state.json` or module-level variables
- [ ] Lowest-numbered ready issue returned; if none ready but issues exist, returns `{ issue: null, blockedIssues: [...] }`

### T005: Wire blocked-issue log line and all-blocked exit in runner main loop

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] Caller of `selectNextIssueFromMilestone()` logs `[runner] skipping #${N} — blocked by unmerged dependencies: ${blockers.join(', ')}` for each entry in `blockedIssues`
- [ ] When every open issue is blocked, runner exits with code `1` and writes a multi-line diagnostic to stderr listing every blocked issue and its unresolved blockers
- [ ] Happy path (at least one ready issue) is unchanged — same log output shape as today for the selected issue

---

## Phase 3: Frontend Implementation (skill prompts — authored via `/skill-creator`)

### T006: Add Epic classification option to `/draft-issue` Step 2

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify (authored via `/skill-creator`)
**Depends**: None
**Acceptance**:
- [ ] Step 2 `AskUserQuestion` includes "Epic" as a third option with the description "A coordinated set of child issues delivering one logical feature across multiple PRs"
- [ ] When Step 1b–1d multi-phase signals fire (`distinctComponents ≥ 4`, phase-language match, explicit "multiple PRs" keyword), Epic is labeled "(Recommended)"
- [ ] Unattended-mode branch: Epic is NEVER auto-selected; classifier defaults to Feature unless user description contains an exact `Type: epic` line (case-insensitive)
- [ ] Existing Feature and Bug flows are unchanged
- [ ] Skill still passes all existing `skill-creator` validation checks (frontmatter, structure, `allowed-tools`)

### T007: Add Epic issue body template to `/draft-issue` Step 6

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify (authored via `/skill-creator`)
**Depends**: T006
**Acceptance**:
- [ ] New inline template section for Epic body matching the Epic Issue Body Contract in `design.md` (sections in order: Goal, Delivery Phases table, Success Criteria delegation note, Child Issues checklist)
- [ ] Template does NOT include User Story, Acceptance Criteria, or Functional Requirements sections (epic is a coordination document only)
- [ ] Delivery Phases table columns exactly: `Phase | Child Issue | Depends On | Summary`
- [ ] Child Issues checklist initially contains placeholder entries; Step 10 fills real issue numbers after child creation

### T008: Wire Epic label creation and child batch-creation in `/draft-issue` Step 10

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify (authored via `/skill-creator`)
**Depends**: T007
**Acceptance**:
- [ ] Step 10, when classification is Epic: uses existing `gh label list` → `gh label create` pattern to lazily create the `epic` label if missing
- [ ] Epic issue is created with both `epic` and `enhancement` labels
- [ ] After epic creation, Step 10 invokes the existing Steps 1b–1d batch-creation mechanism for child issues, passing the epic issue number as the parent reference
- [ ] Each child issue body contains a `Depends on: #{epic-number}` line (and additional `Depends on: #{sibling}` lines if the epic's Delivery Phases table declares intra-epic prerequisites)
- [ ] Each child issue is set as a GitHub sub-issue of the epic via `gh issue edit {child} --add-parent {epic}` when the CLI supports it; graceful no-op with a logged warning if the flag is unsupported
- [ ] Each child is labeled `enhancement` (NOT `epic`)
- [ ] After children exist, the epic issue body is edited in place via `gh issue edit` to replace Child Issues checklist placeholders with real issue numbers

### T009: Prepend parent-link resolution to `/write-spec` Spec Discovery

**File(s)**: `plugins/nmg-sdlc/skills/write-spec/SKILL.md`
**Type**: Modify (authored via `/skill-creator`)
**Depends**: None
**Acceptance**:
- [ ] Spec Discovery section gains a new "Step 0: Parent-link resolution" executed BEFORE the existing keyword-based process
- [ ] Step 0 parses current issue body for all `Depends on: #\d+` and `Blocks: #\d+` lines (case-insensitive, regex `/(?:Depends on|Blocks): #(\d+)\b/gi`)
- [ ] Step 0 also queries `gh issue view --json parent` and adds the parent issue number to the candidate set if non-null
- [ ] For each candidate, Step 0 Globs `specs/*/requirements.md` and reads `**Issues**` frontmatter; match enters amendment mode against that spec
- [ ] Candidate found but parent spec directory NOT present on current branch → abort with message: `Parent spec for #N not found — run '/write-spec #N' and seal the spec before starting child work`
- [ ] Cycle detection: Step 0 maintains a visited set across recursive parent resolution; re-visit aborts with cycle-detected error naming the cycle's issues
- [ ] When Step 0 finds no candidates, control falls through to existing keyword-based discovery unchanged
- [ ] Unattended-mode behavior: Step 0 runs the same way; aborts escalate via runner sentinel rather than prompting

### T010: Add seal-spec flow at `/write-spec` Phase 3 approval gate

**File(s)**: `plugins/nmg-sdlc/skills/write-spec/SKILL.md`
**Type**: Modify (authored via `/skill-creator`)
**Depends**: None
**Acceptance**:
- [ ] After the Phase 3 approval gate, skill detects multi-PR trigger: EITHER `design.md` contains a `## Multi-PR Rollout` heading OR an FR row whose Requirement text contains "multiple PRs" or "multi-PR" (case-insensitive)
- [ ] Interactive mode: when trigger fires, prompt via `AskUserQuestion` with two options — "Seal and transition" and "Don't seal (I'll handle child creation manually)"
- [ ] Unattended mode: when trigger fires, auto-execute seal without prompting
- [ ] Seal action idempotency: check `git log --format=%H --grep='^docs: seal umbrella spec for #{N}$' HEAD` first; if matched, print `Spec already sealed at commit {sha}` and skip the commit+push
- [ ] Fresh seal: `git add specs/{feature-name}/` (explicit path, NEVER `git add -A`), `git commit -m "docs: seal umbrella spec for #{N}"`, `git push origin HEAD`
- [ ] Seal commit MUST NOT include changes to `plugin.json`, `marketplace.json`, `CHANGELOG.md`, or `VERSION`
- [ ] After seal, offer child-issue creation via re-invocation of `/draft-issue` Steps 1b–1d batch mechanism (using Delivery Phases table as the batch input); unattended mode auto-approves
- [ ] "After Completion" message prints `/start-issue #{first-child}` as the next-step command when children exist; existing manual-mode message preserved when seal is skipped or children are declined

### T011: Add sibling-aware bump and race-detection to `/open-pr`

**File(s)**: `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
**Type**: Modify (authored via `/skill-creator`)
**Depends**: None
**Acceptance**:
- [ ] Step 2 (version-bump classification): after label-based bump classification, if current issue body contains `Depends on: #E` OR `gh issue view --json parent` returns a parent #E AND #E is labeled `epic`:
  - [ ] Read parent's Child Issues checklist and body cross-refs to enumerate siblings
  - [ ] Query `gh issue view $C --json state,closedByPullRequestsReferences` for each sibling (excluding current issue)
  - [ ] All siblings closed with at least one merged PR → keep label-based bump; classify as "final"
  - [ ] Any sibling open OR without a merged PR → downgrade to patch bump; classify as "intermediate"
- [ ] Non-epic PRs (no parent OR parent not labeled `epic`) flow through existing classification unchanged
- [ ] Step 3 (CHANGELOG entry): when bump is "intermediate", append ` (partial delivery — see epic #{E})` to the primary entry bullet
- [ ] PR body footer gains `**Bump:** {patch|minor} (epic child: {intermediate|final})` line
- [ ] AC7a (epic closed prematurely): before PR submit, if `gh issue view {E} --json state` returns `CLOSED` but current child issue state is `OPEN`, warn and prompt (interactive) or escalate and exit (unattended)
- [ ] AC7d (race on plugin.json): after bump-and-commit, before push, run `git fetch origin && git merge-base --is-ancestor HEAD origin/{base-branch}`; if non-zero, `git pull --rebase origin {base-branch}`, re-compute bump against now-current `plugin.json` version, re-commit bump files, re-attempt push
- [ ] If rebase produces conflicts in `plugin.json` OR `marketplace.json`, abort with a specific error; NEVER force-push

---

## Phase 4: Integration

### T012: Verify Epic Issue Body Contract flows end-to-end

**File(s)**: Cross-file (no new files)
**Type**: Verify
**Depends**: T008, T009, T011
**Acceptance**:
- [ ] Manually inspect a generated Epic issue body (from T008 exercise): all four Contract sections present in the documented order, with placeholders filled by Step 10
- [ ] `/write-spec` Step 0 (T009) successfully parses the Child Issues checklist to derive candidate siblings
- [ ] `/open-pr` Step 2 (T011) successfully parses the Child Issues checklist to enumerate siblings for bump classification
- [ ] The contract is unchanged between these three consumer call sites (same regex, same field order); any drift is flagged as a verify-code finding

### T013: Verify unattended-mode determinism across new gates

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`, `plugins/nmg-sdlc/skills/write-spec/SKILL.md`, `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
**Type**: Verify
**Depends**: T006, T010, T011
**Acceptance**:
- [ ] Every new `AskUserQuestion` call site added by T006, T010, T011 is preceded by an `.claude/unattended-mode` check
- [ ] Grep pattern `AskUserQuestion` across the three SKILL.md files shows zero unguarded new call sites (baseline set from pre-change blame)
- [ ] Each unattended-mode branch has a documented deterministic default matching AC8 (Epic classification → Feature; seal-spec trigger → auto-seal; epic-closure warning → escalate)

---

## Phase 5: Testing

### T014: Implement Jest unit tests for `selectNextIssueFromMilestone()`

**File(s)**: `scripts/__tests__/select-next-issue-from-milestone.test.mjs` (new)
**Type**: Create
**Depends**: T004, T005
**Acceptance**:
- [ ] Test: single ready issue with no deps → returns it
- [ ] Test: issue blocked by unmerged dep → blockedIssues populated, issue null (or next ready returned)
- [ ] Test: every issue blocked → blockedIssues contains all, returns `{ issue: null, ... }`
- [ ] Test: dependency outside current milestone → treated as satisfied (assumed merged external)
- [ ] Test: cyclic dependency graph (#A→#B→#A) → surfaces cycle in blockedIssues; runner does not infinite-loop
- [ ] Test: `gh` command is mocked — no real GitHub calls
- [ ] `cd scripts && npm test` exits 0

### T015: Implement Agent SDK exercise test for `/draft-issue` Epic branch

**File(s)**: `scripts/__tests__/exercise-draft-issue-epic.test.mjs` (new)
**Type**: Create
**Depends**: T006, T007, T008
**Acceptance**:
- [ ] Test scaffolds a disposable test project per `steering/tech.md` Test Project Pattern
- [ ] Test invokes `/nmg-sdlc:draft-issue` via Agent SDK with a multi-phase description
- [ ] `canUseTool` callback intercepts `AskUserQuestion` at Step 2 and selects "Epic"
- [ ] Dry-run evaluation: captured issue body matches Epic Issue Body Contract (all four sections present, correct column headers in Delivery Phases)
- [ ] Child-creation dry-run: captured child issue bodies each contain `Depends on: #{epic-placeholder}`
- [ ] Unattended mode variant: with `.claude/unattended-mode` present and no `Type: epic` signal in description, classifier picks Feature (not Epic)

### T016: Implement Agent SDK exercise test for `/write-spec` parent-link + seal-spec

**File(s)**: `scripts/__tests__/exercise-write-spec-epic.test.mjs` (new)
**Type**: Create
**Depends**: T009, T010
**Acceptance**:
- [ ] Scenario A (amendment): test project seeded with an epic issue + committed parent spec; run `/write-spec` on a child issue whose body has `Depends on: #{epic}`; verify child's content appended to the parent `specs/{feature}/` directory (Issues field appended, tasks.md phase added)
- [ ] Scenario B (loud failure): test project seeded with an epic issue but NO committed spec; run `/write-spec` on a child; verify abort with message matching `Parent spec for #N not found`
- [ ] Scenario C (keyword fallback): test project with no parent links; verify existing keyword-based discovery still runs
- [ ] Scenario D (cycle): test project with #A and #B both listing `Depends on:` each other; verify cycle-detection error naming both issues
- [ ] Scenario E (seal-spec idempotency): run seal twice; verify the second run prints `Spec already sealed at commit {sha}` and does NOT create a duplicate commit
- [ ] Scenario F (seal-spec bump guard): verify `git show HEAD --stat` after seal includes ONLY files under `specs/{feature-name}/` — no `plugin.json`, `marketplace.json`, `CHANGELOG.md`, `VERSION`

### T017: Implement Agent SDK exercise test for `/open-pr` sibling-aware bumping

**File(s)**: `scripts/__tests__/exercise-open-pr-epic.test.mjs` (new)
**Type**: Create
**Depends**: T011
**Acceptance**:
- [ ] Scenario A (intermediate): test project with epic #E having two open children; run `/open-pr` dry-run on the first child's branch; verify PR body contains `**Bump:** patch (epic child: intermediate)` and CHANGELOG dry-run includes `(partial delivery — see epic #E)`
- [ ] Scenario B (final): test project with epic #E where only the current child remains open (others merged); run `/open-pr` dry-run; verify PR body contains `**Bump:** minor (epic child: final)` and CHANGELOG has no partial-delivery note
- [ ] Scenario C (non-epic passthrough): test project with a standalone enhancement issue (no parent); run `/open-pr` dry-run; verify existing label-based classification fires unchanged (no epic classification line in PR body)
- [ ] Scenario D (race simulation): mock `git fetch` so the base is stale after bump-and-commit; verify rebase + re-bump path fires without force-push
- [ ] Scenario E (AC7a warning): parent epic marked CLOSED; run `/open-pr` on an open child; unattended mode exits non-zero with escalation; interactive mode prompts

---

## Dependency Graph

```
T001 ──────────────────────────────────────────────────▶ T015, T016, T017
T002 ──────────────────────────────────────────────────▶ (reference only)

T003 ──▶ T004 ──▶ T005 ──▶ T014

T006 ──▶ T007 ──▶ T008 ──┬──▶ T012
                         └──▶ T015

T009 ──┬──▶ T012
       └──▶ T016
T010 ──▶ T016

T011 ──┬──▶ T012
       ├──▶ T013
       └──▶ T017

T006 ──┬──▶ T013
T010 ──┤
T011 ──┘
```

**Critical path**: T003 → T004 → T005 → T014 (backend + unit tests, independent of skill changes).
**Longest skill chain**: T007 → T008 → T015 (draft-issue Epic end-to-end exercise).

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #149 | 2026-04-19 | Initial feature spec |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included for each layer (runner unit + three skill exercise tests)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
- [x] Skill edits are driven through `/skill-creator` per architectural invariant
