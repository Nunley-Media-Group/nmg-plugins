#!/usr/bin/env node

import { readFileSync } from "node:fs";

const CLAUDE_PATH = ".claude-plugin/marketplace.json";
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const NAME_SEGMENT = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SOURCE_TYPES = new Set(["github", "url", "git-subdir", "npm"]);

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

function assertNameSegment(value, field) {
  if (typeof value !== "string" || !NAME_SEGMENT.test(value)) {
    throw new Error(`${CLAUDE_PATH} ${field} must be a lowercase name segment (max 64 chars)`);
  }
}

function validateSource(source, name) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error(`${CLAUDE_PATH} plugin ${name} requires an object source`);
  }
  if (!SOURCE_TYPES.has(source.source)) {
    throw new Error(`${CLAUDE_PATH} plugin ${name} has unsupported source type ${source.source}`);
  }
  if (source.source === "url" || source.source === "git-subdir") {
    if (typeof source.url !== "string" || !/^https:\/\/github\.com\/[^/]+\/[^/]+\.git$/.test(source.url)) {
      throw new Error(`${CLAUDE_PATH} plugin ${name} requires an https GitHub .git url`);
    }
    if (source.ref !== "main") {
      throw new Error(`${CLAUDE_PATH} plugin ${name} must pin ref main`);
    }
    if (typeof source.sha !== "string" || !SHA_PATTERN.test(source.sha)) {
      throw new Error(`${CLAUDE_PATH} plugin ${name} must pin a full lowercase commit SHA`);
    }
  }
}

const manifest = readManifest(CLAUDE_PATH);
assertNameSegment(manifest.name, "name");
if (!manifest.owner || typeof manifest.owner !== "object" || typeof manifest.owner.name !== "string") {
  throw new Error(`${CLAUDE_PATH} requires owner.name`);
}
const seen = new Set();
for (const entry of manifest.plugins) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`${CLAUDE_PATH} contains a plugin that is not an object`);
  }
  assertNameSegment(entry.name, "plugin name");
  if (seen.has(entry.name)) {
    throw new Error(`${CLAUDE_PATH} contains duplicate plugin ${entry.name}`);
  }
  seen.add(entry.name);
  if (typeof entry.description !== "string" || entry.description.trim() === "") {
    throw new Error(`${CLAUDE_PATH} plugin ${entry.name} requires a description`);
  }
  if (typeof entry.version !== "string" || !SEMVER.test(entry.version)) {
    throw new Error(`${CLAUDE_PATH} plugin ${entry.name} requires a semver version`);
  }
  validateSource(entry.source, entry.name);
}

console.log(`Validated ${seen.size} Claude Code marketplace plugin(s).`);
