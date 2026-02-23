# Root Cause Analysis: Retrospective learnings produce project-specific regression notes instead of transferable patterns

**Issue**: #39
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude

---

## Root Cause

The `/running-retrospectives` skill produces project-specific output due to four compounding instruction gaps in `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`:

1. **Backward-looking extraction framing (Step 3, line 58)**: The instruction "Extract a learning: A concise statement of what the feature spec should have included" anchors the agent on *that specific spec* rather than prompting it to generalize. The word "should have included" is retrospective about one case, not prospective about a pattern.

2. **No abstraction-level guidance (Step 5)**: The filter step correctly excludes non-spec learnings (implementation bugs, tooling issues, etc.) but provides zero guidance on the *level of abstraction*. An agent can pass the filter with "CDP session isolation was missing from the emulate status spec" — it's a spec gap, just not transferable.

3. **No cross-defect aggregation**: The workflow is strictly per-defect — Step 3 loops through each eligible defect independently, and Step 7 writes one table row per learning. There is no instruction to identify when multiple defects share a root pattern and consolidate them.

4. **Template framing**: The template's "How to Use" section says "consult the relevant sections below to avoid repeating past spec gaps" — backward-looking language that reinforces project-specific application rather than pattern transfer.

Additionally, two downstream consumers need updates:
- `/writing-specs` Phase 1 (line 114) says "apply relevant learnings" but gives no guidance on *how* to adapt generalized patterns to the current feature's context.
- `/migrating-projects` Step 1 doesn't resolve the retrospective template at all, so existing `retrospective.md` files won't be migrated when the template changes.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | 52–59 (Step 3) | Per-defect learning extraction — backward-looking framing |
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | 71–84 (Step 5) | Filter step — missing abstraction-level guidance |
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | 97–111 (Step 7) | Template writing — one row per learning, no aggregation structure |
| `plugins/nmg-sdlc/skills/running-retrospectives/templates/retrospective.md` | 1–45 | Template — per-defect rows, backward-looking framing |
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | 114 | Phase 1 retrospective consumption — no adaptive application guidance |
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | 39–49 (Step 1) | Template resolution — retrospective template not included |

### Triggering Conditions

- Project accumulates multiple defect specs with `Related Spec` links
- `/running-retrospectives` is run
- Each defect produces its own learning because there is no aggregation instruction
- Learnings use project-specific terminology because there is no generalization instruction

---

## Fix Strategy

### Approach

The fix restructures the retrospective workflow to produce **cross-cutting, generalized learnings** instead of per-defect notes. The key change is inserting an **aggregation step** between individual defect analysis (Step 3) and filtering (Step 5), and rewriting the extraction instructions to require generalization. The template is restructured so each learning can reference multiple source defects as evidence.

Changes are confined to three Markdown skill files and one template — no scripts or manifests are affected.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `SKILL.md` (running-retrospectives) Step 3 | Rewrite extraction instructions: replace "what the spec should have included" with "identify the transferable spec-writing pattern — strip project-specific details and frame as a principle applicable to any domain" | Fixes the backward-looking framing that causes project-specific output (FR1) |
| `SKILL.md` (running-retrospectives) New Step 4 | Add "Aggregate Cross-Cutting Patterns" step: after analyzing all defects individually, group learnings that share a root pattern into a single cross-cutting learning with multiple defect evidence references | Implements cross-defect aggregation (FR2) |
| `SKILL.md` (running-retrospectives) Step 5 (renumbered) | Add abstraction-level guidance to the filter: "Too specific: references project domain terms, specific file names, or implementation details. Too generic: could apply to any software without narrowing. Right level: describes the *category* of feature or interaction pattern without naming the specific technology." | Adds abstraction guardrails (FR4) |
| `SKILL.md` (running-retrospectives) Step 7 (renumbered) | Update template-filling instructions: replace single "Source Defect" column with "Evidence" column listing multiple defect spec paths per learning | Aligns with restructured template (FR3) |
| `templates/retrospective.md` | Restructure tables: replace per-defect `Source Defect | Related Feature Spec` columns with `Evidence (defect specs)` column. Update "How to Use" framing from "avoid repeating past gaps" to "apply these transferable patterns to new feature contexts" | Forward-looking framing with evidence traceability (FR3, AC3) |
| `SKILL.md` (writing-specs) line 114 | Expand the instruction from "apply relevant learnings" to "read each learning as a transferable principle; adapt it to the current feature's domain by mapping the abstract pattern to concrete scenarios relevant to this feature" | Guides adaptive consumption (FR5, AC4) |
| `SKILL.md` (migrating-projects) Step 1 | Add a fourth template source: `running-retrospectives/templates/retrospective.md` mapped to `.claude/steering/retrospective.md` | Closes the migration gap (FR6, AC5) |

### Blast Radius

- **Direct impact**: 3 SKILL.md files + 1 template — all Markdown, no runtime code
- **Indirect impact**: Any project with an existing `retrospective.md` will get a structurally different output on next `/running-retrospectives` run (full re-analysis means the old format is replaced entirely)
- **Risk level**: Low — the retrospective is always regenerated from scratch (Step 6 specifies full re-analysis), so format changes are picked up automatically. The `/migrating-projects` addition provides a safety net for projects between runs.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing retrospective.md files become structurally incompatible with updated writing-specs consumption | Low | `/running-retrospectives` does full re-analysis every run, regenerating the file. `/migrating-projects` update provides interim migration. |
| Aggregation step merges defects that shouldn't be merged (false pattern grouping) | Medium | Instruction will specify that grouping requires shared root *pattern type*, not just shared category. Evidence references preserve traceability so users can verify groupings. |
| Over-generalized learnings lose actionability | Medium | Abstraction-level guidance in Step 5 provides explicit "too generic" examples. The three pattern-type categories (Missing ACs, Undertested Boundaries, Domain-Specific Gaps) anchor learnings to concrete spec-writing actions. |
| Step renumbering breaks cross-references within the skill | Low | Audit all step references within the SKILL.md and update them. The skill has no external step-number references. |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Post-processing filter | Keep per-defect learnings but add a post-processing step that generalizes them | Doesn't solve aggregation; still produces N learnings for N defects sharing a pattern. Better to generalize at extraction time. |
| Two-tier template (specific + generalized) | Keep project-specific notes in one section, add a "Generalized Patterns" section | Increases template complexity; consumers must know which section to read. A single generalized format is simpler and matches the stated goal. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
