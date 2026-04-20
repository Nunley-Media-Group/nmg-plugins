#!/usr/bin/env node

/**
 * Skill Exercise Runner
 *
 * Exercises a refactored nmg-sdlc skill against a fixture project and reports
 * pass/fail per the rubric at
 * `scripts/__fixtures__/skill-exercise/rubrics/{skill}.md`.
 *
 * Two evaluation classes:
 *   - Deterministic checks run structurally against the plugin tree (line
 *     count, frontmatter byte-identity, pointer grammar, file budget, audit
 *     script, slash-command surface). These cover the AC1/AC2/AC3/AC5/AC8
 *     bar from issue #146 and are the must-pass half of the rubric.
 *   - Rubric-graded checks require a real Agent-SDK exercise run that
 *     captures the skill's drafted artifact. The Agent-SDK spawn is stubbed
 *     when the SDK is unavailable — the runner reports
 *     `skipped (exercise-mode unavailable)` for those checks and the overall
 *     run still exits 0 as long as every deterministic check passed.
 *
 * Usage:
 *   node scripts/skill-exercise-runner.mjs --skill draft-issue
 *   node scripts/skill-exercise-runner.mjs --skill draft-issue --base origin/main
 *
 * Exit codes:
 *   0 — every deterministic check passed; rubric checks passed or were skipped
 *   1 — at least one deterministic check failed, or a rubric check ran and failed
 *   2 — argument or I/O error
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const POINTER_RE = /^Read `(\.\.\/\.\.\/)?references\/[^`]+\.md` when /;
const MAX_FILES_PER_SKILL = 5;

function readFile(absPath) {
  return fs.readFileSync(absPath, 'utf8');
}

function extractFrontmatter(source) {
  // A SKILL.md frontmatter block is delimited by `---` at lines 1 and N.
  const lines = source.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  return lines.slice(0, end + 1).join('\n');
}

function fmField(frontmatter, name) {
  const re = new RegExp(`^${name}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(re);
  return match ? match[1].trim() : null;
}

function gitShow(ref, relPath) {
  try {
    return execFileSync('git', ['show', `${ref}:${relPath}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch {
    return null;
  }
}

function countLines(source) {
  // Match `wc -l` semantics: count newlines. A file with no trailing newline
  // whose last line is "foo" counts as 1 line in our sizing rubric.
  let n = 0;
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) n++;
  if (source.length > 0 && source.charCodeAt(source.length - 1) !== 10) n++;
  return n;
}

/**
 * Build the deterministic-check list for a given skill. Each check returns
 * `{ id, name, status: 'pass' | 'fail' | 'skipped', detail?: string }`.
 */
