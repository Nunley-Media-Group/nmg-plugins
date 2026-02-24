# Root Cause Analysis: Handle Missing Spec Files Gracefully in /creating-prs

**Issue**: #82
**Date**: 2026-02-23
**Status**: Draft
**Author**: Claude Code

---

## Root Cause

The `/creating-prs` skill (SKILL.md) unconditionally reads spec files in Step 1 ("Read Context"). Lines 32-33 instruct Claude to read `requirements.md` and `tasks.md` from `.claude/specs/{feature-name}/` without first checking whether the spec directory or files exist. The skill was designed under the assumption that the full SDLC pipeline would always be followed (i.e., `/writing-specs` would always run before `/creating-prs`).

In practice, simple bug fixes, documentation changes, or quick patches may skip the spec-writing phase entirely. When `/creating-prs` is invoked without specs, the `Read` tool fails on the non-existent files, and the skill has no fallback logic to recover gracefully.

Additionally, Step 4 ("Generate PR Content") hardcodes a PR body template that always includes a "Specs" section with links to `requirements.md`, `design.md`, and `tasks.md`, and always labels acceptance criteria as "From `.claude/specs/{feature}/requirements.md`". There is no conditional path for when specs are absent.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/creating-prs/SKILL.md` | 32-33 | Step 1 unconditionally reads `requirements.md` and `tasks.md` |
| `plugins/nmg-sdlc/skills/creating-prs/SKILL.md` | 98-130 | Step 4 PR body template always includes Specs section and sources ACs from requirements.md |

### Triggering Conditions

- The user skips `/writing-specs` (no spec directory exists for the feature)
- The user invokes `/creating-prs` directly after making changes
- This is common for simple bug fixes, documentation changes, or quick patches that don't warrant full spec writing

---

## Fix Strategy

### Approach

Add a conditional check at the beginning of Step 1 to detect whether the spec directory exists. If it does, proceed with the current behavior (read spec files). If it doesn't, fall back to extracting acceptance criteria from the GitHub issue body. Then adapt Step 4's PR body template to handle both cases: with-specs and without-specs.

The fix modifies only the SKILL.md instructions — no runtime code changes are needed since this is a prompt-based skill.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/creating-prs/SKILL.md` | Add spec existence check in Step 1 using `Glob` before reading spec files; add fallback to issue body for ACs | Prevents the Read tool from failing on non-existent files |
| `plugins/nmg-sdlc/skills/creating-prs/SKILL.md` | Add conditional PR body template in Step 4: with-specs variant (current) and without-specs variant (omits Specs section, labels ACs "From issue body", includes warning) | Adapts PR output for both code paths |

### Blast Radius

- **Direct impact**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md` — only file modified
- **Indirect impact**: Downstream consumers of PR body content (human reviewers, CI tools parsing PR descriptions) may see a different format when specs are absent, but this is expected and documented via the warning
- **Risk level**: Low — the change adds a conditional branch; the existing happy path (specs exist) is explicitly preserved unchanged

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing behavior changes when specs exist | Low | AC4 explicitly requires the happy path to remain unchanged; the conditional only activates when specs are absent |
| Issue body ACs are incorrectly extracted | Low | The issue body is already read in Step 1 (`gh issue view #N`); the fallback simply uses its content for ACs instead of the spec file |
| Version bump / changelog logic affected | None | Steps 2-3 (versioning) do not depend on spec files at all |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Auto-generate minimal specs from issue body | When specs are missing, run a lightweight spec generation before PR creation | Over-engineering — violates "Out of Scope" and adds complexity for simple changes |
| Fail with a clear error message | Instead of falling back, tell the user to run `/writing-specs` first | Blocks legitimate use cases (quick fixes, docs changes) and was the behavior users reported as a bug |

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #82 | 2026-02-23 | Initial defect spec |

---

## Validation Checklist

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
