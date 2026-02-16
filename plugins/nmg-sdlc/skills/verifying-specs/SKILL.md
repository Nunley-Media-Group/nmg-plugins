---
name: verifying-specs
description: "Verify implementation against spec, fix findings, review architecture and test coverage, update GitHub issue."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Task, WebFetch, WebSearch, Write, Edit, Bash(gh:*), Bash(git:*), Bash(node:*), Bash(which:*), Bash(timeout:*), Bash(rm:*)
---

# Verifying Specs

Verify the implementation against specifications, fix any findings, review architecture and test coverage, then update the GitHub issue with evidence.

## When to Use

- After implementation is complete via `/implementing-specs`
- Before creating a pull request via `/creating-prs`
- When reviewing whether a feature meets its specification

## Automation Mode

If the file `.claude/auto-mode` exists in the project directory:
- All approval gates are pre-approved. Do NOT call `AskUserQuestion` — proceed through all steps without stopping for user input.

## Prerequisites

1. Specs exist at `.claude/specs/{feature-name}/`. The `{feature-name}` is the issue number + kebab-case slug of the title (e.g., `42-add-precipitation-overlay`), matching the branch name. If unsure, use `Glob` to find `.claude/specs/*/requirements.md` and match against the current issue number or branch name.
2. Implementation is complete (or believed to be complete)
3. A GitHub issue exists for tracking

---

## Workflow

### Step 1: Load Specifications and Steering Docs

Read all spec documents:

```
.claude/specs/{feature-name}/
├── requirements.md    — Acceptance criteria to verify
├── design.md          — Architecture decisions to validate
├── tasks.md           — Task completion to confirm
└── feature.gherkin    — BDD scenarios to check
```

Read all steering documents (these define project conventions used throughout verification):

```
.claude/steering/
├── tech.md        — Technology stack, coding standards, testing strategy, behavioral contracts
├── structure.md   — Code organization, naming conventions, architectural invariants
└── product.md     — Product principles, intent verification postconditions
```

**These are required inputs, not optional references.** Steering docs define the verification framework (behavioral contracts, checklist applicability, script verification contracts) and must be loaded before any evaluation begins. They must also be provided to any subagents dispatched during the review.

### Step 2: Load Issue

Read the GitHub issue for the original acceptance criteria:

```bash
gh issue view #N
```

### Bug Fix Verification

When verifying a **defect fix** (specs use defect variants):

- **Reproduction check**: Verify the bug no longer reproduces using the exact steps from `requirements.md`
- **Regression scenarios**: All `@regression`-tagged Gherkin scenarios must pass
- **Architecture review**: Focus on blast radius assessment — full SOLID review is optional for small, targeted fixes
- **Regression test is mandatory**: A `@regression`-tagged test must exist; flag if missing
- **Minimal change check**: Review the diff for unrelated modifications — flag any changes outside the fix scope

### Step 3: Verify Implementation

Check each acceptance criterion against actual code:

1. **For each AC in requirements.md**:
   - Find the implementing code via `Glob` and `Grep`
   - Verify the behavior matches the criterion
   - Mark as: Pass / Fail / Partial
2. **For each task in tasks.md**:
   - Verify the file exists and contains the expected code
   - Check the task's acceptance criteria
   - Mark as: Complete / Incomplete / Skipped

### Step 4: Architecture Review

Run the architecture review using the `Task` tool with `subagent_type='nmg-sdlc:architecture-reviewer'`. The architecture-reviewer agent evaluates the implementation against all five checklists and returns structured scores and findings.

**You MUST include the steering doc content in the subagent prompt.** The architecture-reviewer has no access to conversation context — it only sees the prompt you give it. Include:
- `tech.md` — checklist applicability table (which checklists apply to scripts vs. skills), script verification contracts (preconditions/postconditions/invariants/boundaries), coding standards, cross-platform constraints
- `structure.md` — architectural invariants (hard contracts that must never be violated), cross-platform contracts

