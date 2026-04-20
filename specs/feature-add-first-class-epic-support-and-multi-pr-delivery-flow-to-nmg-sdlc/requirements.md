# Requirements: First-Class Epic Support and Multi-PR Delivery Flow

**Issues**: #149
**Date**: 2026-04-19
**Status**: Draft
**Author**: Rich Nunley

---

## User Story

**As an** nmg-sdlc plugin maintainer (interactive) and as the SDLC runner (automated)
**I want** the SDLC to natively handle features that span multiple PRs — with first-class epic planning, a seal-spec flow, and child-issue-aware pipeline steps
**So that** I never have to improvise coordination structures on top of the pipeline when a feature's scope exceeds what one PR can safely deliver

---

## Background

The current pipeline assumes a strict 1:1:1 relationship: one GitHub issue → one spec directory → one branch → one PR. This breaks down in two legitimate ways:

1. **Discovery during spec writing** — `/write-spec` produces a design that calls for multiple PRs (e.g., additive infrastructure first, then pilot, then bulk rollout). There is no pipeline step for committing the umbrella spec and transitioning to child-issue work without opening a code PR or bumping the version.

2. **Intentional up-front epic planning** — a developer knows before writing any spec that a feature is too large for a single PR and wants to plan it as a coordinated set of issues from the start.

Today's workaround (observed in issue #138): write a spec that describes 4 PRs, manually convert the parent issue's body into a tracking checklist, run `/draft-issue` in batch mode to create children, then manually guide `/write-spec` on each child to amend the correct parent spec. None of these steps are SDLC-native.

