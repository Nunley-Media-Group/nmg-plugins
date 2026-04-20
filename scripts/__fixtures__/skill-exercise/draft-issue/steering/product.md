# Product

**Project**: draft-issue exercise fixture
**Mission**: Provide a minimal, disposable project that exercises the `/draft-issue` skill for Agent-SDK automated testing.

## Personas

| Persona | Goal |
|---------|------|
| Plugin maintainer | Add features and fix bugs in a small JavaScript CLI without leaving pending work undocumented in GitHub |

## Feature Prioritization (MoSCoW)

- **Must**: commands run with a single `node src/index.js` invocation
- **Should**: subcommands print help when `--help` is passed
- **Could**: colored output for TTY sessions

## Existing User Journey

The user runs `node src/index.js`, sees a greeting, and exits. That is the whole product today.