| Area | Checklist | Priority |
|------|-----------|----------|
| SOLID Principles | [checklists/solid-principles.md](checklists/solid-principles.md) | 1 |
| Security | [checklists/security.md](checklists/security.md) | 2 |
| Performance | [checklists/performance.md](checklists/performance.md) | 3 |
| Testability | [checklists/testability.md](checklists/testability.md) | 4 |
| Error Handling | [checklists/error-handling.md](checklists/error-handling.md) | 5 |

For each area:
1. Load the checklist
2. Evaluate the implementation against each item
3. Score 1-5 (5 = excellent)
4. Note any issues found

### Step 5: Verify Test Coverage

#### 5a: Detect Plugin Changes

Run `git diff main...HEAD --name-only` and check if any changed files match these patterns:
- `plugins/*/skills/*/SKILL.md`
- `plugins/*/agents/*.md`

Template-only changes (files in `templates/` without an accompanying SKILL.md change) do not trigger exercise testing.

**If plugin changes are detected** → proceed to **5b–5e** (exercise-based verification).

**If no plugin changes are detected** → run the standard BDD verification below, then skip to Step 6.

#### Standard BDD Verification (non-plugin projects)

Check that BDD tests exist and cover the acceptance criteria:

1. **Feature files**: Do `.feature` files exist at the location specified in `tech.md`?
2. **Scenario coverage**: Does each AC from requirements.md have a corresponding Gherkin scenario?
3. **Step definitions**: Are step definitions implemented for all scenarios?
4. **Test execution**: Reference `tech.md` for the command to run tests

Report coverage gaps.

---

#### 5b: Scaffold Disposable Test Project

Create a minimal test project for exercising the changed skill:

1. **Create temp directory** using `Bash`:
   ```bash
   node -e "const p = require('path').join(require('os').tmpdir(), 'nmg-sdlc-test-' + Date.now()); require('fs').mkdirSync(p, {recursive:true}); console.log(p)"
   ```
   Record the output path — this is `{test-project-path}`.

2. **Write scaffold files** using the `Write` tool:

   - `{test-project-path}/.claude/steering/product.md` — `"Test Project. One persona: Developer."`
   - `{test-project-path}/.claude/steering/tech.md` — `"Stack: Node.js. Test: manual verification."`
   - `{test-project-path}/.claude/steering/structure.md` — `"Flat layout: src/ + tests/"`
   - `{test-project-path}/src/index.js` — `console.log("hello")`
   - `{test-project-path}/README.md` — `"Test project for nmg-sdlc exercise verification"`
   - `{test-project-path}/.gitignore` — `node_modules/`
   - `{test-project-path}/package.json` — `{ "name": "test-project", "version": "1.0.0" }`

3. **Initialize git** using `Bash`:
   ```bash
   git init {test-project-path} && git -C {test-project-path} add -A && git -C {test-project-path} commit -m "initial"
   ```

#### 5c: Exercise Changed Skill

Determine which skill(s) changed from the diff in 5a. Exercise the **first changed skill** (one skill per exercise run).

Identify whether the changed skill is **GitHub-integrated** (i.e., it creates GitHub resources — `creating-issues`, `creating-prs`, `starting-issues`). If so, prepend the dry-run instructions below to the exercise prompt.

**Dry-run prefix** (for GitHub-integrated skills only):
> This is a dry-run exercise. Do NOT execute any `gh` commands that create, modify, or delete GitHub resources. Instead, output the exact command and arguments you WOULD run, along with the content (title, body, labels) you WOULD use. Proceed through the full workflow, generating all artifacts as text output.

**Primary method: Agent SDK with `canUseTool`**

Check if the Agent SDK is available using `Bash`:
```bash
node -e "require('@anthropic-ai/claude-agent-sdk'); console.log('available')"
```

If available, run the following inline Node.js script via `Bash` (substitute `{skill-name}`, `{plugin-path}`, `{test-project-path}`, `{output-file}`, and `{exercise-prompt}` with actual values):

