# Requirements: Persistent Logging for Headless Sessions

**Issue**: #34
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude (from issue by rnunley-nmg)

---

## User Story

**As a** developer debugging headless OpenClaw SDLC cycles
**I want** all Claude Code session output persisted to log files with clear naming conventions
**So that** I can introspect and debug individual step executions after the fact

---

## Background

The SDLC runner (`sdlc-runner.mjs`) launches `claude -p` subprocesses for each step in the development cycle. Currently, subprocess stdout/stderr is captured in memory for error pattern matching but never persisted to disk. The only persistent log is the runner's orchestration log at `/tmp/sdlc-runner.log`, which contains step transitions and timing — not the actual Claude Code output. When a step fails or produces unexpected results, the only visibility is a truncated 500-character excerpt in Discord escalation messages.

This makes debugging headless sessions extremely difficult. Moving to persistent per-step logs with an OS-agnostic location also addresses the hardcoded `/tmp/` path, which is platform-specific.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Per-Step Logs Are Written to OS-Agnostic Temp Directory

**Given** the SDLC runner is executing a step (e.g., `writeSpecs`)
**When** the `claude -p` subprocess completes (success or failure)
**Then** the full stdout and stderr are written to a log file in an OS-agnostic temp directory (e.g., `os.tmpdir()/sdlc-logs/<project-name>/`)

**Example**:
- Given: Runner executes `writeSpecs` step for project `my-app`
- When: The `claude -p` subprocess exits with code 0
- Then: A log file is created at `<os.tmpdir()>/sdlc-logs/my-app/writeSpecs-<session-id>-2026-02-16T10-30-00.log` containing the full stdout and stderr

### AC2: Log Files Follow Naming Convention

**Given** a step subprocess has completed
**When** the log file is created
**Then** the filename includes the step name, Claude Code session identifier, and ISO 8601 timestamp (e.g., `writeSpecs-<session-id>-2026-02-16T10-30-00.log`)

**Example**:
- Given: Step `implementSpecs` completed at 2026-02-16T14:22:33Z with session ID `abc123`
- When: The log file is written
- Then: Filename is `implementSpecs-abc123-2026-02-16T14-22-33.log`

### AC3: Runner Orchestration Log Moves to Same Directory

**Given** the SDLC runner is starting up
**When** it initializes logging
**Then** the runner's own orchestration log is written to the same OS-agnostic temp directory as per-step logs (replacing the hardcoded `/tmp/sdlc-runner.log`)

**Example**:
- Given: Runner starts for project `my-app`
- When: It initializes
- Then: Orchestration log is at `<os.tmpdir()>/sdlc-logs/my-app/sdlc-runner.log` (not `/tmp/sdlc-runner.log`)

### AC4: Log Directory Respects Max Disk Usage

**Given** the log directory has accumulated logs exceeding a configurable size threshold
**When** a new log file is about to be written
**Then** the oldest log files are deleted until total usage is under the threshold

**Example**:
- Given: Log directory contains 520 MB of logs with a 500 MB threshold
- When: A new 5 MB log file is about to be written
- Then: The oldest logs are deleted until total is under 500 MB, then the new file is written

### AC5: Config Supports Logging Options

**Given** a user is configuring `sdlc-config.json`
**When** they set logging-related fields (e.g., `logDir`, `maxLogDiskUsageMB`)
**Then** the runner uses those values, falling back to sensible defaults (`os.tmpdir()/sdlc-logs/<project-name>/`, 500 MB)

**Example**:
- Given: Config has `"logDir": "/var/log/sdlc"` and `"maxLogDiskUsageMB": 200`
- When: Runner reads the config
- Then: Logs are written to `/var/log/sdlc/` with a 200 MB cleanup threshold

### AC6: Running-SDLC Skill Documents Log Location and Naming

**Given** a user reads the `running-sdlc` SKILL.md
**When** they look for log information
**Then** the skill documents the log directory location, naming convention, and how to configure logging options

### AC7: Cross-Platform Compatibility

**Given** the runner is executing on macOS, Linux, or Windows
**When** it resolves the log directory
**Then** it uses `os.tmpdir()` (or equivalent) and path separators appropriate to the OS

**Example**:
- Given: Runner executes on Windows
- When: It resolves the log directory with default config
- Then: Log directory is `C:\Users\<user>\AppData\Local\Temp\sdlc-logs\<project-name>\`

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Write per-step `claude -p` subprocess output (stdout + stderr) to individual log files | Must | In `runClaude()` after subprocess completes |
| FR2 | Use OS-agnostic temp directory via `os.tmpdir()` for log storage | Must | Replaces hardcoded `/tmp/` |
| FR3 | Name log files with step name, session identifier, and ISO timestamp | Must | Session ID from Claude JSON output or fallback UUID |
| FR4 | Move runner orchestration log from hardcoded `/tmp/` to the same log directory | Must | Affects SKILL.md `nohup` redirect |
| FR5 | Implement max disk usage cleanup — delete oldest logs when threshold exceeded | Must | Run before writing each new log |
| FR6 | Add `logDir` and `maxLogDiskUsageMB` fields to config schema with defaults | Should | Defaults: `os.tmpdir()/sdlc-logs/<project>/`, 500 MB |
| FR7 | Update `running-sdlc` SKILL.md with log location, naming conventions, and config options | Must | Documentation update |
| FR8 | Update `sdlc-config.example.json` with logging config fields | Should | Example config stays current |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Log writing must not add measurable latency to step execution; cleanup runs synchronously before write but should complete in <1s for typical log volumes |
| **Reliability** | If log writing fails (e.g., disk full, permissions), the SDLC step itself must not fail — log errors should be warned but non-fatal |
| **Platforms** | Must work on macOS, Linux, and Windows per tech.md cross-platform constraints |
| **Zero-dependency** | Must use only Node.js built-in modules (`node:fs`, `node:path`, `node:os`) per tech.md coding standards |

---

## UI/UX Requirements

Reference `structure.md` and `product.md` for project-specific design standards.

| Element | Requirement |
|---------|-------------|
| **Interaction** | [Touch targets, gesture requirements] |
| **Typography** | [Minimum text sizes, font requirements] |
| **Contrast** | [Accessibility contrast requirements] |
| **Loading States** | [How loading should be displayed] |
| **Error States** | [How errors should be displayed] |
| **Empty States** | [How empty data should be displayed] |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| [field] | [type] | [rules] | Yes/No |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| [field] | [type] | [what it represents] |

---

## Dependencies

### Internal Dependencies
- [x] `runClaude()` function in `sdlc-runner.mjs` (~line 628) — insertion point for log persistence
- [x] `running-sdlc` SKILL.md — `nohup` redirect needs updating

### External Dependencies
- None (uses only Node.js built-in modules)

### Blocked By
- None

---

## Out of Scope

- Log streaming or real-time tailing UI
- Structured/JSON log format (plain text is sufficient)
- Log aggregation to external services (Datadog, ELK, etc.)
- Compression of old log files
- Per-step log level configuration

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Debugging visibility | Full step output available post-execution | Log files exist for every completed step |
| Cross-platform | Logs written correctly on macOS, Linux, Windows | `os.tmpdir()` resolves correctly per platform |
| Disk hygiene | Log directory stays under configured threshold | Cleanup runs before each write |

---

## Open Questions

- [x] Session identifier source — Claude Code JSON output if available, otherwise generated UUID (per issue notes)
- [x] Default max disk usage — 500 MB (per issue specification)

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC4 disk cleanup, AC7 cross-platform)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
