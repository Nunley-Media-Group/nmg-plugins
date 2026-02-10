# Performance Considerations

[Back to main skill](../SKILL.md)

Evaluate performance patterns across both server-side and client-side code.

---

## Async / Concurrency Patterns

- [ ] No blocking operations on main thread / event loop
- [ ] Parallel operations where independent (Promise.all, Future.wait, goroutines, etc.)
- [ ] Proper timeout handling for external calls
- [ ] Cancellation support for long-running operations
- [ ] Debouncing/throttling for rapid user input

## Caching Strategy

- [ ] Cache headers for HTTP responses where appropriate
- [ ] Application-level caching for expensive operations
- [ ] Cache invalidation strategy defined
- [ ] Cache TTL appropriate for data freshness requirements
- [ ] No stale data served past acceptable thresholds

## Resource Management

- [ ] Connection pools sized appropriately (database, HTTP clients)
- [ ] Large payloads limited (request body size, response pagination)
- [ ] Memory usage bounded (no unbounded growth)
- [ ] Graceful shutdown implemented (drain connections, finish requests)
- [ ] File handles and streams properly closed

## Database / Data Access

- [ ] N+1 query problems avoided (batch loading, joins)
- [ ] Indexes exist for common query patterns
- [ ] Large result sets paginated
- [ ] Queries optimized (no SELECT *, appropriate WHERE clauses)
- [ ] Connection pooling configured

## Client-Side / UI Performance

- [ ] Lazy loading for expensive components or data
- [ ] Virtualized/windowed lists for large datasets
- [ ] Images optimized (correct format, size, lazy loading)
- [ ] Minimal re-renders (targeted state updates, memoization)
- [ ] Bundle size considered (no unnecessary dependencies)

## Network Efficiency

- [ ] Batch API calls where possible
- [ ] Compression enabled (gzip/brotli)
- [ ] Appropriate data format (JSON vs binary for large payloads)
- [ ] Optimistic UI updates where safe
- [ ] Offline support considered (if applicable)

---

## Scoring Guide

| Score | Description |
|-------|-------------|
| 1 | Blocking operations, no caching, N+1 queries |
| 2 | Basic async, minimal optimization |
| 3 | Good async patterns, some caching |
| 4 | Optimized queries, proper caching, good resource management |
| 5 | Full optimization, monitoring, graceful degradation |