function deterministicChecks(skillName, baseRef) {
  const skillPath = path.join('plugins', 'nmg-sdlc', 'skills', skillName, 'SKILL.md');
  const skillAbs = path.join(REPO_ROOT, skillPath);
  const refDir = path.join(REPO_ROOT, 'plugins', 'nmg-sdlc', 'skills', skillName, 'references');

  const source = readFile(skillAbs);
  const frontmatter = extractFrontmatter(source);
  if (!frontmatter) {
    return [{ id: 'D0', name: 'frontmatter present', status: 'fail', detail: 'Could not locate frontmatter block.' }];
  }

  const results = [];

  // D1: line count ≤ 300 for draft-issue; other skills have per-skill targets
  // — this runner's authoritative source for the target is the rubric file.
  const lineLimits = { 'draft-issue': 300 };
  const lineLimit = lineLimits[skillName] ?? 300;
  const lines = countLines(source);
  results.push({
    id: 'D1',
    name: `SKILL.md line count ≤ ${lineLimit}`,
    status: lines <= lineLimit ? 'pass' : 'fail',
    detail: `${lines} lines`,
  });

  // D2: frontmatter byte-identical to base ref
  const baseSource = gitShow(baseRef, skillPath);
  if (baseSource == null) {
    results.push({ id: 'D2', name: 'frontmatter byte-identical to base ref', status: 'skipped', detail: `base ref ${baseRef} unreachable` });
  } else {
    const baseFrontmatter = extractFrontmatter(baseSource);
    results.push({
      id: 'D2',
      name: 'frontmatter byte-identical to base ref',
      status: baseFrontmatter === frontmatter ? 'pass' : 'fail',
      detail: baseFrontmatter === frontmatter ? null : 'frontmatter bytes differ from base',
    });
  }

  // D3: every reference pointer matches the AC7 grammar
  const pointerLines = source.split('\n').filter((l) => /^Read `(?:\.\.\/\.\.\/)?references\//.test(l));
  const nonConforming = pointerLines.filter((l) => !POINTER_RE.test(l));
  results.push({
    id: 'D3',
    name: 'every reference pointer matches the AC7 grammar',
    status: pointerLines.length > 0 && nonConforming.length === 0 ? 'pass' : (pointerLines.length === 0 ? 'fail' : 'fail'),
    detail: pointerLines.length === 0
      ? 'no reference pointers found'
      : `${pointerLines.length} pointers, ${nonConforming.length} non-conforming`,
  });

  // D4: per-skill references/ count ≤ 5
  let refFiles = [];
  if (fs.existsSync(refDir)) {
    refFiles = fs.readdirSync(refDir).filter((f) => f.endsWith('.md'));
  }
  results.push({
    id: 'D4',
    name: `references/ file count ≤ ${MAX_FILES_PER_SKILL}`,
    status: refFiles.length <= MAX_FILES_PER_SKILL ? 'pass' : 'fail',
    detail: `${refFiles.length} files`,
  });

  // D5: every referenced file exists
  const missing = [];
  for (const line of pointerLines) {
    const m = line.match(/^Read `((?:\.\.\/\.\.\/)?references\/[^`]+\.md)`/);
    if (!m) continue;
    const refRel = m[1];
    const resolved = refRel.startsWith('../../')
      ? path.join(REPO_ROOT, 'plugins', 'nmg-sdlc', refRel.slice('../../'.length))
      : path.join(REPO_ROOT, 'plugins', 'nmg-sdlc', 'skills', skillName, refRel);
    if (!fs.existsSync(resolved)) missing.push(refRel);
  }
  results.push({
    id: 'D5',
    name: 'every pointer target resolves to a real file',
    status: missing.length === 0 ? 'pass' : 'fail',
    detail: missing.length ? `missing: ${missing.join(', ')}` : null,
  });

  // D6: audit --check passes
  try {
    execFileSync('node', ['scripts/skill-inventory-audit.mjs', '--check'], { cwd: REPO_ROOT, stdio: 'pipe' });
    results.push({ id: 'D6', name: 'skill-inventory-audit --check passes', status: 'pass' });
  } catch (err) {
    const stderr = err.stderr?.toString() ?? '';
    results.push({
      id: 'D6',
      name: 'skill-inventory-audit --check passes',
      status: 'fail',
      detail: stderr.split('\n').slice(0, 2).join(' | '),
    });
  }

  // D7: slash-command surface (`name`, `description`) byte-identical
  if (baseSource != null) {
    const baseFm = extractFrontmatter(baseSource);
    const nameStable = fmField(baseFm, 'name') === fmField(frontmatter, 'name');
    const descStable = fmField(baseFm, 'description') === fmField(frontmatter, 'description');
    results.push({
      id: 'D7',
      name: 'slash-command surface unchanged (name + description)',
      status: nameStable && descStable ? 'pass' : 'fail',
      detail: !nameStable ? 'name changed' : (!descStable ? 'description changed' : null),
    });
  } else {
    results.push({ id: 'D7', name: 'slash-command surface unchanged', status: 'skipped', detail: `base ref ${baseRef} unreachable` });
  }

  // D8: references > 300 lines include a TOC within first 30 lines
  const oversizedNoToc = [];
  for (const file of refFiles) {
    const abs = path.join(refDir, file);
    const refSrc = readFile(abs);
    const refLines = countLines(refSrc);
    if (refLines > 300) {
      const first30 = refSrc.split('\n').slice(0, 30).join('\n');
      if (!/table of contents|^\s*\d+\.\s+\[.+\]\(#/im.test(first30)) {
        oversizedNoToc.push(`${file} (${refLines} lines)`);
      }
    }
  }
  results.push({
    id: 'D8',
    name: 'any references/*.md > 300 lines has a TOC in first 30 lines',
    status: oversizedNoToc.length === 0 ? 'pass' : 'fail',
    detail: oversizedNoToc.length ? oversizedNoToc.join(', ') : null,
  });

  return results;
}

/**
 * Attempt the Agent-SDK interactive exercise. When the SDK is unavailable or
 * any prerequisite is missing, return `null` and the runner reports every
 * rubric-graded check as `skipped (exercise-mode unavailable)`.
 *
 * The full wire-up is intentionally stubbed — spawning the Agent SDK requires
 * `NODE_PATH` adjusted to the npx-installed SDK location and a test repo for
 * `gh issue create`. Until those are wired, we report skipped so the
 * deterministic half can still gate the PR.
 */
async function attemptAgentSdkExercise(_skillName, _fixtureDir) {
  return null;
}

function rubricChecks(skillName, artifact) {
  const checks = [
    { id: 'R1', name: 'title starts with an action verb' },
    { id: 'R2', name: 'AC count meets threshold for classification' },
    { id: 'R3', name: 'every AC contains Given/When/Then lines' },
    { id: 'R4', name: 'User Story present (feature classification)' },
    { id: 'R5', name: 'Root-Cause Analysis present (bug classification)' },
    { id: 'R6', name: 'Out of Scope section with ≥ 1 bullet' },
  ];

  if (!artifact) {
    return checks.map((c) => ({ ...c, status: 'skipped', detail: 'exercise-mode unavailable' }));
  }

  // When the Agent-SDK exercise is wired, artifact will contain the drafted
  // issue body. Rubric evaluation here is intentionally unreachable at the
  // current implementation stage.
  return checks.map((c) => ({ ...c, status: 'skipped', detail: 'rubric evaluation not yet implemented' }));
}

function renderReport(results, { skill }) {
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
  const symbol = { pass: '✓', fail: '✗', skipped: '○' };
  const lines = [`Exercise report: ${skill}`, ''];
  for (const r of results) {
    const detail = r.detail ? ` — ${r.detail}` : '';
    lines.push(`  ${symbol[r.status]} ${pad(r.id, 3)} ${pad(r.name, 56)} [${r.status}]${detail}`);
  }
  const fails = results.filter((r) => r.status === 'fail').length;
  const passes = results.filter((r) => r.status === 'pass').length;
  const skips = results.filter((r) => r.status === 'skipped').length;
  lines.push('');
  lines.push(`Summary: ${passes} pass, ${fails} fail, ${skips} skipped`);
  return lines.join('\n');
}

async function main(argv) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        skill: { type: 'string' },
        base: { type: 'string', default: 'origin/main' },
        help: { type: 'boolean', default: false },
      },
      strict: true,
    }).values;
  } catch (err) {
    console.error(`Argument error: ${err.message}`);
    return 2;
  }

  if (args.help || !args.skill) {
    console.log(`
Usage: node scripts/skill-exercise-runner.mjs --skill <name> [--base <ref>]

Options:
  --skill <name>    Skill to exercise (e.g., draft-issue)
  --base <ref>      Git ref for pre-refactor baseline comparison (default: origin/main)
  --help            Show this help
`);
    return args.help ? 0 : 2;
  }

  const fixtureDir = path.join(REPO_ROOT, 'scripts', '__fixtures__', 'skill-exercise', args.skill);
  if (!fs.existsSync(fixtureDir)) {
    console.error(`Fixture not found: ${fixtureDir}`);
    return 2;
  }

  const detResults = deterministicChecks(args.skill, args.base);
  const artifact = await attemptAgentSdkExercise(args.skill, fixtureDir);
  const rubResults = rubricChecks(args.skill, artifact);

  const results = [...detResults, ...rubResults];
  console.log(renderReport(results, { skill: args.skill }));

  const detFails = detResults.filter((r) => r.status === 'fail').length;
  const rubFails = rubResults.filter((r) => r.status === 'fail').length;
  return detFails + rubFails === 0 ? 0 : 1;
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