```bash
timeout 300 node -e "
const { query } = require('@anthropic-ai/claude-agent-sdk');
const fs = require('fs');

(async () => {
  const messages = [];
  const result = await query({
    prompt: '{exercise-prompt}',
    plugins: [{ type: 'local', path: '{plugin-path}' }],
    workingDirectory: '{test-project-path}',
    canUseTool: (tool) => {
      if (tool.name === 'AskUserQuestion') {
        // Auto-select first option for deterministic testing
        const questions = JSON.parse(tool.input).questions;
        const answers = {};
        questions.forEach((q, i) => { answers['question_' + i] = q.options[0].label; });
        return { result: JSON.stringify({ answers }) };
      }
      return true;
    },
    onMessage: (msg) => messages.push(JSON.stringify(msg)),
  });
  fs.writeFileSync('{output-file}', messages.join('\n'));
  console.log('Exercise complete. Output written to {output-file}');
})().catch(e => { console.error('Exercise error:', e.message); process.exit(1); });
" 2>&1
```

The `{exercise-prompt}` is: `"/{skill-name} [appropriate args based on the skill's argument-hint]"`
The `{plugin-path}` is the absolute path to `plugins/nmg-sdlc` in the current repository.
The `{output-file}` is `{test-project-path}/exercise-output.txt`.

If the Agent SDK is **not available**, use the fallback method.

**Fallback method: `claude -p`**

Check if the `claude` CLI is available using `Bash`:
```bash
which claude
```

If available, run via `Bash`:
```bash
timeout 300 claude -p "{exercise-prompt}" \
  --disallowedTools AskUserQuestion \
  --project-dir {test-project-path} \
  --append-system-prompt "Make reasonable default choices. Do not ask questions." \
  --max-turns 30 \
  > {output-file} 2>&1
```

Note: The `claude -p` fallback only tests the non-interactive path. Record this limitation for the report.

**If neither Agent SDK nor `claude` CLI is available**: Skip exercise testing entirely and proceed to 5e (cleanup is a no-op since no project was scaffolded). Record the reason for the report's Exercise Test Results section (graceful degradation).

**Timeout**: The `timeout 300` wrapper (5 minutes) kills the subprocess if it exceeds the time limit. If a timeout occurs, capture whatever output was produced before the timeout and report it as a graceful degradation in the Exercise Test Results section.

**Exercise errors**: If the exercise subprocess exits with a non-zero status, capture the error output. Report it as a finding and continue with evaluation of whatever output was captured.

#### 5d: Evaluate Exercise Output

Read the captured output file (`{output-file}`) and the test project filesystem:

1. **Load acceptance criteria** from `requirements.md`
2. **For each AC**, search the captured output and test project filesystem for evidence:
   - **File-creating skills**: Check if expected files were created in the test project (use `Glob`)
   - **GitHub-integrated skills** (dry-run): Check if the generated `gh` commands and content match what the AC expects
   - **General**: Look for output messages that indicate the AC's expected behavior occurred
3. **Assign verdict** for each AC:
   - **Pass** — clear evidence the criterion was satisfied
   - **Fail** — contradictory evidence or expected output missing
   - **Partial** — some evidence but incomplete
4. **Record evidence** — the specific output line, file path, or observation supporting the verdict

Exercise findings (any Fail or Partial verdicts) are treated as findings for Step 6 (Fix Findings), just like any other verification finding.

#### 5e: Cleanup

Delete the test project directory using `Bash`, regardless of whether the exercise succeeded or failed:

```bash
rm -rf {test-project-path}
```

This must run even if earlier sub-steps encountered errors. After cleanup, proceed to Step 6.

### Step 6: Fix Findings

Work through all findings discovered in Steps 3–5 and fix them before generating the report.

#### 6a. Prioritize and Fix

Process findings in severity order: **Critical → High → Medium → Low**.

For each finding:
1. Locate the relevant code via `Glob` / `Grep`
2. Apply the fix using `Write` or `Edit`
3. Verify the fix addresses the finding
4. Record: original issue, location, and fix applied

#### 6b. Run Tests After Fixes

Reference `.claude/steering/tech.md` for the project's test command. Run the full test suite and fix any regressions introduced by the fixes.

#### 6c. Re-verify Changed Areas

Re-check modified files against acceptance criteria and architecture checklists. Update scores if fixes improved them.

#### 6d. Handle Unfixable Findings

