# Tasks: Relocate specs and steering out of `.claude/`

**Issues**: #121
**Date**: 2026-04-18
**Status**: Planning
**Author**: Rich Nunley

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Sweep `specs/` and `steering/` references → root-level paths | [ ] |
| T002 | Rename skill `migrate-project` → `upgrade-project` + extend for legacy-layout relocation | [ ] |
| T003 | Add legacy-layout hard gate to `/start-issue` + precondition checks to pipeline skills | [ ] |
| T004 | Bump plugin version to 1.42.0, update README + CHANGELOG + in-repo steering docs | [ ] |
| T005 | Add regression Gherkin scenarios | [ ] |
| T006 | Verify no regressions — exercise full pipeline + AC5 grep check | [ ] |

Although this is a defect, the fix touches 20+ files across skills, templates, manifests, and docs. The scope exceeds a standard 2–4-task defect breakdown, so per the skill's complexity escape hatch we use six focused tasks. Each remains narrowly scoped to a single concern.

---

### T001: Sweep All `specs/` and `steering/` Path References

**File(s)**:
- `plugins/nmg-sdlc/skills/{draft-issue,open-pr,setup-steering,start-issue,verify-code,write-code,write-spec,run-retro}/SKILL.md`
- `plugins/nmg-sdlc/skills/setup-steering/templates/{product,tech,structure}.md`
- `plugins/nmg-sdlc/skills/write-spec/templates/{requirements,tasks,feature.gherkin}`
- `plugins/nmg-sdlc/skills/run-retro/templates/retrospective.md`
- `plugins/nmg-sdlc/skills/verify-code/references/exercise-testing.md`
- `plugins/nmg-sdlc/agents/spec-implementer.md`

**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Every occurrence of `specs/` in the listed files is replaced with `specs/`
- [ ] Every occurrence of `steering/` in the listed files is replaced with `steering/`
- [ ] Exceptions: references inside `upgrade-project` that intentionally name the legacy path for detection purposes (T002) are preserved with a clear comment
- [ ] `grep -r "\.claude/specs\|\.claude/steering" plugins/nmg-sdlc/skills/` returns only references inside `upgrade-project` detection logic
- [ ] Skill content is otherwise unchanged — no behavior edits in this task

**Notes**: Start from the file list produced by `grep -rn "\.claude/\(specs\|steering\)" plugins/nmg-sdlc/`. This is a mechanical find-and-replace. Do not touch runtime-artifact references (`.claude/unattended-mode`, `.claude/sdlc-state.json`, `.claude/migration-exclusions.json`) — those move in T002 only for the exclusions file.

---

### T002: Rename `migrate-project` → `upgrade-project` and Extend for Legacy-Layout Relocation

**File(s)**:
- `plugins/nmg-sdlc/skills/migrate-project/` → `plugins/nmg-sdlc/skills/upgrade-project/` (`git mv`)
- `plugins/nmg-sdlc/skills/upgrade-project/SKILL.md` — frontmatter `name`, description, workflow body
- `plugins/nmg-sdlc/skills/upgrade-project/references/migration-procedures.md` → `upgrade-procedures.md` (`git mv`)
- Every cross-reference across other skills, README, CHANGELOG, plugin manifest that mentions `migrate-project` / `/migrate-project` / `migration-exclusions.json`

**Type**: Modify (directory + file rename + content edits)
**Depends**: T001
**Acceptance**:
- [ ] Skill directory is renamed via `git mv` (preserves history)
- [ ] SKILL.md frontmatter `name: upgrade-project`; description, heading, body, and invocation examples all use `/upgrade-project`
- [ ] Skill contains a new workflow branch that:
  - Detects when `steering/` or `specs/` exists with content
  - Uses `git mv` to move them to `steering/` and `specs/` at project root
  - Rewrites every `specs/` and `steering/` reference inside the moved files to the new paths
  - Removes the now-empty `steering/` and `specs/` directories
  - Does NOT touch `.claude/unattended-mode` or `.claude/sdlc-state.json`
- [ ] `.claude/migration-exclusions.json` read path is renamed to `.claude/upgrade-exclusions.json`
- [ ] On first run, the skill detects an existing `migration-exclusions.json` and migrates it to `upgrade-exclusions.json` (single `git mv` + commit)
- [ ] Every other skill's references to `migrate-project` / `/migrate-project` point to `upgrade-project` / `/upgrade-project`
- [ ] (FR12, Could) A deprecation stub at `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` prints "renamed to /upgrade-project — run that instead" and exits; marked for removal in the next minor release
- [ ] No regressions in existing upgrade behavior (template drift detection, spec directory consolidation, etc.)

**Notes**: Before renaming, snapshot the existing SKILL.md so the legacy-layout branch can be added atomically with the rename. The rewriting of cross-references inside moved files must handle the `**Related Spec**` field and any in-body `specs/` mentions.

---

### T003: Add Legacy-Layout Hard Gate to `/start-issue` and Precondition Checks to Pipeline Skills

**File(s)**:
- `plugins/nmg-sdlc/skills/start-issue/SKILL.md` (primary gate)
- `plugins/nmg-sdlc/skills/{write-spec,write-code,verify-code,open-pr,run-retro,draft-issue,setup-steering}/SKILL.md` (precondition checks)

