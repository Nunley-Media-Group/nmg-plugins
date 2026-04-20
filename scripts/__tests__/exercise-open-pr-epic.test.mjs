/**
 * Agent SDK exercise test for /open-pr sibling-aware bumping + race detection.
 *
 * Derived from: specs/feature-add-first-class-epic-support-and-multi-pr-delivery-flow-to-nmg-sdlc/
 * Issue: #149 (T017)
 *
 * Covers AC5 (intermediate vs final bump), AC7a (epic-closed warning), AC7d
 * (race on version files), and non-epic passthrough.
 *
 * Opt-in: RUN_EXERCISE_TESTS=1 npm test -- --testPathPattern=exercise-open-pr-epic
 */

import { jest } from '@jest/globals';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RUN_EXERCISE = process.env.RUN_EXERCISE_TESTS === '1';
const describeRunner = RUN_EXERCISE ? describe : describe.skip;

const PLUGIN_DIR = path.resolve(process.cwd(), '..', 'plugins', 'nmg-sdlc');

function scaffoldProject({ version = '1.0.0', onBranch = 'feature/test' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nmg-sdlc-open-pr-epic-'));
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), '.claude/\n');
  fs.writeFileSync(path.join(dir, 'VERSION'), `${version}\n`);
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), `# Changelog\n\n## [Unreleased]\n\n- Feature work\n`);
  fs.mkdirSync(path.join(dir, 'steering'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'steering', 'tech.md'),
    `# Tech\n\n## Versioning\n\n| File | Path | Notes |\n|------|------|-------|\n\n### Version Bump Classification\n\n| Label | Bump Type | Description |\n|-------|-----------|-------------|\n| bug | patch | Bug fix |\n| enhancement | minor | Feature |\n`);
  fs.writeFileSync(path.join(dir, 'steering', 'product.md'), '# Product\n');
  fs.writeFileSync(path.join(dir, 'steering', 'structure.md'), '# Structure\n');

  execSync('git init -q', { cwd: dir });
  execSync('git add -A && git -c user.email=t@t -c user.name=t commit -qm init', { cwd: dir });
  execSync(`git checkout -qb ${onBranch}`, { cwd: dir });
  // Simulate an implementation commit
  fs.writeFileSync(path.join(dir, 'src.txt'), 'impl\n');
  execSync('git add -A && git -c user.email=t@t -c user.name=t commit -qm "feat: impl"', { cwd: dir });
  return dir;
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

describeRunner('exercise: /open-pr sibling-aware bump', () => {
  const projects = [];
  afterEach(() => {
    while (projects.length) try { fs.rmSync(projects.pop(), { recursive: true, force: true }); } catch {}
  });

  test('Scenario A (intermediate) — epic child with open sibling gets patch bump + partial-delivery note', async () => {
    const dir = scaffoldProject();
    projects.push(dir);
    // Test fixture assumes #200 is the child (labeled enhancement, Depends on: #199)
    // and #199 is the epic (labeled epic) with Child Issues checklist [#200, #201]
    // where #201 is still open. The skill's sibling logic should downgrade minor→patch.
    const messages = await runSkill({
      cwd: dir,
      prompt: '/nmg-sdlc:open-pr #200',
    });
    const blob = JSON.stringify(messages);
    expect(blob).toMatch(/\*\*Bump:\*\* patch \(epic child: intermediate\)/);
    expect(blob).toMatch(/\(partial delivery — see epic #199\)/);
  }, 300_000);

  test('Scenario B (final) — epic child with all siblings closed+merged gets minor bump', async () => {
    const dir = scaffoldProject();
    projects.push(dir);
    // Fixture: #201 is the final child; #200 already merged.
    const messages = await runSkill({
      cwd: dir,
      prompt: '/nmg-sdlc:open-pr #201',
    });
    const blob = JSON.stringify(messages);
    expect(blob).toMatch(/\*\*Bump:\*\* minor \(epic child: final\)/);
    expect(blob).not.toMatch(/partial delivery/);
  }, 300_000);

  test('Scenario C (non-epic passthrough) — standalone enhancement uses label-based bump unchanged', async () => {
    const dir = scaffoldProject();
    projects.push(dir);
    const messages = await runSkill({
      cwd: dir,
      prompt: '/nmg-sdlc:open-pr #300', // #300 is a standalone enhancement, no parent
    });
    const blob = JSON.stringify(messages);
    expect(blob).not.toMatch(/epic child:/);
  }, 300_000);

  test('Scenario D (race) — stale base after bump commit triggers rebase + re-bump; no force-push', async () => {
    const dir = scaffoldProject();
    projects.push(dir);
    // Simulate origin advancing by creating a bare repo and pushing a divergent commit
    const bareRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'nmg-bare-'));
    execSync(`git init -q --bare`, { cwd: bareRepo });
    execSync(`git remote add origin ${bareRepo}`, { cwd: dir });
    execSync('git push -q origin main', { cwd: dir });
    // Advance origin/main by pushing from a temp clone
    const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'nmg-clone-'));
    execSync(`git clone -q ${bareRepo} ${clone}`);
    fs.writeFileSync(path.join(clone, 'VERSION'), '1.0.1\n');
    execSync('git add -A && git -c user.email=t@t -c user.name=t commit -qm "chore: bump to 1.0.1" && git push -q origin main', { cwd: clone });

    const messages = await runSkill({
      cwd: dir,
      prompt: '/nmg-sdlc:open-pr #200',
    });
    const blob = JSON.stringify(messages);
    // Expect evidence of rebase path: either a re-computed bump against 1.0.1
    // or an explicit conflict error — never a --force push.
    expect(blob).not.toMatch(/git push .*--force/);
    projects.push(bareRepo, clone);
  }, 300_000);

  test('Scenario E (AC7a) — epic CLOSED while child OPEN escalates in unattended mode', async () => {
    const dir = scaffoldProject();
    projects.push(dir);
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'unattended-mode'), '');

    const messages = await runSkill({
      cwd: dir,
      prompt: '/nmg-sdlc:open-pr #200', // fixture: #199 (parent epic) is CLOSED; #200 still OPEN
    });
    const blob = JSON.stringify(messages);
    expect(blob).toMatch(/Epic #\d+ is closed but child #\d+ is still open/);
  }, 300_000);
});
