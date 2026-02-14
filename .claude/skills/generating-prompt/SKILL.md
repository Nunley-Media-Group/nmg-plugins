---
name: generating-prompt
description: "Generate an OpenClaw automation prompt for a given project path."
argument-hint: "/path/to/project"
allowed-tools: Read, Write, Bash(basename:*), Bash(pbcopy:*), Bash(xclip:*), Bash(xsel:*), Bash(wl-copy:*), Bash(clip.exe:*), Bash(cat:*)
---

# Generating Prompt

Generate a ready-to-use OpenClaw automation prompt by substituting a project path into the template.

## Argument

The user must provide the absolute path to the target project as the argument (e.g., `/Volumes/Fast Brick/source/repos/chrome-cli`).

If no argument is provided, ask the user for the project path before proceeding.

## Steps

1. **Read the template** at `openclaw-automation-prompt.md` in the repository root (the nmg-plugins repo where this skill lives).

2. **Derive the project name** from the path's basename:
   ```bash
   basename "/path/to/project"
   ```

3. **Substitute tokens** — replace all occurrences of:
   - `{{PROJECT_PATH}}` → the provided absolute path (e.g., `/Volumes/Fast Brick/source/repos/chrome-cli`)
   - `{{PROJECT_NAME}}` → the basename derived above (e.g., `chrome-cli`)
   - `{{NMG_PLUGINS_PATH}}` → the absolute path to the nmg-plugins repository root (the directory containing `openclaw-automation-prompt.md`)

4. **Output the result** — print the fully substituted prompt, starting from the `---` separator line (skip the header lines above it that describe the template). The output should be ready to paste directly into an OpenClaw agent configuration.

5. **Copy to clipboard** — write the substituted prompt to a temporary file, then copy it to the system clipboard using the appropriate platform command:
   ```bash
   if [[ "$OSTYPE" == "darwin"* ]]; then
     cat /tmp/openclaw-prompt.md | pbcopy
   elif grep -qi microsoft /proc/version 2>/dev/null || [[ -n "$WSL_DISTRO_NAME" ]]; then
     cat /tmp/openclaw-prompt.md | clip.exe
   elif command -v wl-copy &> /dev/null; then
     cat /tmp/openclaw-prompt.md | wl-copy
   elif command -v xclip &> /dev/null; then
     cat /tmp/openclaw-prompt.md | xclip -selection clipboard
   elif command -v xsel &> /dev/null; then
     cat /tmp/openclaw-prompt.md | xsel --clipboard --input
   else
     echo "No clipboard utility found — copy the output above manually." >&2
   fi
   ```
   Confirm to the user that the prompt has been copied to their clipboard (or advise them to copy manually if no clipboard utility was found).

## Integration with SDLC Workflow

This skill is a utility for setting up OpenClaw automation agents. It is not part of the SDLC cycle itself but supports the automation layer that drives it.
