# Error Handling Patterns

[Back to main skill](../SKILL.md)

Evaluate error handling design, hierarchy, and propagation.

---

## Error Hierarchy

- [ ] Custom error types extend the language's base error class
- [ ] Operational errors vs programmer errors distinguished
- [ ] Error codes for machine-readable classification
- [ ] Error messages are descriptive and actionable

### Expected Pattern

```
// Pseudocode — custom error hierarchy

BaseAppError (extends Error)
├── NotFoundError        — Resource not found
├── ValidationError      — Invalid input
├── AuthenticationError  — Not authenticated
├── AuthorizationError   — Not authorized
├── ConflictError        — Resource conflict
└── ExternalServiceError — Third-party failure
```

Each error type should carry:
- **Message**: Human-readable description
- **Code**: Machine-readable identifier (e.g., `USER_NOT_FOUND`)
- **Status/Severity**: HTTP status code or severity level
- **Context**: Additional data for debugging (no sensitive info)

## Error Handling Flow

- [ ] Business logic throws domain-specific errors
- [ ] Entry layer (controllers/handlers) catches and transforms to user-facing responses
- [ ] Global error handler for uncaught exceptions
- [ ] Async errors properly caught (no unhandled promise rejections / uncaught exceptions)
- [ ] Error details hidden in production (no stack traces in responses)

## Error Propagation

- [ ] Errors propagate through layers without losing context
- [ ] Original error preserved when wrapping (cause/inner exception)
- [ ] Errors logged at the appropriate level (error vs warn vs info)
- [ ] Error boundaries exist for UI components (if applicable)

## Anti-Patterns

- [ ] **No swallowed errors**: Every catch block has meaningful handling
- [ ] **No generic errors**: Specific error types over `throw new Error("something")`
- [ ] **No exposed internals**: Stack traces, SQL queries, file paths not in user-facing errors
- [ ] **No silent failures**: Failed operations are reported, not ignored
- [ ] **No retry without backoff**: Retries use exponential backoff with limits

## Client-Side Error Handling

- [ ] Network errors handled gracefully (timeout, offline, server error)
- [ ] User-facing error messages are helpful and actionable
- [ ] Retry logic for transient failures
- [ ] Error state in UI (not just console logging)
- [ ] Error reporting/telemetry for production debugging

---

## Scoring Guide

| Score | Description |
|-------|-------------|
| 1 | Swallowed errors, generic messages, exposed internals |
| 2 | Some error handling, inconsistent patterns |
| 3 | Good error types, mostly consistent handling |
| 4 | Comprehensive error hierarchy, proper propagation |
| 5 | Full error strategy, monitoring, graceful degradation |
