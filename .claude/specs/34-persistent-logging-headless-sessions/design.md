# Design: Persistent Logging for Headless Sessions

**Issue**: #34
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude (from issue by rnunley-nmg)

---

## Overview

This design adds persistent per-step logging to the SDLC runner (`sdlc-runner.mjs`). Currently, the `runClaude()` function captures stdout/stderr in memory for error pattern matching but discards it after each step. The orchestration log is hardcoded to `/tmp/sdlc-runner.log` via a `nohup` redirect in the `running-sdlc` SKILL.md.

The change introduces a logging module within `sdlc-runner.mjs` that: (1) resolves an OS-agnostic log directory using `os.tmpdir()`, (2) writes per-step log files with a standardized naming convention after each `runClaude()` call, (3) moves the orchestration log into the same directory, and (4) enforces a configurable max disk usage threshold by pruning the oldest log files before each write.

All changes are confined to three files: `sdlc-runner.mjs` (logging logic), `running-sdlc/SKILL.md` (nohup redirect path and documentation), and `sdlc-config.example.json` (new config fields). No external dependencies are introduced — only `node:os`, `node:fs`, and `node:path` (already imported or available as built-ins).

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    sdlc-runner.mjs                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │  Config Loader   │──▶│  Log Dir Resolver │               │
│  │  (existing)      │    │  (NEW)            │               │
│  └─────────────────┘    └────────┬─────────┘               │
│                                  │                          │
│                                  ▼                          │
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │  runClaude()     │──▶│  writeStepLog()   │               │
│  │  (existing)      │    │  (NEW)            │               │
│  └─────────────────┘    └────────┬─────────┘               │
│                                  │                          │
│                                  ▼                          │
│                          ┌──────────────────┐               │
│                          │  enforceMaxDisk() │               │
│                          │  (NEW)            │               │
│                          └──────────────────┘               │
│                                                             │
│  ┌─────────────────┐                                        │
│  │  log() function  │──▶ Writes to orchestration log file   │
│  │  (MODIFIED)      │    AND console.log (dual output)      │
│  └─────────────────┘                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    File System                               │
├─────────────────────────────────────────────────────────────┤
│  <os.tmpdir()>/sdlc-logs/<project-name>/                    │
│  ├── sdlc-runner.log           (orchestration log)          │
│  ├── writeSpecs-abc123-2026-02-16T10-30-00.log              │
│  ├── implement-def456-2026-02-16T11-15-22.log               │
│  └── ...                                                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Runner starts → resolveLogDir() computes log directory from config or defaults
2. Log directory created (mkdirSync recursive)
3. log() function modified to append to <logDir>/sdlc-runner.log in addition to console
4. runClaude() completes → returns { exitCode, stdout, stderr, duration }
5. Caller (runStep) passes result to writeStepLog(stepKey, result)
6. writeStepLog() calls enforceMaxDisk() to prune old logs if needed
7. writeStepLog() extracts session ID from JSON output (or generates UUID)
8. writeStepLog() writes <stepKey>-<sessionId>-<timestamp>.log
9. On write failure, warning is logged but step execution is not affected
```

---

## API / Interface Changes

### New Functions in `sdlc-runner.mjs`

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `resolveLogDir(config, projectPath)` | config object, project path string | `string` (absolute path) | Compute log directory from config `logDir` or default to `os.tmpdir()/sdlc-logs/<project-name>/` |
| `writeStepLog(stepKey, result)` | step key string, `runClaude` result object | `void` | Write per-step log file; non-fatal on error |
| `enforceMaxDisk(logDir, maxBytes)` | directory path, max bytes number | `void` | Delete oldest `.log` files until total under threshold |
| `extractSessionId(jsonOutput)` | stdout string from `claude --output-format json` | `string` | Extract session ID from Claude JSON response, fallback to UUID |

### Config Schema Additions

Two new optional fields at the top level of `sdlc-config.json`:

```json
{
  "logDir": "/optional/custom/log/path",
  "maxLogDiskUsageMB": 500
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `logDir` | `string` (optional) | `os.tmpdir()/sdlc-logs/<project-basename>/` | Override log directory path |
| `maxLogDiskUsageMB` | `number` (optional) | `500` | Max total disk usage in MB before oldest logs are pruned |

---

## Database / Storage Changes

### Schema Changes

| Table / Collection | Column / Field | Type | Nullable | Default | Change |
|--------------------|----------------|------|----------|---------|--------|
| [name] | [name] | [type] | Yes/No | [value] | Add/Modify/Remove |

### Migration Plan

```
-- Describe the migration approach
-- Reference tech.md for migration conventions
```

### Data Migration

[If existing data needs transformation, describe the approach]

---

## State Management

Reference `structure.md` and `tech.md` for the project's state management patterns.

### New State Shape

```
// Pseudocode — use project's actual language/framework
FeatureState {
  isLoading: boolean
  items: List<Item>
  error: string | null
  selected: Item | null
}
```

### State Transitions

```
Initial → Loading → Success (with data)
                  → Error (with message)

User action → Optimistic update → Confirm / Rollback
```

---

## UI Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| [name] | [path per structure.md] | [description] |

### Component Hierarchy

```
FeatureScreen
├── Header
├── Content
│   ├── LoadingState
│   ├── ErrorState
│   ├── EmptyState
│   └── DataView
│       ├── ListItem × N
│       └── DetailView
└── Actions
```

---

## Detailed Design

### 1. Log Directory Resolution (`resolveLogDir`)

```javascript
import os from 'node:os';

function resolveLogDir(config, projectPath) {
  if (config.logDir) {
    return path.resolve(config.logDir);
  }
  const projectName = path.basename(projectPath);
  return path.join(os.tmpdir(), 'sdlc-logs', projectName);
}
```

- Uses `os.tmpdir()` for cross-platform default: `/tmp` on Linux/macOS, `C:\Users\<user>\AppData\Local\Temp` on Windows
- `path.basename()` extracts project directory name for namespace isolation
- Custom `logDir` in config overrides the default entirely
- Directory is created early in `main()` with `mkdirSync({ recursive: true })`

### 2. Orchestration Log Migration

The existing `log()` function (line 348) writes only to `console.log`. It will be modified to **also** append to `<logDir>/sdlc-runner.log`:

```javascript
const LOG_DIR = resolveLogDir(config, PROJECT_PATH);
const ORCHESTRATION_LOG = path.join(LOG_DIR, 'sdlc-runner.log');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(line.trimEnd());
  try {
    fs.appendFileSync(ORCHESTRATION_LOG, line);
  } catch { /* non-fatal */ }
}
```

This replaces the `nohup ... > /tmp/sdlc-runner.log 2>&1` redirect in the SKILL.md. The SKILL.md will be updated to redirect to the resolved path (or simply drop the redirect since `log()` now handles its own file output). The `nohup` redirect will change to send only unexpected stderr to the log dir.

### 3. Per-Step Log Writing (`writeStepLog`)

Called in `runStep()` immediately after `runClaude()` returns, regardless of exit code:

```javascript
function writeStepLog(stepKey, result) {
  try {
    const sessionId = extractSessionId(result.stdout);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${stepKey}-${sessionId}-${ts}.log`;
    const filepath = path.join(LOG_DIR, filename);

    enforceMaxDisk(LOG_DIR, MAX_LOG_DISK_BYTES);

    const content = [
      `Step: ${stepKey}`,
      `Exit Code: ${result.exitCode}`,
      `Duration: ${result.duration}s`,
      `Session: ${sessionId}`,
      `Timestamp: ${new Date().toISOString()}`,
      '---STDOUT---',
      result.stdout,
      '---STDERR---',
      result.stderr,
    ].join('\n');

    fs.writeFileSync(filepath, content);
    log(`Step log written: ${filename}`);
  } catch (err) {
    log(`Warning: failed to write step log: ${err.message}`);
  }
}
```

Key design decisions:
- **Entire function is try/caught** — log writing failures must never crash the runner or fail a step
- **Header metadata** in the log file makes grep/search easier
- **Timestamp format** uses `-` instead of `:` for Windows filename compatibility
- **Both stdout and stderr** written to the same file, clearly delimited

### 4. Session ID Extraction (`extractSessionId`)

Claude's `--output-format json` produces a JSON object. We attempt to extract a session identifier from it:

```javascript
import { randomUUID } from 'node:crypto';

