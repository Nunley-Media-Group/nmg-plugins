# Tasks: Fix Opus Rate Limits

**Issues**: #111
**Date**: 2026-03-15

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Remove `model: opus` and add `disable-model-invocation` to affected skills | Complete |
| T002 | Verify all frontmatter changes are correct | Complete |
| T003 | Update CHANGELOG | Pending |

---

## T001: Apply frontmatter fixes to 8 SKILL.md files

**Status**: Complete

### Changes

1. `implementing-specs/SKILL.md` — Remove `model: opus` line (inherit session model)
2. `writing-specs/SKILL.md` — Remove `model: opus` line (inherit session model)
3. `migrating-projects/SKILL.md` — Change `model: opus` to `model: sonnet`
4. `running-retrospectives/SKILL.md` — Change `model: opus` to `model: sonnet`, add `disable-model-invocation: true`
5. `setting-up-steering/SKILL.md` — Change `model: opus` to `model: sonnet`
6. `running-sdlc-loop/SKILL.md` — Add `disable-model-invocation: true`
7. `installing-openclaw-skill/SKILL.md` — Add `disable-model-invocation: true`
8. `generating-openclaw-config/SKILL.md` — Add `disable-model-invocation: true`

### Acceptance Criteria
- No skill has `model: opus` in frontmatter
- 7 skills have `disable-model-invocation: true` (was 3)
- `implementing-specs` and `writing-specs` have no `model` field
- All other skills use `model: sonnet`

---

## T002: Verify changes

**Status**: Complete

Verify the final state:
- 0 skills with `model: opus` (was 5)
- 2 skills inherit session model: `implementing-specs`, `writing-specs`
- 10 skills with `model: sonnet`
- 7 skills with `disable-model-invocation: true` (was 3)
- 5 skills auto-triggerable: `creating-issues`, `implementing-specs`, `starting-issues`, `verifying-specs`, `writing-specs`

---

## T003: Update CHANGELOG

**Status**: Pending

Add entry under `[Unreleased]` in CHANGELOG.md documenting the fix.

---

## Dependency Graph

```
T001 → T002 → T003
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #111 | 2026-03-15 | Initial task breakdown |
