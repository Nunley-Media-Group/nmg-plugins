# Technical Steering Template

Generate this document during `/setting-up-steering`. Pre-fill the tech stack, testing, and coding standards from codebase analysis.

---

```markdown
# [Project Name] Technical Steering

This document defines the technology stack, constraints, and integration standards.
All technical decisions should align with these guidelines.

---

## Architecture Overview

```
<!-- Pre-fill with discovered architecture diagram -->
<!-- Examples:
  Client → API → Database
  Monolith with modules
  Microservices
  Serverless functions
-->
```

---

## Technology Stack

<!-- Pre-fill from package.json, pubspec.yaml, Cargo.toml, go.mod, etc. -->

| Layer | Technology | Version |
|-------|------------|---------|
| [layer] | [technology] | [version] |
| [layer] | [technology] | [version] |
| [layer] | [technology] | [version] |

### External Services

| Service | Purpose | Notes |
|---------|---------|-------|
| [service] | [purpose] | [rate limits, etc.] |

---

## Versioning

<!-- Pre-fill VERSION from the project root if it exists. -->

The `VERSION` file (plain text semver at project root) is the **single source of truth** for the project's current version. Stack-specific files (e.g., `package.json`, `Cargo.toml`, `pubspec.yaml`) are kept in sync via the mapping table below.

<!-- TODO: Fill in the stack-specific files that contain a version field. -->
<!-- The /creating-prs skill reads this table to know which files to update when bumping the version. -->

| File | Path | Notes |
|------|------|-------|
| [file] | [path-to-version-field] | [e.g., "npm version field"] |

### Path Syntax

- **JSON files**: Use dot-notation (e.g., `version` for a root-level key, `packages.mylib.version` for nested)
- **TOML files**: Use dot-notation matching TOML keys (e.g., `package.version`)
- **Plain text files**: Use `line:N` for the line number containing the version, or omit Path if the entire file is the version string

---

## Technical Constraints

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| [metric] | [target] | [why] |

### Security

| Requirement | Implementation |
|-------------|----------------|
| Authentication | [method] |
| Authorization | [method] |
| Secrets management | [approach] |

---

## Coding Standards

<!-- Pre-fill from linter/formatter config if detected -->

### [Primary Language]

```
// GOOD patterns from this project
[example of project convention]

// BAD patterns to avoid
[counter-example]
```

### [Secondary Language] (if applicable)

```
// GOOD patterns
[example]

// BAD patterns
[counter-example]
```

---

## API / Interface Standards

<!-- Pre-fill if API conventions are discoverable -->

### URL/Method Structure

```
[project's API convention, e.g., REST, GraphQL, gRPC]
```

### Response Format

```json
// Success response format
{
  "example": "from existing code"
}

// Error response format
{
  "error": "from existing code"
}
```

---

## Database Standards

<!-- Pre-fill if database conventions are discoverable -->

### Naming

| Element | Convention | Example |
|---------|------------|---------|
| Tables | [convention] | [example] |
| Columns | [convention] | [example] |
| Primary keys | [convention] | [example] |

---

## Testing Standards

### BDD Testing (Required for nmg-sdlc)

**Every acceptance criterion MUST have a Gherkin test.**

<!-- TODO: Fill in your BDD framework details. This is critical for /writing-specs and /verifying-specs. -->

| Layer | Framework | Location |
|-------|-----------|----------|
| [layer] | [BDD framework] | [path to feature files] |

### Gherkin Feature Files

```gherkin
# [path to feature files]
Feature: Example
  As a [user type]
  I want [action]
  So that [benefit]

  Scenario: Example scenario
    Given [precondition]
    When [action]
    Then [expected outcome]
```

### Step Definitions

```
// [language] step definition pattern
// Path: [path to step definitions]

// Adapt to your BDD framework:
// - jest-cucumber (JavaScript/TypeScript)
// - pytest-bdd (Python)
// - SpecFlow (C#)
// - godog (Go)
// - flutter_gherkin (Dart)
// - Cucumber (Java/Ruby)
```

### Unit Tests

<!-- Pre-fill from discovered test framework -->

| Type | Framework | Location | Run Command |
|------|-----------|----------|-------------|
| Unit | [framework] | [path] | [command] |
| Integration | [framework] | [path] | [command] |
| E2E | [framework] | [path] | [command] |

### Test Pyramid

```
        /\
       /  \  BDD Integration (Gherkin)
      /----\  - Acceptance criteria as tests
     /      \ - End-to-end user flows
    /--------\
   /          \  Component / API Tests
  /            \ - Component behavior
 /--------------\
/                \  Unit Tests
 \________________/ - Business logic
```

---

## Environment Variables

<!-- Pre-fill from .env.example, docker-compose, or discovered env usage -->

### Required

| Variable | Description |
|----------|-------------|
| [variable] | [purpose] |

---

## References

- CLAUDE.md for project overview
- `.claude/steering/product.md` for product direction
- `.claude/steering/structure.md` for code organization
```