function extractSessionId(jsonOutput) {
  try {
    const parsed = JSON.parse(jsonOutput);
    // Claude JSON output includes a session_id field
    if (parsed.session_id) return parsed.session_id.slice(0, 12);
  } catch { /* not valid JSON or no session_id */ }
  // Fallback to a short UUID
  return randomUUID().slice(0, 12);
}
```

- Truncates to 12 chars to keep filenames manageable
- Falls back gracefully to a generated UUID if JSON parsing fails or field is missing

### 5. Disk Usage Enforcement (`enforceMaxDisk`)

```javascript
function enforceMaxDisk(logDir, maxBytes) {
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.endsWith('.log') && f !== 'sdlc-runner.log')
      .map(f => {
        const fp = path.join(logDir, f);
        const stat = fs.statSync(fp);
        return { path: fp, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => a.mtime - b.mtime); // oldest first

    let totalSize = files.reduce((sum, f) => sum + f.size, 0);

    while (totalSize > maxBytes && files.length > 0) {
      const oldest = files.shift();
      fs.unlinkSync(oldest.path);
      totalSize -= oldest.size;
      log(`Pruned old log: ${path.basename(oldest.path)}`);
    }
  } catch (err) {
    log(`Warning: disk cleanup failed: ${err.message}`);
  }
}
```

Key design decisions:
- **Excludes `sdlc-runner.log`** from pruning — the orchestration log is always preserved
- **Only prunes `.log` files** — won't accidentally delete non-log files
- **Sorted by mtime (oldest first)** — preserves recent logs
- **Non-fatal** — cleanup failure doesn't block step log writing

### 6. Integration Point in `runStep()`

The call to `writeStepLog` is added in `runStep()` right after the `runClaude()` call (approximately line 1120):

```javascript
// Run claude
const result = await runClaude(step, state);
log(`Step ${step.number} exited with code ${result.exitCode} in ${result.duration}s`);

