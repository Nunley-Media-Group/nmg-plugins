# Design: Exercise-Based Verification for Plugin Projects

**Issue**: #44
**Date**: 2026-02-16
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
   b. Determine exercise method (try Agent SDK → fallback to claude -p)
   c. For GitHub-integrated skills: append dry-run instructions to prompt
   d. Invoke skill against test project → capture output
   e. Parse output → evaluate each AC as Pass/Fail/Partial
   f. Delete temp dir
   g. Feed exercise findings into Step 6 (Fix Findings)
4. IF no plugin changes:
   a. Run existing BDD test coverage checks (unchanged)
5. Step 7 → populate Exercise Test Results section in report
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

Two exercise methods, tried in priority order:

#### Primary: Agent SDK with `canUseTool`

**When to use**: When `@anthropic-ai/claude-agent-sdk` is importable (check via `node -e "require('@anthropic-ai/claude-agent-sdk')"` or equivalent).

**Invocation pattern** (described in SKILL.md as instructions for Claude to follow):

```
Use Bash to run a Node.js script that:
1. Imports { query } from "@anthropic-ai/claude-agent-sdk"
2. Invokes the changed skill with:
   - prompt: "/{skill-name} [appropriate args]"
   - plugins: [{ type: "local", path: "{absolute-path-to-plugins/nmg-sdlc}" }]
   - workingDirectory: "{test-project-path}"
   - canUseTool callback that intercepts AskUserQuestion → auto-selects first option
3. Collects all output messages into a string
4. Writes the output to a temp file for evaluation
```

The SKILL.md will contain an inline Node.js snippet template that Claude populates with the actual paths and skill name, then executes via `Bash`.

**For GitHub-integrated skills** (`creating-issues`, `creating-prs`, `starting-issues`): The prompt is prepended with: "This is a dry-run exercise. Do NOT execute any `gh` commands that create, modify, or delete GitHub resources. Instead, output the exact command and arguments you WOULD run, along with the content (title, body, labels) you WOULD use. Proceed through the full workflow, generating all artifacts as text output."

#### Fallback: `claude -p` with `--disallowedTools`

**When to use**: When Agent SDK is not available.

**Invocation pattern**:

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
- **Agent SDK not found**: Fall through to `claude -p` fallback.
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

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md` | Modified | Add exercise-based verification branch to Step 5 |
| `plugins/nmg-sdlc/skills/verifying-specs/checklists/report-template.md` | Modified | Add Exercise Test Results section |

---

## Open Questions

- [ ] Budget cap for Agent SDK sessions — should the inline script set `max_budget_usd`? (Recommendation: start without a cap, add if cost becomes a concern)
- [ ] Timeout value — 5 minutes proposed. Should this be configurable or is a fixed value sufficient? (Recommendation: fixed for now, configurable later if needed)

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
