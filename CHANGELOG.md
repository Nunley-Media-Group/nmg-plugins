# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [2.16.2] - 2026-02-23

### Fixed

- **`/creating-prs`** — Skill no longer fails when spec files are missing; falls back to extracting acceptance criteria from the GitHub issue body, omits the "Specs" section, and includes a warning in the PR body

## [2.16.1] - 2026-02-23

### Fixed

- **`/migrating-projects` auto-mode support** — Skill now applies non-destructive changes automatically and skips destructive operations (consolidation, renames, deletes) with a machine-readable summary when `.claude/auto-mode` is present, instead of hanging on `AskUserQuestion` in headless sessions

## [2.16.0] - 2026-02-23

### Added

- **Automatable label gate** — `/creating-issues` now asks (Step 5b) whether the issue is suitable for hands-off automation; if "Yes", an `automatable` label is created (if needed) and applied; auto-mode applies the label automatically
- **Automation-eligible issue filtering** — `/starting-issues` in auto-mode now filters `gh issue list` with `--label automatable`; if no automatable issues are found, it exits cleanly instead of picking a non-automatable issue
- **Spec directory cleanup** — Remaining numbered spec directories (`{issue#}-{slug}/`) renamed to feature-centric format (`feature-{slug}/`, `bug-{slug}/`) and retrospective path references updated accordingly

## [2.15.0] - 2026-02-22

### Added

- **Feature-centric spec management** — `/writing-specs` now searches existing `feature-`-prefixed spec directories for related features before creating a new spec; when a match is found, the user is asked to confirm amendment vs. new spec creation (auto-mode auto-approves the amendment)
- **Spec directory naming convention** — New specs are created as `feature-{slug}/` (enhancements) or `bug-{slug}/` (bugs) instead of `{issue#}-{slug}/`; issue numbers are tracked in spec frontmatter only
- **Multi-issue frontmatter** — Spec templates use `**Issues**: #N` (plural) with a `## Change History` table; amended specs accumulate all contributing issue numbers and change summaries
- **Spec discovery pipeline** — Keyword extraction from issue title (stop-word filtered) → Glob `feature-*/requirements.md` → Grep scoring → ranked candidate presentation
- **Amendment content preservation** — New ACs, FRs, design sections, tasks, and Gherkin scenarios are appended to existing spec content; nothing is removed or replaced
- **`/migrating-projects` consolidation** — Detects legacy `{issue#}-{slug}` spec directories, clusters related specs by keyword overlap, presents consolidation candidates per group for explicit user confirmation, merges into `feature-`-prefixed directories with combined frontmatter and Change History
- **Defect cross-reference resolution** — During consolidation, all defect spec `**Related Spec**` fields pointing to legacy directories are updated to new `feature-`-prefixed paths; chain resolution with cycle detection handles multi-hop references
- **Legacy frontmatter migration** — `/migrating-projects` detects feature specs with singular `**Issue**` frontmatter and proposes updating to plural `**Issues**` with a `## Change History` section
- **Downstream compatibility** — `/implementing-specs` and `/verifying-specs` spec resolution searches both new `feature-`/`bug-` naming and legacy `{issue#}-{slug}` patterns; multi-issue frontmatter (`**Issues**`) searched first with fallback to singular `**Issue**`

## [2.14.0] - 2026-02-22

### Added

- **Per-step model and effort configuration** — SDLC runner now supports per-step `model` and `effort` overrides in `sdlc-config.json`, with a three-level fallback chain: phase-level → step-level → global → default; the implement step splits into separate plan (Opus) and code (Sonnet) phases with independent model/effort/maxTurns/timeout settings
- **`validateConfig(config)`** — Config validation function that rejects invalid effort values and empty model strings at startup, preventing runtime failures from misconfigured steps
- **`resolveStepConfig(step, config)`** — Resolution helper implementing the model/effort fallback chain for generic steps
- **`resolveImplementPhaseConfig(step, config, phase)`** — Resolution helper for the implement step's plan/code phases, including maxTurns and timeout fallback
- **`runImplementStep(step, state)`** — Two-phase implement execution: plan phase (read specs, design approach) followed by code phase (execute tasks), with separate logging (`implement-plan`, `implement-code`), soft failure detection, and Discord status for each phase
- **`spec-implementer` agent** — New agent (`plugins/nmg-sdlc/agents/spec-implementer.md`) for executing implementation tasks from specs; runs on Sonnet, auto-invoked by `/implementing-specs` during Step 5
- **Skill `model` frontmatter** — All 11 SKILL.md files now declare a recommended `model` field: `opus` for writing-specs, implementing-specs, migrating-projects, running-retrospectives, setting-up-steering; `sonnet` for creating-issues, creating-prs, generating-openclaw-config, installing-openclaw-skill, starting-issues, verifying-specs
- **`CLAUDE_CODE_EFFORT_LEVEL` env var** — `runClaude()` sets this in the subprocess environment when effort is configured, enabling per-step effort control

