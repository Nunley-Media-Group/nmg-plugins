#!/usr/bin/env node

import { readFileSync } from "node:fs";

const CODEX_PATH = ".agents/plugins/marketplace.json";
const CLAUDE_PATH = ".claude-plugin/marketplace.json";
const OMP_PATH = ".omp-plugin/marketplace.json";
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const NAME_SEGMENT = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;
const COMPATIBLE_SOURCE_TYPES = new Set(["github", "url", "git-subdir", "npm"]);

const COMPATIBLE_CATALOGS = [
  {
    path: CLAUDE_PATH,
    label: "Claude",
    requireSkillsMetadata: true,
  },
  {
    path: OMP_PATH,
    label: "OMP",
    requireSkillsMetadata: false,
  },
];

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

function assertNameSegment(value, path, field) {
  if (typeof value !== "string" || !NAME_SEGMENT.test(value)) {
    throw new Error(
      `${path} ${field} must be a lowercase name segment (max 64 chars)`,
    );
  }
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

function validateCompatibleCatalog(catalog, spec, codex, codexEntries) {
  if (codex.name !== catalog.name) {
    throw new Error(`marketplace names differ: ${codex.name} != ${catalog.name} (${spec.path})`);
  }
  assertNameSegment(catalog.name, spec.path, "name");
  if (!catalog.owner || typeof catalog.owner !== "object" || typeof catalog.owner.name !== "string") {
    throw new Error(`${spec.path} requires owner.name`);
  }

  const entries = entriesByName(catalog, spec.path);
  for (const [name, codexEntry] of codexEntries) {
    const entry = entries.get(name);
    if (!entry) {
      throw new Error(`${spec.path} is missing plugin ${name}`);
    }
    assertNameSegment(entry.name, spec.path, `plugin ${name}`);
    validatePinnedSource(codexEntry.source, CODEX_PATH, name);
    validatePinnedSource(entry.source, spec.path, name);
    if (!COMPATIBLE_SOURCE_TYPES.has(entry.source.source)) {
      throw new Error(`${spec.path} plugin ${name} has unsupported source type ${entry.source.source}`);
    }
    for (const field of ["url", "ref", "sha"]) {
      if (codexEntry.source[field] !== entry.source[field]) {
        throw new Error(`plugin ${name} source.${field} differs between ${CODEX_PATH} and ${spec.path}`);
      }
    }
    if (codexEntry["x-version"] !== entry.version) {
      throw new Error(`plugin ${name} version differs between ${CODEX_PATH} and ${spec.path}`);
    }
    if (spec.requireSkillsMetadata && (entry.strict !== false || entry.skills !== "./skills")) {
      throw new Error(`${spec.path} plugin ${name} must declare non-strict ./skills runtime metadata`);
    }
  }
  for (const name of entries.keys()) {
    if (!codexEntries.has(name)) {
      throw new Error(`${CODEX_PATH} is missing plugin ${name} required by ${spec.path}`);
    }
  }
  return entries;
}

const codex = readManifest(CODEX_PATH);
const codexEntries = entriesByName(codex, CODEX_PATH);
for (const spec of COMPATIBLE_CATALOGS) {
  validateCompatibleCatalog(readManifest(spec.path), spec, codex, codexEntries);
}

console.log(
  `Validated ${codexEntries.size} synchronized Codex/Claude/OMP marketplace plugin(s).`,
);
