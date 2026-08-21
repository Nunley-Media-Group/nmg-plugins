# nmg-plugins

Codex-, Oh My Pi-, and Pi-compatible plugin marketplace by Nunley Media Group.

## Plugins

No plugins are currently listed.

## Installation

Add the marketplace, then install the plugins you want:

```bash
# Add the marketplace
codex plugin marketplace add Nunley-Media-Group/nmg-plugins
```

This marketplace uses Git-backed Codex entries, so each plugin can stay in its own repository. For private repos, ensure your Git credentials have read access to both the marketplace repo and the plugin repositories.

### Oh My Pi

OMP prefers `.omp-plugin/marketplace.json` and falls back to `.claude-plugin/marketplace.json`:

```bash
omp plugin marketplace add Nunley-Media-Group/nmg-plugins
```

In the TUI:

```text
/marketplace add Nunley-Media-Group/nmg-plugins
```

### Pi

Install a compatible Pi plugin manager, then add this marketplace:

```text
pi install npm:@nklisch/pi-plugins
/plugins marketplace add Nunley-Media-Group/nmg-plugins
```

The OMP catalog is the preferred Oh My Pi index. The Claude-compatible catalog remains the Pi fallback. The Codex index remains authoritative for Codex consumers.

## Updating

```bash
codex plugin marketplace upgrade nmg-plugins
omp plugin marketplace update nmg-plugins
```

## Documentation

Each plugin's full docs (workflow, skills reference, configuration) live in its own repository. This repo stays thin and only publishes the marketplace indexes that point Codex, Oh My Pi, and Pi at those plugin repos.
