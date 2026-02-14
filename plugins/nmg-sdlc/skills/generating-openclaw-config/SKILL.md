---
name: generating-openclaw-config
description: "Generate an SDLC runner config for the current project."
allowed-tools: Read, Write, Bash(basename:*), Bash(pbcopy:*), Bash(xclip:*), Bash(xsel:*), Bash(wl-copy:*), Bash(clip.exe:*), Bash(cat:*), Bash(realpath:*), Bash(pwd:*), Bash(git:*), Bash(test:*)
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

6. **Output the result** — print the fully substituted config JSON. The output should be ready to save as `sdlc-config.json`.

7. **Copy to clipboard** — write the substituted config to a temporary file, then copy it to the system clipboard using the appropriate platform command:
   ```bash
   if [[ "$OSTYPE" == "darwin"* ]]; then
     cat /tmp/sdlc-config.json | pbcopy
   elif grep -qi microsoft /proc/version 2>/dev/null || [[ -n "$WSL_DISTRO_NAME" ]]; then
     cat /tmp/sdlc-config.json | clip.exe
   elif command -v wl-copy &> /dev/null; then
     cat /tmp/sdlc-config.json | wl-copy
   elif command -v xclip &> /dev/null; then
     cat /tmp/sdlc-config.json | xclip -selection clipboard
   elif command -v xsel &> /dev/null; then
     cat /tmp/sdlc-config.json | xsel --clipboard --input
   else
     echo "No clipboard utility found — copy the output above manually." >&2
   fi
   ```
   Confirm to the user that the config has been copied to their clipboard (or advise them to copy manually if no clipboard utility was found).

8. **Suggest next step** — tell the user to save the config and launch the runner:
   ```
   Save this as sdlc-config.json, then run:
     node openclaw/scripts/sdlc-runner.mjs --config /path/to/sdlc-config.json
   Or install the OpenClaw skill and launch via Discord.
   ```

## Integration with SDLC Workflow

This skill is a utility for setting up the SDLC runner. It generates the configuration file that `sdlc-runner.mjs` reads to orchestrate the development cycle. It is not part of the SDLC cycle itself but supports the automation layer that drives it.