// Persist step log (non-fatal)
writeStepLog(step.key, result);

cleanupProcesses();
```

### 7. SKILL.md Changes

The `running-sdlc` SKILL.md step 6 (launch command) changes from:

```bash
nohup node <runner-path>/sdlc-runner.mjs --config <config-path> --discord-channel <channel-id> > /tmp/sdlc-runner.log 2>&1 &
```

To:

```bash
nohup node <runner-path>/sdlc-runner.mjs --config <config-path> --discord-channel <channel-id> 2>&1 &
```

The skill will also gain a **Logging** section documenting:
- Default log directory location
- Log file naming convention
- Config fields for customization
- How to find/tail logs

### 8. Config Example Changes

`sdlc-config.example.json` gains two new fields:

```json
{
  "logDir": "",
  "maxLogDiskUsageMB": 500,
  ...
}
```

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Separate log module file** | Extract logging into a new `sdlc-logger.mjs` file | Clean separation of concerns | Adds a file import; runner is meant to be a single script | Rejected — single file is simpler and aligns with existing pattern |
| **B: Stream-based writing** | Pipe subprocess stdout/stderr directly to log files during execution | Real-time log availability; lower memory | Duplicates data if still needed in memory for error matching; more complex stream management | Rejected — post-execution write is simpler and sufficient |
| **C: Write logs in `runClaude()`** | Move log writing into `runClaude()` itself | Encapsulated | `runClaude()` doesn't know the step key; muddies its single responsibility | Rejected — caller (`runStep()`) has context |
| **D: Keep nohup redirect for orchestration log** | Continue using shell redirect, only add per-step logs | Minimal change to SKILL.md | Two logging mechanisms for the same directory; redirect path must still change | Rejected — unified approach is cleaner |

**Selected approach**: Add all logging functions directly to `sdlc-runner.mjs`, call `writeStepLog()` from `runStep()`, modify `log()` to dual-write. This keeps the runner as a self-contained single file with zero external dependencies.

---

## Security Considerations

- [ ] **Authentication**: [How auth is enforced]
- [ ] **Authorization**: [Permission checks required]
- [ ] **Input Validation**: [Validation approach]
- [ ] **Data Sanitization**: [How data is sanitized]
- [ ] **Sensitive Data**: [How sensitive data is handled]

---

## Performance Considerations

- [ ] **Caching**: [Caching strategy]
- [ ] **Pagination**: [Pagination approach for large datasets]
- [ ] **Lazy Loading**: [What loads lazily]
- [ ] **Indexing**: [Database indexes or search indexes needed]

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Log dir resolution | Verification | Default path uses `os.tmpdir()`; custom path from config; project name extracted correctly |
| Per-step log writing | Verification | Log files created with correct naming; content includes stdout/stderr; handles write failure gracefully |
| Disk cleanup | Verification | Oldest files pruned when over threshold; orchestration log preserved; empty dir handled |
| Session ID extraction | Verification | Extracts from valid JSON; falls back to UUID on invalid JSON; truncated to 12 chars |
| SKILL.md | Manual review | nohup command updated; Logging section documents all options |
| Config | Manual review | New fields present in example; defaults work when fields omitted |
| Cross-platform | Verification | `os.tmpdir()` resolves correctly; `path.join()` used throughout; no hardcoded separators |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Log write fails (disk full, permissions) | Low | Low | Entire `writeStepLog` is try/caught; failure logged as warning but step continues |
| Large Claude output causes memory pressure | Low | Medium | Already captured in memory by `runClaude()`; writing to disk actually helps if output is later GC'd |
| Timestamp collision in filenames | Very Low | Low | Session ID + timestamp makes collisions extremely unlikely |
| `os.tmpdir()` returns unexpected path | Very Low | Low | Configurable `logDir` override provides escape hatch |
| Pruning deletes recent useful logs | Low | Medium | Prunes oldest first; 500 MB default allows substantial history |

---

## Open Questions

- [ ] [Technical question]
- [ ] [Architecture question]
- [ ] [Integration question]

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (single-file script, zero dependencies per `structure.md` / `tech.md`)
- [x] All API/interface changes documented (new functions, config fields)
- [x] No database/storage changes (file system only)
- [x] State management unaffected (only `log()` function gains dual output)
- [x] No UI components (headless script)
- [x] Security considerations: no secrets in logs (stdout/stderr from Claude sessions may contain project code but logs are in temp directory with user permissions)
- [x] Performance impact minimal (synchronous file writes are negligible relative to multi-minute Claude sessions)
- [x] Testing strategy defined
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
