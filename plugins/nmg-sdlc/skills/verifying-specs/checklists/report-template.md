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

## Issues Found

### Critical Issues
[Must fix before merging]

### High Priority
[Should fix before merging]

### Medium Priority
[Plan to address]

### Low Priority
[Nice to have]

### Issue Format

For each issue:

| Field | Value |
|-------|-------|
| **Severity** | Critical / High / Medium / Low |
| **Category** | Architecture / SOLID / Security / Performance / Testing / Error Handling |
| **Location** | `path/to/file:line` |
| **Issue** | [description] |
| **Impact** | [what this causes] |
| **Recommendation** | [specific fix] |

---

## Positive Observations

[What's working well — acknowledge good patterns]

---

## Recommendations Summary

### Before PR (Must)
- [ ] [critical/high items]

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
