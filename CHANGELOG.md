# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed

- **SDLC runner no longer false-positives on "permission denied" substring** (issue #133) — removed the duplicate `/permission denied/i` regex from `IMMEDIATE_ESCALATION_PATTERNS` in `scripts/sdlc-runner.mjs`. The structured `permission_denials` array from the stream-json `result` event (inspected by `detectSoftFailure` with `BENIGN_DENIED_TOOLS` and ephemeral-tmpdir filtering) is now the single authoritative signal for permission-denial escalation. Motivated by agentchrome issue #181, where the literal phrase appeared in a tool-result payload with `permission_denials: []` and hard-escalated a successful verify step into a bounce-loop exit. Regression tests added in `scripts/__tests__/sdlc-runner.test.mjs` pin both directions (phrase ignored; real non-benign denial still escalates via soft-failure).

## [8.1.0] - 2026-04-18

### Added

- **`/open-pr` interactive CI monitor + auto-merge** (issue #128) — after PR creation in interactive mode, the skill now offers an opt-in Step 7 that mirrors the unattended runner's semantics: `AskUserQuestion` prompts the user with "Yes, monitor CI and auto-merge" / "No, I'll handle it". On opt-in, the skill polls `gh pr checks <num> --json name,state,link` every 30 seconds (`sleep 30` via `Bash(sleep:*)`) up to 30 minutes / 60 polls, matching `scripts/sdlc-runner.mjs` line 937. Pre-merge `gh pr view --json mergeable,mergeStateStatus` check guards against non-`CLEAN` states. On all-success + `CLEAN`: captures branch name via `git rev-parse --abbrev-ref HEAD`, then runs `gh pr merge <num> --squash --delete-branch`, `git checkout main`, and `git branch -D <branch>`, printing `Merged and cleaned up — you are back on main.`. Terminal failures (`FAILURE`, `CANCELLED`, `TIMED_OUT`), non-`CLEAN` mergeability, and polling timeout print each failing check's name + details URL and exit without merging or deleting the branch. `No CI configured — skipping auto-merge.` is printed when `gh pr checks` returns an empty JSON array (graceful-skip per retrospective learning on absent integrations). Opt-out reuses the existing "Next step: Wait for CI to pass…" guidance unchanged. When `.claude/unattended-mode` exists, Step 7 is actively suppressed — the skill MUST NOT prompt, poll, or merge — preserving runner ownership of CI monitoring and merging.

## [8.0.0] - 2026-04-18

### Changed

- **SDLC runner + skill defaults re-tuned for the current Claude Code lineup** (issue #130) — `scripts/sdlc-config.example.json` now pins an explicit `model` / `maxTurns` / `timeoutMin` (and `effort` for non-Haiku steps) on every step, with Opus hard-capped to `writeSpecs`, `implement`, and `verify`. Mechanical steps (`startCycle`, `commitPush`, `merge`) drop to Haiku; `startIssue` / `createPR` / `monitorCI` run on Sonnet at tier-appropriate effort. The runner's `VALID_EFFORTS` gains `xhigh`; `max` is explicitly rejected with a policy message; `effort` on a Haiku step (step-level or inherited from global) is rejected at config load. The fallback for both `resolveStepConfig()` and module-level `MODEL`/`EFFORT` flips from `opus` / `undefined` to `sonnet` / `medium` so configs that omit fields produce a cost-aware baseline. All SDLC pipeline skills (`draft-issue`, `start-issue`, `write-spec`, `write-code`, `verify-code`, `open-pr`, `run-retro`, `init-config`, `run-loop`, `upgrade-project`) declare matching `model:` and (for Opus/Sonnet) `effort:` frontmatter, honored under interactive invocation. Run `/upgrade-project` to review the diff against existing configs. See README → *Model & Effort Configuration* for the precedence chain and the full defaults table.

- **Blanket `maxTurns` floor bump** (issue #130 addendum, motivated by incident #181) — per-step turn budgets raised to conservative floors: `startCycle` 5→10, `startIssue` 15→25, `writeSpecs` 40→60, `implement` 100→150, `verify` 60→100, `commitPush` 10→15, `createPR` 30→45, `monitorCI` 40→60, `merge` 5→10. Incident #181 surfaced that `verify` exhausted 60 turns at 819s (well inside its 20-min timeout) — turns, not wall-clock, was the binding constraint. `timeoutMin` values are unchanged this round; future telemetry may warrant time-axis adjustments.

## [7.4.0] - 2026-04-18

### Changed

- **`/start-issue` dependency-aware selection** (issue #127) — added Step 1a "Dependency Resolution" between issue fetch and selection presentation. Issues with any open declared dependency (via GitHub native sub-issue/tracked-by links or `Depends on: #X` / `Blocks: #Y` body cross-refs) are filtered out; the remainder is topologically sorted using Kahn's algorithm with issue-number ascending tie-breaking. Cycles are handled gracefully (warning + tail placement, no abort). The filter and sort apply in both interactive and unattended mode; unattended auto-select now picks the first unblocked `automatable` issue in topological order. A `Filtered N blocked issues from selection.` session note is emitted before every selection (including when N=0). Fallback chain: GraphQL batch failure → body-only fetch; body failure → skip resolution entirely.

## [7.3.0] - 2026-04-18

### Added

- **`/draft-issue` multi-issue pipeline** (issue #125) — the skill can now detect multi-part asks in the initial prompt and loop through its existing Steps 2–9 per planned issue. New Step 1b runs a heuristic over the description (conjunction markers, bullet/numbered lists, distinct component mentions) and proposes a split with per-ask summaries and a `high`/`medium`/`low` confidence indicator, or exits with a `"single-issue detected"` trail note. A split-confirm menu (`[1] Approve`, `[2] Adjust (merge/re-divide)`, `[3] Collapse`) lets the user recover from false-positive splits. New Step 1d infers a dependency DAG from explicit cues, shared-component precursor language, and AC/FR scope overlap, then presents a graph-confirm menu (`[1] Approve`, `[2] Adjust edges`, `[3] Flatten`). Drafting only begins after both gates are confirmed. Each iteration retains an independent `DraftState` (classification, milestone, investigation, interview, review loop); only `session.productContext`, `session.designContext`, and `session.dag` cross iteration boundaries. A new Step 7 review-gate option `[Abandon]` (visible only mid-batch) lets the user stop cleanly; already-created issues are preserved with no rollback.

- **`/draft-issue` autolinking** (issue #125) — after the per-issue loop, Step 10 probes `gh issue edit --help` once per batch for `--add-sub-issue` support and wires each parent/child edge in the confirmed DAG via `gh issue edit <child> --add-sub-issue <parent>`. Body cross-refs (`Depends on: #X, #Y` / `Blocks: #Z`) are written **unconditionally** via a body rewrite — independent of the probe result — so dependency information is readable even when the `gh` flag is unavailable or per-edge sub-issue calls fail. Placeholders for uncreated issues (partial-batch abandonment) are replaced with `"(planned but not created)"`. A Step 11 batch summary reports `"Created N of M planned issues"` with URLs, autolinking counts, and any degradation notes.

- **`/draft-issue` Claude Design URL ingestion** (issue #125) — the skill accepts an optional Claude Design URL (auto-detected in the argument or elicited once in Step 1). Step 1a reuses the `/onboard-project` §2G.1 fetch/decode helper (HTTPS-validated, 15s timeout, `node:zlib.gunzipSync`-based gzip decode, README parse) and caches the parsed content as `session.designContext`. The design context is shared read-only across every per-issue Step 4 investigation, Step 5 interview, and Step 6 synthesis in the batch — letting the skill reference design components as pre-known context rather than re-eliciting them, and citing the design URL in Background / Current State sections when applicable. Fetch/decode failures (HTTP error, timeout, non-gzip payload, missing README) are logged as visible session notes and recorded in the Step 11 summary; the session continues without design context rather than aborting.

### Changed

- `/draft-issue` argument hint updated to `"[brief description of the need] [optional Claude Design URL]"`.

## [7.2.0] - 2026-04-18

### Added

- **`/onboard-project` greenfield enhancement** (issue #124) — Step 2G now runs a seven-sub-step orchestration: optional Claude Design URL ingestion (HTTPS-validated, gzip-decoded via `node:zlib.gunzipSync`), multi-round intent + tech-selection interview (vision, personas, success criteria, language, framework, test tooling, deployment target), absorbed steering bootstrap/enhancement, idempotent `v1 (MVP)` and `v2` GitHub milestone seeding via `gh api`, 3–7 starter-issue candidate generation, dependency DAG inference with cycle detection and a confirmation gate, and a starter-issue seeding loop that delegates to `/draft-issue` once per candidate with autolinking via the Issue #125 primitive (`gh issue edit --add-sub-issue` plus `Depends on:`/`Blocks:` body lines). Re-running on a project that already has steering enters **Greenfield-Enhancement mode**: steering files are edited in place rather than overwritten, milestones/issues already seeded (detected via `seeded-by-onboard` label) are skipped, and existing dependency links are preserved. New tools added to `allowed-tools`: `WebFetch`, `Bash(node:*)`. New argument: `--design-url <url>`. Step 5 summary extended to include design fetch result, interview defaults with their source, milestone outcomes, the full DAG, and per-issue seed results. All failure modes (design fetch, milestone create, DAG cycle, per-issue seed) degrade gracefully — recorded as gaps without aborting the run.

### Removed

- **Standalone `/setup-steering` skill** (issue #124) — absorbed into `/onboard-project`'s Step 2G.3. The `plugins/nmg-sdlc/skills/setup-steering/` directory has been removed; templates relocated to `plugins/nmg-sdlc/skills/onboard-project/templates/`. All references in `/upgrade-project` and `/write-spec` rewritten to point at `/onboard-project`. This maintains the "one skill = one SDLC step" invariant — `/onboard-project` is now the sole entry point for project initialization (greenfield, greenfield-enhancement, brownfield, or already-initialized).

## [7.1.0] - 2026-04-18

### Added

- **`/end-loop`** — New skill to cleanly disable unattended mode (issue #122). Explicit counterpart to `/run-loop`: sends SIGTERM to the runner PID recorded in `.claude/sdlc-state.json` (if the process is live), then removes both `.claude/unattended-mode` and `.claude/sdlc-state.json`. Idempotent — re-invocation on an already-disabled project reports "already disabled" and exits 0. Handles edge cases robustly: missing `.claude/` directory, malformed state JSON (treated as opaque and still deleted), dead runner PIDs (signalling skipped silently), and SIGTERM failures (surfaced with the PID and OS reason, deletion continues). Permission-denied on a required deletion exits non-zero with a specific-file error. Validates `runnerPid` as a positive integer before passing to `process.kill` to prevent signalling arbitrary processes or process groups.

## [7.0.0] - 2026-04-18

### Added

- **`/onboard-project`** — New skill for greenfield bootstrap and brownfield spec reconciliation (issue #115). Detects whether a project is greenfield (no code, no specs), brownfield (existing code and closed issues but no specs), or already-initialized, then routes work: delegates to `/setup-steering` for steering docs, optionally to `/init-config` for runner config, and to `/upgrade-project` for already-initialized projects. For brownfield, synthesizes one `specs/{feature,bug}-{slug}/` directory per closed issue — or per consolidated group — using `/write-spec`'s templates read at runtime, with evidence gathered in order from issue body, merged PR body, PR diff, commit messages, and the current implementation. Degrades gracefully when a closed issue has no merged PR (emits spec with `## Known Gaps` section). Honors `.claude/unattended-mode` by auto-accepting consolidation groups and defaults, and logs every auto-decision in the final summary. Supports `--dry-run` to preview without writing files. Post-reconciliation verification confirms each produced spec directory has all four artifact files and flags any referenced source files that no longer exist in the working tree. Pipeline position: runs once per project lifetime, before `/draft-issue`. Plugin version bumped **major** (6.1.0 → 7.0.0) — issue #115 was the last open issue in milestone v5, triggering the milestone-completion major-bump override from `tech.md`.

## [6.1.0] - 2026-04-18

### Changed (BREAKING)

- **Relocated canonical SDLC artifacts out of `.claude/`** (issue #121) — current Claude Code releases protect the project-level `.claude/` directory from Edit/Write even under `--dangerously-skip-permissions`, which silently broke every SDLC skill that authored files under `.claude/steering/` or `.claude/specs/`. Canonical locations moved to `steering/` and `specs/` at the project root. Runtime artifacts (`.claude/unattended-mode`, `.claude/sdlc-state.json`) remain unchanged — they are read/written by the SDLC runner directly and are not affected by the tool-layer protection.

  **Migration:** Existing projects must run `/upgrade-project` once to `git mv` the legacy directories into place, rewrite intra-file cross-references, and rename `.claude/migration-exclusions.json` → `.claude/upgrade-exclusions.json`. Every pipeline skill (`/start-issue`, `/write-spec`, `/write-code`, `/verify-code`, `/open-pr`, `/run-retro`, `/draft-issue`, `/setup-steering`) hard-gates on the legacy layout and refuses to proceed until the upgrade runs.

- **Renamed `/migrate-project` → `/upgrade-project`** (issue #121) — the old name described a narrow "migrate artifacts" action; the skill's actual job is to bring a project forward to match the current plugin contract. The renamed skill now also handles the new legacy-layout relocation (see above). A deprecation stub remains at `/migrate-project` that points to `/upgrade-project` and exits; it will be removed in the next minor release.

- **Renamed `.claude/migration-exclusions.json` → `.claude/upgrade-exclusions.json`** (issue #121) — naming consistency with the renamed skill. `/upgrade-project` auto-migrates the existing file on first run via `git mv`, preserving declined-section data. The schema is unchanged.

## [6.0.0] - 2026-04-18

### Changed (BREAKING)

- **`/draft-issue` no longer honors `.claude/unattended-mode`** (issue #116) — issue drafting is intrinsically a human-judgment activity and shipping an unattended path was a miscalibration. The top-level "Unattended Mode" section and every per-step `> Unattended-mode: ...` blockquote have been removed from the skill; the skill no longer reads or acts on the flag file. A single sign-post sentence replaces the section so users scrolling for the old behavior are explicitly redirected. The SDLC runner's `STEP_KEYS` array already excluded `draftIssue` and now carries an in-file comment and a regression test to prevent re-introduction. The plugin version is bumped **major** (5.2.0 → 6.0.0) because this changes observable behavior for any user who previously relied on `.claude/unattended-mode` in `/draft-issue`.

  **Migration:** If your workflow created issues via `/draft-issue` under `.claude/unattended-mode`, switch to invoking `/draft-issue` interactively. Downstream skills (`/write-spec`, `/write-code`, `/verify-code`, `/open-pr`) continue to honor `.claude/unattended-mode` unchanged.

### Added

- **`/draft-issue` readability treatment** (issue #116) — brought the skill to parity with `/write-spec` on review-gate UX. Step 7 now renders a structured inline summary of the drafted issue (Title, User Story one-liner, numbered ACs with one-line G/W/T, FRs with MoSCoW priorities, Out of Scope, Labels) followed by an `AskUserQuestion` menu with two options: `[1] Approve — create the issue` / `[2] Revise — I'll describe what to change`. Revise iterations replace the draft wholesale and loop until approval. A Workflow Overview ASCII diagram opens the skill, every workflow step is restructured with explicit `#### Input` / `#### Process` / `#### Output` subsections (plus `#### Human Review Gate` on Steps 5c and 7), and a feature-vs-bug template comparison table appears near Step 6.

- **`/draft-issue` deeper interview** (issue #116) — the interview now probes non-functional requirements, edge cases, and related-feature consistency for Features, and adds an edge-case / regression-risk round to the Bug path. A new **Step 5c: Playback and Confirm** forces the skill to play back its understanding of persona / outcome / AC outline / scope before drafting; the skill does not synthesize the issue body until the user confirms. Playback length is depth-proportional (one-line for core, full structured block for extended). Step 5 selects interview depth (core vs extended) from Step 4 signals (`filesFound`, `componentsInvolved`, `descriptionVagueness`) and logs the decision to the user; borderline signals bias toward the extended interview. The user can override the heuristic's pick via `AskUserQuestion` immediately after the log, with the override recorded as a one-line session note for future threshold tuning. Every final round ends with a free-text `"Anything I missed?"` probe before Step 5c. Step 5b's automatable-label question now includes a 1–2 line prefix explaining that the label controls downstream skills (not `/draft-issue` itself).

- **`/draft-issue` Step 7 soft guard** (issue #116) — on the 4th consecutive `[2] Revise` selection, the menu expands to three options: `[1] Keep revising`, `[2] Reset and re-interview` (returns to Step 5 with classification and milestone preserved), `[3] Accept as-is` (proceeds to issue creation). The skill does not auto-terminate the loop; the user remains in control.

## [5.2.0] - 2026-04-17

### Changed

- **Renamed `.claude/auto-mode` to `.claude/unattended-mode` plugin-wide** (issue #118) — Claude Code v2.1.83 introduced a native "Auto Mode" permission feature that injects an "Auto mode is active" system-reminder into the model context, creating a lexical overlap with the plugin's own headless-execution flag. Renaming the plugin's flag to `.claude/unattended-mode` (a well-established sysadmin term for non-interactive execution) eliminates the overlap and makes the two conditions independently addressable. No behavior change — the flag continues to signal headless operation to all SDLC skills; only the path string changes.

  **Migration:** If you previously created `.claude/auto-mode` manually to enable headless mode, rename or recreate it as `.claude/unattended-mode`. Users who run the pipeline only via `/run-loop` or `sdlc-runner.mjs` do not need to take action — the runner creates and removes the flag automatically.

## [5.1.0] - 2026-04-16

### Changed

- Rewrote ~40 historical specs in `.claude/specs/` to remove stale references to OpenClaw integration (removed in v4.1.0) and Discord posting, replace `openclaw/scripts/` paths with `scripts/`, drop references to the renamed/removed `generating-openclaw-config` and `installing-openclaw-skill` skills, resolve dangling `feature-openclaw-runner-operations` cross-references, and align automatic-major-bump descriptions with the v4.3.0 manual-only behavior
- Removed the legacy `postDiscord()` pass-through from `scripts/sdlc-runner.mjs`; status notifications now go directly through `log()` as `[STATUS]` lines (behavior unchanged)

## [5.0.0] - 2026-04-16

### Changed (BREAKING)

- **All 11 gerund-form skills renamed to imperative verb-object form** — the new names are shorter, more ergonomic at the command line, and better match how users describe their intent. Existing slash-command muscle memory and any automation that invokes these skills by name must be updated:

  | Old | New |
  |-----|-----|
  | `/creating-issues` | `/draft-issue` |
  | `/starting-issues` | `/start-issue` |
  | `/writing-specs` | `/write-spec` |
  | `/implementing-specs` | `/write-code` |
  | `/verifying-specs` | `/verify-code` |
  | `/creating-prs` | `/open-pr` |
  | `/running-sdlc-loop` | `/run-loop` |
  | `/running-retrospectives` | `/run-retro` |
  | `/setting-up-steering` | `/setup-steering` |
  | `/migrating-projects` | `/migrate-project` |
  | `/generating-sdlc-config` | `/init-config` |

- **Skill descriptions enhanced with question-form triggers** — each skill's `description` frontmatter now includes natural question phrasings (e.g., "how do I start an issue", "how do I create a PR") so users asking Claude questions reliably land on the right skill. The description is the primary mechanism Claude uses to decide when to invoke a skill
- **Every skill now explicitly describes the next step** — each SKILL.md ends with a clear "Next step" pointer to the next skill in the SDLC pipeline, making the workflow self-documenting and introspectable ("how do I start an issue?" → triggers `/start-issue`, which describes what comes after)
- **Spec directories renamed** — 22 directories in `.claude/specs/` that referenced old skill names were renamed (e.g., `feature-creating-issues-skill/` → `feature-draft-issue-skill/`); git history preserves the original names

### Migration Notes

- Run `/migrate-project` after upgrading to pick up any template changes
- If you previously ran `/creating-issues`, now run `/draft-issue` — same behavior, new name
- Automation scripts that invoke these skills by slash-command name must be updated to the new names

## [4.3.2] - 2026-04-16

### Fixed

- **`sdlc-runner.mjs`** — Fixed `detectAndHydrateState()` skipping steps after SIGTERM auto-push: the shutdown handler's commit+push made artifact probing think step 6 was complete even if the runner was mid-step-3; now persists a `signalShutdown` flag in state and caps the probed `lastCompletedStep` to the state file's value on resume

## [4.3.1] - 2026-04-15

### Fixed

- **`sdlc-runner.mjs`** — Fixed `ReferenceError: Cannot access 'LOG_DIR' before initialization` TDZ bug: `LOG_DIR`, `MAX_LOG_DISK_BYTES`, and `ORCHESTRATION_LOG` were declared with `let` after their first assignment inside the `if (isMainModule)` block; moved declarations to join the other module-level variables
- **Tests** — Removed stale `performs major bump when last issue in milestone` test that tested removed major-bump functionality

## [4.3.0] - 2026-04-15

### Changed

- **`sdlc-runner.mjs`** — Removed automatic major version bumps; `performDeterministicVersionBump()` no longer checks milestone completion or increments the major version — only patch (bug) and minor (default) bumps are applied; major version changes must be done manually

## [4.2.1] - 2026-04-15

### Fixed

- **All SDLC skills** — Every step now outputs the next slash command to guide users through the workflow; `/draft-issue` was incorrectly pointing to `/write-spec` instead of `/start-issue`, and `/start-issue` had no next-step guidance at all
- **All SDLC skills** — "Integration with SDLC Workflow" diagrams updated to include `/start-issue` in the chain (was omitted from 6 of 9 skills)

## [4.2.0] - 2026-04-15

### Improved

- **`/write-spec` review gates** — All three phase gates (Requirements, Design, Tasks) now present structured inline summaries with full spec detail so users can evaluate proposals without opening the markdown files; replaced open-ended questions with a numbered `[1] Approve / [2] Revise` menu

## [4.1.0] - 2026-04-15

### Removed

- **OpenClaw integration** — Removed the entire `openclaw/` directory (OpenClaw skill, runner installer, CLI patch, README), the `/installing-openclaw-skill` and `/generating-openclaw-config` skills, and all Discord status posting from `sdlc-runner.mjs`; the runner now logs status messages instead of posting to Discord
- **`--discord-channel` CLI flag** — Removed from `sdlc-runner.mjs`; `discordChannelId` removed from config template

### Changed

- **`sdlc-runner.mjs`** — Moved from `openclaw/scripts/` to `scripts/` at the repo root; `postDiscord()` replaced with a log-only implementation
- **`/generating-openclaw-config`** — Renamed to `/init-config`; updated template path from `openclaw/scripts/` to `scripts/`
- **`/run-loop`** — Updated runner path from `openclaw/scripts/` to `scripts/`; removed OpenClaw references
- **`/migrate-project`** — Removed Step 6 (OpenClaw Skill Version check); renumbered Steps 7–10 to 6–9; renamed "OpenClaw Config" references to "Runner Config"
- **`/installing-locally`** — Removed OpenClaw skill sync (Step 5) and gateway restart (Step 6)
- **README.md** — Rewrote Automation Mode section; removed OpenClaw setup steps, skills table, and references

## [4.0.3] - 2026-04-15

### Fixed

- **`/run-loop`** — Trimmed dead auto-trigger phrases from skill description (skill uses `disable-model-invocation: true`); added `Bash(CLAUDECODE:*)` to `allowed-tools` to cover the `CLAUDECODE="" node ...` command pattern that was blocked by the previous `Bash(node:*)` pattern; replaced `cat` instruction with Read tool
- **`sdlc-runner.mjs`** — Extracted shared helpers to eliminate duplication: `findFeatureDir()` replaces 4 inline feature-directory lookups, `checkRequiredSpecFiles()` replaces 3 inline spec-file checks, `parseMaxBounceRetries()` replaces 2 identical IIFEs, `classifyBumpType()` extracts 40-line nested classification from `performDeterministicVersionBump()` into flat early-return style, `runValidationGate()` consolidates identical retry-or-escalate boilerplate from post-step gates (steps 3, 6, 8); merged duplicate `isMainModule` blocks to eliminate redundant config re-read from disk

## [4.0.2] - 2026-03-15

### Fixed

- **Skills** — Removed `model:` frontmatter field from all 12 skills to prevent model-switch rate limit errors when invoking skills via `/`; skills now inherit the session model instead of overriding it (issue #111)
- **Skills** — Added `disable-model-invocation: true` to 4 slash-command-only skills (`run-loop`, `installing-openclaw-skill`, `generating-openclaw-config`, `run-retro`) to reduce always-in-context token overhead (issue #111)

## [4.0.1] - 2026-03-15

### Fixed

- **Skills** — Superseded by 4.0.2 — initial attempt pinned skills to explicit model IDs but did not address the root cause (model-switch rate limit bucket issue)

## [4.0.0] - 2026-03-03

### Added

- **`/verify-code`** — Steering doc verification gates: projects can declare mandatory verification constraints in a structured `## Verification Gates` section in `tech.md`; the skill extracts gates at Step 1, executes them as hard sub-steps in Step 5f, and aggregates results into a Pass/Partial/Incomplete status — a "Pass" verdict requires all applicable gates to pass (issue #109)
- **`/verify-code`** report template — New "Steering Doc Verification Gates" section with per-gate status (Pass/Fail/Incomplete) and evidence/blocker reason
- **`/setup-steering`** tech.md template — `## Verification Gates` section scaffolded for new projects, with condition/action/pass-criteria table and usage guidance
- **README.md** — Verification Gates convention documented with example table and status semantics

## [3.1.1] - 2026-02-26

### Fixed

- **`sdlc-runner.mjs`** — Runner now self-heals projects where `.claude/sdlc-state.json` was committed before the gitignore fix (#57): `untrackRunnerArtifactsIfTracked()` runs `git rm --cached` on already-tracked runner artifacts at startup, making `.gitignore` effective
- **`/start-issue`** — Step 4 working-tree check now filters known SDLC runner artifacts (`.claude/sdlc-state.json`, `.claude/auto-mode`) from `git status --porcelain` output before evaluating dirtiness, preventing false "Working tree is not clean" aborts when only runner state files are modified

## [3.1.0] - 2026-02-26

### Added

- **`/run-loop`** — New skill that runs the full SDLC pipeline from within an active Claude Code session; supports single-issue mode (`/run-loop #42`) and continuous loop mode (`/run-loop`); invokes `sdlc-runner.mjs` as a subprocess with `CLAUDECODE=""` to enable nested `claude -p` sessions (issue #107)
- **`sdlc-runner.mjs`** — `--issue <N>` CLI flag for single-issue mode: targets a specific issue instead of selecting the next open one, runs a single SDLC cycle, and exits on completion or escalation

### Fixed

- **`sdlc-runner.mjs`** — Table row parsing regex in `performDeterministicVersionBump()` now uses `[^|\n]` instead of `[^|]` to prevent cross-line matching in Markdown tables, fixing incorrect version bump classification when the `## Versioning` section contains both a file mapping table and a `### Version Bump Classification` table

## [3.0.0] - 2026-02-25

### Added

- **`/migrate-project`** — Step 5 now detects config value drift: scalar values present in both `sdlc-config.json` and the template that differ are surfaced in a new "Config Value Drift" summary section; in interactive mode, users select per-value via `AskUserQuestion multiSelect` which drifted values to update to the template default; in auto-mode, drift is reported only (no automatic updates, as drifted values may represent intentional customizations) (issue #95)

## [2.22.0] - 2026-02-25

### Added

- **`sdlc-runner.mjs`** — Post-Step 3 spec content structure validation: `validateSpecContent()` checks that `requirements.md` contains `**Issues**:` frontmatter and at least one `### AC` heading, and that `tasks.md` contains at least one `### T` task heading; content validation failures trigger a Step 3 retry with per-file, per-check detail in the retry context (issue #90)

## [2.21.0] - 2026-02-25

### Added

- **`/start-issue`** — Diagnostic output when zero automatable issues are found in auto-mode: runs a scoped `gh issue list` without the label filter and reports the total open issue count; if open issues exist without the label, suggests adding the `automatable` label; if no open issues exist, reports "0 open issues in scope" without a misleading label suggestion (issue #89)

## [2.20.0] - 2026-02-25

### Added

- **`sdlc-config.example.json`** — `maxBounceRetries` field added alongside `maxRetriesPerStep` so operators can tune the bounce-loop halt threshold without modifying the runner source (issue #88)

## [2.19.0] - 2026-02-25

### Added

- **`/setup-steering` template** — `tech.md` now includes a `### Version Bump Classification` subsection under `## Versioning`, pre-populated with default `bug → patch` and `enhancement → minor` rows; both `/open-pr` and `sdlc-runner.mjs` read this table as the single source of truth for version bump classification

### Changed

- **`/open-pr`** — Step 2 now reads the version bump classification matrix from `.claude/steering/tech.md` (`### Version Bump Classification` table) instead of using an inline hardcoded matrix; adding a new label→bump mapping to `tech.md` requires no skill changes
- **`sdlc-runner.mjs`** — `performDeterministicVersionBump()` now reads classification from the `tech.md` Version Bump Classification table instead of hardcoded if-else logic; falls back to `bug → patch / else → minor` if the subsection is absent
- **`sdlc-runner.mjs`** — `MAX_BOUNCE_RETRIES` is now configurable independently from `maxRetriesPerStep` via the `maxBounceRetries` config key; precondition failure log messages now include a `failedCheck` label and step key for clearer debugging visibility

## [2.18.1] - 2026-02-25

### Fixed

- **SDLC runner** — `detectSoftFailure()` now scans stdout/stderr for known text-based failure patterns (e.g., `EnterPlanMode` in headless session, `AskUserQuestion` in auto-mode); text-pattern matches are treated as soft failures with the same retry/escalation behavior as JSON-detected failures, and matched patterns are included in Discord status messages for debugging visibility

## [2.18.0] - 2026-02-25

### Fixed

- **`/verify-code`** — Exercise script now resolves the Agent SDK from non-standard locations (e.g., npx cache) using dynamic `import()` with `pathToFileURL`, replacing the bare ESM specifier that failed when the SDK was outside the `node_modules` hierarchy; availability check updated to use the same path-resolving mechanism, eliminating false positives

## [2.17.4] - 2026-02-25

### Fixed

- **`/verify-code`** — Exercise prompt structure now places the skill invocation at the start of the prompt with dry-run instructions appended after (prefixed with "IMPORTANT:"), fixing skill recognition failure for skills with `disable-model-invocation: true`

## [2.17.3] - 2026-02-24

### Fixed

- **`/write-code`** — Missing specs error path now checks for `.claude/auto-mode`; in auto-mode, outputs an escalation message ending with "Done. Awaiting orchestrator." instead of calling `AskUserQuestion`, preventing headless sessions from hanging

## [2.17.2] - 2026-02-24

### Fixed

- **`/start-issue`** — Skill now runs `git status --porcelain` as a precondition before `gh issue develop`; aborts with a diagnostic error listing dirty files in interactive mode; in auto-mode, reports as an escalation reason for the runner

## [2.17.1] - 2026-02-24

### Fixed

- **`/migrate-project`** — Skill now detects legacy `{issue#}-{slug}/` spec directories and proposes renaming them to `feature-{slug}/` or `bug-{slug}` using `git mv`; auto-mode applies solo renames as non-destructive operations; cross-reference updates use `Grep`/`Edit` with chain resolution

## [2.17.0] - 2026-02-23

### Changed

- **SDLC runner** — Implement step (Step 4) now uses a single `runClaude()` invocation instead of separate plan + code phases; `write-code` handles planning internally via auto-mode
- **SDLC runner** — Removed `resolveImplementPhaseConfig()` and `runImplementStep()` (legacy plan/code split); plan/code sub-objects in config are silently ignored
- **SDLC runner** — Increased `createPR` default `maxTurns` from 15 to 30 in example config

## [2.16.2] - 2026-02-23

### Fixed

- **`/open-pr`** — Skill no longer fails when spec files are missing; falls back to extracting acceptance criteria from the GitHub issue body, omits the "Specs" section, and includes a warning in the PR body

## [2.16.1] - 2026-02-23

### Fixed

- **`/migrate-project` auto-mode support** — Skill now applies non-destructive changes automatically and skips destructive operations (consolidation, renames, deletes) with a machine-readable summary when `.claude/auto-mode` is present, instead of hanging on `AskUserQuestion` in headless sessions

## [2.16.0] - 2026-02-23

### Added

- **Automatable label gate** — `/draft-issue` now asks (Step 5b) whether the issue is suitable for hands-off automation; if "Yes", an `automatable` label is created (if needed) and applied; auto-mode applies the label automatically
- **Automation-eligible issue filtering** — `/start-issue` in auto-mode now filters `gh issue list` with `--label automatable`; if no automatable issues are found, it exits cleanly instead of picking a non-automatable issue
- **Spec directory cleanup** — Remaining numbered spec directories (`{issue#}-{slug}/`) renamed to feature-centric format (`feature-{slug}/`, `bug-{slug}/`) and retrospective path references updated accordingly

## [2.15.0] - 2026-02-22

### Added

- **Feature-centric spec management** — `/write-spec` now searches existing `feature-`-prefixed spec directories for related features before creating a new spec; when a match is found, the user is asked to confirm amendment vs. new spec creation (auto-mode auto-approves the amendment)
- **Spec directory naming convention** — New specs are created as `feature-{slug}/` (enhancements) or `bug-{slug}/` (bugs) instead of `{issue#}-{slug}/`; issue numbers are tracked in spec frontmatter only
- **Multi-issue frontmatter** — Spec templates use `**Issues**: #N` (plural) with a `## Change History` table; amended specs accumulate all contributing issue numbers and change summaries
- **Spec discovery pipeline** — Keyword extraction from issue title (stop-word filtered) → Glob `feature-*/requirements.md` → Grep scoring → ranked candidate presentation
- **Amendment content preservation** — New ACs, FRs, design sections, tasks, and Gherkin scenarios are appended to existing spec content; nothing is removed or replaced
- **`/migrate-project` consolidation** — Detects legacy `{issue#}-{slug}` spec directories, clusters related specs by keyword overlap, presents consolidation candidates per group for explicit user confirmation, merges into `feature-`-prefixed directories with combined frontmatter and Change History
- **Defect cross-reference resolution** — During consolidation, all defect spec `**Related Spec**` fields pointing to legacy directories are updated to new `feature-`-prefixed paths; chain resolution with cycle detection handles multi-hop references
- **Legacy frontmatter migration** — `/migrate-project` detects feature specs with singular `**Issue**` frontmatter and proposes updating to plural `**Issues**` with a `## Change History` section
- **Downstream compatibility** — `/write-code` and `/verify-code` spec resolution searches both new `feature-`/`bug-` naming and legacy `{issue#}-{slug}` patterns; multi-issue frontmatter (`**Issues**`) searched first with fallback to singular `**Issue**`

## [2.14.0] - 2026-02-22

### Added

- **Per-step model and effort configuration** — SDLC runner now supports per-step `model` and `effort` overrides in `sdlc-config.json`, with a three-level fallback chain: phase-level → step-level → global → default; the implement step splits into separate plan (Opus) and code (Sonnet) phases with independent model/effort/maxTurns/timeout settings
- **`validateConfig(config)`** — Config validation function that rejects invalid effort values and empty model strings at startup, preventing runtime failures from misconfigured steps
- **`resolveStepConfig(step, config)`** — Resolution helper implementing the model/effort fallback chain for generic steps
- **`resolveImplementPhaseConfig(step, config, phase)`** — Resolution helper for the implement step's plan/code phases, including maxTurns and timeout fallback
- **`runImplementStep(step, state)`** — Two-phase implement execution: plan phase (read specs, design approach) followed by code phase (execute tasks), with separate logging (`implement-plan`, `implement-code`), soft failure detection, and Discord status for each phase
- **`spec-implementer` agent** — New agent (`plugins/nmg-sdlc/agents/spec-implementer.md`) for executing implementation tasks from specs; runs on Sonnet, auto-invoked by `/write-code` during Step 5
- **Skill `model` frontmatter** — All 11 SKILL.md files now declare a recommended `model` field: `opus` for write-spec, write-code, migrate-project, run-retro, setup-steering; `sonnet` for draft-issue, open-pr, generating-openclaw-config, installing-openclaw-skill, start-issue, verify-code
- **`CLAUDE_CODE_EFFORT_LEVEL` env var** — `runClaude()` sets this in the subprocess environment when effort is configured, enabling per-step effort control

### Changed

- **`buildClaudeArgs()`** — Now accepts an `overrides` object for model and prompt, allowing callers to override the global model and default prompt per invocation
- **`runClaude()`** — Now accepts an `overrides` object for model, effort, and prompt; resolves config via `resolveStepConfig()` with fallback to globals
- **`runStep()`** — Step 4 (implement) now delegates to `runImplementStep()` for two-phase execution instead of a single `runClaude()` call
- **`sdlc-config.example.json`** — Added global `effort`, per-step `model`/`effort`, and `plan`/`code` sub-objects for the implement step
- **`/write-code`** — Step 5 now delegates to `spec-implementer` agent via Task tool in interactive mode; auto-mode continues to work inline
- **README.md** — Added "Model & Effort Configuration" section with recommendations table and configuration layer documentation

## [2.13.0] - 2026-02-22

### Added

- **`/run-retro`** — SHA-256 content hashing and state tracking (`retrospective-state.json`) so unchanged defect specs are skipped on subsequent runs; carried-forward learnings extracted from existing `retrospective.md` tables; output summary now shows spec partition breakdown (new/modified/skipped/removed) and learning source breakdown (new vs. carried forward)

## [2.12.13] - 2026-02-22

### Fixed

- **`/run-retro`** — Defect spec discovery rewritten from unreliable Grep-glob (`*/requirements.md` misses two-level paths) to deterministic Glob + Read-heading approach; added chain resolution that follows defect-to-defect `Related Spec` links to the root feature spec, with cycle detection and orphan handling
- **`/write-spec`** — Phase 1 Step 7 Related Spec search now filters out defect specs (checks first heading for `# Defect Report:`) and follows defect chains to find the root feature spec when no feature spec directly matches keywords
- **`/migrate-project`** — New Step 4a validates `Related Spec` links in defect specs: checks target existence, verifies target is a feature spec, follows chains through defect specs, detects circular references, and presents corrections for user approval

## [2.12.12] - 2026-02-20

### Fixed

- **`/migrate-project`** — Missing template sections are now filtered by codebase evidence (glob-based relevance heuristics) before being proposed; users can approve or decline individual sections via `multiSelect`; declined sections are persisted in `.claude/migration-exclusions.json` and skipped on future runs

## [2.12.11] - 2026-02-20

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Removed fragile `#N` regex fallback in `extractStateFromStep` that could match stale issue numbers from previous cycles in conversation transcripts; issue number is now derived exclusively from the branch name (ground truth); added `git clean -fd && git checkout -- .` working tree cleanup to step 1 prompt to prevent cross-cycle file contamination

## [2.12.10] - 2026-02-20

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Version bumping during automated SDLC runs is now deterministic: added `validateVersionBump()` postcondition that detects missing version bumps after PR creation (Step 7), and `performDeterministicVersionBump()` recovery function that reads `VERSION`, issue labels, milestone, and `.claude/steering/tech.md` to compute and commit the correct bump; Step 7 prompt reinforced with explicit version bump mandate as defense-in-depth

## [2.12.9] - 2026-02-19

### Fixed

- **`/start-issue`** — Milestone selection no longer iterates through random milestones; now fetches milestones with `open_issues` metadata, filters to viable milestones, and applies deterministic 3-way selection (zero → fallback to all issues, one → auto-select, multiple → present to user or pick first alphabetically in auto-mode)

## [2.12.8] - 2026-02-19

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Runner now ensures `.claude/auto-mode` and `.claude/sdlc-state.json` are listed in the target project's `.gitignore` before creating runner artifacts, preventing `git add -A` from staging and committing them to the target project

## [2.12.7] - 2026-02-16

### Fixed

- **`/run-retro`** — Severity grep pattern updated from plain `Severity:` to regex `\*{0,2}Severity\*{0,2}:` to match both bold-formatted (`**Severity**: High`) and plain (`Severity: High`) fields in defect specs; also fixed Related Spec field reference to use bold-formatted variant from defect template

## [2.12.6] - 2026-02-16

### Fixed

- **`/write-spec`** — Defect variant now actively searches `.claude/specs/*/requirements.md` for related feature specs by keyword matching (file paths, function names, component names) instead of relying on passive agent intuition; populates the **Related Spec** field with any match or N/A if none found

## [2.12.5] - 2026-02-16

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Process cleanup rewritten to use PID tree killing instead of `pkill -f`: kills entire process trees (all descendants) for each matched PID, uses filtered PID list directly instead of re-matching with `pkill`, tracks `lastClaudePid` to scope cleanup to runner-spawned processes, falls back to pattern-based matching for orphaned processes (PPID=1), and always emits `[CLEANUP]` log entries

## [2.12.4] - 2026-02-16

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — SDLC runner infinite retry when repo has no CI checks: `gh pr checks` exits code 1 with "no checks reported" on repos without CI workflows; Steps 8 (monitorCI) and 9 (merge) now detect this and treat it as a passing condition instead of retrying indefinitely

## [2.12.3] - 2026-02-16

### Fixed

- **`/migrate-project`** — Skill now explicitly ignores `.claude/auto-mode` and always presents proposed changes for interactive review via `AskUserQuestion`, matching the original spec's out-of-scope declaration that migration is always interactive

## [2.12.2] - 2026-02-16

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — 6 edge case bugs: `currentProcess` never assigned so SIGTERM couldn't kill subprocess (F1); `Atomics.wait()` blocking event loop during Discord retry (F2); incomplete shell escaping in `autoCommitIfDirty` (F3); uncaught exception on merged-PR `git checkout` with dirty worktree (F4); silent retry counter reset when `--resume` used with missing state file (F5); unused `AbortController` dead code in `runClaude()` (F6)

## [2.12.1] - 2026-02-16

### Added

- **`/verify-code`** — Exercise-based verification for plugin projects: generates targeted exercises that test plugin capabilities through real usage scenarios instead of relying on traditional test suites

## [2.12.0] - 2026-02-16

### Added

- **Integrated versioning system** — `VERSION` file (plain text semver) as the single source of truth for project versions
- **`/draft-issue`** — Milestone assignment step: reads VERSION for major version default, creates milestones via `gh api` if missing, passes `--milestone` to `gh issue create`
- **`/open-pr`** — Automatic version bump classification: reads issue labels (`bug` → patch, `enhancement` → minor), detects milestone completion for major bumps, updates VERSION/CHANGELOG/stack-specific files
- **`/migrate-project`** — CHANGELOG.md analysis: generates from git history if missing, reconciles existing changelogs with Keep a Changelog format
- **`/migrate-project`** — VERSION file analysis: derives expected version from CHANGELOG/git tags, creates or updates VERSION
- **tech.md template** — New `## Versioning` section: declares stack-specific version file mappings (file/path/notes table) bridging VERSION to package.json, Cargo.toml, etc.

### Changed

- **`/draft-issue`** — Workflow expanded from 8 to 9 steps (milestone assignment inserted as Step 3); auto-mode runs Step 3 non-interactively
- **`/open-pr`** — Workflow expanded from 4 to 6 steps (version bump classification as Step 2, version artifact updates as Step 3); PR body includes Version section
- **`/migrate-project`** — Workflow expanded from 8 to 10 steps (CHANGELOG analysis as Step 7, VERSION analysis as Step 8); "What Gets Analyzed" section updated

## [2.11.0] - 2026-02-16

### Added

- **Persistent per-step logging** — SDLC runner writes full stdout/stderr from each `claude -p` subprocess to individual log files in an OS-agnostic temp directory (`<os.tmpdir()>/sdlc-logs/<project>/`)
- **Configurable log directory and disk usage threshold** via `logDir` and `maxLogDiskUsageMB` config fields (defaults: `os.tmpdir()/sdlc-logs/<project>/`, 500 MB)

### Changed

- **Runner orchestration log** moved from hardcoded `/tmp/sdlc-runner.log` (via nohup redirect) to `<logDir>/sdlc-runner.log` via dual-write in `log()` function
- **`running-sdlc` SKILL.md** updated: removed nohup stdout redirect, added Logging section documenting log location, naming convention, disk limits, and config options

## [2.10.0] - 2026-02-16

### Added

- **Failure loop detection** — SDLC runner (`openclaw/scripts/sdlc-runner.mjs`) now detects three failure loop patterns and halts with a diagnostic Discord message instead of looping indefinitely:
  - **Consecutive escalations** — halts after 2 back-to-back escalations across cycles
  - **Same-issue loops** — tracks escalated issues in-memory, excludes them from step 2 issue selection, and halts when all open issues have been escalated
  - **Step bounce loops** — counts step-back transitions per cycle, escalates when bounces exceed `maxRetriesPerStep`
- **`haltFailureLoop()`** — New halt function that posts a `FAILURE LOOP DETECTED` diagnostic to Discord and exits without cleanup, preserving state for manual inspection

### Removed

- **Spec drift detection hook** — PostToolUse hook that ran on every `Write`/`Edit` removed; with 23+ spec directories the agent consistently hit the 60-second timeout, producing errors on every file modification

### Added

- **`/migrate-project`** — New skill that updates existing project specs, steering docs, and OpenClaw configs to latest template standards by diffing headings against current templates and merging missing sections while preserving all user content
- **`/run-retro`** — New skill that batch-analyzes defect specs to identify spec-writing gaps (missing ACs, undertested boundaries, domain-specific gaps) and produces `.claude/steering/retrospective.md` with actionable learnings
- **`/draft-issue`** — Upfront issue type classification: first question after gathering context asks whether this is a Bug or Enhancement/Feature via `AskUserQuestion`, then performs type-specific codebase investigation before the interview
- **`/draft-issue`** — Enhancement path: explores existing specs and source code, adds "Current State" section to issue body between Background and Acceptance Criteria
- **`/draft-issue`** — Bug path: searches codebase, traces code paths, forms root cause hypothesis, confirms with user, adds "Root Cause Analysis" section to issue body

### Changed

- **`/setup-steering`** — Now detects existing steering files and offers an enhancement flow instead of always running the bootstrap flow; metadata and documentation updated to reflect iterative use
- **`/write-spec`** — Phase 1 now reads `retrospective.md` (when present) to apply defect-derived learnings when drafting acceptance criteria
- **`/draft-issue`** — Interview questions now branch explicitly by issue type instead of adapting passively; workflow expanded from 6 steps to 8 steps (classification and investigation inserted as Steps 2–3); auto-mode references updated accordingly

## [2.4.0] - 2026-02-14

### Added

- **Defect requirements template** — Optional `Related Spec` field linking defect specs back to the original feature spec, improving traceability when bugs are found in previously-specified features

## [2.3.0] - 2026-02-14

### Changed

- Renamed `/installing-openclaw-plugin` skill to `/installing-openclaw-skill`
- Restructured README automation section with clear 4-step OpenClaw setup guide

## [2.2.0] - 2026-02-14

### Added

- **Defect-specific spec handling** — Bug issues (detected via `bug` label) now use lighter, defect-focused template variants throughout the 3-phase spec process, replacing the heavyweight feature templates with reproduction steps, root cause analysis, and flat 2–4 task lists
- **`/write-spec`** — Defect Detection section: reads `bug` label from GitHub issue and routes all three phases to defect template variants; includes complexity escape hatch for architectural bugs
- **`/draft-issue`** — Bug Report issue body template with reproduction steps, expected/actual behavior, environment table, and defect-focused acceptance criteria; expanded bug interview questions
- **`/write-code`** — Bug Fix Implementation guidance: follow fix strategy precisely, flat task execution, minimize change scope, regression test required
- **`/verify-code`** — Bug Fix Verification guidance: reproduction check, `@regression` scenario validation, blast radius focus, minimal change audit
- **Templates** — Defect Requirements Variant (reproduction, expected vs actual, severity, lightweight FRs), Defect Design Variant (root cause analysis, fix strategy, blast radius, regression risk), Defect Tasks Variant (flat T001–T003: fix/test/verify), Defect Regression Scenarios (Gherkin with `@regression` tags)

## [2.1.8] - 2026-02-14

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Runner now auto-detects in-progress work from git state on every startup; inspects branch name, specs, commits, PR status, and CI to hydrate state from reality, preventing loss of context when restarting on a feature branch

## [2.1.7] - 2026-02-14

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Discord status posts sent duplicate messages because `openclaw message send` CLI hangs after delivery (Discord.js WebSocket never closed); replaced `execSync` with `spawn`-based approach that detects success markers in stdout and kills the hanging process immediately ([openclaw/openclaw#16460](https://github.com/openclaw/openclaw/issues/16460))

### Added

- **`openclaw/scripts/patch-openclaw-message-hang.mjs`** — Idempotent patch script that fixes the `openclaw message send` hang bug by adding `process.exit(0)` to the `runMessageAction` helper in the installed openclaw CLI
- **`/installing-openclaw-skill`** — New Step 3 automatically runs the patch script to fix the openclaw CLI hang bug if present; added `Bash(node:*)` to allowed tools

## [2.1.6] - 2026-02-14

### Fixed

- **`/generating-openclaw-config`** — Now also adds `.claude/sdlc-state.json` to `.gitignore` alongside `sdlc-config.json`

## [2.1.5] - 2026-02-14

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Discord status posts intermittently failed with ETIMEDOUT due to single-attempt 15s timeout; added 3-attempt retry with exponential backoff (2s, 4s) and bumped timeout to 30s

## [2.1.4] - 2026-02-14

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Resume started from the in-progress step instead of the next step, causing completed work to be re-run; added `lastCompletedStep` state tracking so `--resume` correctly skips already-finished steps
- **`openclaw/scripts/sdlc-runner.mjs`** — Signal handler reset `currentStep` to 0 on graceful shutdown, losing progress; now preserves `lastCompletedStep` so the runner can resume from where it left off

## [2.1.3] - 2026-02-14

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Runner loop between Steps 4–5: implementation left uncommitted so verify precondition "commits ahead of main" always failed; added `autoCommitIfDirty()` that commits and pushes after Step 4 completes
- **`openclaw/scripts/sdlc-runner.mjs`** — Discord status updates were silently failing because `openclaw system event` doesn't route to Discord channels; switched to `openclaw message send --channel discord --target <id>` with channel ID passed via `--discord-channel` CLI flag or `discordChannelId` config field
- **`openclaw/skills/running-sdlc/SKILL.md`** — Skill now auto-detects the source Discord channel via `openclaw sessions` and passes it to the runner via `--discord-channel`

### Changed

- **`openclaw/scripts/sdlc-config.example.json`** — Added optional `discordChannelId` field for static Discord channel configuration
- **`openclaw/README.md`** — Documented `--discord-channel` flag, Discord channel auto-detection, and `discordChannelId` config option
- **`README.md`** — Updated direct-run example with `--discord-channel` flag and auto-detection note

## [2.1.2] - 2026-02-14

### Changed

- **`openclaw/README.md`** — Expanded with architecture diagram, setup instructions, installation methods, error handling, state/logs, and file layout
- **`openclaw/skills/running-sdlc/SKILL.md`** — Documented in README Skills Reference with `--config <path>` argument and link to `openclaw/README.md`
- **`README.md`** — Fixed `/generating-openclaw-config` description (writes to file, not clipboard) and usage (no path argument); added `--config` argument and `openclaw/README.md` link to OpenClaw Skills table

## [2.1.1] - 2026-02-14

### Moved

- **`/generating-openclaw-config`** — Moved from repo-level skill (`.claude/skills/`) to plugin skill (`plugins/nmg-sdlc/skills/`) so it's available in all projects with nmg-sdlc installed

## [2.1.0] - 2026-02-14

### Added

- **`openclaw/scripts/sdlc-runner.mjs`** — Deterministic Node.js orchestrator that replaces the prompt-engineered heartbeat loop; drives the full SDLC cycle via `claude -p` subprocesses with code-based step sequencing, precondition validation, timeout detection, retry logic, Discord reporting, and escalation
- **`openclaw/scripts/sdlc-config.example.json`** — Project configuration template for the SDLC runner with per-step maxTurns, timeouts, and skill references
- **`openclaw/scripts/install-openclaw-skill.sh`** — Installer utility for the OpenClaw skill (copy or link mode)
- **`openclaw/skills/running-sdlc/`** — OpenClaw skill: launch, monitor status, or stop the SDLC runner from Discord

### Changed

- **`openclaw/README.md`** (was `openclaw-automation-prompt.md`) — Replaced 410-line prompt-engineered orchestration with short documentation for the script-based approach
- **`/generating-openclaw-config`** (was `/generating-prompt`) — Now generates `sdlc-config.json` instead of the old automation prompt
- **`/installing-locally`** — Now also syncs the OpenClaw `running-sdlc` skill to `~/.openclaw/skills/` and restarts the OpenClaw gateway after installing marketplace plugins

### Moved

- All OpenClaw files to top-level `openclaw/` directory: `openclaw/skills/running-sdlc/`, `openclaw/scripts/`, `openclaw/README.md` — separates OpenClaw integration from the Claude Code plugin

### Removed

- Heartbeat-driven orchestration loop (replaced by deterministic `for` loop in `sdlc-runner.mjs`)
- Watchdog cron prompt engineering (replaced by simple PID check or script crash recovery)
- All prompt-based state management, retry counting, timeout detection, and Discord posting logic

## [2.0.2] - 2026-02-14

### Fixed

- **Spec alignment hook** — Add `command`-type gate that short-circuits when no spec files exist, avoiding expensive agent spawns on every Write/Edit in projects without specs

## [1.12.0] - 2026-02-13

### Changed

- **All skills** — Remove deprecated "ultrathink" keyword lines (no functional effect; extended thinking is session-level)
- **`/write-code`** — Clarify auto-mode: Steps 1–3 are still required, only Step 4 (EnterPlanMode) is skipped
- **`/write-spec`** — Add Feature Name Convention section defining the `{feature-name}` algorithm (issue number + kebab-case slug)
- **`/write-spec`** — Add inline auto-mode conditionals at each Human Review Gate for unambiguous behavior
- **`/write-code`, `/verify-code`, `/open-pr`** — Add feature-name fallback: use `Glob` to find specs if feature-name is ambiguous
- **`/start-issue`** — Specify auto-mode issue sort order: issue number ascending (oldest first)
- **`/verify-code`** — Add standard Automation Mode section for consistency with other skills
- **`/verify-code`** — Add fix-vs-defer heuristic: fix findings under ~20 lines; defer architectural changes
- **`/draft-issue`** — Clarify auto-mode inference: read `product.md`, generate 3–5 Given/When/Then acceptance criteria
- **`/draft-issue`** — Reword interview as adaptive questioning (skip answered topics, aim for 2–3 rounds)
- **`/open-pr`** — Add auto-mode conditional output (`Done. Awaiting orchestrator.`)
- **OpenClaw prompt** — Spec validation gate uses glob instead of unresolved `{feature-name}` template variable
- **OpenClaw prompt** — Merge step now verifies CI via `gh pr checks` before merging
- **OpenClaw prompt** — Clarify retry count attribution: Step N precondition failure retries Step N-1 against N-1's cap
- **OpenClaw prompt** — Escalation protocol now commits/pushes partial work and checks out main before stopping

### Removed

- **`/beginning-dev`** skill — removed; use `/start-issue` directly, then chain `/write-spec` and `/write-code` manually or via orchestrator
- Discord notification hooks (`on-stop.sh`, `on-notification.sh`, `_lib.sh`) — redundant with heartbeat-driven orchestration; the orchestrator already detects subprocess state via polling and posts its own Discord updates
- `OPENCLAW_DISCORD_CHANNEL` requirement from automation prompt — no hooks consume it anymore

### Fixed

- Move heartbeat orchestration instructions to top of automation prompt so agent prioritizes them
- Make heartbeat explicitly drive orchestration loop instead of passive HEARTBEAT_OK
- Watchdog cron now remediates orphaned state instead of only reporting it
- Add `--model opus` to all `claude -p` invocations to prevent Sonnet fallback
- Add artifact validation gates between steps — spec files verified before advancing to implementation
- Strengthen retry cap to 3 attempts with shared state tracking in `sdlc-state.json`
- Add pre-retry checklist requiring root cause investigation before retrying failed steps
- Explicitly prohibit combined multi-step `claude -p` sessions in both heartbeat and watchdog
- Remove unused `EnterPlanMode` and `Skill` from `/write-spec` allowed-tools — prevents unintended plan mode entry during spec writing
- Remove unused `Skill` from `/write-code` allowed-tools
- Remove `Task` from architecture-reviewer agent tools — subagents cannot nest; agent now uses Read/Glob/Grep directly
- Clarify `/verify-code` Step 4 to explicitly delegate to the `nmg-sdlc:architecture-reviewer` agent instead of generic Explore subagents
- Upgrade spec alignment PostToolUse hook from `prompt` to `agent` type so it can read spec files when checking for drift
- Add top-level `description` to hooks.json
- Fix `generating-prompt` skill's `Bash(cat * | *)` allowed-tools pattern to standard `Bash(cat:*)`

## [1.10.1] - 2026-02-13

### Fixed

- Prevent `EnterPlanMode` from being called in headless automation sessions
- Use per-step stall timeouts instead of flat 5-minute threshold in OpenClaw automation prompt

## [1.10.0] - 2026-02-13

### Added

- `/beginning-dev` — Automation Mode: in auto-mode, runs only `/start-issue` then stops; orchestrator handles remaining skills with `/clear` between steps

### Changed

- Rewrote OpenClaw automation prompt to use headless `claude -p` per-step sessions instead of interactive sessions with PTY input submission
- Added `{{NMG_PLUGINS_PATH}}` template token to `/generating-prompt`
- All skills with "Next step" output — suppressed in auto-mode to prevent unintended skill chaining

## [1.8.1] - 2026-02-12

### Added

- Notification hook (`on-notification.sh`) — notifies Discord via OpenClaw when Claude Code is waiting for input in automation mode; 60-second debounce prevents notification spam

### Changed

- Renamed `.noclaw` suppression file to `.claude/.nodiscord` — project-scoped only, removed global `$HOME/.noclaw` option
- Extracted shared hook logic into `_lib.sh` — `claw_guard`, `gather_context`, `build_message`, `send_claw_message` functions used by both `on-stop.sh` and `on-notification.sh`
- Refactored `on-stop.sh` to source `_lib.sh` instead of inlining all logic

## [1.7.1] - 2026-02-12

### Fixed

- `on-stop.sh` — Background the `openclaw cron add` call with `nohup` + `&` to prevent the hook runner from killing the process before it completes (~5-10s plugin load time)

## [1.7.0] - 2026-02-12

### Added

- Discord stop notification hook (`on-stop.sh`) — notifies via OpenClaw when sessions end in automation mode; channel ID read from `OPENCLAW_DISCORD_CHANNEL` env var

### Removed

- `auto-continue.sh` Stop hook — OpenClaw manages session lifecycle directly
- `auto-permission.sh` PermissionRequest hook — skills handle auto-mode detection directly
- `auto-respond.sh` PreToolUse hook — skills skip AskUserQuestion in auto-mode (v1.6.0)
- `auto-plan.sh` PreToolUse hook — skills skip EnterPlanMode in auto-mode (v1.6.0)

## [1.6.0] - 2026-02-12

### Added

- **Automation Mode awareness in skills** — Skills now detect `.claude/auto-mode` and skip `AskUserQuestion` calls entirely, fixing the infinite retry loop caused by `exit 2` PreToolUse blocks. Previous hook-level fixes (1.5.1–1.5.3) couldn't solve this because Claude interprets a blocked tool as "I need this but couldn't get it" and retries — the block message is never treated as a tool response. Skills updated:
  - **`/write-spec`** — All 3 Human Review Gates skipped in automation mode
  - **`/start-issue`** — Issue selection and confirmation skipped when issue number provided
  - **`/draft-issue`** — Interview and review steps skipped; uses argument as feature description
  - **`/write-code`** — Plan mode and approval gates skipped

## [1.5.3] - 2026-02-12

### Fixed

- **Automation hooks** — `auto-respond.sh` AskUserQuestion retry loop: skills instruct Claude "do not proceed until the user approves" while the hook says "don't ask questions," creating a conflict that causes infinite retries. Now parses the actual questions from tool input, echoes them back with explicit "APPROVED" answers, and states "this block IS the user's approval." Includes debounce counter that escalates the message on rapid consecutive blocks.

## [1.5.2] - 2026-02-12

### Fixed

- **Automation hooks** — `auto-continue.sh` infinite loop when combined with `auto-respond.sh`: PreToolUse blocks (exit 2) reset the `stop_hook_active` chain, so the built-in guard never fired. Added a 30-second timestamp debounce as a fallback to break the cycle.

## [1.5.1] - 2026-02-12

### Fixed

- **Automation hooks** — `auto-permission.sh` was using the PreToolUse output format (`permissionDecision`) instead of the PermissionRequest format (`decision.behavior`), so auto-mode never actually approved permissions

## [1.5.0] - 2026-02-11

### Added

- **`/start-issue`** — New standalone skill: select a GitHub issue, create linked feature branch, set issue to In Progress
- **Automation hooks** — Four new hooks that let external agents (e.g., OpenClaw) drive the SDLC without human input, gated by a `.claude/auto-mode` flag file:
  - `PermissionRequest` → auto-allows all tool permissions
  - `PreToolUse` on `AskUserQuestion` → blocks questions and steers Claude to proceed with defaults
  - `PreToolUse` on `EnterPlanMode` → blocks plan mode and instructs Claude to plan internally
  - `Stop` → forces continuation when Claude would wait for free-form input (with loop prevention)
- **OpenClaw automation prompt** — Example prompt for driving the full SDLC cycle with an OpenClaw agent (`openclaw-automation-prompt.md`)

### Changed

- **`/beginning-dev`** — Now delegates issue selection and branch setup to `/start-issue` instead of handling inline
- **README** — Added Automation Mode section documenting hooks, enable/disable, default behaviors, and OpenClaw example

## [1.3.1] - 2026-02-11

### Changed

- **`/beginning-dev`** — Added context compaction handoffs between phases (write-spec, write-code) to free context window for each phase

## [1.3.0] - 2026-02-10

### Changed

- **`/verify-code`** — No longer read-only; now fixes findings during verification before generating report
- **`/verify-code`** — Added `Write`, `Edit`, and `Bash(git:*)` to allowed tools
- **`/verify-code`** — Report restructured: "Issues Found" replaced with "Fixes Applied" and "Remaining Issues" sections
- **`/verify-code`** — New Step 6 (Fix Findings) with prioritization, test-after-fix, re-verification, and deferral workflow

## [1.2.1] - 2026-02-10

### Changed

- Updated README skills reference to match actual SKILL.md definitions and argument hints

### Fixed

- Spec alignment hook now returns expected `{ok, reason}` JSON format and references `$ARGUMENTS` for edit context

## [1.2.0] - 2026-02-10

### Added

- **`/beginning-dev`** — Pick a GitHub issue to work on, then automatically chain through `/write-spec` and `/write-code`

### Fixed

- **`/beginning-dev`** — Now links the feature branch to the GitHub issue (via `gh issue develop`) and updates the issue status to "In Progress" in any associated GitHub Project

## [1.0.0] - 2026-02-10

### Added

- **nmg-sdlc plugin** — Stack-agnostic BDD spec-driven development toolkit
- **`/draft-issue`** — Interview user, create groomed GitHub issue with BDD acceptance criteria
- **`/write-spec`** — Create requirements, design, and task specs from a GitHub issue (3-phase with human gates)
- **`/write-code`** — Read specs, enter plan mode, execute implementation tasks sequentially
- **`/verify-code`** — Verify implementation against spec, architecture review, update GitHub issue with evidence
- **`/open-pr`** — Create pull request with spec-driven summary linking issue and specs
- **`/setup-steering`** — One-time codebase scan to generate product, tech, and structure steering documents
- **architecture-reviewer agent** — SOLID, security, performance, testability, error handling evaluation
- **Verification checklists** — SOLID principles, security (OWASP), performance, testability, error handling, report template
- **Spec templates** — Requirements, design, tasks, and Gherkin feature file templates
- **Steering templates** — Product, tech, and structure templates for project bootstrapping
- **Spec alignment hook** — PostToolUse hook that checks file modifications against active specs
