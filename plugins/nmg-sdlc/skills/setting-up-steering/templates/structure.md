# Code Structure Steering Template

Generate this document during `/setting-up-steering`. Pre-fill the project layout, layer architecture, and naming conventions from codebase analysis.

---

```markdown
# [Project Name] Code Structure Steering

This document defines code organization, naming conventions, and patterns.
All code should follow these guidelines for consistency.

---

## Project Layout

<!-- Pre-fill with actual directory structure from `ls` and `find` -->

```
project/
├── [directory]/          # [purpose]
│   ├── [subdirectory]/   # [purpose]
│   └── [subdirectory]/   # [purpose]
├── [directory]/          # [purpose]
└── [config files]
```

---

## Layer Architecture

<!-- Pre-fill based on discovered directory structure and imports -->

### Request / Data Flow

```
[Entry Point]
    ↓
┌─────────────────┐
│  [Layer 1 Name] │ ← [responsibility]
└────────┬────────┘
         ↓
┌─────────────────┐
│  [Layer 2 Name] │ ← [responsibility]
└────────┬────────┘
         ↓
┌─────────────────┐
│  [Layer 3 Name] │ ← [responsibility]
└────────┬────────┘
         ↓
   [External / Storage]
```

### Layer Responsibilities

| Layer | Does | Doesn't Do |
|-------|------|------------|
| [Layer 1] | [responsibilities] | [anti-patterns] |
| [Layer 2] | [responsibilities] | [anti-patterns] |
| [Layer 3] | [responsibilities] | [anti-patterns] |

---

## Naming Conventions

<!-- Pre-fill from observed patterns in the codebase -->

### [Primary Language]

| Element | Convention | Example |
|---------|------------|---------|
| Files | [convention] | [example] |
| Classes/Types | [convention] | [example] |
| Functions | [convention] | [example] |
| Constants | [convention] | [example] |
| Variables | [convention] | [example] |

### [Secondary Language] (if applicable)

| Element | Convention | Example |
|---------|------------|---------|
| Files | [convention] | [example] |
| Classes/Types | [convention] | [example] |
| Functions | [convention] | [example] |

---

## File Templates

<!-- Pre-fill with patterns discovered from existing code -->

### [Layer 1 Template]

```
// Pseudocode — replace with project language

// [path pattern]
class [Name] {
  constructor(dependencies) { }

  method() {
    // [pattern]
  }
}
```

### [Layer 2 Template]

```
// Pseudocode — replace with project language

// [path pattern]
class [Name] {
  constructor(dependencies) { }

  method() {
    // [pattern]
  }
}
```

---

## Import Order

<!-- Pre-fill from observed patterns -->

```
// 1. Standard library
// 2. External packages
// 3. Internal modules
// 4. Types/interfaces
```

---

## Design Tokens / UI Standards (if applicable)

<!-- Pre-fill if design token files are found -->

| Token | Value | Usage |
|-------|-------|-------|
| [token] | [value] | [when to use] |

---

## Anti-Patterns to Avoid

<!-- Pre-fill based on observed patterns and common issues for the stack -->

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| [pattern] | [why it's bad] | [what to do instead] |
| [pattern] | [why it's bad] | [what to do instead] |

---

## References

- CLAUDE.md for project overview
- `.claude/steering/product.md` for product direction
- `.claude/steering/tech.md` for technical standards
```
