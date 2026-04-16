# Tasks: Fix Skill Rate Limits

**Issues**: #111
**Date**: 2026-03-15

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Remove `model:` field from all 12 skills, add `disable-model-invocation` to 4 | Complete |
| T002 | Update specs and CHANGELOG | Complete |

---

## T001: Remove model field and add disable-model-invocation

**Status**: Complete

Removed `model:` field from all 12 SKILL.md files. Added `disable-model-invocation: true` to: `run-loop`, `installing-openclaw-skill`, `generating-openclaw-config`, `run-retro`.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #111 | 2026-03-15 | Initial task breakdown |
| #111 | 2026-03-15 | Updated: remove all `model:` fields |
