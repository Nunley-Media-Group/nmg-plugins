# Root Cause Analysis: Creating-issues skill does not read tech.md and structure.md during investigation

**Issue**: #27
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude Code

---

## Root Cause

The `/creating-issues` skill's Step 3 (Investigate Codebase) defines two investigation sub-flows — one for Enhancement/Feature and one for Bug — but neither reads `.claude/steering/tech.md` or `.claude/steering/structure.md`.

Step 1 reads only `product.md` for product context (vision, users, priorities), which is correct for its purpose. The assumption was that Step 3's codebase exploration (specs + source code) would surface all relevant constraints. However, technical constraints (e.g., "review Claude Code docs before modifying CC resources" in `tech.md`) and architectural patterns (e.g., layer responsibilities in `structure.md`) are only captured in steering documents, not in specs or source code. Without reading these documents, the investigation summary is incomplete and the resulting issue misses constraint-derived acceptance criteria.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | 46–59 | Step 3, Enhancement flow — explores specs and source code but not steering docs |
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | 61–75 | Step 3, Bug flow — searches and traces code but not steering docs |

### Triggering Conditions

- `.claude/steering/tech.md` and/or `.claude/steering/structure.md` exist in the project
- The enhancement or bug area is subject to constraints defined in those documents
- These constraints are not duplicated in existing specs or source code comments

---

## Fix Strategy

### Approach

Add a new sub-step to both Enhancement and Bug flows within Step 3 that reads `tech.md` and `structure.md` (if they exist) and incorporates relevant constraints into the investigation summary. This is a minimal change — it adds one numbered item to each flow and augments the summary output to include a constraints section.

The new sub-step should be inserted early in each flow (after initial exploration, before summarization) so that constraints inform the summary. For the Enhancement flow, it becomes a new item 3 (before "Summarize findings", which shifts to item 4). For the Bug flow, it becomes a new item 3 (before "Form hypothesis", which shifts to item 4, and "Confirm with user" shifts to item 5).

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | Add steering doc read step to Enhancement flow (after source exploration, before summarize) | Surfaces technical and architectural constraints for enhancements |
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | Add steering doc read step to Bug flow (after code tracing, before hypothesis) | Surfaces constraints relevant to the bug's domain |
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | Update summarize/hypothesis steps to include relevant constraints | Ensures constraints flow through to issue output |

### Blast Radius

- **Direct impact**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` — only file modified
- **Indirect impact**: None. Skills are prompt-based Markdown files; there are no callers or imports. The change affects Claude's behavior when executing `/creating-issues`, but does not touch any other skill, hook, or agent.
- **Risk level**: Low — adding more information to the investigation step cannot break existing behavior; Step 1's `product.md` reading is untouched.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Step 1 product.md reading is accidentally altered | Low | The fix only modifies Step 3; Step 1 is not touched |
| Investigation takes noticeably longer due to extra reads | Low | Reading two small Markdown files adds negligible latency |
| Constraints overwhelm the investigation summary | Low | The instructions specify surfacing only constraints *relevant to the enhancement/bug area*, not all constraints |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
