# nmg-plugins

Codex plugin marketplace by Nunley Media Group.

## Plugins

| Plugin | Description | Repository |
|--------|-------------|------------|
| `nmg-sdlc` | Stack-agnostic BDD spec-driven development toolkit (issue grooming, three-phase specs, plan-mode implementation, verification, PR creation) | [Nunley-Media-Group/nmg-sdlc](https://github.com/Nunley-Media-Group/nmg-sdlc) |

## Installation

Add the marketplace to Codex, then install the plugins you want:

```bash
# Add the marketplace
codex plugin marketplace add Nunley-Media-Group/nmg-plugins

# Install a plugin
codex plugin install nmg-sdlc@nmg-plugins
```

This marketplace uses Git-backed Codex entries, so each plugin can stay in its own repository. For private repos, ensure your Git credentials have read access to both the marketplace repo and the plugin repositories.

## Updating

```bash
codex plugin marketplace upgrade nmg-plugins
```

## Documentation

Each plugin's full docs (workflow, skills reference, configuration) live in its own repository. This repo stays thin and only publishes the marketplace index that points Codex at those plugin repos.
