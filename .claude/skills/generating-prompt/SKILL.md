---
name: generating-prompt
description: "Generate an SDLC runner config for a given project path."
argument-hint: "/path/to/project"
allowed-tools: Read, Write, Bash(basename:*), Bash(pbcopy:*), Bash(xclip:*), Bash(xsel:*), Bash(wl-copy:*), Bash(clip.exe:*), Bash(cat:*), Bash(realpath:*)
---

# Generating Config

Generate a ready-to-use `sdlc-config.json` for the SDLC runner by substituting a project path into the config template.

## Argument

The user must provide the absolute path to the target project as the argument (e.g., `/Volumes/Fast Brick/source/repos/chrome-cli`).

If no argument is provided, ask the user for the project path before proceeding.

## Steps

1. **Read the template** at `openclaw/scripts/sdlc-config.example.json` in the repository root (the nmg-plugins repo where this skill lives).

2. **Derive the project name** from the path's basename:
   ```bash
   basename "/path/to/project"
   ```

3. **Resolve the nmg-plugins path** — the absolute path to the nmg-plugins repository root (the directory containing `openclaw/scripts/sdlc-config.example.json`):
   ```bash
   realpath "$(dirname "$(dirname "$0")")"
   ```
   Or use the known working directory if already in the repo.

4. **Substitute values** — replace the placeholder fields in the template:
   - `"projectPath": "/path/to/your/project"` → the provided absolute path
   - `"pluginsPath": "/path/to/nmg-plugins"` → the resolved nmg-plugins repo root

5. **Output the result** — print the fully substituted config JSON. The output should be ready to save as `sdlc-config.json`.

6. **Copy to clipboard** — write the substituted config to a temporary file, then copy it to the system clipboard using the appropriate platform command:
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

7. **Suggest next step** — tell the user to save the config and launch the runner:
   ```
   Save this as sdlc-config.json, then run:
     node openclaw/scripts/sdlc-runner.mjs --config /path/to/sdlc-config.json
   Or install the OpenClaw skill and launch via Discord.
   ```

## Integration with SDLC Workflow

This skill is a utility for setting up the SDLC runner. It generates the configuration file that `sdlc-runner.mjs` reads to orchestrate the development cycle. It is not part of the SDLC cycle itself but supports the automation layer that drives it.
