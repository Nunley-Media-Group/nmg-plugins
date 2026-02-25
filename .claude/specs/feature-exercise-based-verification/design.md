# Design: Exercise-Based Verification for Plugin Projects

**Issues**: #44, #50
**Date**: 2026-02-25
**Status**: Draft
**Author**: Claude (from issue by rnunley-nmg)

---

## Overview

This feature extends `/verifying-specs` Step 5 (Verify Test Coverage) with a conditional branch: when the diff contains SKILL.md or agent definition files, it runs exercise-based verification instead of the standard BDD test coverage check. The exercise path scaffolds a disposable test project, invokes the changed skill using the Claude Agent SDK (with `canUseTool` for `AskUserQuestion` handling) or a `claude -p` fallback, evaluates the captured output against acceptance criteria, and reports the results in an extended verification report template.

The design modifies two files: the `verifying-specs/SKILL.md` skill definition (adding exercise-based logic to Step 5) and the `checklists/report-template.md` (adding an "Exercise Test Results" section). All other files in the plugin remain unchanged.

Key architectural decisions:
1. **Conditional branching in Step 5** — plugin changes trigger exercise testing; non-plugin changes use existing BDD verification unchanged
2. **Agent SDK primary, `claude -p` fallback** — provides full interactive path testing where possible, degrades gracefully
3. **Prompt-engineered dry-run** — GitHub-integrated skills are exercised with prompt instructions to generate content without creating real artifacts
4. **Inline scaffolding instructions** — test project creation is described as SKILL.md instructions, not a separate script
5. **Dynamic SDK path resolution** (Issue #50) — the exercise script resolves the Agent SDK's filesystem path at runtime via `require.resolve()`, then uses dynamic `import()` with a `file://` URL. This bypasses ESM's bare-specifier limitation (which ignores `NODE_PATH`) and avoids symlink creation (which requires elevated privileges on Windows)

---

## Architecture

### Component Diagram

```
verifying-specs/SKILL.md
├── Step 1-4: Load specs, issue, verify impl, arch review (UNCHANGED)
├── Step 5: Verify Test Coverage (MODIFIED — conditional branch)
│   ├── [Non-plugin changes] → Existing BDD verification (UNCHANGED)
│   └── [Plugin changes detected] → Exercise-Based Verification (NEW)
│       ├── 5a: Detect plugin changes in diff
│       ├── 5b: Scaffold disposable test project
│       ├── 5c: Exercise changed skill
│       │   ├── [Primary] Agent SDK with canUseTool
│       │   └── [Fallback] claude -p with --disallowedTools
│       ├── 5d: Evaluate output against ACs
│       └── 5e: Cleanup test project
├── Step 6: Fix findings (UNCHANGED — consumes exercise findings)
├── Step 7: Generate report (MODIFIED — new Exercise Test Results section)
├── Step 8-9: Update issue, output (UNCHANGED)

checklists/report-template.md
└── Exercise Test Results section (NEW — inserted after Test Coverage)
```

### Data Flow

```
1. Step 5 begins → read diff via `git diff main...HEAD --name-only`
2. Filter diff for SKILL.md / agents/*.md patterns
3. IF plugin changes detected:
   a. Create temp dir → scaffold minimal project (steering docs, source, git init)
   b. Resolve Agent SDK path (require.resolve → fallback search → not found)
   c. Determine exercise method: SDK resolved → Agent SDK; not resolved → claude -p; neither → skip
   d. For GitHub-integrated skills: append dry-run instructions to prompt
   e. Invoke skill against test project → capture output
   e. Parse output → evaluate each AC as Pass/Fail/Partial
   f. Delete temp dir
   g. Feed exercise findings into Step 6 (Fix Findings)
4. IF no plugin changes:
   a. Run existing BDD test coverage checks (unchanged)
5. Step 7 → populate Exercise Test Results section in report
```

---

## API / Interface Changes

### New Endpoints / Methods

| Endpoint / Method | Type | Auth | Purpose |
|-------------------|------|------|---------|
| [path or signature] | [GET/POST/etc or method] | [Yes/No] | [description] |

### Request / Response Schemas

#### [Endpoint or Method Name]

**Input:**
```json
{
  "field1": "string",
  "field2": 123
}
```

**Output (success):**
```json
{
  "id": "string",
  "field1": "string",
  "createdAt": "ISO8601"
}
```

**Errors:**

| Code / Type | Condition |
|-------------|-----------|
| [error code] | [when this happens] |

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

### 5a: Plugin Change Detection

**Logic**: Scan the diff for files matching plugin change patterns.

```
Patterns that indicate plugin changes:
- plugins/*/skills/*/SKILL.md
- plugins/*/skills/**/templates/*.md
- plugins/*/agents/*.md
```

**Implementation in SKILL.md**: Instruct Claude to run `git diff main...HEAD --name-only` and check if any changed files match the patterns above. Template-only changes (files in `templates/` without an accompanying SKILL.md change) are excluded per the Out of Scope — only SKILL.md and agent definition changes trigger exercise testing.

**Output**: A boolean flag (plugin change detected or not) and a list of changed skill/agent files.

### 5b: Test Project Scaffolding

**Layout**: Per `structure.md` → Test Project Scaffolding:

```
{os-temp-dir}/nmg-sdlc-test-{timestamp}/
├── .claude/
│   └── steering/
│       ├── product.md     — "Test Project. One persona: Developer."
│       ├── tech.md        — "Stack: Node.js. Test: manual verification."
│       └── structure.md   — "Flat layout: src/ + tests/"
├── src/
│   └── index.js           — console.log("hello")
├── README.md              — "Test project for nmg-sdlc exercise verification"
├── .gitignore             — node_modules/
└── package.json           — { "name": "test-project", "version": "1.0.0" }
```

**Implementation**: SKILL.md instructs Claude to:
1. Create the temp directory using `Bash` with a cross-platform temp dir approach (reference `node -e "console.log(require('os').tmpdir())"` or use `/tmp` with a note about cross-platform)
2. Write all scaffold files using `Write` tool
3. Initialize git: `git init && git add -A && git commit -m "initial"`
4. Record the temp directory path for later cleanup

**For GitHub-integrated skills**: No real GitHub repo is created. The test project is local-only. Dry-run evaluation (see 5c) handles GitHub operations.

### 5c: Exercise Changed Skill

Three sub-phases: resolve SDK path, choose exercise method, invoke.

#### 5c-i: Resolve Agent SDK Path (Issue #50)

**Problem**: The exercise script is an ESM module (`.mjs`) that runs in a temp directory. ESM bare-specifier resolution (`import "pkg"`) only searches the `node_modules` hierarchy from the script's location and does NOT respect `NODE_PATH`. When the Agent SDK is installed in a non-standard location (npx cache, global install via a version manager), the import fails with `ERR_MODULE_NOT_FOUND`.

**Solution**: Resolve the SDK's absolute filesystem path before writing the exercise script, then use ESM dynamic `import()` with a `file://` URL. This separates "finding the SDK" (CJS resolution, which respects `NODE_PATH` and searches more locations) from "importing the SDK" (ESM, which works with any `file://` URL).

**Resolution strategy** (tried in order):

1. **`require.resolve()`** — Uses CJS module resolution, which respects `NODE_PATH` and searches the standard `node_modules` hierarchy, global modules, and `$HOME/.node_modules`:
   ```bash
   node -e "try { console.log(require.resolve('@anthropic-ai/claude-agent-sdk')); } catch { process.exit(1); }"
   ```
   If exit code 0, the output is the SDK's entry point absolute path (e.g., `/Users/x/.npm/_npx/.../node_modules/@anthropic-ai/claude-agent-sdk/dist/index.js`).

2. **Fallback search of known locations** — If `require.resolve` fails (SDK not in any standard resolution path), search for the SDK package in known npm cache locations:
   ```bash
   node -e "
     const fs = require('fs');
     const path = require('path');
     const os = require('os');
     const home = os.homedir();
     const candidates = [
       path.join(home, '.npm', '_npx'),     // npx cache (macOS/Linux)
       path.join(home, 'AppData', 'Local', 'npm-cache', '_npx'),  // npx cache (Windows)
     ];
     for (const base of candidates) {
       if (!fs.existsSync(base)) continue;
       for (const entry of fs.readdirSync(base)) {
         const pkg = path.join(base, entry, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'package.json');
         if (fs.existsSync(pkg)) {
           const main = JSON.parse(fs.readFileSync(pkg, 'utf8')).main || 'dist/index.js';
           console.log(path.resolve(path.dirname(pkg), main));
           process.exit(0);
         }
       }
     }
     process.exit(1);
   "
   ```

3. **Not found** — If both methods fail, the Agent SDK is not available. Fall through to `claude -p` fallback (or skip if that's also unavailable).

The resolved path is stored as `{sdk-entry-point}` for use in the exercise script template.

**Why this satisfies cross-platform constraints**:
- No symlinks created (satisfies `structure.md` → "No symlink dependencies")
- `require.resolve()` is cross-platform
- Fallback search uses `node:path` for path construction (no hardcoded separators)
- `pathToFileURL()` correctly handles Windows drive letters (e.g., `C:\Users\...` → `file:///C:/Users/...`)

#### 5c-ii: Choose Exercise Method

**Decision tree**:
- SDK path resolved → **Agent SDK** (primary method)
- SDK path not resolved, `claude` CLI available → **`claude -p`** (fallback method)
- Neither available → **Skip** (graceful degradation)

#### 5c-iii: Primary — Agent SDK with `canUseTool`

**When to use**: When `{sdk-entry-point}` was successfully resolved in 5c-i.

**Modified exercise script template** (changes from Issue #44 marked with `// CHANGED`):

```javascript
// exercise.mjs — written to {test-project-path}/exercise.mjs
import { pathToFileURL } from "node:url";         // CHANGED: added for file URL conversion
import fs from "node:fs";

// CHANGED: Dynamic import using resolved absolute path (bypasses ESM bare-specifier limitation)
const { query } = await import(pathToFileURL("{sdk-entry-point}").href);

const messages = [];
for await (const message of query({
  prompt: "{exercise-prompt}",
  options: {
    plugins: [{ type: "local", path: "{plugin-path}" }],
    cwd: "{test-project-path}",
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns: 30,
    env: { ...process.env, CLAUDECODE: "" },
    canUseTool: async (toolName, input) => {
      if (toolName === "AskUserQuestion") {
        const answers = {};
        for (const q of input.questions) {
          answers[q.question] = q.options[0].label;
        }
        return { behavior: "allow", updatedInput: { ...input, answers } };
      }
      return { behavior: "allow", updatedInput: input };
    },
  },
})) {
  if (message.type === "assistant" && message.message?.content) {
    for (const block of message.message.content) {
      if ("text" in block) messages.push(block.text);
    }
  } else if (message.type === "result") {
    messages.push(`Result: ${message.subtype}`);
    if ("result" in message) messages.push(message.result);
  }
}
fs.writeFileSync("{output-file}", messages.join("\n"));
console.log("Exercise complete. Output written to {output-file}");
```

The key change is replacing:
```javascript
import { query } from "@anthropic-ai/claude-agent-sdk";  // OLD: bare specifier, fails if SDK not in node_modules hierarchy
```
with:
```javascript
import { pathToFileURL } from "node:url";
const { query } = await import(pathToFileURL("{sdk-entry-point}").href);  // NEW: resolved absolute path as file URL
```

**For GitHub-integrated skills**: Dry-run instructions appended to the exercise prompt (unchanged from original design).

#### 5c-iv: Fallback — `claude -p` with `--disallowedTools`

**When to use**: When Agent SDK path resolution fails (5c-i returns no path).

**Invocation pattern** (unchanged from original design):

```bash
claude -p "Exercise: /{skill-name} [args]" \
  --plugin-dir {absolute-path-to-plugins/nmg-sdlc} \
  --project-dir {test-project-path} \
  --disallowedTools AskUserQuestion \
  --append-system-prompt "Make reasonable default choices. Do not ask questions." \
  --max-turns 30
```

This tests only the non-interactive path. The verification report notes this limitation.

#### Timeout and Error Handling

- **Timeout**: 5 minutes for the exercise subprocess. If exceeded, kill the process and report graceful degradation.
- **Agent SDK path not resolved**: Fall through to `claude -p` fallback.
- **`claude` CLI not found**: Report graceful degradation — skip exercise testing entirely.
- **Exercise produces an error**: Capture the error output, report it as a finding, and continue with evaluation of whatever output was captured.

### 5d: Evaluate Output Against ACs

After capturing exercise output:

1. Load `requirements.md` acceptance criteria
2. For each AC, search the captured output for evidence of:
   - Expected files created (check test project filesystem)
   - Expected behavior described in output messages
   - Expected `gh` commands generated (for dry-run)
3. Assign verdict: **Pass** (clear evidence), **Fail** (contradictory evidence or missing), **Partial** (some evidence but incomplete)
4. Record evidence string for each AC

**Implementation**: This is done by Claude itself (reading the captured output and reasoning about AC satisfaction), not by a separate script. The SKILL.md instructs Claude to evaluate methodically.

### 5e: Cleanup

Delete the temp directory:

```bash
rm -rf {test-project-path}
```

This runs regardless of exercise success or failure. The SKILL.md explicitly instructs cleanup even on error paths.

### Report Template Extension

Add an "Exercise Test Results" section to `checklists/report-template.md`, positioned after the existing "Test Coverage" section:

```markdown
## Exercise Test Results

*This section is included when exercise-based verification was performed for plugin changes.*

| Field | Value |
|-------|-------|
| **Skill Exercised** | [skill name] |
| **Test Project** | [temp dir path] |
| **Exercise Method** | Agent SDK with `canUseTool` / `claude -p` fallback / Skipped |
| **AskUserQuestion Handling** | Programmatic first-option / Denied / N/A |
| **Duration** | [seconds] |

### Captured Output Summary

[Brief summary of what the skill produced during exercise — files created, commands generated, key output messages]

### AC Evaluation

| AC | Description | Verdict | Evidence |
|----|-------------|---------|----------|
| AC1 | [criterion] | Pass/Fail/Partial | [evidence from exercise output] |

### Notes

[Any additional observations — e.g., "Only non-interactive path tested (fallback method)", "GitHub operations evaluated via dry-run"]
```

When exercise testing is **skipped** (graceful degradation), the section reads:

```markdown
## Exercise Test Results

**Exercise testing was skipped.**

| Field | Value |
|-------|-------|
| **Reason** | [e.g., claude CLI not found, Agent SDK unavailable, timeout] |
| **Recommendation** | Manual exercise testing recommended as follow-up |
```

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Separate exercise script** | Create a Node.js script in `plugins/nmg-sdlc/scripts/` that handles scaffolding, invocation, and evaluation | Reusable, testable with Jest | Adds complexity, new file, zero-dependency constraint for scripts | Rejected — over-engineering for a workflow that Claude executes inline |
| **B: Inline SKILL.md instructions** | All exercise logic is described as SKILL.md workflow instructions that Claude follows | No new files, consistent with existing skill patterns, Claude handles evaluation natively | Longer SKILL.md, relies on Claude's execution fidelity | **Selected** — matches project architecture (skills are Markdown instructions) |
| **C: Promptfoo eval suite** | Create a `promptfoo.yaml` config with test cases for each skill | Declarative, repeatable, built-in AskUserQuestion handling | Requires Promptfoo installation, adds external dependency, significant setup | Rejected for now — future enhancement per Out of Scope |
| **D: Agent SDK only (no fallback)** | Require Agent SDK for exercise testing, skip if unavailable | Simpler implementation | Loses testing capability when SDK not installed | Rejected — fallback provides partial value |
| **E: Symlink SDK into test project** (Issue #50) | Create `node_modules/@anthropic-ai` symlink in test project pointing to SDK location | Simple, preserves original `import` syntax | Symlinks require elevated privileges on Windows; violates `structure.md` cross-platform contract "No symlink dependencies" | Rejected — cross-platform constraint |
| **F: Set NODE_PATH for ESM** (Issue #50) | Set `NODE_PATH` env var before running exercise script | Minimal code change | ESM ignores `NODE_PATH` entirely (Node.js design decision); would only work for CJS | Rejected — fundamentally incompatible with ESM |
| **G: Install SDK in test project** (Issue #50) | Run `npm install @anthropic-ai/claude-agent-sdk` in the test project before exercise | Most robust — standard resolution would work | Slow (network + install), adds external dependency during verification, may fail without network | Rejected — adds latency and network dependency |
| **H: Dynamic import with resolved file URL** (Issue #50) | Resolve SDK path via `require.resolve()` (CJS), then use `import(pathToFileURL(...))` in ESM script | Cross-platform, no symlinks, no network, fast; consistent availability check | Slightly more complex script template; relies on CJS resolution finding the package | **Selected** — satisfies all cross-platform constraints while being simple and fast |

---

## Security Considerations

- [x] **No secrets in scaffolding**: Test project contains only placeholder content — no tokens, credentials, or real project data
- [x] **No real GitHub artifacts**: Dry-run evaluation generates content without executing `gh` commands against real repos
- [x] **Temp directory cleanup**: Exercise artifacts deleted after verification, preventing accumulation of test data
- [x] **Plugin loading is local**: `--plugin-dir` loads from the local repo, not from a remote source
- [x] **Subprocess sandboxing**: Exercise runs in a separate Claude session with its own permission boundary

---

## Performance Considerations

- [x] **Exercise timeout**: 5-minute cap prevents runaway sessions
- [x] **Single skill per exercise**: Only the changed skill is exercised, not all skills
- [x] **Temp directory in OS temp**: Uses fast local storage, not network-mounted paths
- [x] **Cleanup on all paths**: No disk space accumulation from orphaned test projects

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Plugin change detection | Exercise verification | Verify diff scanning correctly identifies SKILL.md and agent changes |
| Test project scaffolding | Exercise verification | Verify temp project is created with correct structure |
| Agent SDK invocation | Exercise verification | Verify skill loads and runs against test project |
| Fallback invocation | Exercise verification | Verify `claude -p` fallback works when SDK unavailable |
| AC evaluation | Exercise verification | Verify output is evaluated against each AC |
| Report generation | Exercise verification | Verify Exercise Test Results section appears in report |
| Cleanup | Exercise verification | Verify temp directory is deleted |
| Non-plugin path | Exercise verification | Verify existing BDD behavior is unchanged |

This feature is itself verified by exercise — the modified `/verifying-specs` skill will be exercised against a test project during its own verification step.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent SDK not installed in target environments | Medium | Medium | `claude -p` fallback provides partial coverage; graceful degradation reports skipped |
| Exercise testing adds significant time to verification | Medium | Low | 5-minute timeout cap; single skill per exercise; non-blocking for non-plugin projects |
| Claude misinterprets exercise SKILL.md instructions | Low | Medium | Instructions are explicit and step-by-step; evaluation is self-contained |
| Test project scaffolding fails (permissions, disk) | Low | Low | Graceful degradation — report notes skip reason |
| Dry-run prompt doesn't prevent all GitHub API calls | Low | High | Skill instructions explicitly deny `gh` create/modify/delete; `canUseTool` can intercept `Bash` for `gh` commands |
| `require.resolve()` cannot find SDK (no NODE_PATH, not in standard hierarchy) | Medium | Low | Fallback search checks npx cache and common install locations; ultimate fallback to `claude -p` still provides partial coverage |
| Dynamic `import()` of resolved path fails due to CJS/ESM entry point mismatch | Low | Medium | Modern Node.js (v22+) handles `import()` of CJS modules; SDK's package.json `exports` field typically provides ESM entry point |

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md` | Modified | Add exercise-based verification branch to Step 5 |
| `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md` | Modified | Update SDK availability check and exercise script template with dynamic path resolution |
| `plugins/nmg-sdlc/skills/verifying-specs/checklists/report-template.md` | Modified | Add Exercise Test Results section |

---

## Open Questions

- [ ] Budget cap for Agent SDK sessions — should the inline script set `max_budget_usd`? (Recommendation: start without a cap, add if cost becomes a concern)
- [ ] Timeout value — 5 minutes proposed. Should this be configurable or is a fixed value sufficient? (Recommendation: fixed for now, configurable later if needed)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #44 | 2026-02-16 | Initial feature spec |
| #50 | 2026-02-25 | Add dynamic SDK path resolution design — require.resolve + fallback search + dynamic import with file URL; new alternatives E–H |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`) — inline SKILL.md instructions, no new scripts
- [x] All interface changes documented — new report section, modified Step 5
- [x] Database/storage changes planned — N/A (no database)
- [x] State management approach is clear — temp directory path tracked during Step 5 execution
- [x] UI components and hierarchy defined — N/A (CLI-based)
- [x] Security considerations addressed — no secrets, no real artifacts, cleanup
- [x] Performance impact analyzed — timeout cap, single skill, temp dir
- [x] Testing strategy defined — exercise-based (dogfooding)
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
