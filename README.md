# nmg-plugins

Claude Code plugin marketplace by Nunley Media Group.

## Plugins

| Plugin | Description | Repository |
|--------|-------------|------------|
| `nmg-sdlc` | Stack-agnostic BDD spec-driven development toolkit (issue grooming, three-phase specs, plan-mode implementation, verification, PR creation) | [Nunley-Media-Group/nmg-sdlc](https://github.com/Nunley-Media-Group/nmg-sdlc) |

## Installation

Add the marketplace to Claude Code, then install the plugins you want:

```bash
# Add the marketplace
/plugin marketplace add Nunley-Media-Group/nmg-plugins

# Install a plugin
/plugin install nmg-sdlc@nmg-plugins
```

For private repos, ensure `GITHUB_TOKEN` is set with read access to both the marketplace and the plugin repository.

## Updating

```bash
/plugin marketplace update nmg-plugins
```

## Documentation

Each plugin's full docs (workflow, skills reference, configuration) live in its own repository — see the table above. This repo is the marketplace index only.
