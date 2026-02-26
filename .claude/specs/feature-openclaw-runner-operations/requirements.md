# Requirements: OpenClaw Runner Operations

**Issues**: #12, #24, #33, #34, #88, #90
**Date**: 2026-02-25
**Status**: Complete
**Author**: Claude Code (consolidated from issues #12, #24, #33, #34, #88)

---

## User Story

**As an** OpenClaw agent operator,
**I want** a deterministic script-based SDLC orchestrator that drives the full development cycle via Claude Code subprocesses,
**So that** the SDLC workflow runs reliably with proper step sequencing, precondition validation, retry logic, and Discord status reporting.

---

## Background

The OpenClaw SDLC runner (`openclaw/scripts/sdlc-runner.mjs`) is a Node.js orchestrator that replaced the earlier prompt-engineered heartbeat loop. It drives the complete SDLC cycle — issue selection, spec writing, implementation, verification, PR creation, CI checks, and merge — using `claude -p` subprocesses with deterministic `for`-loop step sequencing. Each step has precondition validation, configurable timeouts and maxTurns, and retry logic with escalation. The runner posts Discord status updates at each step, auto-commits dirty work trees after implementation, auto-detects in-progress work from git state on startup, and tracks `lastCompletedStep` for proper resume behavior.

Additional capabilities were added iteratively: configurable post-step process cleanup to kill orphaned processes (e.g., Chrome instances) spawned by Claude subprocesses; failure loop detection to halt the runner when consecutive escalations, same-issue loops, or step-bounce loops are detected; and persistent per-step logging to OS-agnostic temp directories for post-hoc debugging of headless sessions.

---

## Acceptance Criteria

### AC1: Full SDLC Cycle Runs End-to-End

**Given** the runner is started with a valid config
**When** it runs to completion
**Then** it executes all SDLC steps: issue selection, spec writing, implementation, verification, PR creation, CI verification, and merge

### AC2: Steps Have Precondition Validation

**Given** the runner advances to a new step
**When** preconditions for that step are checked
**Then** the step only proceeds if all preconditions pass (e.g., spec files exist before implementation)

### AC3: Failed Steps Retry With Escalation

**Given** a step fails
**When** retries are attempted
**Then** the step retries up to its configured cap, and escalation occurs if all retries are exhausted

### AC4: Discord Status Updates at Each Step

**Given** a Discord channel is configured
**When** each step starts, completes, or fails
**Then** a status message is posted to Discord via `openclaw message send`

### AC5: Resume Detects In-Progress Work

**Given** the runner starts on a feature branch with existing work
**When** it inspects git state (branch name, specs, commits, PR status, CI)
**Then** it hydrates state from reality and resumes from the correct step

### AC6: Auto-Commit After Implementation

**Given** implementation (Step 4) completes with uncommitted changes
**When** the step finishes
**Then** the runner auto-commits and pushes so verification preconditions pass

<!-- From issue #24 -->

### AC7: Configurable Process Cleanup Patterns

**Given** a config file with a `cleanup.processPatterns` array (e.g., `["chrome", "chromium"]`)
**When** the runner loads the config
**Then** it stores the patterns for use in post-step cleanup

### AC8: Post-Step Cleanup Runs After Every Step

**Given** a step completes (success or failure) and process patterns are configured
**When** the runner transitions between steps
**Then** it kills any running processes matching the configured patterns before starting the next step

### AC9: Cleanup Runs on Escalation

**Given** an escalation is triggered and process patterns are configured
**When** the runner escalates
**Then** it kills matching processes before returning to main or exiting

### AC10: Cleanup Runs on Graceful Shutdown

**Given** the runner receives SIGTERM/SIGINT and process patterns are configured
**When** it performs graceful shutdown
**Then** it kills matching processes before exiting

### AC11: Cleanup Is Optional and Backward-Compatible

**Given** a config file without `cleanup.processPatterns`
**When** the runner runs normally
**Then** no cleanup is performed and behavior is identical to the current version

### AC12: Cleanup Logs Actions

**Given** cleanup kills one or more processes
**When** the cleanup completes
**Then** the runner logs which processes were killed and how many

<!-- From issue #33 -->

### AC13: Consecutive Escalation Detection — Runner Halts After 2 Back-to-Back Escalations

**Given** the runner is in continuous loop mode processing open issues
**When** 2 consecutive cycles result in escalation without any successful cycle completion in between
**Then** the runner posts a detailed failure-loop diagnostic to Discord and exits immediately with a non-zero exit code, leaving state as-is for manual inspection

### AC14: Same-Issue Loop Detection — Runner Skips Previously-Escalated Issues

**Given** an issue caused an escalation in the current runner session
**When** the runner loops back and encounters the same issue as the next candidate
**Then** the runner skips that issue and selects the next open issue; if all remaining issues have been escalated, the runner halts with a Discord report and non-zero exit

### AC15: Step Bounce Loop Detection — Runner Halts on Excessive Step-Back Transitions

**Given** a cycle is in progress and steps are bouncing back via `retry-previous`
**When** the total number of step-back transitions within a single cycle exceeds `maxRetriesPerStep` (default 3)
**Then** the runner escalates the current cycle, posts a bounce-loop diagnostic to Discord, and exits immediately with non-zero exit code

### AC16: Discord Report Contains Actionable Diagnostics

**Given** any failure loop is detected (consecutive escalation, same-issue, or step bounce)
**When** the runner posts the halt notification to Discord
**Then** the message includes: loop type detected, affected issue number(s), step(s) involved, total escalation count, and the last 500 characters of subprocess output

### AC17: State Preserved for Manual Inspection

**Given** a failure loop halt is triggered
**When** the runner exits
**Then** `sdlc-state.json` is NOT reset, `.claude/auto-mode` is NOT removed, the working tree is left as-is, and the branch is NOT changed — allowing manual inspection of the failure state

<!-- From issue #34 -->

### AC18: Per-Step Logs Are Written to OS-Agnostic Temp Directory

**Given** the SDLC runner is executing a step (e.g., `writeSpecs`)
**When** the `claude -p` subprocess completes (success or failure)
**Then** the full stdout and stderr are written to a log file in an OS-agnostic temp directory (e.g., `os.tmpdir()/sdlc-logs/<project-name>/`)

### AC19: Log Files Follow Naming Convention

**Given** a step subprocess has completed
**When** the log file is created
**Then** the filename includes the step name, Claude Code session identifier, and ISO 8601 timestamp (e.g., `writeSpecs-<session-id>-2026-02-16T10-30-00.log`). Additionally, a `{step}-live.log` file is written in real-time during execution for `tail -f` observability.

### AC20: Runner Orchestration Log Moves to Same Directory

**Given** the SDLC runner is starting up
**When** it initializes logging
**Then** the runner's own orchestration log is written to the same OS-agnostic temp directory as per-step logs (replacing the hardcoded `/tmp/sdlc-runner.log`)

### AC21: Log Directory Respects Max Disk Usage

**Given** the log directory has accumulated logs exceeding a configurable size threshold
**When** a new log file is about to be written
**Then** the oldest log files are deleted until total usage is under the threshold

### AC22: Config Supports Logging Options

**Given** a user is configuring `sdlc-config.json`
**When** they set logging-related fields (e.g., `logDir`, `maxLogDiskUsageMB`)
**Then** the runner uses those values, falling back to sensible defaults (`os.tmpdir()/sdlc-logs/<project-name>/`, 500 MB)

### AC23: Running-SDLC Skill Documents Log Location and Naming

**Given** a user reads the `running-sdlc` SKILL.md
**When** they look for log information
**Then** the skill documents the log directory location, naming convention, and how to configure logging options

### AC24: Cross-Platform Compatibility

**Given** the runner is executing on macOS, Linux, or Windows
**When** it resolves the log directory
**Then** it uses `os.tmpdir()` (or equivalent) and path separators appropriate to the OS

<!-- From issue #88 -->

### AC25: Configurable Bounce Retry Threshold

**Given** an operator wants to tune the bounce loop threshold
**When** they set a `maxBounceRetries` field in `sdlc-config.json`
**Then** the runner uses that value as the bounce loop halt threshold in all bounce detection paths (both `handleFailure()` retry-previous and `runStep()` precondition retry-previous)

### AC26: Backward-Compatible Default for Bounce Retries

**Given** `sdlc-config.json` does not include a `maxBounceRetries` field
**When** the runner starts
**Then** the default value of 3 is used, preserving existing behavior

### AC27: Enhanced Bounce Loop Logging with Precondition Name

**Given** a bounce loop retry occurs because a precondition check failed
**When** the runner logs the bounce event
**Then** the log includes the specific precondition that failed, the current bounce count, and the configured threshold

### AC28: Discord Status Includes Bounce Diagnostics

**Given** a bounce occurs and the runner reports to Discord
**When** the status message is sent
**Then** it includes the bounce count, the configured threshold, and which step is being retried

### AC29: Invalid Config Value Falls Back to Default

**Given** the `maxBounceRetries` config value is not a positive integer (e.g., 0, -1, `"abc"`, `null`)
**When** the runner loads the config
**Then** it falls back to the default value of 3 and logs a warning about the invalid value

<!-- From issue #90 -->

### AC30: Requirements.md Frontmatter Validation

**Given** `/writing-specs` has completed (Step 3)
**When** the runner runs post-step validation
**Then** it checks that `requirements.md` contains `**Issues**:` frontmatter and at least one `### AC` heading

### AC31: Tasks.md Content Validation

**Given** `/writing-specs` has completed (Step 3)
**When** the runner runs post-step validation
**Then** it checks that `tasks.md` contains at least one task heading matching `### T` (e.g., `### T001:`)

### AC32: Content Validation Failure Triggers Retry

**Given** post-Step 3 content validation fails for one or more spec files
**When** the runner processes the validation result
**Then** it triggers a retry of Step 3 (writing-specs) with the specific missing elements reported in the retry context

### AC33: Validation Reports Specific Missing Elements Per File

**Given** multiple content checks are performed across spec files
**When** one or more checks fail
**Then** the validation error message lists each individual check that failed per file (e.g., "requirements.md: missing **Issues** frontmatter; tasks.md: no task headings found") rather than a generic "validation failed" message

### AC34: Existing File-Existence Checks Are Preserved

**Given** the runner validates spec files after Step 3
**When** content validation logic is added
**Then** the existing file-existence and non-zero-size checks still run before content checks, and a missing file is reported as a missing-file error (not a content-structure error)

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Deterministic step sequencing via `for` loop | Must | Not prompt-engineered |
| FR2 | `claude -p` subprocess execution per step with configurable maxTurns and timeouts | Must | Per-step config |
| FR3 | Precondition validation before each step | Must | Step-specific checks |
| FR4 | Retry logic with configurable cap and escalation | Must | Per-step retry limits |
| FR5 | Discord status posting via `openclaw message send` | Must | With retry/backoff |
| FR6 | `lastCompletedStep` tracking for correct resume behavior | Must | State persistence |
| FR7 | Auto-detection of in-progress work from git state on startup | Must | Branch, specs, commits, PR, CI |
| FR8 | Auto-commit of dirty work tree after implementation step | Must | `git add -A && git commit` |
| FR9 | Config file support (`sdlc-config.json`) with per-step settings | Must | JSON config format |
| FR10 | Add `cleanup.processPatterns` config field (array of process name patterns) | Should | New optional section in config schema |
| FR11 | Implement `cleanupProcesses()` function that kills processes matching configured patterns | Should | Uses cross-platform process killing |
| FR12 | Run cleanup after every step completion (success and failure paths) | Should | Insert into post-step logic |
| FR13 | Run cleanup during escalation handling | Should | Before escalation exit/return |
| FR14 | Run cleanup during graceful shutdown (SIGTERM/SIGINT) | Should | Before process exit |
| FR15 | Log cleanup actions (process names, count killed) | Should | Use existing logging conventions |
| FR16 | No-op when `cleanup` is not configured (backward-compatible) | Must | Guard all cleanup calls |
| FR17 | Track consecutive escalation count across cycles; halt at 2 | Must | Counter resets on successful cycle completion |
| FR18 | Track escalated issue numbers in-session; skip them on re-encounter | Must | In-memory set, not persisted to state file |
| FR19 | Track step-back transition count per cycle; halt when exceeding `maxRetriesPerStep` | Must | Counter resets at the start of each new cycle |
| FR20 | Post detailed diagnostic to Discord on any failure-loop halt | Must | Include loop type, issue numbers, steps, escalation count, last 500 chars of output |
| FR21 | Exit with non-zero code on failure-loop halt, preserving all state | Must | No state reset, no auto-mode removal, no branch checkout |
| FR22 | Reset consecutive escalation counter on any successful cycle completion | Should | A successful merge (step 9) resets the counter |
| FR23 | Write per-step `claude -p` subprocess output (stdout + stderr) to individual log files | Must | In `runClaude()` after subprocess completes |
| FR24 | Use OS-agnostic temp directory via `os.tmpdir()` for log storage | Must | Replaces hardcoded `/tmp/` |
| FR25 | Name log files with step name, session identifier, and ISO timestamp | Must | Session ID from Claude JSON output or fallback UUID |
| FR26 | Move runner orchestration log from hardcoded `/tmp/` to the same log directory | Must | Affects SKILL.md `nohup` redirect |
| FR27 | Implement max disk usage cleanup — delete oldest logs when threshold exceeded | Must | Run before writing each new log |
| FR28 | Add `logDir` and `maxLogDiskUsageMB` fields to config schema with defaults | Should | Defaults: `os.tmpdir()/sdlc-logs/<project>/`, 500 MB |
| FR29 | Update `running-sdlc` SKILL.md with log location, naming conventions, and config options | Must | Documentation update |
| FR30 | Update `sdlc-config.example.json` with logging config fields | Should | Example config stays current |
| FR31 | Read `maxBounceRetries` from `sdlc-config.json` top-level field at startup | Must | Single read point; used in all bounce detection paths |
| FR32 | Default `maxBounceRetries` to 3 if not present in config | Must | Backward-compatible with existing configs |
| FR33 | Validate `maxBounceRetries` is a positive integer; fall back to 3 with warning on invalid values | Should | Guards against 0, negative, non-numeric inputs |
| FR34 | Include the specific failed precondition name in bounce loop log messages | Should | e.g., "Precondition failed: spec files exist" |
| FR35 | Include bounce count, configured threshold, and retrying step name in Discord bounce status messages | Should | Format: `(bounce N/M)` with step identification |
| FR36 | Update `sdlc-config.example.json` with `maxBounceRetries` field | Should | Example config stays current |
| FR37 | Validate `requirements.md` contains `**Issues**:` frontmatter after Step 3 | Must | Content check, not just file existence |
| FR38 | Validate `requirements.md` contains at least one `### AC` heading after Step 3 | Must | Ensures acceptance criteria were generated |
| FR39 | Validate `tasks.md` contains at least one task heading (`### T`) after Step 3 | Must | Ensures implementation tasks were generated |
| FR40 | Report each specific missing element individually in validation failure output | Must | Actionable retry context |
| FR41 | Trigger Step 3 retry on content validation failure with missing elements in retry context | Must | Reuses existing retry mechanism |
| FR42 | Preserve existing file-existence and non-zero-size checks as prerequisite to content checks | Must | Content checks only run if files exist |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Each step bounded by configurable timeout; cleanup completes in < 5 seconds; log writing adds no measurable latency |
| **Security** | No secrets in config file; Discord channel ID is the only external reference; only kill processes matching user-configured patterns |
| **Reliability** | Resume from any failure point via git state detection; cleanup failures must not crash the runner; log write failures are non-fatal |
| **Platforms** | macOS and Linux for process cleanup (`pkill`/`pgrep`); macOS, Linux, and Windows for logging (`os.tmpdir()`) |
| **Backwards Compatibility** | Existing configs work without changes when `cleanup` and logging fields are omitted |
| **Zero-dependency** | Logging must use only Node.js built-in modules (`node:fs`, `node:path`, `node:os`) |

---

## Dependencies

### Internal Dependencies
- [x] All SDLC skills (#3-#8, #10, #11) for step execution
- [x] Automation mode (#11) for headless skill operation
- [x] `openclaw/scripts/sdlc-runner.mjs` — the file being modified for cleanup, loop detection, and logging
- [x] `running-sdlc` SKILL.md — `nohup` redirect needs updating for logging

### External Dependencies
- [x] `claude` CLI for subprocess execution
- [x] `openclaw message send` for Discord integration
- [x] `gh` CLI for PR and CI operations
- [x] Node.js runtime for script execution
- [x] OS process listing/killing commands (`pkill`/`pgrep`) for process cleanup

---

## Out of Scope

- Multi-repo orchestration
- Parallel step execution
- Custom step ordering or step skip configuration
- Integration with CI/CD systems beyond `gh pr checks`
- Process group / cgroup-based tree killing
- Cleanup of non-process resources (temp files, ports, etc.)
- Discord reporting of cleanup actions (just log locally)
- Automatic detection of what to clean up — must be explicitly configured
- Windows support for process cleanup (OpenClaw currently targets macOS/Linux for cleanup)
- ~~Configurable failure loop thresholds (hardcode sensible defaults for now)~~ (bounce retry threshold now configurable via #88; consecutive escalation threshold remains hardcoded at 2)
- Per-step bounce retry thresholds (one global `maxBounceRetries` setting is sufficient for now)
- Exponential backoff between bounce retries
- Configurable consecutive escalation threshold (remains hardcoded at 2)
- Auto-recovery strategies (e.g., automatically closing problematic issues)
- Validating `design.md` or `testplan.md` content structure (start with the most critical files — `requirements.md` and `tasks.md`)
- Validating semantic correctness of acceptance criteria or task descriptions
- Adding content validation to steps other than Step 3 (writing-specs)
- ~~Log streaming or real-time tailing UI~~ (implemented: `{step}-live.log` files with real-time streaming via `--output-format stream-json`)
- Structured/JSON log format (plain text is sufficient)
- Log aggregation to external services (Datadog, ELK, etc.)
- Compression of old log files

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Orphaned process count after multi-step run | 0 matching processes remain | Check `pgrep` after a full SDLC cycle |
| Backward compatibility | Existing configs work without changes | Run with config lacking `cleanup` field |
| Failure loop halts | Runner never exceeds 2 consecutive escalations | Observe runner logs during automated cycles |
| Same-issue avoidance | Previously-escalated issues are never re-attempted in same session | Runner logs show skip messages |
| Diagnostic quality | Discord reports are actionable without checking server logs | Manual review of Discord halt messages |
| Debugging visibility | Full step output available post-execution | Log files exist for every completed step |
| Cross-platform | Logs written correctly on macOS, Linux, Windows | `os.tmpdir()` resolves correctly per platform |
| Disk hygiene | Log directory stays under configured threshold | Cleanup runs before each write |
| Configurable bounce threshold | Custom `maxBounceRetries` value respected in all bounce paths | Set to 5, observe 4 bounces allowed before escalation |
| Bounce diagnostic quality | Discord bounce messages are actionable without checking logs | Messages include precondition name, bounce count, threshold, and step |
| Content validation catch rate | Malformed specs caught before downstream steps | Run with spec files missing frontmatter or task headings; verify retry triggers |
| Validation specificity | Error messages identify exactly which checks failed | Review validation output for per-file, per-check detail |

---

## Change History

| Issue | Date | Description |
|-------|------|-------------|
| #12 | 2026-02-15 | Initial OpenClaw SDLC orchestration — deterministic runner, Discord integration, resume detection, auto-commit |
| #24 | 2026-02-15 | Configurable post-step process cleanup via `cleanup.processPatterns` config field |
| #33 | 2026-02-16 | Failure loop detection — consecutive escalation halt, same-issue skip, step-bounce detection |
| #34 | 2026-02-16 | Persistent logging for headless sessions — per-step log files, OS-agnostic log directory, disk usage cap |
| #88 | 2026-02-25 | Configurable bounce retry threshold via `maxBounceRetries` config field, enhanced bounce diagnostics in logs and Discord |
| #90 | 2026-02-25 | Post-Step 3 spec content structure validation — frontmatter fields, AC headings, task headings — with specific error reporting and retry on failure |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