### Changed

- **`buildClaudeArgs()`** — Now accepts an `overrides` object for model and prompt, allowing callers to override the global model and default prompt per invocation
- **`runClaude()`** — Now accepts an `overrides` object for model, effort, and prompt; resolves config via `resolveStepConfig()` with fallback to globals
- **`runStep()`** — Step 4 (implement) now delegates to `runImplementStep()` for two-phase execution instead of a single `runClaude()` call
- **`sdlc-config.example.json`** — Added global `effort`, per-step `model`/`effort`, and `plan`/`code` sub-objects for the implement step
- **`/implementing-specs`** — Step 5 now delegates to `spec-implementer` agent via Task tool in interactive mode; auto-mode continues to work inline
- **README.md** — Added "Model & Effort Configuration" section with recommendations table and configuration layer documentation

## [2.13.0] - 2026-02-22

### Added

- **`/running-retrospectives`** — SHA-256 content hashing and state tracking (`retrospective-state.json`) so unchanged defect specs are skipped on subsequent runs; carried-forward learnings extracted from existing `retrospective.md` tables; output summary now shows spec partition breakdown (new/modified/skipped/removed) and learning source breakdown (new vs. carried forward)

## [2.12.13] - 2026-02-22

### Fixed

- **`/running-retrospectives`** — Defect spec discovery rewritten from unreliable Grep-glob (`*/requirements.md` misses two-level paths) to deterministic Glob + Read-heading approach; added chain resolution that follows defect-to-defect `Related Spec` links to the root feature spec, with cycle detection and orphan handling
- **`/writing-specs`** — Phase 1 Step 7 Related Spec search now filters out defect specs (checks first heading for `# Defect Report:`) and follows defect chains to find the root feature spec when no feature spec directly matches keywords
- **`/migrating-projects`** — New Step 4a validates `Related Spec` links in defect specs: checks target existence, verifies target is a feature spec, follows chains through defect specs, detects circular references, and presents corrections for user approval

## [2.12.12] - 2026-02-20

### Fixed

- **`/migrating-projects`** — Missing template sections are now filtered by codebase evidence (glob-based relevance heuristics) before being proposed; users can approve or decline individual sections via `multiSelect`; declined sections are persisted in `.claude/migration-exclusions.json` and skipped on future runs

## [2.12.11] - 2026-02-20

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Removed fragile `#N` regex fallback in `extractStateFromStep` that could match stale issue numbers from previous cycles in conversation transcripts; issue number is now derived exclusively from the branch name (ground truth); added `git clean -fd && git checkout -- .` working tree cleanup to step 1 prompt to prevent cross-cycle file contamination

## [2.12.10] - 2026-02-20

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Version bumping during automated SDLC runs is now deterministic: added `validateVersionBump()` postcondition that detects missing version bumps after PR creation (Step 7), and `performDeterministicVersionBump()` recovery function that reads `VERSION`, issue labels, milestone, and `.claude/steering/tech.md` to compute and commit the correct bump; Step 7 prompt reinforced with explicit version bump mandate as defense-in-depth

## [2.12.9] - 2026-02-19

### Fixed

- **`/starting-issues`** — Milestone selection no longer iterates through random milestones; now fetches milestones with `open_issues` metadata, filters to viable milestones, and applies deterministic 3-way selection (zero → fallback to all issues, one → auto-select, multiple → present to user or pick first alphabetically in auto-mode)

## [2.12.8] - 2026-02-19

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Runner now ensures `.claude/auto-mode` and `.claude/sdlc-state.json` are listed in the target project's `.gitignore` before creating runner artifacts, preventing `git add -A` from staging and committing them to the target project