**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] `/start-issue` Step 0 (or prerequisites) contains a check: "If `steering/` or `specs/` exists with content, exit with an instructive message directing the user to run `/upgrade-project` — include the exact command"
- [ ] The gate exits WITHOUT creating a branch or modifying issue status
- [ ] Every other pipeline skill includes the same preconditional check at its entry point, worded identically for consistency
- [ ] The instructive message names `/upgrade-project` (not `/migrate-project`) and references the relocation as the reason
- [ ] `/setup-steering` bootstrap path: if `steering/` exists with content, the skill instructs the user to run `/upgrade-project` first (rather than writing to the new location alongside stale old docs)
- [ ] Unattended-mode: the gate still fires (automation on a legacy-layout project should halt, not silently write to mixed locations)

**Notes**: Define the instructive message as a short reusable paragraph and copy-paste it into each skill, or document it in one skill and cross-link. Prefer repetition over cross-links to keep each skill self-contained.

---

### T004: Bump Version to 1.42.0 + Update README + CHANGELOG + In-Repo Steering

**File(s)**:
- `plugins/nmg-sdlc/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `README.md`
- `CHANGELOG.md`
- `steering/{product,tech,structure}.md` (this repo — still under `.claude/` until this repo is self-upgraded in T006)
- `scripts/sdlc-runner.mjs`, `scripts/__tests__/sdlc-runner.test.mjs` (audit for path refs)

**Type**: Modify
**Depends**: T001, T002, T003
**Acceptance**:
- [ ] `plugins/nmg-sdlc/.claude-plugin/plugin.json` version = `1.42.0`
- [ ] `.claude-plugin/marketplace.json` plugin entry version = `1.42.0` (marketplace `metadata.version` unchanged)
- [ ] `README.md`: all three `.claude/specs` / `.claude/steering` references updated; every `/migrate-project` mention replaced with `/upgrade-project`; "Installation" and "Workflow" sections describe the new paths
- [ ] `CHANGELOG.md` has an `## [Unreleased]` entry documenting: (a) breaking directory convention change with migration command, (b) `/migrate-project` → `/upgrade-project` rename, (c) `migration-exclusions.json` → `upgrade-exclusions.json` rename
- [ ] In-repo steering docs (`steering/{product,tech,structure}.md`) updated to describe the NEW canonical locations (`steering/`, `specs/`) — even though these files themselves still live at `steering/` until T006 runs the upgrade on this repo
- [ ] `scripts/sdlc-runner.mjs` and its tests: any path ref to `.claude/specs` or `.claude/steering` updated; any reference to `migration-exclusions.json` updated to `upgrade-exclusions.json` (if present)
- [ ] All runner tests still pass (`npm test` in `scripts/`)

**Notes**: Keep the version bump to this single commit so revert is clean. Follow conventional commit style — this commit will be marked `feat!:` when committed.

---

### T005: Add Regression Gherkin Scenarios

**File(s)**: `specs/bug-relocate-specs-and-steering/feature.gherkin`

**Type**: Create
**Depends**: T001, T002, T003
**Acceptance**:
- [ ] Gherkin scenarios cover all 7 ACs from `requirements.md`
- [ ] Every scenario is tagged `@regression`
- [ ] Scenario for AC1 uses concrete paths (`steering/product.md`, `specs/`) — not placeholders
- [ ] Scenario for AC2 exercises `git mv` expectations and the "runtime artifacts left untouched" invariant
- [ ] Scenario for AC3 uses `/start-issue` as the gate example and asserts the instructive message contains `/upgrade-project`
- [ ] Scenario for AC7 exercises the full pipeline end-to-end (no `--dangerously-skip-permissions`)

---

### T006: Verify No Regressions — Exercise Full Pipeline + AC5 Grep Check + Self-Upgrade

**File(s)**: N/A (verification-only)

**Type**: Verify
**Depends**: T001, T002, T003, T004, T005
**Acceptance**:
- [ ] `grep -r "\.claude/specs\|\.claude/steering" plugins/nmg-sdlc/skills/` returns only references inside `upgrade-project` detection logic (AC5)
- [ ] Exercise the upgrade in a disposable test project seeded with `steering/` + `specs/`: all files move to project root via `git mv`, cross-references updated, directories removed, runtime artifacts untouched (AC2)
- [ ] Exercise `/start-issue` on the same test project BEFORE upgrade: skill refuses with the instructive `/upgrade-project` message (AC3)
- [ ] Exercise `/setup-steering` in a fresh project: all files written to `steering/` + `specs/` at project root, nothing under `.claude/` (AC1)
- [ ] Exercise the full SDLC pipeline (`/draft-issue` → `/start-issue` → `/write-spec` → `/write-code` → `/verify-code` → `/open-pr`) on a fresh project without `--dangerously-skip-permissions` — all steps succeed (AC7)
- [ ] Run `/upgrade-project` on THIS repo (dogfooding per FR11) — `steering/` → `steering/`, `specs/` → `specs/`, `.claude/migration-exclusions.json` → `.claude/upgrade-exclusions.json` (if present)
- [ ] All existing runner tests pass (`npm test` in `scripts/`)

**Notes**: T006 dogfoods the change on this repo as the final step. Do NOT run the self-upgrade until the disposable test-project exercises pass, to avoid getting stuck in an inconsistent state on the repo that contains the fix.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #121 | 2026-04-18 | Initial task breakdown for directory relocation + skill rename |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T005)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
