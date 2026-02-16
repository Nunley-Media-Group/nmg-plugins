# Architecture & Spec Verification Report Template

[Back to main skill](../SKILL.md)

Use this template to generate the final verification report.

---

```markdown
# Verification Report: [Feature Name]

**Date**: [Current Date]
**Issue**: #[number]
**Reviewer**: Claude Code
**Scope**: Implementation verification against spec

---

## Executive Summary

| Category | Score (1-5) |
|----------|-------------|
| Spec Compliance | [score] |
| Architecture (SOLID) | [score] |
| Security | [score] |
| Performance | [score] |
| Testability | [score] |
| Error Handling | [score] |
| **Overall** | [average] |

**Status**: Pass / Partial / Fail
**Total Issues**: [count]

---

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | [criterion] | Pass/Fail | `path/to/file:line` |
| AC2 | [criterion] | Pass/Fail | `path/to/file:line` |
| AC3 | [criterion] | Pass/Fail | `path/to/file:line` |

---

## Task Completion

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| T001 | [task title] | Complete/Incomplete | |
| T002 | [task title] | Complete/Incomplete | |

---

## Architecture Assessment

### SOLID Compliance

| Principle | Score (1-5) | Notes |
|-----------|-------------|-------|
| Single Responsibility | [score] | |
| Open/Closed | [score] | |
| Liskov Substitution | [score] | |
| Interface Segregation | [score] | |
| Dependency Inversion | [score] | |

### Layer Separation

[Assessment of layer boundaries and dependency flow]

### Dependency Flow

[Assessment of dependency directions and coupling]

---

## Security Assessment

[Key findings from security checklist]

- [ ] Authentication: [status]
- [ ] Authorization: [status]
- [ ] Input validation: [status]
- [ ] Injection prevention: [status]
- [ ] Data protection: [status]

---

## Performance Assessment

[Key findings from performance checklist]

- [ ] Async patterns: [status]
- [ ] Caching: [status]
- [ ] Resource management: [status]
- [ ] Query optimization: [status]

---

## Test Coverage

### BDD Scenarios

| Acceptance Criterion | Has Scenario | Has Steps | Passes |
|---------------------|-------------|-----------|--------|
| AC1 | Yes/No | Yes/No | Yes/No |
| AC2 | Yes/No | Yes/No | Yes/No |

### Coverage Summary

- Feature files: [count] scenarios
- Step definitions: [Implemented / Missing]
- Unit tests: [count] tests
- Integration tests: [count] tests

---

## Exercise Test Results

*Include this section when exercise-based verification was performed for plugin changes. Omit entirely for non-plugin projects.*

**If exercise was performed:**

| Field | Value |
|-------|-------|
| **Skill Exercised** | [skill name] |
| **Test Project** | [temp dir path] |
| **Exercise Method** | Agent SDK with `canUseTool` / `claude -p` fallback |
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

**If exercise was skipped (graceful degradation):**

| Field | Value |
|-------|-------|
| **Reason** | [e.g., claude CLI not found, Agent SDK unavailable, timeout] |
| **Recommendation** | Manual exercise testing recommended as follow-up |

---

## Fixes Applied

| Severity | Category | Location | Original Issue | Fix Applied |
|----------|----------|----------|----------------|-------------|
| [sev] | [cat] | `path/to/file:line` | [what was wrong] | [what was done] |

## Remaining Issues

Issues that could not be auto-fixed during verification.

### Critical Issues
[Must fix before merging — include reason not fixed]

### High Priority
[Should fix before merging — include reason not fixed]

### Medium Priority
[Plan to address — include reason not fixed]

### Low Priority
[Nice to have — include reason not fixed]

### Issue Format

For each remaining issue:

| Field | Value |
|-------|-------|
| **Severity** | Critical / High / Medium / Low |
| **Category** | Architecture / SOLID / Security / Performance / Testing / Error Handling |
| **Location** | `path/to/file:line` |
| **Issue** | [description] |
| **Impact** | [what this causes] |
| **Reason Not Fixed** | [why deferred: needs spec clarification / scope change / risk] |

---

## Positive Observations

[What's working well — acknowledge good patterns]

---

## Recommendations Summary

### Before PR (Must)
- [ ] [remaining unfixed critical/high items]

### Short Term (Should)
- [ ] [medium items]

### Long Term (Could)
- [ ] [low items, architectural improvements]

---

## Files Reviewed

| File | Issues | Notes |
|------|--------|-------|
| [path] | [count] | |

---

## Recommendation

**[Ready for PR / Needs fixes / Major rework needed]**

[Summary justification for the recommendation]
```