See [issue #149](https://github.com/Nunley-Media-Group/nmg-plugins/issues/149) for full context.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Epic Classification and Auto-Detection in /draft-issue

**Given** a user description with cross-cutting signals (references to multiple delivery phases, "in phases", "multiple PRs", or `distinctComponents ≥ 4` with `sentenceCount ≥ 3`)
**When** `/draft-issue` reaches Step 2 (classification)
**Then** it offers "Epic" as a third option alongside Feature and Bug, with a one-line explanation: "A coordinated set of child issues delivering one logical feature across multiple PRs"
**And** when Epic is selected, the child-issue creation flow begins immediately within the same session (reusing the existing batch mechanism from Steps 1b–1d)
**And** in unattended mode, Epic is never auto-selected — the classifier defaults to Feature unless the issue description contains an explicit `Type: epic` declaration in a machine-parseable form, preventing a runner from misclassifying a borderline feature as an epic without human confirmation

### AC2: Epic Issue Body Format

**Given** an Epic classification selected in Step 2
**When** Step 6 synthesizes the issue body
**Then** the body uses the Epic coordination template with these sections in order:
- **Goal** — 1–3 sentences describing what this epic delivers when all children are done
- **Delivery Phases** — a table with columns `Phase | Child Issue | Depends On | Summary`, one row per planned PR
- **Success Criteria** — a one-line delegation note: "Each child issue owns its own acceptance criteria — this epic is a coordination document only"
- **Child Issues** — a GitHub task-list checklist (populated by Step 10 once children are created)
**And** no User Story, no implementation ACs, no FRs — the epic is a coordination document only
**And** the issue is labeled `epic` (created automatically if absent) in addition to `enhancement`

### AC3: Seal-Spec Flow

**Given** a `/write-spec` run that produces a design whose `design.md` contains either a `## Multi-PR Rollout` section OR an FR row whose Requirement text references "multiple PRs"
**When** the user approves the tasks in Phase 3
**Then** `/write-spec` offers a "Seal and transition" option that:
- Stages all files under `specs/{feature-name}/` and commits with message `docs: seal umbrella spec for #N`
- Pushes the current branch (no version bump, no CHANGELOG entry, no `plugin.json` or `marketplace.json` modification)
- Offers to create child issues using the `/draft-issue` batch mechanism from Steps 1b–1d
- Prints the next-step command `/start-issue #{child1}` for the first unblocked child
**And** if the user declines child-issue creation, the seal commit still happens and a manual next-step hint is printed
**And** re-running seal-spec on an already-sealed spec is a no-op that prints "Spec already sealed at commit {sha}" and does not create a duplicate commit
**And** in unattended mode, the seal-spec flow executes automatically whenever the multi-PR trigger is present, and child issues are created via the batch mechanism without prompting

### AC4: Child /write-spec Finds Parent Spec by Issue Link

**Given** a child issue whose body contains a `Depends on: #N` line, a `Blocks: #N` line, OR whose GitHub sub-issue parent field resolves to issue #N
**When** `/write-spec` runs on the child issue
**Then** it locates the parent spec directory by the following procedure, in this order:
1. Parse the child's body for `Depends on:` / `Blocks:` lines; collect candidate parent issue numbers
2. Query the GitHub sub-issue parent field via `gh issue view --json parent` and add it to the candidate list if non-null
3. Glob `specs/*/requirements.md` and read each file's `**Issues**` frontmatter field; match any candidate parent number against that list
4. If found: enter amendment mode against that spec (append the child issue number to the `**Issues**` field, add child-scoped tasks in a new phase, add a Change History entry)
**And** if the parent spec directory does not yet exist (not committed) but a candidate parent was found, the skill fails loudly with message: `Parent spec for #N not found — run '/write-spec #N' and seal the spec before starting child work`
**And** if no candidate parent is found in the child issue body or GitHub parent field, the skill falls back to the existing keyword-based spec discovery
**And** parent-link resolution uses cycle detection (a visited-set of issue numbers) so a pathological graph where #A depends on #B and #B depends on #A terminates with an error rather than looping

### AC5: Intermediate vs Final PR Versioning in /open-pr

**Given** a PR for a child issue that has one or more sibling issues (other issues sharing the same epic parent)
**When** `/open-pr` runs
**Then** it determines sibling state by:
1. Identifying the parent epic issue (via the child's `Depends on:` body link or GitHub parent field)
2. Listing all open issues that share that parent or are referenced in the parent's Child Issues checklist
3. Excluding the current issue from that list
**And** if all siblings are closed with merged PRs: apply a **minor** version bump (feature complete)
**And** if any sibling is still open or has no merged PR: apply a **patch** version bump (intermediate delivery)
**And** the CHANGELOG entry for intermediate PRs appends a note to the primary bullet: `(partial delivery — see epic #N)` where `#N` is the parent epic number
**And** the determined bump type is stored in the PR body under a `**Bump:** patch|minor (epic child: intermediate|final)` line so reviewers can verify the classification

### AC6: SDLC Runner Topological Ordering

**Given** an epic with child issues that have `Depends on:` body cross-refs, `Blocks:` body cross-refs, or native GitHub sub-issue links
**When** the SDLC runner selects the next issue to process from a milestone
**Then** it builds a dependency graph from all three signal types
**And** it processes a child issue only when every issue it `Depends on` has a merged PR (either `gh issue view --json state` is `CLOSED` AND `gh issue view --json closedByPullRequestsReferences` includes at least one merged PR, or the dependency is itself an epic whose own children are all merged)
**And** if a candidate issue is blocked, the runner emits a log line `[runner] skipping #N — blocked by unmerged dependencies: #A, #B` and moves to the next unblocked issue in the milestone queue
**And** if every open issue in the milestone is blocked (circular or broken graph), the runner exits with non-zero code and a diagnostic message naming every issue and its unresolved blockers
**And** when re-entering the runner after a crash or restart, dependency evaluation is re-derived from GitHub state (not cached in `sdlc-state.json`) so stale cache never causes a blocked issue to run prematurely

### AC7: Edge Cases Handled

Each scenario below must fail loudly with a specific, actionable message — no silent bad state, no partial writes, no infinite retry.

**AC7a: Parent epic closed before all children merge**
- **Given** an epic issue #E is closed on GitHub while one or more child issues remain open
- **When** `/open-pr` runs for a still-open child of #E
- **Then** the skill warns `Epic #E is closed but child #N is still open — confirm the epic was not closed prematurely` and prompts for confirmation before proceeding (in unattended mode, the runner escalates and exits without creating the PR)

**AC7b: Child PR merged out of topological order**
- **Given** child #B depends on #A per the epic's dependency graph
- **When** #B's PR is merged before #A's PR is merged (e.g., by an admin override)
- **Then** the next runner tick detects this via the pre-merge dependency check on `/open-pr` and logs a warning; subsequent children with `Depends on: #B` are permitted to proceed because #B's merge status is authoritative regardless of order

**AC7c: Child /write-spec run before parent spec is committed**
- **Given** a child issue whose `Depends on: #N` points to an epic whose spec directory has not been committed to the branch `/write-spec` is reading
- **When** `/write-spec` runs on the child
- **Then** it aborts with message `Parent spec for #N not found — run '/write-spec #N' and seal the spec before starting child work`, and does not create any spec files for the child

**AC7d: Two child PRs race to bump plugin.json**
- **Given** two child PRs are simultaneously open, both bumping `plugins/nmg-sdlc/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`
- **When** the second PR attempts to push after the first merges
- **Then** `/open-pr` detects the stale base via `git fetch origin && git merge-base --is-ancestor HEAD origin/main` returning non-zero after bump-and-commit, automatically rebases, re-computes the bump against the now-current version in `plugin.json`, and re-pushes; if rebase has conflicts in either version file, it escalates with a conflict message and does not force-push

### AC8: Unattended-Mode Determinism for New Gates

**Given** `.claude/unattended-mode` exists in the project directory
**When** any new interactive gate introduced by this feature is reached (Epic classification in `/draft-issue`, seal-spec flow in `/write-spec`, Epic-closure warning in `/open-pr`)
**Then** each gate has a documented deterministic default:
- Epic classification: never auto-selected — defaults to Feature unless explicit `Type: epic` signal
- Seal-spec flow: auto-executes when trigger conditions are met
- Epic-closure warning (AC7a): escalates via runner escalation sentinel and exits non-zero rather than auto-confirming
**And** no new gate calls `AskUserQuestion` without first checking for `.claude/unattended-mode`

---

### Generated Gherkin Preview

```gherkin
Feature: First-Class Epic Support and Multi-PR Delivery Flow
  As an nmg-sdlc maintainer and the SDLC runner
  I want native SDLC support for epics that span multiple PRs
  So that I never have to improvise coordination on top of the pipeline

  Scenario: Epic classification offered when multi-phase signals detected
    Given a user description containing "in phases" or references to multiple delivery PRs
    When /draft-issue reaches classification
    Then Epic is offered as a third option alongside Feature and Bug

  Scenario: Epic body uses coordination template
    Given Epic is selected in classification
    When the issue body is synthesized
    Then it contains Goal, Delivery Phases table, delegated Success Criteria, Child Issues checklist
    And no User Story, ACs, or FRs are present

  Scenario: Seal-spec commits the umbrella spec without version bump
    Given /write-spec produces a design calling for multiple PRs
    When the user approves the tasks in Phase 3
    Then "Seal and transition" commits specs/{feature}/ with message "docs: seal umbrella spec for #N"
    And no version bump or CHANGELOG entry is created

  Scenario: Child /write-spec resolves parent via issue link
    Given a child issue whose body contains "Depends on: #N" and N has a committed spec
    When /write-spec runs on the child
    Then the child's content is appended to specs/{parent-feature}/ as an amendment

  Scenario: Parent spec missing fails loudly on child write-spec
    Given a child issue whose "Depends on: #N" resolves to an uncommitted parent spec
    When /write-spec runs on the child
    Then it aborts with a message naming #N and the required fix

  Scenario: Intermediate PR gets patch bump
    Given a child PR whose sibling issues are still open
    When /open-pr runs
    Then a patch bump is applied and the CHANGELOG entry includes "(partial delivery — see epic #N)"

  Scenario: Final PR in series gets minor bump
    Given a child PR whose sibling issues are all closed with merged PRs
    When /open-pr runs
    Then a minor bump is applied and no partial-delivery note appears

  Scenario: Runner skips blocked children
    Given child #B depends on #A and #A's PR is not yet merged
    When the runner selects the next issue to process
    Then #B is skipped with a log line naming its blockers and the next unblocked issue is processed

  Scenario: Runner exits when every issue is blocked
    Given every open issue in the milestone has unmerged dependencies
    When the runner attempts to select the next issue
    Then it exits non-zero with a diagnostic listing every blocked issue and blocker

  Scenario: Parent-link cycle detected
    Given issue #A's body lists "Depends on: #B" and issue #B's body lists "Depends on: #A"
    When /write-spec runs on either
    Then parent resolution terminates with a cycle-detected error naming both issues

  Scenario: Unattended-mode defaults are deterministic
    Given .claude/unattended-mode exists
    When any new gate is reached (Epic classification, seal-spec, epic-closure warning)
    Then the documented default fires without invoking AskUserQuestion
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Add "Epic" as a third classification in `/draft-issue` Step 2, with auto-detection heuristic and explicit `Type: epic` unattended-mode signal | Must | Builds on existing Feature/Bug classifier |
| FR2 | Implement the Epic body template in `/draft-issue` Step 6 (Goal, Delivery Phases table, delegated Success Criteria, Child Issues checklist) and apply the `epic` label | Must | New template file in `draft-issue/templates/` |
| FR3 | Add the seal-spec flow at the end of `/write-spec` Phase 3 when the design calls for multiple PRs | Must | Inline in `/write-spec` — no new skill |
| FR4 | Modify `/write-spec` spec discovery to resolve parent spec by issue link (body cross-refs + GitHub parent field) before falling back to keyword search | Must | Must include cycle detection |
| FR5 | Modify `/open-pr` to check sibling issue states and apply patch vs minor bump accordingly; add partial-delivery CHANGELOG note; record classification in PR body | Should | Reuses existing version-bump logic |
| FR6 | Modify `sdlc-runner.mjs` to build a topological queue from child-issue dependency links and skip blocked issues; derive graph fresh each tick | Could | Must not cache graph in `sdlc-state.json` |
| FR7 | Add explicit error handling for all four AC7 edge cases with specific, actionable messages | Must | No silent failures, no partial writes |
| FR8 | Every new gate (Epic classification, seal-spec flow, epic-closure warning) has a documented deterministic unattended-mode default | Must | Guards every `AskUserQuestion` with `.claude/unattended-mode` check |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Parent-link resolution in `/write-spec` must complete in under 5 seconds for epics with up to 20 children (bounded by number of `gh issue view` calls; cache per-run) |
| **Cross-Platform** | All new shell commands POSIX-compatible; Node.js code uses `node:path`; no Bash-specific syntax (see `steering/tech.md`) |
| **Reliability** | `/open-pr` race detection (AC7d) must be idempotent — re-running after a failed push must not double-bump |
| **Security** | No secrets introduced; all GitHub writes go through `gh` CLI with existing auth |
| **Stack-Agnosticism** | Epic/child concepts must be described in skill prompts without leaking into steering templates; the feature belongs to nmg-sdlc skills only, not to projects adopting the pipeline |

---

## Dependencies

### Internal Dependencies
- [ ] Existing `/draft-issue` Steps 1b–1d batch-creation mechanism (reused for epic child creation)
- [ ] Existing `/write-spec` spec-discovery (extended, not replaced)
- [ ] Existing `/open-pr` version-bump classification in `steering/tech.md`
- [ ] Existing `sdlc-runner.mjs` milestone-pool selection logic

### External Dependencies
- [ ] GitHub sub-issue parent field (`gh issue view --json parent`) — requires `gh` CLI version that supports sub-issues
- [ ] GitHub `closedByPullRequestsReferences` JSON field — standard in current `gh` CLI

### Blocked By
- None

---

## Out of Scope

- UI dashboard for epic progress visualization
- Multi-repo or cross-organization epics
- Changes to `retrospective`, `onboard-project`, `upgrade-project`, `run-retro` skills
- Changes to unattended-mode semantics (existing `.claude/unattended-mode` file contract is unchanged)
- New slash commands beyond what FR3 requires (seal-spec is implemented inline in `/write-spec`; may be extracted to `/seal-spec` during design if warranted, but the default is inline)
- Automatic rollback of an already-sealed umbrella spec (once committed, sealing is one-way)
- Migration of existing multi-PR features that pre-date this change (issue #138 stays in its current shape)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Epic pipeline completeness | All four pipeline steps (`/draft-issue`, `/write-spec`, `/open-pr`, runner) handle epics natively | Exercise against a synthetic 2-child epic; no manual coordination required |
| Parent-spec resolution accuracy | 100% of child issues with valid `Depends on:` links resolve to the correct parent spec | Exercise with 3 test scenarios: single parent, multiple candidates, no parent |
| Unattended-mode determinism | Zero `AskUserQuestion` prompts fire during unattended runs of the new gates | Exercise each new gate with `.claude/unattended-mode` present; grep logs for `AskUserQuestion` |
| CHANGELOG correctness | Intermediate PRs carry the partial-delivery note; final PR closes the epic cleanly | Manual review of the first real epic shipped with this feature |

---

## Open Questions

- [ ] Should seal-spec eventually be extracted to a standalone `/seal-spec` skill for reuse outside the `/write-spec` flow? (Design phase decision)
- [ ] For AC6 topological ordering, should the runner treat an epic itself as processable (running an empty `/write-code` pass to close it) or skip epics entirely in the milestone queue? (Design phase decision)
- [ ] AC5 sibling detection: when an epic has children across multiple milestones, does sibling state look at all children or only those in the same milestone as the current PR? (Design phase decision — default assumption is all children of the epic regardless of milestone)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #149 | 2026-04-19 | Initial feature spec |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements (design phase covers that)
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC7 + AC8)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (3 design-phase questions)