## [2.12.7] - 2026-02-16

### Fixed

- **`/running-retrospectives`** — Severity grep pattern updated from plain `Severity:` to regex `\*{0,2}Severity\*{0,2}:` to match both bold-formatted (`**Severity**: High`) and plain (`Severity: High`) fields in defect specs; also fixed Related Spec field reference to use bold-formatted variant from defect template

## [2.12.6] - 2026-02-16

### Fixed

- **`/writing-specs`** — Defect variant now actively searches `.claude/specs/*/requirements.md` for related feature specs by keyword matching (file paths, function names, component names) instead of relying on passive agent intuition; populates the **Related Spec** field with any match or N/A if none found

## [2.12.5] - 2026-02-16

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — Process cleanup rewritten to use PID tree killing instead of `pkill -f`: kills entire process trees (all descendants) for each matched PID, uses filtered PID list directly instead of re-matching with `pkill`, tracks `lastClaudePid` to scope cleanup to runner-spawned processes, falls back to pattern-based matching for orphaned processes (PPID=1), and always emits `[CLEANUP]` log entries

## [2.12.4] - 2026-02-16

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — SDLC runner infinite retry when repo has no CI checks: `gh pr checks` exits code 1 with "no checks reported" on repos without CI workflows; Steps 8 (monitorCI) and 9 (merge) now detect this and treat it as a passing condition instead of retrying indefinitely

## [2.12.3] - 2026-02-16

### Fixed

- **`/migrating-projects`** — Skill now explicitly ignores `.claude/auto-mode` and always presents proposed changes for interactive review via `AskUserQuestion`, matching the original spec's out-of-scope declaration that migration is always interactive

## [2.12.2] - 2026-02-16

### Fixed

- **`openclaw/scripts/sdlc-runner.mjs`** — 6 edge case bugs: `currentProcess` never assigned so SIGTERM couldn't kill subprocess (F1); `Atomics.wait()` blocking event loop during Discord retry (F2); incomplete shell escaping in `autoCommitIfDirty` (F3); uncaught exception on merged-PR `git checkout` with dirty worktree (F4); silent retry counter reset when `--resume` used with missing state file (F5); unused `AbortController` dead code in `runClaude()` (F6)

## [2.12.1] - 2026-02-16

### Added

- **`/verifying-specs`** — Exercise-based verification for plugin projects: generates targeted exercises that test plugin capabilities through real usage scenarios instead of relying on traditional test suites

## [2.12.0] - 2026-02-16

### Added

- **Integrated versioning system** — `VERSION` file (plain text semver) as the single source of truth for project versions
- **`/creating-issues`** — Milestone assignment step: reads VERSION for major version default, creates milestones via `gh api` if missing, passes `--milestone` to `gh issue create`
- **`/creating-prs`** — Automatic version bump classification: reads issue labels (`bug` → patch, `enhancement` → minor), detects milestone completion for major bumps, updates VERSION/CHANGELOG/stack-specific files
- **`/migrating-projects`** — CHANGELOG.md analysis: generates from git history if missing, reconciles existing changelogs with Keep a Changelog format
- **`/migrating-projects`** — VERSION file analysis: derives expected version from CHANGELOG/git tags, creates or updates VERSION
- **tech.md template** — New `## Versioning` section: declares stack-specific version file mappings (file/path/notes table) bridging VERSION to package.json, Cargo.toml, etc.

### Changed

- **`/creating-issues`** — Workflow expanded from 8 to 9 steps (milestone assignment inserted as Step 3); auto-mode runs Step 3 non-interactively
- **`/creating-prs`** — Workflow expanded from 4 to 6 steps (version bump classification as Step 2, version artifact updates as Step 3); PR body includes Version section
- **`/migrating-projects`** — Workflow expanded from 8 to 10 steps (CHANGELOG analysis as Step 7, VERSION analysis as Step 8); "What Gets Analyzed" section updated

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

