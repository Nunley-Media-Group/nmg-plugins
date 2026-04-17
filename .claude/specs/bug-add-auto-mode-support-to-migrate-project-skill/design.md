# Root Cause Analysis: /migrate-project Lacks Auto-Mode Support

**Issue**: #81
**Date**: 2026-02-23
**Status**: Draft
**Author**: Claude

---

## Root Cause

The `/migrate-project` skill was written before unattended-mode was introduced as a project-wide convention. When the feature-migration-skill spec (#25/#72) was created, the Unattended Mode section was intentionally set to "ALWAYS interactive" because migration was considered too sensitive for automation. However, this blanket prohibition is overly conservative: not all migration operations are destructive. Non-destructive operations like adding missing template sections to existing files, updating frontmatter format, correcting Related Spec links, and adding missing JSON config keys are safe to auto-apply. Only spec directory consolidation/merges (which delete legacy directories and restructure content) are truly destructive.

The skill has zero unattended-mode awareness — it never checks for `.claude/unattended-mode` and always calls `AskUserQuestion` at three points in the workflow:

1. **Step 4d** — Per-group consolidation approval (destructive: merges/renames/deletes directories)
2. **Step 9 Part A** — Per-section steering doc approval via `multiSelect` (non-destructive: adds sections)
3. **Step 9 Part B** — Batch approval for remaining changes + per-group consolidation approval (mixed: non-destructive changes + destructive consolidations)

Every other skill in the pipeline (`/write-spec`, `/write-code`, `/verify-code`, `/open-pr`, `/draft-issue`, `/start-issue`) checks for `.claude/unattended-mode` and branches behavior accordingly. This skill was overlooked.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` | 21–27 | "Unattended Mode" section — explicitly declares "ALWAYS interactive" |
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` | 169–179 | Step 4d — consolidation approval via `AskUserQuestion` |
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` | 293–379 | Step 9 — two-part approval gate, all via `AskUserQuestion` |
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` | 380–392 | Step 10 — apply changes (no unattended-mode branch) |

### Triggering Conditions

- `.claude/unattended-mode` exists in the project directory
- `/migrate-project` is invoked (e.g., by SDLC runner during a headless SDLC cycle)
- Any migration finding is detected (steering doc sections, spec frontmatter, config keys, etc.)
- The skill hits any `AskUserQuestion` call and hangs indefinitely because no user is present

---

## Fix Strategy

### Approach

Add unattended-mode awareness to `/migrate-project` SKILL.md following the established pattern from other skills. The fix classifies every migration operation as either **non-destructive** (safe to auto-apply) or **destructive** (must be skipped in unattended-mode), then branches behavior at each `AskUserQuestion` call site.

This is a minimal fix to the Markdown skill instructions — no scripts or runtime code need to change. The changes modify prompt instructions that Claude follows, not executable code.

### Operation Classification

| Operation | Category | Auto-Mode Behavior |
|-----------|----------|-------------------|
| Steering doc section additions (Step 3) | Non-destructive | Auto-apply all proposed sections |
| Spec file section additions (Step 4) | Non-destructive | Auto-apply |
| Related Spec link corrections (Step 4a) | Non-destructive | Auto-apply |
| Legacy frontmatter migration `Issue` → `Issues` (Step 4f) | Non-destructive | Auto-apply |
| Change History section additions (Step 4f) | Non-destructive | Auto-apply |
| Config key additions (Step 5) | Non-destructive | Auto-apply |
| CHANGELOG.md fixes (Step 7) | Non-destructive | Auto-apply |
| VERSION file creation/update (Step 8) | Non-destructive | Auto-apply |
| Spec directory consolidation (Steps 4b–4e) | Destructive | Skip with summary |
| Legacy directory renames (Step 4e) | Destructive | Skip with summary |
| Legacy directory deletes (Step 4e) | Destructive | Skip with summary |

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` lines 21–27 | Rewrite "Unattended Mode" section to describe the dual behavior: auto-apply non-destructive, skip destructive with summary | Establishes the unattended-mode contract for this skill |
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` Step 4d (lines 169–179) | Add unattended-mode guard: when `.claude/unattended-mode` exists, skip consolidation entirely and record each group as a skipped operation | Prevents destructive merges/renames/deletes in headless mode |
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` Step 9 (lines 293–379) | Add unattended-mode branch: skip both Part A and Part B approval prompts; auto-select all non-destructive changes; skip any remaining destructive changes | Eliminates all `AskUserQuestion` calls in unattended-mode |
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` Step 10 (lines 380–392) | Add unattended-mode output section: after applying changes, emit a machine-readable "Skipped Operations" block listing each skipped destructive operation with type, paths, and reason | Enables the runner to surface skipped operations in its status log |
| `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` Key Rules | Update rule 5 to reflect conditional interactivity; add a new rule about unattended-mode behavior | Keeps the Key Rules section consistent with the updated workflow |

### Blast Radius

- **Direct impact**: Only `plugins/nmg-sdlc/skills/migrate-project/SKILL.md` is modified
- **Indirect impact**: The SDLC runner (`sdlc-runner.mjs`) invokes this skill — it will now complete instead of hanging, which is the desired fix. No runner code changes needed.
- **Risk level**: Low — the skill is Markdown instructions; the fix adds conditional branches around existing `AskUserQuestion` calls without changing the underlying analysis logic (Steps 1–8) or the apply logic (Step 10)

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Interactive mode behavior changes | Low | AC4 explicitly requires all existing interactive behavior to be preserved unchanged; the unattended-mode branch only activates when `.claude/unattended-mode` exists |
| Non-destructive operations misclassified as destructive (or vice versa) | Low | The operation classification table is explicit; all directory-level operations (consolidation, renames, deletes) are destructive; all content additions are non-destructive |
| Declined sections not persisted in unattended-mode | Low | FR7 explicitly states `.claude/migration-exclusions.json` is not written to in unattended-mode (nothing is declined); existing exclusions from prior interactive runs are still respected during analysis |
| Machine-readable output format breaks runner parsing | Low | The output is informational — the runner surfaces it in its status log but does not parse it for control flow decisions |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Auto-apply everything (including consolidation) | Apply all changes including destructive operations in unattended-mode | Consolidation deletes directories and merges content — too risky for unattended execution; could lose data if the merge logic produces incorrect results |
| Skip entire skill in unattended-mode | Have the skill immediately exit with "Migration requires interactive mode" | Misses the opportunity to auto-apply safe, non-destructive changes that keep project files current |

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #81 | 2026-02-23 | Initial defect spec |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
