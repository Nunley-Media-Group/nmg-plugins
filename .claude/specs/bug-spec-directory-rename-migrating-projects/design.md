# Root Cause Analysis: Missing Spec Directory Rename in /migrating-projects

**Issue**: #83
**Date**: 2026-02-24
**Status**: Draft
**Author**: Claude (spec agent)

---

## Root Cause

The `/migrating-projects` SKILL.md already contains Steps 4b–4e (added by #72) which describe the rename/consolidation flow. However, the instructions fail when Claude attempts to execute them for three distinct reasons:

**1. Vague tool usage in solo rename instructions (Step 4e, lines 207–215).** The solo feature rename says "Rename the directory from `{issue#}-{slug}/` to `feature-{slug}/`" without specifying which tool to use. The skill's allowed tools include `Bash(git:*)` (which permits `git mv`), but the instruction doesn't say to use it. Compare this with the consolidation path (Step 4e, line 204) which explicitly mentions `Grep` for cross-reference discovery. Claude either attempts a bare `mv` command (blocked by tool permissions) or skips the operation entirely due to ambiguity.

**2. Solo rename cross-reference updates lack tool specificity (Step 4e, lines 210, 215).** The solo rename paths say "Update defect spec cross-references that pointed to the old directory name" — a single sentence without specifying `Grep` to discover affected files or `Edit` to update them. The consolidation path (line 204) does specify `Grep` and chain resolution explicitly, creating an asymmetry where consolidation cross-reference logic is detailed but solo rename cross-reference logic is a one-liner.

**3. Auto-mode incorrectly classifies solo renames as destructive (Automation Mode section, line 27; Step 4d, line 187).** The Automation Mode section lists "legacy directory renames" alongside "Spec directory consolidation" and "legacy directory deletes" as destructive operations skipped in auto-mode. Solo renames are content-preserving operations — no data is lost, no files are merged or deleted. Only consolidation (which merges multiple specs, potentially discarding content) and directory deletion are genuinely destructive.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | 25–27 | Automation Mode: non-destructive vs destructive classification |
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | 187 | Step 4d: auto-mode handling lumps solo renames with consolidation |
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | 207–215 | Step 4e: solo rename instructions lack explicit `git mv` and `Grep`/`Edit` tool usage |

### Triggering Conditions

- Legacy `{issue#}-{slug}/` spec directories exist in `.claude/specs/`
- The skill reaches Steps 4b–4e (legacy directories are detected)
- Claude attempts to execute the rename but fails due to ambiguous instructions (no explicit `git mv`)
- In auto-mode, the operation is skipped entirely before execution is even attempted

---

## Fix Strategy

### Approach

Make three targeted changes to the SKILL.md, all within the existing Steps 4b–4e and Automation Mode sections. No new steps are added — the fix clarifies and corrects existing instructions.

1. **Reclassify solo renames as non-destructive in auto-mode.** Move "legacy directory renames (solo)" from the destructive list to the non-destructive list in the Automation Mode section. Keep "Spec directory consolidation" and "legacy directory deletes" as destructive.

2. **Add explicit `git mv` usage to Step 4e solo rename instructions.** Replace the vague "Rename the directory" with explicit `git mv .claude/specs/{old}/ .claude/specs/{new}/` instructions for both feature and bug solo renames.

3. **Expand solo rename cross-reference update instructions in Step 4e.** Replace the one-liner "Update defect spec cross-references" with the same level of detail as the consolidation path: use `Grep` to discover `**Related Spec**` fields pointing to the old path, filter to defect specs, use `Edit` to update, and follow chain resolution with cycle detection.

4. **Update Step 4d auto-mode logic.** Instead of recording ALL operations as skipped, differentiate: solo renames proceed automatically (no `AskUserQuestion`, no skipped operation record), consolidation is recorded as skipped.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `SKILL.md` lines 25–27 | Move "legacy directory renames (solo)" to non-destructive list; keep consolidation/deletes as destructive | Solo renames preserve all content — they're non-destructive |
| `SKILL.md` line 187 | Split auto-mode logic: auto-apply solo renames, skip consolidation only | Enables automated rename without interactive gates |
| `SKILL.md` lines 207–210 | Add `git mv` command and expand cross-reference update to use `Grep`/`Edit` with chain resolution | Explicit tool usage removes ambiguity |
| `SKILL.md` lines 212–215 | Same treatment for solo bug rename path | Consistency between feature and bug rename paths |
| `SKILL.md` lines 29–33 | Update auto-mode bullet points to reflect new Step 4d behavior (solo renames auto-applied, consolidation skipped) | Documentation consistency |

### Blast Radius

- **Direct impact**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` — the only file modified
- **Indirect impact**: Any project running `/migrating-projects` with legacy-named spec directories will now see rename proposals (interactive) or automatic renames (auto-mode) that were previously skipped
- **Risk level**: Low — solo renames are content-preserving operations; the git history tracks the rename for reversibility

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Multi-spec consolidation accidentally treated as non-destructive | Low | The fix explicitly keeps consolidation in the destructive list; only solo renames move to non-destructive |
| Solo rename applied in auto-mode corrupts spec directory | Low | `git mv` is atomic and versioned; the operation is reversible via `git checkout` |
| Cross-reference updates miss indirect references | Low | Expanded instructions include chain resolution with cycle detection, matching the consolidation path's logic |
| Existing interactive behavior changes for manual mode users | Low | Interactive mode still uses `AskUserQuestion` for all operations (both renames and consolidation) — only auto-mode behavior changes |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Add a separate Step 4b-rename before Step 4b | Create an entirely new step dedicated to solo renames, separate from the consolidation flow | Unnecessary duplication — the existing Steps 4b–4e already contain the rename logic; the fix is to clarify instructions, not restructure the workflow |
| Keep solo renames as destructive in auto-mode | Leave auto-mode behavior unchanged; only fix the tool usage ambiguity | Violates issue AC3 which explicitly requires auto-mode to apply non-destructive renames; solo renames are genuinely non-destructive |

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #83 | 2026-02-24 | Initial defect design |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
