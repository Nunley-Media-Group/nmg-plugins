# nmg-plugins Product Steering

This document defines the product vision, target users, and success metrics.
All feature development should align with these guidelines.

---

## Mission

**nmg-plugins provides a BDD spec-driven development toolkit for Claude Code that transforms GitHub issues into verified, production-ready implementations through a structured SDLC workflow.**

---

## Target Users

### Primary: Developer using Claude Code

| Characteristic | Implication |
|----------------|-------------|
| Uses Claude Code CLI daily | Skills must integrate seamlessly with Claude Code's tool system |
| Works from GitHub issues | Workflow must be issue-driven with branch linking |
| Wants structured process | BDD specs provide guardrails without excessive ceremony |
| Values quality gates | Verification step catches drift before PR |

### Secondary: SDLC Runner (Automation)

| Characteristic | Implication |
|----------------|-------------|
| Headless execution | Skills must detect `.claude/unattended-mode` and skip interactive prompts |
| Deterministic orchestration | Runner script drives steps sequentially with preconditions |
| Log-based reporting | Status updates flow to console and log files |

---

## Core Value Proposition

1. **Structured SDLC workflow** — Transforms vague requirements into verified implementations via issue → spec → implement → verify → PR pipeline
2. **Stack-agnostic BDD** — Works with any language/framework; steering docs customize to the project
3. **Full automation support** — The SDLC runner enables hands-off development cycles

---

## Product Principles

| Principle | Description |
|-----------|-------------|
| Stack-agnostic | Never assume a specific language, framework, or tool — let steering docs provide specifics |
| OS-agnostic | Must work on macOS, Windows, and Linux — no platform-specific assumptions |
| Process over tooling | Provide the workflow structure; project steering provides the technical details |
| Human gates by default | Interactive review at each phase; unattended mode is opt-in for automation |
| Spec as source of truth | All implementation and verification traces back to spec documents |
| Dogfooding | The SDLC develops itself — changes to skills are verified by exercising them in Claude Code |

---

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Spec-to-implementation fidelity | Zero drift findings on first verify | Validates the spec-driven approach works |
| Skill adoption | All SDLC steps used end-to-end | Proves the workflow is complete and practical |
| Automation reliability | SDLC runner completes full cycles without manual intervention | Validates headless operation |
| Exercise verification | Changed skills verified by invocation against a test project | Validates that skill changes produce correct behavior, not just correct text |

---

## Feature Prioritization

### Must Have (MVP)
- Issue creation with BDD acceptance criteria (`/draft-issue`)
- 3-phase spec writing: requirements, design, tasks (`/write-spec`)
- Spec-driven implementation with plan mode (`/write-code`)
- Verification against specs with architecture review (`/verify-code`)
- PR creation linking issue and specs (`/open-pr`)
- Steering document bootstrapping (`/setup-steering`)

### Should Have
- Issue branch linking and status management (`/start-issue`)
- Defect-specific spec templates (bug label detection)
- Automation mode support (`/run-loop`)

### Could Have
- SDLC runner config generation (`/init-config`)

### Won't Have (Now)
- Multi-repo orchestration
- Non-GitHub issue trackers
- Visual dashboard for spec status

---

## Key User Journeys

### Journey 1: Manual SDLC Cycle

```
1. Developer runs /draft-issue to capture a feature need
2. Runs /start-issue #N to create branch and set status
3. Runs /write-spec #N — reviews requirements, design, tasks at each gate
4. Runs /write-code #N — approves plan, watches execution
5. Runs /verify-code #N — reviews findings, confirms fixes
6. Runs /open-pr #N — reviews PR before submission
```

### Journey 2: Automated SDLC Cycle (Runner)

```
1. Runner picks oldest open issue from milestone
2. Runs each skill sequentially via claude -p subprocesses
3. Auto-approves all gates (unattended mode enabled)
4. Logs status updates at each step
5. Creates PR, monitors CI, merges on green
6. Loops to next issue
```

### Journey 3: Dogfooding — Developing the SDLC with the SDLC

This project uses its own SDLC toolkit to develop itself. The verification step is unique because skills are Markdown instructions, not executable code:

```
1. Developer creates issue for a skill enhancement
2. Runs /write-spec — spec defines expected skill behavior as ACs
3. Runs /write-code — modifies SKILL.md files and templates
4. Runs /verify-code — must exercise the changed skill:
   a. Scaffold a disposable test project
   b. Load the modified plugin: claude --plugin-dir ./plugins/nmg-sdlc
   c. Invoke the changed skill against the test project
   d. For GitHub-integrated skills: evaluate what WOULD be created (dry-run)
   e. Confirm output matches spec ACs
5. Runs /open-pr — PR includes verification evidence
```

The key difference from Journey 1: traditional "run tests" is replaced by "exercise the skill in Claude Code and evaluate the output."

---

## Intent Verification

Each product principle translates to a verifiable behavioral contract. `/verify-code` should check these when evaluating whether a change serves the product mission.

### Principle → Postcondition Mapping

| Product Principle | Behavioral Contract | Verification Check |
|-------------------|--------------------|--------------------|
| **Stack-agnostic** | Skills must not contain language, framework, or tool-specific instructions | Grep changed skill files for technology names (e.g., "React", "Python", "npm") that aren't Claude Code tool names |
| **OS-agnostic** | No platform-specific paths, commands, or assumptions | Grep for hardcoded separators, Bash-only syntax, macOS/Windows/Linux-specific commands |
| **Spec as source of truth** | Every implementation change traces to a requirement in the spec | Each modified file must map to a task in `tasks.md` or an AC in `requirements.md` |
| **Human gates by default** | Interactive approval exists at every decision point | Skills contain `AskUserQuestion` at gates, guarded by unattended-mode check |
| **Process over tooling** | Skills define workflow structure; project details live in steering docs | Skills reference steering docs for conventions, not hardcode them |
| **Dogfooding** | Skill changes are verified by exercise, not just by reading | Changed skills must be loaded via `claude --plugin-dir` and invoked against a test project |

### Skill Pipeline Contracts

The SDLC pipeline is a chain. Each skill's output is a contract with the next:

```
/draft-issue
  Postcondition: GitHub issue exists with BDD acceptance criteria
  ↓ (issue # feeds into)
/start-issue #N
  Postcondition: Feature branch exists, issue status = In Progress
  ↓ (branch context feeds into)
/write-spec #N
  Postcondition: .claude/specs/{feature}/ contains requirements.md, design.md, tasks.md, feature.gherkin
  ↓ (spec files feed into)
/write-code #N
  Postcondition: Code changes implement all tasks
  ↓ (implementation feeds into)
/verify-code #N
  Postcondition: Verification report posted to issue; all ACs pass or deferred items documented
  ↓ (verified implementation feeds into)
/open-pr #N
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
