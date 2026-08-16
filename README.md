# nmg-plugins

Codex- and Pi-compatible plugin marketplace by Nunley Media Group.

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

### Pi

Install a compatible Pi plugin manager, add this marketplace, then install nmg-sdlc:

```text
pi install npm:@nklisch/pi-plugins
/plugins marketplace add Nunley-Media-Group/nmg-plugins
/plugins add nmg-sdlc@nmg-plugins --scope user
```

The Claude-compatible marketplace index supplies Pi's root-repository source representation while the Codex index remains authoritative for Codex consumers.

## Updating

The `nmg-sdlc` entry is pinned to the latest `main` commit by a GitHub Actions workflow. When `nmg-sdlc` changes on `main`, this repository receives a dispatch event and commits the new plugin SHA/version directly to `main`.

```bash
codex plugin marketplace upgrade nmg-plugins
```

## Documentation

Each plugin's full docs (workflow, skills reference, configuration) live in its own repository. This repo stays thin and only publishes the marketplace index that points Codex at those plugin repos.
