# nmg-plugins

Claude Code plugin marketplace by Nunley Media Group.

## Plugins

| Plugin | Description | Source |
|--------|-------------|--------|
| `nmg-sdlc` | Spec-driven delivery for Claude Code and Herdr: groomed issues, approved BDD specs in native plan mode, and automated implement/verify/deliver workers. | [Nunley-Media-Group/nmg-sdlc](https://github.com/Nunley-Media-Group/nmg-sdlc) |
| `nmg-router` | Puts non-Claude models into Claude Code's /model picker through the user's own provider logins, with an Anthropic guard on every routed request. | [Nunley-Media-Group/nmg-router](https://github.com/Nunley-Media-Group/nmg-router) |
| `nmg-game-dev` | Blender-first, Unreal-shipped content pipeline for NMG games: freeform asset authoring in Blender via MCP, checked by an asset contract and finalized into Desktop and Mobile variants in Unreal Engine. | [Nunley-Media-Group/nmg-game-dev](https://github.com/Nunley-Media-Group/nmg-game-dev) |

## Installation

Add the marketplace, then install the plugins you want. In Claude Code:

```text
/plugin marketplace add Nunley-Media-Group/nmg-plugins
/plugin install nmg-sdlc@nmg-plugins
/plugin install nmg-router@nmg-plugins
/plugin install nmg-game-dev@nmg-plugins
```

Or from a shell:

```bash
claude plugin marketplace add Nunley-Media-Group/nmg-plugins
claude plugin install nmg-sdlc@nmg-plugins
claude plugin install nmg-router@nmg-plugins
claude plugin install nmg-game-dev@nmg-plugins
```

Each entry tracks its plugin repository's `main` branch. For private repositories, make sure your Git credentials can read both this repository and the plugin repositories.

## Updating

```bash
claude plugin marketplace update nmg-plugins
claude plugin update nmg-sdlc@nmg-plugins
claude plugin update nmg-router@nmg-plugins
claude plugin update nmg-game-dev@nmg-plugins
```

Each entry tracks its plugin repository's `main` branch, with no pinned commit or version. A plugin's version is the one in its own `.claude-plugin/plugin.json` on `main`, so a release needs no change here.

## Documentation

Each plugin's full docs live in its own repository. This repository stays thin and only publishes the Claude Code marketplace index.
