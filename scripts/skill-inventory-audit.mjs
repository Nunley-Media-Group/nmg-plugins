#!/usr/bin/env node

/**
 * Skill Inventory Audit
 *
 * Deterministic content-inventory check that guards SKILL.md edits against
 * silent content loss. Walks every plugins/nmg-sdlc/skills/* /SKILL.md and
 * every plugins/nmg-sdlc/** /references/* .md, extracts inventory items from
 * tracked sections, normalizes and hashes each one, and either produces a
 * baseline (--baseline) or checks the current tree against a committed
 * baseline (--check, default).
 *
 * Modes:
 *   --baseline           Scan and write the baseline JSON
 *   --check              Scan, load the baseline, exit 1 on unmapped items
 *   --diff               Print a human-readable before → after destination map
 *   --output <path>      Override default output path (used by --baseline and
 *                        by the CI baseline-freshness diff)
 *
 * Exit codes:
 *   0 — scan clean (or --baseline / --diff completed successfully)
 *   1 — --check found unmapped items
 *   2 — argument or I/O error
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASELINE = 'scripts/skill-inventory.baseline.json';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_DEFAULT = path.resolve(SCRIPT_DIR, '..');

// ---------------------------------------------------------------------------
// Extraction: walk a Markdown file, emit one clause per tracked line.
// ---------------------------------------------------------------------------

const TRACKED_H2 = new Set(['## Input', '## Output', '## Process', '## Human Review Gate']);
const TRACKED_H3 = /^### (Step \d+[a-z]?|Human Review Gate)\b/;

/**
 * Extract raw clauses from a Markdown source.
 *
 * Rules:
 *   - A clause is any non-empty content line within a tracked section.
 *   - Tracked sections: `## Input`, `## Output`, `## Process`, `## Human Review Gate`,
 *     and any `### Step N` / `### Human Review Gate` sub-heading.
 *   - Lines inside fenced code blocks are ignored.
 *   - Table header and separator rows are ignored.
 *   - In addition, any line containing `unattended-mode` (case-insensitive)
 *     is emitted regardless of whether it sits inside a tracked section.
 *
 * Each emitted clause carries `{ line, text, heading }` where `heading` is the
 * nearest enclosing tracked H2 or H3 heading (null for unattended-mode lines
 * outside any tracked section).
 */