- **`/migrating-projects`** — New skill that updates existing project specs, steering docs, and OpenClaw configs to latest template standards by diffing headings against current templates and merging missing sections while preserving all user content
- **`/running-retrospectives`** — New skill that batch-analyzes defect specs to identify spec-writing gaps (missing ACs, undertested boundaries, domain-specific gaps) and produces `.claude/steering/retrospective.md` with actionable learnings
- **`/creating-issues`** — Upfront issue type classification: first question after gathering context asks whether this is a Bug or Enhancement/Feature via `AskUserQuestion`, then performs type-specific codebase investigation before the interview
- **`/creating-issues`** — Enhancement path: explores existing specs and source code, adds "Current State" section to issue body between Background and Acceptance Criteria
- **`/creating-issues`** — Bug path: searches codebase, traces code paths, forms root cause hypothesis, confirms with user, adds "Root Cause Analysis" section to issue body

### Changed

- **`/setting-up-steering`** — Now detects existing steering files and offers an enhancement flow instead of always running the bootstrap flow; metadata and documentation updated to reflect iterative use
- **`/writing-specs`** — Phase 1 now reads `retrospective.md` (when present) to apply defect-derived learnings when drafting acceptance criteria
- **`/creating-issues`** — Interview questions now branch explicitly by issue type instead of adapting passively; workflow expanded from 6 steps to 8 steps (classification and investigation inserted as Steps 2–3); auto-mode references updated accordingly

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
- **`/writing-specs`** — Defect Detection section: reads `bug` label from GitHub issue and routes all three phases to defect template variants; includes complexity escape hatch for architectural bugs
- **`/creating-issues`** — Bug Report issue body template with reproduction steps, expected/actual behavior, environment table, and defect-focused acceptance criteria; expanded bug interview questions
- **`/implementing-specs`** — Bug Fix Implementation guidance: follow fix strategy precisely, flat task execution, minimize change scope, regression test required
- **`/verifying-specs`** — Bug Fix Verification guidance: reproduction check, `@regression` scenario validation, blast radius focus, minimal change audit
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
- **`/implementing-specs`** — Clarify auto-mode: Steps 1–3 are still required, only Step 4 (EnterPlanMode) is skipped
- **`/writing-specs`** — Add Feature Name Convention section defining the `{feature-name}` algorithm (issue number + kebab-case slug)
- **`/writing-specs`** — Add inline auto-mode conditionals at each Human Review Gate for unambiguous behavior
- **`/implementing-specs`, `/verifying-specs`, `/creating-prs`** — Add feature-name fallback: use `Glob` to find specs if feature-name is ambiguous
- **`/starting-issues`** — Specify auto-mode issue sort order: issue number ascending (oldest first)
- **`/verifying-specs`** — Add standard Automation Mode section for consistency with other skills
- **`/verifying-specs`** — Add fix-vs-defer heuristic: fix findings under ~20 lines; defer architectural changes
- **`/creating-issues`** — Clarify auto-mode inference: read `product.md`, generate 3–5 Given/When/Then acceptance criteria
- **`/creating-issues`** — Reword interview as adaptive questioning (skip answered topics, aim for 2–3 rounds)
- **`/creating-prs`** — Add auto-mode conditional output (`Done. Awaiting orchestrator.`)
- **OpenClaw prompt** — Spec validation gate uses glob instead of unresolved `{feature-name}` template variable
- **OpenClaw prompt** — Merge step now verifies CI via `gh pr checks` before merging
- **OpenClaw prompt** — Clarify retry count attribution: Step N precondition failure retries Step N-1 against N-1's cap
- **OpenClaw prompt** — Escalation protocol now commits/pushes partial work and checks out main before stopping

### Removed

- **`/beginning-dev`** skill — removed; use `/starting-issues` directly, then chain `/writing-specs` and `/implementing-specs` manually or via orchestrator
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
- Remove unused `EnterPlanMode` and `Skill` from `/writing-specs` allowed-tools — prevents unintended plan mode entry during spec writing
- Remove unused `Skill` from `/implementing-specs` allowed-tools
- Remove `Task` from architecture-reviewer agent tools — subagents cannot nest; agent now uses Read/Glob/Grep directly
- Clarify `/verifying-specs` Step 4 to explicitly delegate to the `nmg-sdlc:architecture-reviewer` agent instead of generic Explore subagents
- Upgrade spec alignment PostToolUse hook from `prompt` to `agent` type so it can read spec files when checking for drift
- Add top-level `description` to hooks.json
- Fix `generating-prompt` skill's `Bash(cat * | *)` allowed-tools pattern to standard `Bash(cat:*)`

