# nmg-plugins Product Steering

This document defines the product vision, target users, and success metrics.
All feature development should align with these guidelines.

---

## Mission

**nmg-plugins provides a BDD spec-driven development toolkit for Claude Code that transforms GitHub issues into verified, production-ready implementations through a structured SDLC workflow.**

<!-- TODO: Refine this mission statement to match your vision -->

---

## Target Users

### Primary: Developer using Claude Code

| Characteristic | Implication |
|----------------|-------------|
| Uses Claude Code CLI daily | Skills must integrate seamlessly with Claude Code's tool system |
| Works from GitHub issues | Workflow must be issue-driven with branch linking |
| Wants structured process | BDD specs provide guardrails without excessive ceremony |
| Values quality gates | Verification step catches drift before PR |

### Secondary: OpenClaw Automation Agent

| Characteristic | Implication |
|----------------|-------------|
| Headless execution | Skills must detect `.claude/auto-mode` and skip interactive prompts |
| Deterministic orchestration | Runner script drives steps sequentially with preconditions |
| Discord reporting | Status updates flow to Discord channels |

<!-- TODO: Refine these personas to match your actual user base -->

---

## Core Value Proposition

1. **Structured SDLC workflow** — Transforms vague requirements into verified implementations via issue → spec → implement → verify → PR pipeline
2. **Stack-agnostic BDD** — Works with any language/framework; steering docs customize to the project
3. **Full automation support** — OpenClaw integration enables hands-off development cycles

---

## Product Principles

| Principle | Description |
|-----------|-------------|
| Stack-agnostic | Never assume a specific language, framework, or tool — let steering docs provide specifics |
| OS-agnostic | Must work on macOS, Windows, and Linux — no platform-specific assumptions |
| Process over tooling | Provide the workflow structure; project steering provides the technical details |
| Human gates by default | Interactive review at each phase; auto-mode is opt-in for automation |
| Spec as source of truth | All implementation and verification traces back to spec documents |

<!-- TODO: Adjust principles to match your decision-making priorities -->

---

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Spec-to-implementation fidelity | Zero drift findings on first verify | Validates the spec-driven approach works |
| Skill adoption | All SDLC steps used end-to-end | Proves the workflow is complete and practical |
| Automation reliability | OpenClaw completes full cycles without manual intervention | Validates headless operation |

---

## Feature Prioritization

### Must Have (MVP)
- Issue creation with BDD acceptance criteria (`/creating-issues`)
- 3-phase spec writing: requirements, design, tasks (`/writing-specs`)
- Spec-driven implementation with plan mode (`/implementing-specs`)
- Verification against specs with architecture review (`/verifying-specs`)
- PR creation linking issue and specs (`/creating-prs`)
- Steering document bootstrapping (`/setting-up-steering`)

### Should Have
- Issue branch linking and status management (`/starting-issues`)
- Defect-specific spec templates (bug label detection)
- OpenClaw automation mode support

### Could Have
- OpenClaw runner script and skill (`/running-sdlc`)
- Config generation (`/generating-openclaw-config`)

### Won't Have (Now)
- Multi-repo orchestration
- Non-GitHub issue trackers
- Visual dashboard for spec status

<!-- TODO: Adjust priorities based on your roadmap -->

---

## Key User Journeys

### Journey 1: Manual SDLC Cycle

```
1. Developer runs /creating-issues to capture a feature need
2. Runs /starting-issues #N to create branch and set status
3. Runs /writing-specs #N — reviews requirements, design, tasks at each gate
4. Runs /implementing-specs #N — approves plan, watches execution
5. Runs /verifying-specs #N — reviews findings, confirms fixes
6. Runs /creating-prs #N — reviews PR before submission
```

### Journey 2: Automated SDLC Cycle (OpenClaw)

```
1. OpenClaw picks oldest open issue from milestone
2. Runs each skill sequentially via claude -p subprocesses
3. Auto-approves all gates (auto-mode enabled)
4. Posts Discord status updates at each step
5. Creates PR, monitors CI, merges on green
6. Loops to next issue
```

<!-- TODO: Add additional journeys relevant to your workflow -->

---

## Intent Verification

Each product principle translates to a verifiable behavioral contract. `/verifying-specs` should check these when evaluating whether a change serves the product mission.

### Principle → Postcondition Mapping

| Product Principle | Behavioral Contract | Verification Check |
|-------------------|--------------------|--------------------|
| **Stack-agnostic** | Skills must not contain language, framework, or tool-specific instructions | Grep changed skill files for technology names (e.g., "React", "Python", "npm") that aren't Claude Code tool names |
| **OS-agnostic** | No platform-specific paths, commands, or assumptions | Grep for hardcoded separators, Bash-only syntax, macOS/Windows/Linux-specific commands |
| **Spec as source of truth** | Every implementation change traces to a requirement in the spec | Each modified file must map to a task in `tasks.md` or an AC in `requirements.md` |
| **Human gates by default** | Interactive approval exists at every decision point | Skills contain `AskUserQuestion` at gates, guarded by auto-mode check |
| **Process over tooling** | Skills define workflow structure; project details live in steering docs | Skills reference steering docs for conventions, not hardcode them |

### Skill Pipeline Contracts

The SDLC pipeline is a chain. Each skill's output is a contract with the next:

```
/creating-issues
  Postcondition: GitHub issue exists with BDD acceptance criteria
  ↓ (issue # feeds into)
/starting-issues #N
  Postcondition: Feature branch exists, issue status = In Progress
  ↓ (branch context feeds into)
/writing-specs #N
  Postcondition: .claude/specs/{feature}/ contains requirements.md, design.md, tasks.md, feature.gherkin
  ↓ (spec files feed into)
/implementing-specs #N
  Postcondition: Code changes implement all tasks
  ↓ (implementation feeds into)
/verifying-specs #N
  Postcondition: Verification report posted to issue; all ACs pass or deferred items documented
  ↓ (verified implementation feeds into)
/creating-prs #N
  Postcondition: PR created linking issue, specs, and verification report
```

When verifying a change to any skill, confirm it preserves these contracts — the postconditions of the changed skill must still satisfy the preconditions of its downstream consumer.

---

## Brand Voice

| Attribute | Do | Don't |
|-----------|-----|-------|
| Technical | Use precise terminology (BDD, Gherkin, SOLID) | Oversimplify or use vague language |
| Concise | Keep skill output focused and actionable | Add verbose explanations or filler |
| Process-oriented | Reference workflow steps and spec documents | Assume ad-hoc development |

---

## Privacy Commitment

| Data | Usage | Shared |
|------|-------|--------|
| GitHub issues/PRs | Read/write via gh CLI for workflow | Only within the user's GitHub org |
| Source code | Analyzed locally by Claude Code | Never transmitted beyond Claude API |
| Steering docs | Local project context | Committed to repo at user's discretion |

---

## References

- Technical spec: `.claude/steering/tech.md`
- Code structure: `.claude/steering/structure.md`
