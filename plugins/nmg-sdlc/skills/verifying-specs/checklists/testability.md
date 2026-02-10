# Testability Assessment

[Back to main skill](../SKILL.md)

Evaluate whether the implementation is structured for effective testing.

---

## Unit Test Readiness

- [ ] Dependencies injectable for mocking (constructor injection, DI container, provider overrides)
- [ ] Pure functions for business logic (deterministic, no side effects)
- [ ] No hidden side effects (global state, singletons without reset)
- [ ] Async operations awaitable and testable
- [ ] Time-dependent logic uses injectable clock/time source

### Mock Patterns

The implementation should support easy mocking:

```
// Pseudocode — dependency injection enables mocking

// Production
service = new UserService(realDatabase, realEmailClient)

// Test
service = new UserService(mockDatabase, mockEmailClient)
```

## Integration Test Readiness

- [ ] Database/storage can be reset between tests
- [ ] External services mockable (HTTP interceptors, fake servers)
- [ ] Test fixtures available for common data
- [ ] Environment isolation (test config separate from production)

## BDD Test Readiness

- [ ] Feature files exist with valid Gherkin syntax
- [ ] Step definitions implemented for all scenarios
- [ ] Scenarios are independent (no shared mutable state)
- [ ] Test data setup is declarative and repeatable

## Test Organization

- [ ] Tests colocated with source OR in dedicated test directory
- [ ] Clear test naming (describe what, not how)
- [ ] AAA pattern (Arrange-Act-Assert) or Given-When-Then
- [ ] Setup/teardown properly managed (no leaked state)
- [ ] Test utilities shared and maintainable

## Anti-Patterns

- [ ] No hard-coded dates/times (use injectable clock)
- [ ] No tests that depend on execution order
- [ ] No tests that require network access for unit tests
- [ ] No tests with excessive mocking (testing implementation, not behavior)
- [ ] No flaky tests (random failures, timing dependencies)

---

## Scoring Guide

| Score | Description |
|-------|-------------|
| 1 | Hard-coded dependencies, no tests possible |
| 2 | Some tests, difficult to mock |
| 3 | Testable design, partial coverage |
| 4 | Good DI, comprehensive unit tests |
| 5 | Full DI, high coverage, integration + BDD tests |
