---
name: generating-openclaw-config
description: "Generate an SDLC runner config for the current project."
allowed-tools: Read, Write, Edit, Bash(basename:*), Bash(realpath:*), Bash(pwd:*), Bash(git:*), Bash(test:*), Bash(grep:*)
---

# Generating Config

Generate a ready-to-use `sdlc-config.json` for the SDLC runner by substituting the current project directory into the config template.

## Steps

1. **Resolve the project root** — find the root of the Claude Code project by locating the nearest ancestor directory containing a `.claude/` folder:
   ```bash
   git rev-parse --show-toplevel
   ```
   Then verify it's a Claude Code project:
   ```bash
   test -d "$(git rev-parse --show-toplevel)/.claude"
   ```
   If `.claude/` does not exist at the repo root, **stop and tell the user**: this must be run from within a Claude Code project (a directory with `.claude/` at its root).

   Use this resolved project root for all subsequent steps — do NOT use `pwd` directly, as it may differ from the project root.

2. **Read the template** from the local marketplace clone:
   ```
   ~/.claude/plugins/marketplaces/nmg-plugins/openclaw/scripts/sdlc-config.example.json
   ```

3. **Derive the project name** from the project root's basename:
   ```bash
   basename "$(git rev-parse --show-toplevel)"
   ```

4. **Resolve the nmg-plugins path** — use the marketplace clone location:
   ```
   ~/.claude/plugins/marketplaces/nmg-plugins
   ```

5. **Substitute values** — replace the placeholder fields in the template:
   - `"projectPath": "/path/to/your/project"` → the resolved project root from Step 1
   - `"pluginsPath": "/path/to/nmg-plugins"` → the marketplace clone path (`~/.claude/plugins/marketplaces/nmg-plugins`), expanded to the full absolute path

6. **Write the config file** — save the fully substituted config JSON to `sdlc-config.json` in the project root (resolved in Step 1). Use the Write tool.

7. **Add to .gitignore** — ensure `sdlc-config.json` and `.claude/sdlc-state.json` are listed in the project's `.gitignore`:
   - Read the `.gitignore` file in the project root. If it does not exist, create it.
   - For each of `sdlc-config.json` and `.claude/sdlc-state.json`: if NOT already present, add it under an `# SDLC runner config` comment.
   - If both are already listed, skip this step.

8. **Confirm and suggest next step** — tell the user the config has been written and is git-ignored, then suggest:
   ```
   Run the SDLC runner:
     node openclaw/scripts/sdlc-runner.mjs --config sdlc-config.json
   Or install the OpenClaw skill and launch via Discord.
   ```

## Integration with SDLC Workflow

This skill is a utility for setting up the SDLC runner. It generates the configuration file that `sdlc-runner.mjs` reads to orchestrate the development cycle. It is not part of the SDLC cycle itself but supports the automation layer that drives it.