## [1.10.1] - 2026-02-13

### Fixed

- Prevent `EnterPlanMode` from being called in headless automation sessions
- Use per-step stall timeouts instead of flat 5-minute threshold in OpenClaw automation prompt

## [1.10.0] - 2026-02-13

### Added

- `/beginning-dev` — Automation Mode: in auto-mode, runs only `/starting-issues` then stops; orchestrator handles remaining skills with `/clear` between steps

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
  - **`/writing-specs`** — All 3 Human Review Gates skipped in automation mode
  - **`/starting-issues`** — Issue selection and confirmation skipped when issue number provided
  - **`/creating-issues`** — Interview and review steps skipped; uses argument as feature description
  - **`/implementing-specs`** — Plan mode and approval gates skipped

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

- **`/starting-issues`** — New standalone skill: select a GitHub issue, create linked feature branch, set issue to In Progress
- **Automation hooks** — Four new hooks that let external agents (e.g., OpenClaw) drive the SDLC without human input, gated by a `.claude/auto-mode` flag file:
  - `PermissionRequest` → auto-allows all tool permissions
  - `PreToolUse` on `AskUserQuestion` → blocks questions and steers Claude to proceed with defaults
  - `PreToolUse` on `EnterPlanMode` → blocks plan mode and instructs Claude to plan internally
  - `Stop` → forces continuation when Claude would wait for free-form input (with loop prevention)
- **OpenClaw automation prompt** — Example prompt for driving the full SDLC cycle with an OpenClaw agent (`openclaw-automation-prompt.md`)

### Changed

- **`/beginning-dev`** — Now delegates issue selection and branch setup to `/starting-issues` instead of handling inline
- **README** — Added Automation Mode section documenting hooks, enable/disable, default behaviors, and OpenClaw example

## [1.3.1] - 2026-02-11

### Changed

- **`/beginning-dev`** — Added context compaction handoffs between phases (writing-specs, implementing-specs) to free context window for each phase

## [1.3.0] - 2026-02-10

### Changed

- **`/verifying-specs`** — No longer read-only; now fixes findings during verification before generating report
- **`/verifying-specs`** — Added `Write`, `Edit`, and `Bash(git:*)` to allowed tools
- **`/verifying-specs`** — Report restructured: "Issues Found" replaced with "Fixes Applied" and "Remaining Issues" sections
- **`/verifying-specs`** — New Step 6 (Fix Findings) with prioritization, test-after-fix, re-verification, and deferral workflow

## [1.2.1] - 2026-02-10

### Changed

- Updated README skills reference to match actual SKILL.md definitions and argument hints

### Fixed

- Spec alignment hook now returns expected `{ok, reason}` JSON format and references `$ARGUMENTS` for edit context

## [1.2.0] - 2026-02-10

### Added

- **`/beginning-dev`** — Pick a GitHub issue to work on, then automatically chain through `/writing-specs` and `/implementing-specs`

### Fixed

- **`/beginning-dev`** — Now links the feature branch to the GitHub issue (via `gh issue develop`) and updates the issue status to "In Progress" in any associated GitHub Project

## [1.0.0] - 2026-02-10

### Added

- **nmg-sdlc plugin** — Stack-agnostic BDD spec-driven development toolkit
- **`/creating-issues`** — Interview user, create groomed GitHub issue with BDD acceptance criteria
- **`/writing-specs`** — Create requirements, design, and task specs from a GitHub issue (3-phase with human gates)
- **`/implementing-specs`** — Read specs, enter plan mode, execute implementation tasks sequentially
- **`/verifying-specs`** — Verify implementation against spec, architecture review, update GitHub issue with evidence
- **`/creating-prs`** — Create pull request with spec-driven summary linking issue and specs
- **`/setting-up-steering`** — One-time codebase scan to generate product, tech, and structure steering documents
- **architecture-reviewer agent** — SOLID, security, performance, testability, error handling evaluation
- **Verification checklists** — SOLID principles, security (OWASP), performance, testability, error handling, report template
- **Spec templates** — Requirements, design, tasks, and Gherkin feature file templates
- **Steering templates** — Product, tech, and structure templates for project bootstrapping
- **Spec alignment hook** — PostToolUse hook that checks file modifications against active specs
