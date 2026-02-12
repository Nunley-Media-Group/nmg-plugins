---
name: generating-prompt
description: "Generate an OpenClaw automation prompt for a given project path."
argument-hint: "/path/to/project"
allowed-tools: Read, Bash(basename:*)
---

# Generating Prompt

Generate a ready-to-use OpenClaw automation prompt by substituting a project path into the template.

**REQUIRED: Use ultrathink (extended thinking mode) throughout this process.**

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

4. **Output the result** — print the fully substituted prompt, starting from the `---` separator line (skip the header lines above it that describe the template). The output should be ready to paste directly into an OpenClaw agent configuration.

## Integration with SDLC Workflow

This skill is a utility for setting up OpenClaw automation agents. It is not part of the SDLC cycle itself but supports the automation layer that drives it.