export function extractClauses(source) {
  const lines = source.split('\n');
  const out = [];

  let inFence = false;
  let currentH2 = null;
  let currentH3 = null;
  let tracked = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\r$/, '');

    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      // Config examples inside fences frequently show the unattended-mode sentinel — keep them.
      if (/unattended-mode/i.test(line)) {
        out.push({ line: i + 1, text: line, heading: currentH3 || currentH2 || null });
      }
      continue;
    }

    const h1 = line.match(/^# (.+?)\s*$/);
    if (h1) {
      currentH2 = null;
      currentH3 = null;
      tracked = false;
      continue;
    }

    const h2 = line.match(/^## (.+?)\s*$/);
    if (h2) {
      currentH2 = `## ${h2[1].trim()}`;
      currentH3 = null;
      tracked = TRACKED_H2.has(currentH2);
      continue;
    }

    const h3 = line.match(/^### (.+?)\s*$/);
    if (h3) {
      currentH3 = `### ${h3[1].trim()}`;
      tracked = TRACKED_H3.test(currentH3) || TRACKED_H2.has(currentH2 || '');
      continue;
    }

    // H4+ headings inherit tracking from the nearest tracked H2/H3 ancestor,
    // so `#### Input` under `### Step 1` (a common shape in nmg-sdlc skills)
    // is still audited. Without this inheritance, H4 subsections silently
    // escape the inventory — exactly the drop this script exists to catch.
    if (/^#{4,6} /.test(line)) {
      continue;
    }

    const trimmed = line.trim();
    if (trimmed === '') continue;

    // Skip Markdown table header separators: `|---|---|`
    if (/^\|?\s*-{3,}\s*(\|\s*-{3,}\s*)+\|?$/.test(trimmed)) continue;

    const isUnattended = /unattended-mode/i.test(trimmed);
    if (tracked || isUnattended) {
      out.push({
        line: i + 1,
        text: trimmed,
        heading: currentH3 || currentH2 || null,
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Normalization: produce a stable key and content for hashing.
// ---------------------------------------------------------------------------

/**
 * Normalize a clause's text for hashing.
 *
 * Steps (applied in order):
 *   1. Strip Markdown emphasis markers (`**`, `__`, `*`, `_`) around words.
 *   2. Strip Markdown link syntax, keeping the link text: `[text](url)` → `text`.
 *   3. Strip inline backticks.
 *   4. Strip list-item markers and leading whitespace.
 *   5. Collapse any run of whitespace into a single space.
 *   6. Lowercase.
 *   7. Truncate to first 80 characters (hash-stability — long sentences that
 *      only differ in their tail still map to the same item).
 */
export function normalize(text) {
  let s = text;
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1$2');
  s = s.replace(/(^|[^_])_([^_]+)_/g, '$1$2');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/^\s*[-*+]\s+/, '');
  s = s.replace(/^\s*\d+\.\s+/, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.toLowerCase();
  if (s.length > 80) s = s.slice(0, 80);
  return s;
}

/** SHA-1 hash of the normalized form, truncated to 12 hex chars. */
export function hashId(normalized) {
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// Scan: walk the plugin tree and build an inventory from every tracked file.
// ---------------------------------------------------------------------------

/**
 * Recursively walk a directory and return paths matching `predicate(relPath)`.
 * Skips `node_modules`, `.git`, and any dotfile directory.
 */
function walk(root, predicate, acc = [], baseRoot = root) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, predicate, acc, baseRoot);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = path.relative(baseRoot, full).split(path.sep).join('/');
    if (predicate(rel)) acc.push(rel);
  }
  return acc;
}

/** Build an array of audit-tracked file paths (SKILL.md + references/*.md) under a plugin root. */
export function findTrackedFiles(repoRoot) {
  const pluginRoot = path.join(repoRoot, 'plugins', 'nmg-sdlc');
  if (!fs.existsSync(pluginRoot)) return [];
  return walk(pluginRoot, (rel) => {
    if (rel.endsWith('/SKILL.md')) return true;
    if (rel.includes('/references/') && rel.endsWith('.md')) return true;
    return false;
  }, [], repoRoot).sort();
}

/** Scan the repo and produce the inventory object. */
export function scan(repoRoot) {
  const files = findTrackedFiles(repoRoot);
  const items = [];
  const seen = new Map(); // id → existing item (for collision detection)

  for (const rel of files) {
    const abs = path.join(repoRoot, rel);
    const source = fs.readFileSync(abs, 'utf8');
    const clauses = extractClauses(source);

    for (const c of clauses) {
      const normalized = normalize(c.text);
      if (!normalized) continue;
      const id = hashId(normalized);
      const destination = `${rel}:${c.line}`;
      if (seen.has(id)) {
        // Repeat clause: the first destination stays on the primary item;
        // subsequent destinations append to `additional_destinations`. A true
        // hash collision across *different* normalized forms is a bug in the
        // hash function and is flagged separately under `collisions`.
        const prior = seen.get(id);
        if (prior.normalized !== normalized) {
          prior.collisions = prior.collisions || [];
          prior.collisions.push({ normalized, destination });
        } else {
          prior.additional_destinations = prior.additional_destinations || [];
          prior.additional_destinations.push(destination);
        }
        continue;
      }
      const item = {
        id,
        source_before: destination,
        normalized,
        destination,
      };
      items.push(item);
      seen.set(id, item);
    }
  }

  return {
    generated_at: new Date().toISOString(),
    generator: 'skill-inventory-audit@1',
    items,
  };
}

// ---------------------------------------------------------------------------
// Modes.
// ---------------------------------------------------------------------------

function writeJson(outPath, data) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');
}

function readBaseline(baselinePath) {
  if (!fs.existsSync(baselinePath)) {
    throw new Error(
      `Baseline file not found: ${baselinePath}\n` +
      `  Run \`node scripts/skill-inventory-audit.mjs --baseline\` to create one.`
    );
  }
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

/** --baseline: scan and write the inventory JSON. */
export function runBaseline(repoRoot, outPath) {
  const inventory = scan(repoRoot);
  writeJson(outPath, inventory);
  console.log(`Wrote baseline: ${outPath}`);
  console.log(`Items: ${inventory.items.length}`);
  return 0;
}

/** --check: compare current scan to committed baseline. */
export function runCheck(repoRoot, baselinePath) {
  const baseline = readBaseline(baselinePath);
  const current = scan(repoRoot);

  const currentIds = new Set(current.items.map((i) => i.id));
  const unmapped = baseline.items.filter((i) => !currentIds.has(i.id));

  if (unmapped.length === 0) {
    console.log(`Skill inventory audit: clean (${current.items.length} items mapped).`);
    return 0;
  }

  console.error(`Skill inventory audit: ${unmapped.length} baseline item(s) unmapped in current tree.`);
  for (const item of unmapped) {
    console.error(`  - [${item.id}] ${item.source_before}: ${item.normalized}`);
  }
  console.error('');
  console.error('Content appears to have been dropped without a matching baseline regeneration.');
  console.error('If the removal is intentional, regenerate the baseline with:');
  console.error('  node scripts/skill-inventory-audit.mjs --baseline');
  console.error('and document each removed item under an `### Inventory Removals` heading in the PR body.');
  return 1;
}

/** --diff: human-readable before → after destination map. */
export function runDiff(repoRoot, baselinePath) {
  const baseline = readBaseline(baselinePath);
  const current = scan(repoRoot);

  const currentById = new Map(current.items.map((i) => [i.id, i]));
  console.log('Skill inventory diff (baseline → current):');
  console.log('');

  let unmapped = 0;
  let moved = 0;
  let stable = 0;

  for (const prior of baseline.items) {
    const now = currentById.get(prior.id);
    if (!now) {
      console.log(`  [unmapped] ${prior.source_before}  ⇢  ∅`);
      console.log(`             ${prior.normalized}`);
      unmapped++;
      continue;
    }
    if (now.destination === prior.source_before) {
      stable++;
      continue;
    }
    console.log(`  [moved]    ${prior.source_before}  ⇢  ${now.destination}`);
    moved++;
  }

  // New items (present in current, absent in baseline).
  const baselineIds = new Set(baseline.items.map((i) => i.id));
  const added = current.items.filter((i) => !baselineIds.has(i.id));
  for (const a of added) {
    console.log(`  [added]    ∅  ⇢  ${a.destination}`);
    console.log(`             ${a.normalized}`);
  }

  console.log('');
  console.log(`Summary: ${stable} stable, ${moved} moved, ${unmapped} unmapped, ${added.length} added.`);
  return 0;
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------

function main(argv) {
  let args;
  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        baseline: { type: 'boolean', default: false },
        check: { type: 'boolean', default: false },
        diff: { type: 'boolean', default: false },
        output: { type: 'string' },
        'repo-root': { type: 'string' },
        help: { type: 'boolean', default: false },
      },
      strict: true,
    });
    args = parsed.values;
  } catch (err) {
    console.error(`Argument error: ${err.message}`);
    return 2;
  }

  if (args.help) {
    console.log(`
Usage: node scripts/skill-inventory-audit.mjs [options]

Options:
  --baseline             Scan and write the baseline JSON
  --check                Scan and compare to the committed baseline (default)
  --diff                 Print a before → after destination map
  --output <path>        Override default output/baseline path
                         (default: ${DEFAULT_BASELINE})
  --repo-root <path>     Override repo root (default: inferred from script path)
  --help                 Show this help
`);
    return 0;
  }

  const modes = [args.baseline, args.check, args.diff].filter(Boolean).length;
  if (modes > 1) {
    console.error('Argument error: --baseline, --check, and --diff are mutually exclusive.');
    return 2;
  }

  const repoRoot = args['repo-root']
    ? path.resolve(args['repo-root'])
    : REPO_ROOT_DEFAULT;
  const outPath = args.output
    ? path.resolve(args.output)
    : path.join(repoRoot, DEFAULT_BASELINE);

  try {
    if (args.baseline) return runBaseline(repoRoot, outPath);
    if (args.diff) return runDiff(repoRoot, outPath);
    return runCheck(repoRoot, outPath);
  } catch (err) {
    console.error(`${err.message}`);
    return 2;
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const code = main(process.argv.slice(2));
  process.exit(code);
}
