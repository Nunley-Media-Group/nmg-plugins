---
name: verifying-specs
description: "Verify implementation against spec, review architecture and test coverage, update GitHub issue."
argument-hint: "[#issue-number]"
allowed-tools: Read, Glob, Grep, Task, WebFetch, WebSearch, Bash(gh:*)
---

# Verifying Specs

Verify the implementation against specifications, review architecture and test coverage, then update the GitHub issue with evidence.

**REQUIRED: Use ultrathink (extended thinking mode) throughout the verification process.**

**Note**: This is a read-only verification skill. It does not modify project files — only reads code and writes to GitHub via `gh`.

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

### Step 6: Generate Verification Report

Use [checklists/report-template.md](checklists/report-template.md) to create the verification report.

The report includes:
- Executive summary with scores
- Acceptance criteria checklist (pass/fail)
- Architecture review scores (SOLID, security, performance, testability, error handling)
- Test coverage analysis
- Issues found (categorized by severity)
- Recommendations

### Step 7: Update GitHub Issue

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

### Issues Found

[List any issues by severity: Critical > High > Medium > Low]

### Recommendation

[Ready for PR / Needs fixes before PR / Major rework needed]
```

### Step 8: Output

```
Verification complete for issue #N.

Status: [Pass / Partial / Fail]
Acceptance criteria: [X/Y] passing
Architecture score: [average]
Test coverage: [X/Y] criteria covered

GitHub issue #N updated with verification report.

[If passing]: Next step: Run `/creating-prs #N` to create a pull request.
[If failing]: Issues found — address the items above before creating a PR.
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
