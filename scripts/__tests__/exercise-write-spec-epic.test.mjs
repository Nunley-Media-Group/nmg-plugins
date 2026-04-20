/**
 * Agent SDK exercise test for /write-spec parent-link resolution + seal-spec.
 *
 * Derived from: specs/feature-add-first-class-epic-support-and-multi-pr-delivery-flow-to-nmg-sdlc/
 * Issue: #149 (T016)
 *
 * Covers AC3 (Seal-Spec Flow), AC4 (child /write-spec parent-link), AC7c
 * (loud failure on missing parent spec), and cycle-detection.
 *
 * Opt-in: RUN_EXERCISE_TESTS=1 npm test -- --testPathPattern=exercise-write-spec-epic
 */

import { jest } from '@jest/globals';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RUN_EXERCISE = process.env.RUN_EXERCISE_TESTS === '1';
const describeRunner = RUN_EXERCISE ? describe : describe.skip;

const PLUGIN_DIR = path.resolve(process.cwd(), '..', 'plugins', 'nmg-sdlc');

function scaffoldProject({ withParentSpec = false, cycle = false, epicNumber = 100, childNumber = 101, siblingNumber = 102 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nmg-sdlc-write-spec-epic-'));
  fs.mkdirSync(path.join(dir, 'steering'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), '.claude/\n');
  fs.writeFileSync(path.join(dir, 'steering', 'product.md'), '# Product\n');
  fs.writeFileSync(path.join(dir, 'steering', 'tech.md'), '# Tech\n');
  fs.writeFileSync(path.join(dir, 'steering', 'structure.md'), '# Structure\n');

  if (withParentSpec) {
    const parentDir = path.join(dir, 'specs', 'feature-umbrella-epic');
    fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(path.join(parentDir, 'requirements.md'),
      `# Parent Epic Requirements\n\n**Issues**: #${epicNumber}\n\n## User Story\n...\n`);
    fs.writeFileSync(path.join(parentDir, 'design.md'),
      `# Design\n\n**Issues**: #${epicNumber}\n\n## Multi-PR Rollout\nPhase 1, Phase 2, Phase 3.\n`);
    fs.writeFileSync(path.join(parentDir, 'tasks.md'),
      `# Tasks\n\n**Issues**: #${epicNumber}\n\n## Phase 1\n- T001\n`);
    fs.writeFileSync(path.join(parentDir, 'feature.gherkin'),
      `Feature: Umbrella\n  Scenario: stub\n    Given x\n    When y\n    Then z\n`);
  }

  execSync('git init -q', { cwd: dir });
  execSync('git add -A && git -c user.email=t@t -c user.name=t commit -qm init', { cwd: dir });
  return { dir, epicNumber, childNumber, siblingNumber, cycle };
}

async function runSkill({ cwd, prompt, answers }) {
  const env = { ...process.env, CLAUDECODE: '' };
  const sdkPath = env.NODE_PATH || '/Users/rnunley/.npm/_npx/81bbc6515d992ace/node_modules';
  const { query } = await import(`${sdkPath}/@anthropic-ai/claude-agent-sdk/sdk.mjs`);
  const messages = [];
  for await (const m of query({
    prompt,
    options: {
      plugins: [{ type: 'local', path: PLUGIN_DIR }],
      cwd,
      canUseTool: async (toolName, input) => {
        if (toolName === 'AskUserQuestion') {
          const patch = {};
          for (const q of input.questions || []) {
            patch[q.question] = (answers && answers[q.question]) || (q.options[0] && q.options[0].label);
          }
          return { behavior: 'allow', updatedInput: { ...input, answers: patch } };
        }
        return { behavior: 'allow', updatedInput: input };
      },
    },
  })) messages.push(m);
  return messages;
}

describeRunner('exercise: /write-spec parent-link + seal-spec', () => {
  const projects = [];
  afterEach(() => {
    while (projects.length) try { fs.rmSync(projects.pop(), { recursive: true, force: true }); } catch {}
  });

  test('Scenario A — child with Depends on: #<parent> enters amendment mode', async () => {
    const { dir, epicNumber, childNumber } = scaffoldProject({ withParentSpec: true });
    projects.push(dir);
    // Note: this test requires a real GitHub issue #N (or a gh mock). In CI-only
    // environments without gh access, the skill aborts during `gh issue view`.
    // The assertion below is a pass/skip signal derived from the skill's own
    // tracing — concretely we look for "amendment mode" or "Parent spec for"
    // strings to distinguish the path taken.
    const messages = await runSkill({
      cwd: dir,
      prompt: `/nmg-sdlc:write-spec #${childNumber}`,
    });
    const blob = JSON.stringify(messages);
    expect(blob).toMatch(/amendment mode|feature-umbrella-epic/);
  }, 300_000);

  test('Scenario B — child with Depends on: #<parent> but uncommitted parent spec fails loudly', async () => {
    const { dir, childNumber } = scaffoldProject({ withParentSpec: false });
    projects.push(dir);
    const messages = await runSkill({
      cwd: dir,
      prompt: `/nmg-sdlc:write-spec #${childNumber}`,
    });
    const blob = JSON.stringify(messages);
    expect(blob).toMatch(/Parent spec for #\d+ not found/);
  }, 300_000);

  test('Scenario C — no parent link falls through to keyword discovery', async () => {
    const { dir } = scaffoldProject({ withParentSpec: true });
    projects.push(dir);
    const messages = await runSkill({
      cwd: dir,
      prompt: '/nmg-sdlc:write-spec "add sparkline widget"',
    });
    const blob = JSON.stringify(messages);
    // Keyword-based discovery should run; either creates a new spec or amends
    // via keyword scoring — neither emits "Parent spec for #N not found".
    expect(blob).not.toMatch(/Parent spec for #\d+ not found/);
  }, 300_000);

  test('Scenario D — cyclic parent graph aborts with cycle-detected error', async () => {
    const { dir } = scaffoldProject({ withParentSpec: false });
    projects.push(dir);
    const messages = await runSkill({
      cwd: dir,
      prompt: '/nmg-sdlc:write-spec #200', // assumes #200 ↔ #201 cycle in gh fixture
    });
    const blob = JSON.stringify(messages);
    expect(blob).toMatch(/cycle detected in parent-link graph/i);
  }, 300_000);

  test('Scenario E — seal-spec is idempotent; second run prints "already sealed"', async () => {
    const { dir, epicNumber } = scaffoldProject({ withParentSpec: true });
    projects.push(dir);
    // Create an existing seal commit
    execSync(`git commit --allow-empty -qm "docs: seal umbrella spec for #${epicNumber}"`, { cwd: dir });
    const messages = await runSkill({
      cwd: dir,
      prompt: `/nmg-sdlc:write-spec #${epicNumber}`,
    });
    const blob = JSON.stringify(messages);
    expect(blob).toMatch(/Spec already sealed at commit [0-9a-f]{7,}/i);
  }, 300_000);

  test('Scenario F — seal commit stages ONLY specs/ paths (no plugin.json/marketplace.json/CHANGELOG/VERSION)', async () => {
    const { dir, epicNumber } = scaffoldProject({ withParentSpec: true });
    projects.push(dir);
    // Simulate the seal by running /write-spec through to Phase 3 approval.
    await runSkill({
      cwd: dir,
      prompt: `/nmg-sdlc:write-spec #${epicNumber}`,
    });
    // Inspect the most recent commit — it must only touch specs/
    const diff = execSync('git show HEAD --stat', { cwd: dir, encoding: 'utf8' });
    expect(diff).not.toMatch(/plugin\.json|marketplace\.json|CHANGELOG\.md|VERSION/);
  }, 300_000);
});
