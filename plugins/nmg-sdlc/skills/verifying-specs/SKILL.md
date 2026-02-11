---
name: verifying-specs
description: "Verify implementation against spec, fix findings, review architecture and test coverage, update GitHub issue."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Task, WebFetch, WebSearch, Write, Edit, Bash(gh:*), Bash(git:*)
---

# Verifying Specs

Verify the implementation against specifications, fix any findings, review architecture and test coverage, then update the GitHub issue with evidence.

**REQUIRED: Use ultrathink (extended thinking mode) throughout the verification process.**

## When to Use

- After implementation is complete via `/implementing-specs`
- Before creating a pull request via `/creating-prs`
- When reviewing whether a feature meets its specification

## Prerequisites

1. Specs exist at `.claude/specs/{feature-name}/`
2. Implementation is complete (or believed to be complete)
3. A GitHub issue exists for tracking

---

## Workflow

### Step 1: Load Specifications

Read all spec documents:

```
.claude/specs/{feature-name}/
├── requirements.md    — Acceptance criteria to verify
├── design.md          — Architecture decisions to validate
├── tasks.md           — Task completion to confirm
└── feature.gherkin    — BDD scenarios to check
```

### Step 2: Load Issue

Read the GitHub issue for the original acceptance criteria:

```bash
gh issue view #N
```

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

Run the architecture review using checklists. Use the `Task` tool with `subagent_type='Explore'` for deeper investigation.

Reference `.claude/steering/tech.md` for project-specific conventions.

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

Check that BDD tests exist and cover the acceptance criteria:

1. **Feature files**: Do `.feature` files exist at the location specified in `tech.md`?
2. **Scenario coverage**: Does each AC from requirements.md have a corresponding Gherkin scenario?
3. **Step definitions**: Are step definitions implemented for all scenarios?
4. **Test execution**: Reference `tech.md` for the command to run tests

Report coverage gaps.

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

[If passing]: Next step: Run `/creating-prs #N` to create a pull request.
[If remaining issues]: Deferred items documented — review before creating a PR.
[If failing]: Critical issues remain — address the items above before creating a PR.
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
