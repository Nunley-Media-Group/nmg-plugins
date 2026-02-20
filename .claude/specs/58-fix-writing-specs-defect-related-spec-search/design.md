# Root Cause Analysis: Writing-specs defect variant does not actively search for related feature specs

**Issue**: #58
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude Code

---

## Root Cause

The Phase 1 defect process in `SKILL.md` uses a passive instruction at step 7 that tells the agent to populate the **Related Spec** field "if the bug relates to an existing feature spec." This gives the agent no mechanism to discover whether a related spec exists — it must already know the connection from the issue text alone.

When the connection isn't obvious (e.g., issue #55 describes `cleanupProcesses()` bugs but the original feature spec is named `24-configurable-post-step-process-cleanup`), the agent has no search step to bridge the gap. It defaults to N/A every time.

The template reinforces this by using a passive comment: `*(optional — link to the feature spec this bug was found in, if one exists)*` — no instruction to search, just an invitation to fill it in if the agent already knows.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | ~119 (step 7, Defect bullet) | Passive instruction: "If the bug relates to an existing feature spec, populate the optional **Related Spec** field." |
| `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md` | ~214 | Passive template comment: `*(optional — link to the feature spec this bug was found in, if one exists)*` |

### Triggering Conditions

- The issue is a defect (has `bug` label)
- A related feature spec exists in `.claude/specs/` but the connection is not obvious from the issue title or body alone
- The agent has no explicit instruction to search for related specs

---

## Fix Strategy

### Approach

Add an explicit search step to the Phase 1 defect process in SKILL.md that instructs the agent to glob `.claude/specs/*/requirements.md` and grep for keywords extracted from the bug issue (file paths, function names, component names). This replaces the passive "if the bug relates to" instruction with an active discovery mechanism.

The search should extract keywords from the issue body (file paths like `sdlc-runner.mjs`, function names like `cleanupProcesses`, component names) and use them to grep across existing spec requirements files. If a match is found, populate the Related Spec field. If not, set it to N/A.

The template comment should be updated to reference the search step rather than relying on agent intuition.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | Replace the passive defect instruction in step 7 with an active search step: extract keywords from the issue, glob+grep `.claude/specs/*/requirements.md`, populate Related Spec with match or N/A | Gives the agent a concrete discovery mechanism instead of relying on passive intuition |
| `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md` | Update the Related Spec comment from passive hint to reference the search step | Aligns the template guidance with the new active search instruction |

### Blast Radius

- **Direct impact**: `SKILL.md` Phase 1 step 7 (defect bullet only), `templates/requirements.md` (defect variant Related Spec comment)
- **Indirect impact**: None — the feature variant is unchanged, and no other skills consume the Related Spec field
- **Risk level**: Low — this adds a search step to an existing field; it doesn't change the spec output structure or affect downstream skills

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Search produces false positives (links to unrelated specs) | Low | Keywords are extracted from the issue body which is specific to the bug; broad terms would need to match in a spec's requirements.md |
| Search adds latency to spec writing | Low | Glob+grep on a small directory of Markdown files is near-instant |
| Feature variant accidentally modified | Low | Changes are scoped to the defect bullet in step 7 only; feature bullet is untouched |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| [Alternative fix] | [approach] | [why the chosen approach is better] |

*Omit this section if only one reasonable fix approach exists.*

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
