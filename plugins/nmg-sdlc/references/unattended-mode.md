# Unattended Mode

**Consumed by**: every pipeline skill (`start-issue`, `write-spec`, `write-code`, `verify-code`, `open-pr`, `onboard-project`, `upgrade-project`, `run-retro`). `draft-issue` does **not** honor unattended mode — issue drafting requires interactive judgment and the skill rejects headless invocation at Step 1.

## The sentinel file

The SDLC runner signals headless operation by creating `.claude/unattended-mode` (a plain file; contents are not inspected — existence is the signal) in the project root before spawning a `claude -p` subprocess, and removing it after the run completes. Skills detect the sentinel by checking whether the file exists on disk.

Check once at the top of the workflow and cache the result for the duration of the run:

```
Glob('.claude/unattended-mode')  →  fileExists
```

## Invariant: interactive by default, unattended is opt-in

Manual mode is the default behavior for every skill. Unattended mode is opt-in per run, driven by the sentinel, and should not become the default. Each `AskUserQuestion` call site should be guarded by an explicit unattended-mode branch, with the interactive path as the fall-through case — the special-case branch is the headless one.

## Gate semantics

Each skill's workflow declares Human Review Gates (places where `AskUserQuestion` fires in interactive mode). When the sentinel is present, gates follow one of three patterns — the skill specifies which:

| Pattern | Behavior in unattended mode |
|---------|-----------------------------|
| **Pre-approved** | The gate proceeds automatically. Do NOT call `AskUserQuestion`. Used for gates whose purpose is human pacing, not human judgment (e.g., `/write-spec` phase gates, `/write-code` plan approval). |
| **Deterministic default** | The skill applies a pre-declared default selection. Do NOT call `AskUserQuestion`. Used where a deterministic outcome is acceptable (e.g., seal-spec auto-execute, version-bump classification from labels). |
| **Escalate-and-exit** | The skill prints an `ESCALATION:` line describing why the gate needs a human and exits non-zero. Used where the decision cannot be delegated safely to an automated runner (e.g., `/open-pr --major`, epic closure anomaly). |

The skill's workflow states the pattern for each gate — do not improvise a fourth path.

## Plan-mode calls

`EnterPlanMode` is interactive by definition — it produces a plan for the user to approve. In a headless session it fails because there is no user. Skills that enter plan mode interactively (e.g., `/write-code` Step 4) must skip the call entirely when the sentinel is present and design the approach inline instead. This is NOT an `AskUserQuestion` gate; do not emit an `ESCALATION:` line — just proceed without plan mode.

## Logging

When a skill diverges from its interactive workflow due to unattended mode, emit a one-line user-visible note so the divergence appears in session logs (e.g., `"Unattended mode: skipping plan approval — proceeding with designed approach"`). Runner logs then show every such divergence with a searchable marker.

## What the sentinel does NOT do

- It does not grant additional permissions — tools that would otherwise prompt still prompt under the runner's permission mode.
- It does not alter the legacy-layout gate. That gate fires in both modes (see `references/legacy-layout-gate.md`).
- It does not activate `/draft-issue`. That skill refuses to run headless regardless of the sentinel.
- It does not silence output. Skills produce the same stdout/stderr — they just do not block on `AskUserQuestion`.
