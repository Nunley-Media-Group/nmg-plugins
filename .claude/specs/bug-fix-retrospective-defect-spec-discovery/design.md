# Root Cause Analysis: Retrospective defect-spec discovery and Related Spec link validation

**Issue**: #68
**Date**: 2026-02-20
**Status**: Draft
**Author**: Claude

---

## Root Cause

Four interconnected problems exist across three skill files, all stemming from insufficient type awareness in spec handling. The skills treat all specs uniformly when they should distinguish between feature specs (heading `# Requirements:`) and defect specs (heading `# Defect Report:`).

**Problem 1 (running-retrospectives Step 1):** The skill instructs the agent to "use Grep to identify defect specs by scanning for `\*{0,2}Severity\*{0,2}:`" after a Glob. The Grep tool's glob parameter interprets `*/requirements.md` as a single-level match, which fails to match `.claude/specs/{name}/requirements.md` (two levels deep). The regex pattern itself is correct; the routing is the problem.

**Problem 2 (running-retrospectives Step 3):** Step 3 unconditionally reads "the related feature spec" from the `Related Spec` field. When that field points to another defect spec (e.g., spec #57 referencing defect #17), the feature-vs-defect comparison becomes meaningless. No chain-following logic exists.

**Problem 3 (migrating-projects):** Step 4 analyzes spec file headings and variants but never validates the semantic correctness of `Related Spec` links. Invalid links persist silently across migration runs.

**Problem 4 (writing-specs Phase 1 Step 7):** The Related Spec search (added in #58) lists all specs via Glob and Grep with no filter to exclude defect specs. When a defect spec matches keywords more strongly than the feature spec, the agent picks the defect, creating circular references (e.g., bug #57 about auto-mode linking to defect #17 instead of feature #11).

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | 26-34 | Step 1: Defect spec discovery via Glob + Grep |
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | 51-59 | Step 3: Reads "related feature spec" without validating it's actually a feature spec |
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | 36-49 | Step 2: Filters eligible defects but doesn't detect cross-defect links |
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | 119-123 | Phase 1 Step 7: Related Spec search without defect-spec filtering |
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | 130-150 | Step 4: Spec file analysis without Related Spec link validation |

### Triggering Conditions

- A project has defect specs where `Related Spec` points to other defect specs (regression chains or mis-linked specs)
- The agent interprets the Grep glob parameter literally as `*/requirements.md` (single-level), missing the two-level path `.claude/specs/{name}/requirements.md`
- A new bug is filed about a component that already has a defect spec, causing keyword matches to favor the defect spec over the feature spec

---

## Fix Strategy

### Approach

All four fixes are minimal, targeted changes to SKILL.md instructions — no template or agent changes needed. The core principle is: **everywhere the skills handle spec files, they must distinguish feature specs from defect specs by checking the first `# ` heading.**

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `running-retrospectives/SKILL.md` Step 1 (lines 26-34) | Rewrite discovery to: (1) Glob for `.claude/specs/*/requirements.md`, (2) iterate results and Read each file's first line, (3) collect files whose heading starts with `# Defect Report:` | Eliminates reliance on Grep glob parameter entirely — Glob always works for this pattern, and Read is deterministic |
| `running-retrospectives/SKILL.md` Step 2 (lines 36-49) | Add cross-defect chain detection: when `Related Spec` points to a defect spec (heading `# Defect Report:`), follow its own `Related Spec` link recursively until reaching a feature spec or detecting a cycle | Resolves AC2 (chain resolution) and AC3 (orphan handling) |
| `running-retrospectives/SKILL.md` Step 3 (lines 51-59) | Update "Read the related feature spec" to use the resolved feature spec from Step 2's chain resolution | Ensures comparisons are always defect-vs-feature |
| `writing-specs/SKILL.md` Phase 1 Step 7 (lines 119-123) | After Grep returns matching specs: (1) Read each match's first heading, (2) filter to only `# Requirements:` headings (feature specs), (3) if no feature specs match but defect specs do, follow the defect specs' `Related Spec` links to find the root feature spec | Prevents circular references (AC6) and enables chain following (AC7) |
| `migrating-projects/SKILL.md` after Step 4 (new Step 4a) | Add "Validate Related Spec Links" step: for each defect spec found in Step 2, read the `Related Spec` field, validate the target exists and is a feature spec (heading `# Requirements:`), follow chains if needed, record findings for invalid links | Detects and corrects invalid links during migration (AC4, AC5) |

### Blast Radius

- **Direct impact**: Three SKILL.md files modified — running-retrospectives, writing-specs, migrating-projects
- **Indirect impact**: The retrospective output (`.claude/steering/retrospective.md`) may change if previously-skipped defect specs become discoverable, or if chain resolution changes which feature spec is compared. This is a positive correctness improvement.
- **Risk level**: Low — all changes are to Markdown instructions, not executable code. The fixes make behavior more deterministic, reducing agent interpretation variance.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Step 1 rewrite changes defect spec discovery count | Low | The new approach (Glob + Read heading) is strictly more reliable than Grep with glob — it will find the same or more specs |
| Chain resolution infinite loop on circular references | Low | Step 2 explicitly detects cycles (visited set) and skips with a warning (AC3) |
| migrating-projects becomes slower due to new validation step | Low | The step only reads the first line of each defect spec's Related Spec target — minimal I/O |
| writing-specs Phase 1 Step 7 becomes more complex | Medium | The logic is clearly structured: filter first, chain-follow second. Each sub-step is independently testable. Clear fallback to N/A if chain resolution fails. |
| Existing valid Related Spec links are disrupted | None | The changes only add filtering and validation — they never modify existing links (only migrating-projects corrects links, and only with user approval) |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Fix the Grep glob to use `**/requirements.md` | Change the glob parameter in Step 1 instructions to `**` | Fragile — still depends on agent correctly passing the glob parameter to the Grep tool. The Glob+Read approach eliminates this dependency entirely. |
| Add a `spec-type` field to the defect template | Explicit metadata instead of heading-based detection | Breaks all existing specs, requires migration, adds maintenance burden. Heading detection is already reliable and used by migrating-projects Step 4. |
| Validate Related Spec links in writing-specs instead of migrating-projects | Catch bad links at creation time only | Doesn't fix existing bad links. migrating-projects is the right place for retroactive validation. writing-specs filter (AC6/AC7) prevents new bad links; migrating-projects (AC4/AC5) fixes old ones. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
