# nmg-plugins

Claude Code plugin marketplace by Nunley Media Group.

## Plugins

| Plugin | Description | Source |
|--------|-------------|--------|
| `nmg-sdlc` | Spec-driven delivery for Claude Code and Herdr: groomed issues, approved BDD specs in native plan mode, and automated implement/verify/deliver workers. | [Nunley-Media-Group/nmg-sdlc](https://github.com/Nunley-Media-Group/nmg-sdlc) |

## Installation

Add the marketplace, then install the plugins you want. In Claude Code:

```text
/plugin marketplace add Nunley-Media-Group/nmg-plugins
/plugin install nmg-sdlc@nmg-plugins
```

Or from a shell:

```bash
claude plugin marketplace add Nunley-Media-Group/nmg-plugins
claude plugin install nmg-sdlc@nmg-plugins
```

Each entry pins a commit on its plugin repository's `main` branch. For private repositories, make sure your Git credentials can read both this repository and the plugin repositories.

## Updating

```bash
claude plugin marketplace update nmg-plugins
claude plugin update nmg-sdlc@nmg-plugins
```

The `nmg-sdlc` pointer is updated automatically: each push to nmg-sdlc `main` dispatches `nmg-sdlc-main-updated`, and the Sync nmg-sdlc Pointer workflow repins the entry to that commit and its `.claude-plugin/plugin.json` version.

## Documentation

Each plugin's full docs live in its own repository. This repository stays thin and only publishes the Claude Code marketplace index.
