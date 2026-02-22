---
name: verifying-specs
description: "Verify implementation against spec, fix findings, review architecture and test coverage, update GitHub issue. Use when user says 'verify specs', 'check implementation', 'review the code against spec', 'validate the code', 'check if done', or 'run verification for #N'. Do NOT use for writing specs, implementing code, or creating PRs. Includes SOLID/security/performance review, exercise testing for plugin changes, and auto-fix of findings."
argument-hint: "[#issue-number]"
model: sonnet
allowed-tools: Read, Glob, Grep, Task, WebFetch, WebSearch, Write, Edit, Bash(gh:*), Bash(git:*), Bash(node:*), Bash(which:*), Bash(rm:*)
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

#### 5b–5e: Exercise Testing

Follow the full exercise testing procedure in [references/exercise-testing.md](references/exercise-testing.md). This includes:

1. **5b**: Scaffold a disposable test project with steering docs and git
2. **5c**: Exercise the changed skill via Agent SDK (preferred) or `claude -p` (fallback), with dry-run mode for GitHub-integrated skills
3. **5d**: Evaluate exercise output against acceptance criteria (Pass/Fail/Partial verdicts)
4. **5e**: Cleanup the test project directory

Exercise findings are treated as findings for Step 6, just like any other verification finding. If neither Agent SDK nor `claude` CLI is available, skip exercise testing and record the reason for the report (graceful degradation).

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
