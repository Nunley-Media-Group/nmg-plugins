# Security Checklist

[Back to main skill](../SKILL.md)

OWASP-aligned security review. Evaluate the implementation against common vulnerability categories.

---

## Authentication

- [ ] Passwords hashed with strong algorithm (bcrypt, argon2, scrypt)
- [ ] Token-based auth properly configured (expiry, algorithm, secrets)
- [ ] Token rotation/revocation implemented
- [ ] Session management secure (if applicable)

## Authorization

- [ ] Role-based or attribute-based access control
- [ ] Authorization checks on every protected endpoint/route
- [ ] No privilege escalation paths
- [ ] Default deny — resources inaccessible unless explicitly allowed

## Input Validation

- [ ] All external input validated at entry point
- [ ] Validation library or schema validation used
- [ ] Type coercion handled explicitly
- [ ] Validation errors return safe, descriptive messages (no internal details)

## Injection Prevention

- [ ] SQL injection prevented (parameterized queries, ORM)
- [ ] NoSQL injection prevented (if applicable)
- [ ] Command injection prevented (no shell exec with user input)
- [ ] XSS prevented (output encoding, content security policy)
- [ ] CSRF protection for state-changing operations (if applicable)

## Data Protection

- [ ] Sensitive data encrypted at rest
- [ ] Sensitive data encrypted in transit (HTTPS)
- [ ] No secrets in source code or logs
- [ ] PII handled according to data protection requirements
- [ ] Error responses don't expose internal details (stack traces, SQL, paths)

## Transport Security

- [ ] Security headers configured (HSTS, CSP, X-Frame-Options, etc.)
- [ ] CORS properly configured (not `*` in production)
- [ ] HTTPS enforced in production

## Rate Limiting

- [ ] Rate limiting on authentication endpoints
- [ ] Rate limiting on sensitive operations
- [ ] Rate limiting on public-facing endpoints

## Dependency Security

- [ ] Dependencies up to date (no known vulnerabilities)
- [ ] Lock files committed (`package-lock.json`, `pubspec.lock`, etc.)
- [ ] Minimal dependency surface (no unnecessary packages)

---

## Common Vulnerabilities Quick Check

| Vulnerability | What to Look For |
|---------------|-----------------|
| SQL Injection | String interpolation in queries |
| XSS | Unescaped user input in output |
| CSRF | State changes without token validation |
| Broken Auth | Missing auth checks, weak token config |
| Sensitive Data | Secrets in code, PII in logs |
| Security Headers | Missing HSTS, CSP, X-Frame-Options |
| Mass Assignment | Accepting arbitrary fields from input |
| IDOR | Direct object references without auth checks |

---

## Scoring Guide

| Score | Description |
|-------|-------------|
| 1 | Major vulnerabilities present |
| 2 | Some security measures, missing basics |
| 3 | Good security, some gaps |
| 4 | Comprehensive security measures |
| 5 | Security-first design, defense in depth |
