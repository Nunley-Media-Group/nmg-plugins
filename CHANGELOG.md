# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
