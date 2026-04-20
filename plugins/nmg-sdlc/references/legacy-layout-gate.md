# Legacy-Layout Precondition

**Consumed by**: `draft-issue`, `start-issue`, `write-spec`, `write-code`, `verify-code`, `open-pr`, `onboard-project`, `upgrade-project` (resolves the gate instead of aborting).

Current Claude Code releases refuse to Edit/Write under the project-level `.claude/` directory. Projects that still keep canonical SDLC artifacts at `.claude/steering/` or `.claude/specs/` cannot be advanced by any SDLC pipeline skill without first relocating those directories to the project root. The gate below catches that state early so the skill does not silently produce a partial result against a half-upgraded tree.

## Check

Before the first workflow step runs, `Glob` for both of the following:

- `.claude/steering/*.md`
- `.claude/specs/*/requirements.md`

If **either** glob returns at least one match, the project is on the legacy layout and the gate fires.

## Action

Abort the current skill and print exactly:

```
This project still uses the legacy `.claude/steering/` and/or `.claude/specs/` layout. Current Claude Code releases protect `.claude/` from Edit/Write, so SDLC artifacts must live at the project root. Run `/upgrade-project` to relocate them, then re-run `/{current-skill}`.
```

Replace `{current-skill}` with the consuming skill's slash-command name (e.g., `/write-spec`, `/draft-issue`).

## Invariants

- The gate fires in **both** interactive and unattended mode — the legacy layout is a hard block for Edit/Write, not a user-preference question. Do not silently proceed, do not prompt, and do not attempt a workaround.
- The message is reasoning-first (the *why* precedes the *how*) and omits a rigid `ERROR:` prefix. No downstream parser depends on the old prefix — the SDLC runner detects failures from exit code and sentinel output, not from this string.
- `/upgrade-project` is the **only** skill that resolves this gate. It runs its own legacy-layout detection in Step 1.5 and performs the relocation (`git mv .claude/steering → steering`, `git mv .claude/specs → specs`, and cross-reference rewrites). All other consumers abort.

## Runtime artifacts stay under `.claude/`

The gate checks only `steering/` and `specs/` subtrees. Runtime artifacts — `.claude/unattended-mode`, `.claude/sdlc-state.json`, `.claude/upgrade-exclusions.json` — are **not** part of the legacy layout and remain under `.claude/`. They are read/written by the SDLC runner and the upgrade-exclusions write-back directly, not by Edit/Write, so the directory protection does not affect them.