Fix findings that can be resolved in roughly 20 lines of change or fewer. Defer findings that would require architectural changes, new dependencies, or modifications outside the feature's scope.

If a finding cannot be safely fixed (e.g., requires spec clarification, would change scope, or risks breaking unrelated functionality):
1. Document **why** it cannot be fixed now
2. Categorize as **"Deferred"** in the report

#### Fix Rules

| Rule | Detail |
|------|--------|
| Follow the spec | Fixes must not contradict requirements.md or design.md |
| Follow steering docs | Reference tech.md and structure.md for conventions |
| Match code style | Mirror the patterns already used in the codebase |
| One finding at a time | Fix, verify, then move to the next |
| Test after each batch | Run the test suite after each group of related fixes |
| No scope changes | Do not add features or refactor beyond the finding |

### Step 7: Generate Verification Report

Use [checklists/report-template.md](checklists/report-template.md) to create the verification report.

The report includes:
- Executive summary with post-fix scores
- Acceptance criteria checklist (pass/fail)
- Architecture review scores (SOLID, security, performance, testability, error handling)
- Test coverage analysis
- Exercise test results (if plugin changes were detected in Step 5a — includes skill exercised, method, AC evaluation, and captured output summary; or graceful degradation note if exercise was skipped)
- Fixes applied (what was found and how it was fixed)
- Remaining issues (items that could not be auto-fixed, with reasons)
- Recommendations

### Step 8: Update GitHub Issue

Post the verification results as an issue comment:

```bash
gh issue comment #N --body "[verification summary]"
```

The comment should include:

```markdown
## Verification Report

### Implementation Status: [Pass / Partial / Fail]

### Acceptance Criteria

- [x] AC1: [criterion] — Implemented in `path/to/file`
- [x] AC2: [criterion] — Implemented in `path/to/file`
- [ ] AC3: [criterion] — **Not implemented** / **Partial**

### Architecture Review

| Area | Score (1-5) |
|------|-------------|
| SOLID Principles | [score] |
| Security | [score] |
| Performance | [score] |
| Testability | [score] |
| Error Handling | [score] |

### Test Coverage

- BDD scenarios: [X/Y] acceptance criteria covered
- Step definitions: [Implemented / Missing]
- Test execution: [Pass / Fail / Not run]

### Fixes Applied

| Severity | Category | Location | Issue | Fix |
|----------|----------|----------|-------|-----|
| [sev] | [cat] | `path/to/file` | [what was wrong] | [what was done] |

### Remaining Issues

| Severity | Category | Location | Issue | Reason Not Fixed |
|----------|----------|----------|-------|------------------|
| [sev] | [cat] | `path/to/file` | [what is wrong] | [why deferred] |

### Recommendation

[Ready for PR / Needs fixes for remaining items / Major rework needed]
```

### Step 9: Output

```
Verification complete for issue #N.

Status: [Pass / Partial / Fail]
Acceptance criteria: [X/Y] passing
Architecture score: [average]
Test coverage: [X/Y] criteria covered
Fixes applied: [count]
Remaining issues: [count]

GitHub issue #N updated with verification report.

[If `.claude/auto-mode` does NOT exist AND passing]: Next step: Run `/creating-prs #N` to create a pull request.
[If `.claude/auto-mode` does NOT exist AND remaining issues]: Deferred items documented — review before creating a PR.
[If `.claude/auto-mode` does NOT exist AND failing]: Critical issues remain — address the items above before creating a PR.
[If `.claude/auto-mode` exists]: Done. Awaiting orchestrator.
```

---

## Checklist Files

| Checklist | Purpose |
|-----------|---------|
| [solid-principles.md](checklists/solid-principles.md) | SOLID principles compliance |
| [security.md](checklists/security.md) | Security review (OWASP-aligned) |
| [performance.md](checklists/performance.md) | Performance patterns |
| [testability.md](checklists/testability.md) | Dependency injection and mock patterns |
| [error-handling.md](checklists/error-handling.md) | Error hierarchy and propagation |
| [report-template.md](checklists/report-template.md) | Verification report template |

---

## Integration with SDLC Workflow

```
/creating-issues  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
                                                                            ▲ You are here
```
