#!/bin/bash
#
# Install the running-sdlc skill + sdlc-runner for OpenClaw.
#
# Usage:
#   ./scripts/install-openclaw-skill.sh          # copy to ~/.openclaw/skills/
#   ./scripts/install-openclaw-skill.sh --link    # add extraDirs entry instead (stays in sync with repo)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
SKILL_SRC="$REPO_DIR/plugins/nmg-sdlc/skills/running-sdlc/SKILL.md"
RUNNER_SRC="$SCRIPT_DIR/sdlc-runner.mjs"
CONFIG_SRC="$SCRIPT_DIR/sdlc-config.example.json"
DEST_DIR="$HOME/.openclaw/skills/running-sdlc"
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"

LINK_MODE=false
if [[ "${1:-}" == "--link" ]]; then
  LINK_MODE=true
fi

# Verify source files exist
if [[ ! -f "$SKILL_SRC" ]]; then
  echo "Error: Skill file not found: $SKILL_SRC"
  echo "Make sure you're running this from the nmg-plugins repository."
  exit 1
fi

if [[ ! -f "$RUNNER_SRC" ]]; then
  echo "Error: Runner script not found: $RUNNER_SRC"
  exit 1
fi

if $LINK_MODE; then
  # Add extraDirs entry to openclaw.json
  echo "Adding skills.load.extraDirs entry to $OPENCLAW_CONFIG..."

  SKILLS_DIR="$REPO_DIR/plugins/nmg-sdlc/skills"

  if [[ ! -f "$OPENCLAW_CONFIG" ]]; then
    mkdir -p "$(dirname "$OPENCLAW_CONFIG")"
    echo '{}' > "$OPENCLAW_CONFIG"
  fi

  # Check if jq is available
  if ! command -v jq &> /dev/null; then
    echo "Error: jq is required for --link mode. Install it with: brew install jq"
    exit 1
  fi

  # Add the extraDirs entry
  jq --arg dir "$SKILLS_DIR" '.skills.load.extraDirs = (.skills.load.extraDirs // []) + [$dir] | .skills.load.extraDirs |= unique' \
    "$OPENCLAW_CONFIG" > "$OPENCLAW_CONFIG.tmp" && mv "$OPENCLAW_CONFIG.tmp" "$OPENCLAW_CONFIG"

  echo "Done. Added $SKILLS_DIR to skills.load.extraDirs."
  echo "Skills will stay in sync with the repository — no manual updates needed."
else
  # Copy skill + runner to ~/.openclaw/skills/
  echo "Installing running-sdlc skill to $DEST_DIR..."

  mkdir -p "$DEST_DIR"
  cp "$SKILL_SRC" "$DEST_DIR/SKILL.md"
  cp "$RUNNER_SRC" "$DEST_DIR/sdlc-runner.mjs"
  cp "$CONFIG_SRC" "$DEST_DIR/sdlc-config.example.json"

  echo "Done. Files installed:"
  echo "  $DEST_DIR/SKILL.md"
  echo "  $DEST_DIR/sdlc-runner.mjs"
  echo "  $DEST_DIR/sdlc-config.example.json"
fi

# Verify
if $LINK_MODE; then
  if jq -e '.skills.load.extraDirs' "$OPENCLAW_CONFIG" > /dev/null 2>&1; then
    echo "Verified: extraDirs entry present in openclaw.json."
  else
    echo "Warning: Could not verify extraDirs entry."
  fi
else
  if [[ -f "$DEST_DIR/SKILL.md" ]]; then
    echo "Verified: SKILL.md exists at $DEST_DIR/SKILL.md"
  else
    echo "Warning: SKILL.md not found at expected location."
  fi
fi

echo ""
echo "OpenClaw auto-discovers skills within 250ms. The /running-sdlc skill"
echo "should be available immediately to all agents on this machine."
