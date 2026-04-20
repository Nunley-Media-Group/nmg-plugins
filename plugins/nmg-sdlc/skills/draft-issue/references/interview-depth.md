# Interview Depth & Probe Rounds

**Consumed by**: `draft-issue` Step 5.
**Triggering condition**: The skill has finished Step 4 (codebase investigation) and is entering the interview phase for the current iteration's `DraftState`.

This reference covers adaptive depth selection, the user-override prompt, the probe rounds for Feature and Bug classifications, and the end-of-interview "anything I missed?" free-text probe.

## Input

- `classification` from Step 2
- `investigation.filesFound`, `investigation.componentsInvolved`, `investigation.descriptionVagueness` from Step 4
- Initial description from Step 1
- `session.designContext` (read-only; may be null)

## Process

### 5.1 Select Interview Depth (Adaptive-Depth Heuristic)

Compute `depth` from the Step 4 signals:

| Depth | Condition | Rounds |
|-------|-----------|--------|
| Core | `filesFound ≤ 3` **and** `componentsInvolved ≤ 1` **and** `descriptionVagueness < 0.10` | 3 rounds |
| Extended (borderline bias) | `descriptionVagueness ∈ [0.10, 0.15)` **or** (`componentsInvolved == 1` **and** `filesFound > 8`) | 4 rounds (identical to Extended; exists only so the log line can record the borderline bias) |
| Extended | otherwise (multi-component, many files, or vague description) | 4 rounds |

The borderline row intentionally biases ambiguous cases to the deeper interview — running extended for a small issue costs a few extra probes; running core for an under-specified issue costs a downstream spec amendment.

### 5.2 Log the Depth Decision

Emit a one-sentence user-visible log line explaining the selection, for example:

- Extended: `"This touches 4 components across 2 skills — I'll ask deeper scope questions."`
- Core: `"Small scoped change — running a core interview."`

### 5.3 Offer Depth Override

Immediately after the log line, call `AskUserQuestion` with two options:

```
question: "Which interview depth would you like to use?"
options:
  - "[1] Use {heuristic_pick} interview (recommended)"
    description: "Keep the heuristic's default for this issue"
  - "[2] Use {other_depth} interview"
    description: "Override the heuristic"
```

If the user selects `[2]`, switch `depth` to the other value and emit a one-line session note before the interview begins — e.g., `"(heuristic chose core, user selected extended)"`. This visible trail lets future threshold tuning build on concrete evidence.

### 5.4 Run the Probe Rounds

Skip any topics already answered by the initial description, the Step 4 investigation, or `session.designContext`. When `session.designContext` is present, the interview may reference design components or flows as pre-known context rather than re-eliciting them from the user (e.g., `"The design shows the overlay layer toggles from the map-controls panel — is the same trigger acceptable here?"`). Group related questions when natural. Use multi-question `AskUserQuestion` rounds rather than individual questions.

#### If Feature / Enhancement

| Round | Core (3 rounds) | Extended (4 rounds) |
|-------|-----------------|---------------------|
| R1 Persona & outcome | Who benefits? What pain point? What desired outcome? | Same as core |
| R2 ACs, scope, priority | Key ACs in G/W/T format; in-scope / out-of-scope; MoSCoW priority | Key ACs in G/W/T format; in-scope / out-of-scope (priority moves to R4) |
| R3 NFRs & edge cases | *(omitted)* | Performance / accessibility / security / i18n relevance; edge cases and error states beyond the happy path |
| R4 Related features & priority | *(folded into R2)* | Existing related features to maintain consistency with; MoSCoW priority |

#### If Bug

| Round | Probes |
|-------|--------|
| R1 Repro | Exact reproduction steps; expected vs actual |
| R2 Env & recency | Environment (OS, browser, version); frequency; error output; when it started |
| R3 Edge cases & regression risk | Edge/error states beyond the primary repro; related behavior that must not regress |

Reproduction remains the bug-path primary focus. R3 is always asked, regardless of depth — bugs benefit from edge-case probing even when scoped tightly.

### 5.5 End-of-Interview "Anything I Missed?" Probe

Regardless of classification or depth, the **final** round ends with a single free-text probe:

> "Before I play back my understanding, is there anything I haven't asked that matters here?"

A non-empty answer is folded into the understanding block that feeds Step 5c.

## Output

- `depth` ∈ {`core`, `extended`}
- `depthOverridden` — true if the user chose the non-recommended option
- `interviewAnswers` — map of round → answers
- `anythingMissed` — free-text answer or `null`
