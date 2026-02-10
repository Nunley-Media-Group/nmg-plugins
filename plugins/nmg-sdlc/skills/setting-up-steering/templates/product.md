# Product Steering Template

Generate this document during `/setting-up-steering`. Pre-fill what you can discover from the codebase, and leave the rest as templates for the user to customize.

---

```markdown
# [Project Name] Product Steering

This document defines the product vision, target users, and success metrics.
All feature development should align with these guidelines.

---

## Mission

**[Project Name] [does what] for [whom] by [how].**

<!-- TODO: Replace with your product's mission statement -->

---

## Target Users

### Primary: [Persona Name]

| Characteristic | Implication |
|----------------|-------------|
| [trait] | [how it affects design/features] |
| [trait] | [how it affects design/features] |

### Secondary: [Persona Name]

| Characteristic | Implication |
|----------------|-------------|
| [trait] | [how it affects design/features] |
| [trait] | [how it affects design/features] |

<!-- TODO: Define your user personas. Good personas drive better acceptance criteria. -->

---

## Core Value Proposition

1. **[Primary value]** — [What makes this uniquely useful]
2. **[Secondary value]** — [Additional benefit]
3. **[Tertiary value]** — [Nice-to-have differentiator]

---

## Product Principles

| Principle | Description |
|-----------|-------------|
| [principle] | [What this means for product decisions] |
| [principle] | [What this means for product decisions] |
| [principle] | [What this means for product decisions] |

<!-- TODO: Principles guide decision-making when requirements conflict -->

---

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| [metric] | [target] | [rationale] |
| [metric] | [target] | [rationale] |
| [metric] | [target] | [rationale] |

---

## Feature Prioritization

### Must Have (MVP)
- [Core feature 1]
- [Core feature 2]

### Should Have
- [Important feature 1]
- [Important feature 2]

### Could Have
- [Nice-to-have 1]

### Won't Have (Now)
- [Explicitly deferred 1]

<!-- TODO: MoSCoW prioritization helps /writing-specs scope features correctly -->

---

## Key User Journeys

### Journey 1: [Primary User Flow]

```
1. [Step]
2. [Step]
3. [Step]
```

### Journey 2: [Secondary User Flow]

```
1. [Step]
2. [Step]
3. [Step]
```

<!-- TODO: User journeys become the basis for BDD acceptance criteria -->

---

## Brand Voice

| Attribute | Do | Don't |
|-----------|-----|-------|
| [attribute] | [example] | [counter-example] |
| [attribute] | [example] | [counter-example] |

---

## Privacy Commitment

| Data | Usage | Shared |
|------|-------|--------|
| [data type] | [how used] | [with whom] |

---

## References

- Technical spec: `.claude/steering/tech.md`
- Code structure: `.claude/steering/structure.md`
```
