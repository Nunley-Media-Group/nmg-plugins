#!/usr/bin/env node

import { readFileSync } from "node:fs";

const CODEX_PATH = ".agents/plugins/marketplace.json";
const CLAUDE_PATH = ".claude-plugin/marketplace.json";
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const CLAUDE_SOURCE_TYPES = new Set(["github", "url", "git-subdir", "npm"]);

function readManifest(path) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must contain a JSON object`);
  }
  if (typeof value.name !== "string" || !Array.isArray(value.plugins)) {
    throw new Error(`${path} requires a string name and plugins array`);
  }
  return value;
}

function entriesByName(manifest, path) {
  const entries = new Map();
  for (const entry of manifest.plugins) {
    if (!entry || typeof entry !== "object" || typeof entry.name !== "string") {
      throw new Error(`${path} contains a plugin without a valid name`);
    }
    if (entries.has(entry.name)) {
      throw new Error(`${path} contains duplicate plugin ${entry.name}`);
    }
    entries.set(entry.name, entry);
  }
  return entries;
}

function validatePinnedSource(source, path, pluginName) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error(`${path} plugin ${pluginName} requires an object source`);
  }
  if (source.ref !== "main") {
    throw new Error(`${path} plugin ${pluginName} must pin ref main`);
  }
  if (typeof source.sha !== "string" || !SHA_PATTERN.test(source.sha)) {
    throw new Error(`${path} plugin ${pluginName} must pin a full lowercase commit SHA`);
  }
}

const codex = readManifest(CODEX_PATH);
const claude = readManifest(CLAUDE_PATH);
if (codex.name !== claude.name) {
  throw new Error(`marketplace names differ: ${codex.name} != ${claude.name}`);
}

const codexEntries = entriesByName(codex, CODEX_PATH);
const claudeEntries = entriesByName(claude, CLAUDE_PATH);
for (const [name, codexEntry] of codexEntries) {
  const claudeEntry = claudeEntries.get(name);
  if (!claudeEntry) {
    throw new Error(`${CLAUDE_PATH} is missing plugin ${name}`);
  }
  validatePinnedSource(codexEntry.source, CODEX_PATH, name);
  validatePinnedSource(claudeEntry.source, CLAUDE_PATH, name);
  if (!CLAUDE_SOURCE_TYPES.has(claudeEntry.source.source)) {
    throw new Error(`${CLAUDE_PATH} plugin ${name} has unsupported source type ${claudeEntry.source.source}`);
  }
  for (const field of ["url", "ref", "sha"]) {
    if (codexEntry.source[field] !== claudeEntry.source[field]) {
      throw new Error(`plugin ${name} source.${field} differs between marketplace manifests`);
    }
  }
  if (codexEntry["x-version"] !== claudeEntry.version) {
    throw new Error(`plugin ${name} version differs between marketplace manifests`);
  }
  if (claudeEntry.strict !== false || claudeEntry.skills !== "./skills") {
    throw new Error(`${CLAUDE_PATH} plugin ${name} must declare non-strict ./skills runtime metadata`);
  }
}
for (const name of claudeEntries.keys()) {
  if (!codexEntries.has(name)) {
    throw new Error(`${CODEX_PATH} is missing plugin ${name}`);
  }
}

console.log(`Validated ${codexEntries.size} synchronized Codex/Claude marketplace plugin(s).`);
