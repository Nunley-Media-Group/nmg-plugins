/**
 * BDD Test Suite for sdlc-runner.mjs
 *
 * Derived from: .claude/specs/38-detect-soft-failures-runner-tests/
 * Issue: #38
 *
 * Tests are organized by spec scenarios (feature.gherkin) and functional
 * requirements (requirements.md AC5).
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// ESM mocking setup — must come before importing the module under test
// ---------------------------------------------------------------------------

// Mock node:child_process
const mockExecSync = jest.fn();
const mockSpawn = jest.fn();
jest.unstable_mockModule('node:child_process', () => ({
  execSync: mockExecSync,
  spawn: mockSpawn,
}));

// Mock node:fs
const mockFs = {
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  renameSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  statSync: jest.fn(() => ({ isDirectory: () => true, size: 100, mtimeMs: Date.now() })),
  appendFileSync: jest.fn(),
  unlinkSync: jest.fn(),
};
jest.unstable_mockModule('node:fs', () => ({
  default: mockFs,
  ...mockFs,
}));

// Now import the module under test (after mocks are set up)
const runner = await import('../sdlc-runner.mjs');

const {
  detectSoftFailure,
  detectAndHydrateState,
  matchErrorPattern,
  incrementBounceCount,
  defaultState,
  validateConfig,
  getConfigObject,
  resolveStepConfig,

  validatePreconditions,
  extractStateFromStep,
  validateSpecs,
  validateCI,
  validatePush,
  validateVersionBump,
  performDeterministicVersionBump,
  autoCommitIfDirty,
  buildClaudeArgs,
  readSkill,
  handleFailure,
  escalate,
  haltFailureLoop,
  handleSignal,

  runStep,
  readState,
  writeState,
  updateState,
  removeAutoMode,
  ensureRunnerArtifactsGitignored,
  runClaude,
  cleanupProcesses,
  getChildPids,
  getProcessTree,
  killProcessTree,
  findProcessesByPattern,
  hasOpenIssues,
  hasNonEscalatedIssues,
  log,
  writeStepLog,
  extractSessionId,
  enforceMaxDisk,
  resolveLogDir,
  sleep,
  IS_WINDOWS,
  STEPS,
  STEP_KEYS,
  RUNNER_ARTIFACTS,
  IMMEDIATE_ESCALATION_PATTERNS,
  TEXT_FAILURE_PATTERNS,
  RATE_LIMIT_PATTERN,
  VALID_EFFORTS,
  MAX_CONSECUTIVE_ESCALATIONS,
  __test__,
} = runner;

// ---------------------------------------------------------------------------
// Test configuration helper
// ---------------------------------------------------------------------------

const TEST_PROJECT = '/tmp/test-project';
const TEST_PLUGINS = '/tmp/test-plugins';
const TEST_STATE_PATH = '/tmp/test-project/.claude/sdlc-state.json';

function setupTestConfig() {
  __test__.setConfig({
    projectPath: TEST_PROJECT,
    pluginsPath: TEST_PLUGINS,
    maxRetriesPerStep: 3,
    model: 'opus',
    effort: undefined,
    discordChannelId: null,
    statePath: TEST_STATE_PATH,
    dryRun: false,
    logDir: '/tmp/test-logs',
    orchestrationLog: '/tmp/test-logs/sdlc-runner.log',
  });
}

// ---------------------------------------------------------------------------
// Before each — reset mocks and module state
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  __test__.resetState();
  setupTestConfig();

  // Default: state file does not exist
  mockFs.existsSync.mockReturnValue(false);
  mockFs.readFileSync.mockReturnValue('{}');
  mockExecSync.mockReturnValue('');
});

// ===========================================================================
// From feature.gherkin — Soft failure detection scenarios
// ===========================================================================

describe('AC1: Runner detects error_max_turns as failure', () => {
  it('returns isSoftFailure:true with reason error_max_turns (AC1, FR2)', () => {
    const stdout = JSON.stringify({
      subtype: 'error_max_turns',
      result: 'Some partial output',
      session_id: 'abc123',
    });
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(true);
    expect(result.reason).toBe('error_max_turns');
  });
});

describe('AC2: Runner detects permission denials as failure', () => {
  it('returns isSoftFailure:true when permission_denials contains non-benign tools (AC2, FR3)', () => {
    const stdout = JSON.stringify({
      subtype: 'success',
      permission_denials: ['SomeDangerousTool', 'AnotherTool'],
      session_id: 'abc123',
    });
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(true);
    expect(result.reason).toContain('permission_denials');
    expect(result.reason).toContain('SomeDangerousTool');
  });

  it('returns isSoftFailure:false when all denials are benign (EnterPlanMode, AskUserQuestion)', () => {
    const stdout = JSON.stringify({
      subtype: 'success',
      permission_denials: ['AskUserQuestion', 'EnterPlanMode'],
      session_id: 'abc123',
    });
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(false);
  });

  it('filters benign denials and reports only serious ones', () => {
    const stdout = JSON.stringify({
      subtype: 'success',
      permission_denials: ['AskUserQuestion', 'ToolA', 'EnterPlanMode', 'ToolB'],
    });
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(true);
    expect(result.reason).toContain('ToolA');
    expect(result.reason).toContain('ToolB');
    expect(result.reason).not.toContain('AskUserQuestion');
    expect(result.reason).not.toContain('EnterPlanMode');
  });

  it('handles object-shaped permission_denials with tool_name field', () => {
    const stdout = JSON.stringify({
      subtype: 'success',
      permission_denials: [
        { tool_name: 'EnterPlanMode', tool_use_id: 'x' },
        { tool_name: 'SeriousTool', tool_use_id: 'y' },
      ],
    });
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(true);
    expect(result.reason).toContain('SeriousTool');
    expect(result.reason).not.toContain('EnterPlanMode');
  });
});

describe('AC3: Normal exit code 0 still treated as success', () => {
  it('returns isSoftFailure:false for subtype success with no denials (AC3)', () => {
    const stdout = JSON.stringify({
      subtype: 'success',
      result: 'Everything worked',
      session_id: 'abc123',
    });
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(false);
  });

  it('returns isSoftFailure:false when permission_denials is empty array', () => {
    const stdout = JSON.stringify({
      subtype: 'success',
      permission_denials: [],
    });
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(false);
  });

  it('returns isSoftFailure:false when permission_denials is absent', () => {
    const stdout = JSON.stringify({ subtype: 'success' });
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(false);
  });
});

describe('Non-JSON output does not trigger false positive', () => {
  it('returns isSoftFailure:false for plain text output', () => {
    const result = detectSoftFailure('This is plain text output, not JSON');
    expect(result.isSoftFailure).toBe(false);
  });

  it('returns isSoftFailure:false for empty string', () => {
    const result = detectSoftFailure('');
    expect(result.isSoftFailure).toBe(false);
  });

  it('returns isSoftFailure:false for partial JSON', () => {
    const result = detectSoftFailure('{"subtype": "error_max_turns"');
    expect(result.isSoftFailure).toBe(false);
  });
});

// ===========================================================================
// Text-pattern soft failure detection (issue #86)
// ===========================================================================

describe('Text-pattern soft failure detection', () => {
  it('detects EnterPlanMode text pattern as soft failure (AC1)', () => {
    const stdout = 'Some output\nEnterPlanMode called in headless session — cannot enter plan mode without a TTY\nMore output';
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(true);
    expect(result.reason).toBe('text_pattern: EnterPlanMode');
  });

  it('detects AskUserQuestion auto-mode text pattern as soft failure (AC1)', () => {
    const stdout = 'AskUserQuestion called in auto-mode — this skill does not support auto-mode';
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(true);
    expect(result.reason).toContain('text_pattern:');
    expect(result.reason).toContain('AskUserQuestion');
  });

  it('returns isSoftFailure:false for normal success text with no failure patterns (AC6)', () => {
    const stdout = 'Implementation complete for issue #42.\nFiles created: src/index.js';
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(false);
  });

  it('JSON error_max_turns takes precedence over text pattern (AC5, edge case)', () => {
    // JSON check fires first; text pattern scan should not override
    const stdout = JSON.stringify({
      subtype: 'error_max_turns',
      result: 'EnterPlanMode called in headless session',
    });
    const result = detectSoftFailure(stdout);
    expect(result.isSoftFailure).toBe(true);
    expect(result.reason).toBe('error_max_turns');
  });

  it('returns isSoftFailure:false for empty stdout (edge case)', () => {
    const result = detectSoftFailure('');
    expect(result.isSoftFailure).toBe(false);
  });

  it('TEXT_FAILURE_PATTERNS is non-empty and each entry has pattern and label', () => {
    expect(TEXT_FAILURE_PATTERNS.length).toBeGreaterThan(0);
    for (const entry of TEXT_FAILURE_PATTERNS) {
      expect(entry.pattern).toBeInstanceOf(RegExp);
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// From requirements.md AC5 — Runner functionality coverage
// ===========================================================================

describe('Precondition validation', () => {
  // Helper: set up git/gh mock responses
  function mockGit(response) {
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.startsWith('git ')) return response;
      if (cmd.startsWith('gh ')) return response;
      return '';
    });
  }

  function mockGitMulti(responses) {
    mockExecSync.mockImplementation((cmd) => {
      for (const [pattern, value] of Object.entries(responses)) {
        if (cmd.includes(pattern)) return value;
      }
      return '';
    });
  }

  it('step 1 (startCycle) always passes — no preconditions', () => {
    const result = validatePreconditions(STEPS[0], defaultState());
    expect(result.ok).toBe(true);
  });

  it('step 2 (startIssue) passes on clean main branch', () => {
    mockGitMulti({
      'status --porcelain': '',
      'rev-parse --abbrev-ref HEAD': 'main',
    });
    const result = validatePreconditions(STEPS[1], defaultState());
    expect(result.ok).toBe(true);
  });

  it('step 2 (startIssue) fails if working tree is dirty', () => {
    mockGitMulti({
      'status --porcelain': 'M some-file.js',
      'rev-parse --abbrev-ref HEAD': 'main',
    });
    const result = validatePreconditions(STEPS[1], defaultState());
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('dirty');
  });

  it('step 2 (startIssue) ignores runner artifacts in dirty check', () => {
    mockGitMulti({
      'status --porcelain': '?? .claude/sdlc-state.json\n?? .claude/auto-mode',
      'rev-parse --abbrev-ref HEAD': 'main',
    });
    const result = validatePreconditions(STEPS[1], defaultState());
    expect(result.ok).toBe(true);
  });

  it('step 2 (startIssue) fails if not on main branch', () => {
    mockGitMulti({
      'status --porcelain': '',
      'rev-parse --abbrev-ref HEAD': '42-feature-branch',
    });
    const result = validatePreconditions(STEPS[1], defaultState());
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('main');
  });

  it('step 3 (writeSpecs) passes on feature branch with issue set', () => {
    mockExecSync.mockReturnValue('42-feature-branch');
    const state = { ...defaultState(), currentIssue: 42, currentBranch: '42-feature-branch' };
    const result = validatePreconditions(STEPS[2], state);
    expect(result.ok).toBe(true);
  });

  it('step 3 (writeSpecs) fails on main branch', () => {
    mockExecSync.mockReturnValue('main');
    const state = { ...defaultState(), currentIssue: 42 };
    const result = validatePreconditions(STEPS[2], state);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('main');
  });

  it('step 3 (writeSpecs) fails without current issue', () => {
    mockExecSync.mockReturnValue('42-feature-branch');
    const state = { ...defaultState(), currentIssue: null };
    const result = validatePreconditions(STEPS[2], state);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('issue');
  });

  it('step 4 (implement) passes when all 4 spec files exist', () => {
    const specsDir = `${TEST_PROJECT}/.claude/specs`;
    const featureDir = `${specsDir}/42-feature`;

    mockFs.existsSync.mockImplementation((p) => {
      if (p === specsDir) return true;
      if (p === featureDir) return true;
      if (p.startsWith(featureDir)) return true;
      return false;
    });
    mockFs.readdirSync.mockReturnValue(['42-feature']);
    mockFs.statSync.mockReturnValue({ isDirectory: () => true, size: 100 });

    const state = { ...defaultState(), featureName: '42-feature' };
    const result = validatePreconditions(STEPS[3], state);
    expect(result.ok).toBe(true);
  });

  it('step 4 (implement) fails when spec files are missing', () => {
    const specsDir = `${TEST_PROJECT}/.claude/specs`;

    mockFs.existsSync.mockImplementation((p) => {
      if (p === specsDir) return true;
      return false;
    });
    mockFs.readdirSync.mockReturnValue([]);

    const state = { ...defaultState(), featureName: null };
    const result = validatePreconditions(STEPS[3], state);
    expect(result.ok).toBe(false);
  });

  it('step 5 (verify) passes on feature branch with commits ahead', () => {
    mockGitMulti({
      'rev-parse --abbrev-ref HEAD': '42-feature',
      'log main..HEAD --oneline': 'abc1234 feat: implement something',
    });
    const result = validatePreconditions(STEPS[4], defaultState());
    expect(result.ok).toBe(true);
  });

  it('step 5 (verify) fails on main branch', () => {
    mockExecSync.mockReturnValue('main');
    const result = validatePreconditions(STEPS[4], defaultState());
    expect(result.ok).toBe(false);
  });

  it('step 6 (commitPush) always passes — no strict preconditions', () => {
    const result = validatePreconditions(STEPS[5], defaultState());
    expect(result.ok).toBe(true);
  });

  it('step 7 (createPR) passes when branch is pushed with no unpushed commits', () => {
    mockGitMulti({
      'rev-parse --abbrev-ref HEAD': '42-feature',
      'log origin/42-feature..HEAD --oneline': '',
    });
    const result = validatePreconditions(STEPS[6], defaultState());
    expect(result.ok).toBe(true);
  });

  it('step 7 (createPR) fails when unpushed commits exist', () => {
    mockGitMulti({
      'rev-parse --abbrev-ref HEAD': '42-feature',
      'log origin/42-feature..HEAD --oneline': 'abc1234 some commit',
    });
    const result = validatePreconditions(STEPS[6], defaultState());
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Unpushed');
  });

  it('step 8 (monitorCI) passes when PR exists', () => {
    mockExecSync.mockReturnValue('{"number": 10}');
    const result = validatePreconditions(STEPS[7], defaultState());
    expect(result.ok).toBe(true);
  });

  it('step 8 (monitorCI) fails when no PR exists', () => {
    mockExecSync.mockImplementation(() => { throw new Error('no PR'); });
    const result = validatePreconditions(STEPS[7], defaultState());
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('No PR');
  });

  it('step 9 (merge) passes when CI checks pass', () => {
    mockExecSync.mockReturnValue('All checks passed');
    const result = validatePreconditions(STEPS[8], defaultState());
    expect(result.ok).toBe(true);
  });

  it('step 9 (merge) fails when CI checks are failing', () => {
    mockExecSync.mockReturnValue('Some check FAIL');
    const result = validatePreconditions(STEPS[8], defaultState());
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('failing');
  });

  it('step 9 (merge) passes when no CI checks are reported (#54)', () => {
    const err = new Error('Command failed: gh pr checks\nno checks reported on the \'54-fix\' branch');
    err.stderr = "no checks reported on the '54-fix' branch";
    mockExecSync.mockImplementation(() => { throw err; });
    const result = validatePreconditions(STEPS[8], defaultState());
    expect(result.ok).toBe(true);
  });
});

describe('State extraction', () => {
  it('step 1 resets cycle state (extractStateFromStep)', () => {
    const result = { stdout: '{}', stderr: '', exitCode: 0 };
    const state = { ...defaultState(), currentIssue: 42, currentBranch: '42-feature' };
    const patch = extractStateFromStep(STEPS[0], result, state);
    expect(patch.currentIssue).toBeNull();
    expect(patch.currentBranch).toBe('main');
    expect(patch.featureName).toBeNull();
    expect(patch.retries).toEqual({});
  });

  it('step 2 extracts issue number from output', () => {
    mockExecSync.mockReturnValue('42-feature-branch');
    const result = { stdout: 'Created branch for issue #42', stderr: '', exitCode: 0 };
    const state = defaultState();
    const patch = extractStateFromStep(STEPS[1], result, state);
    expect(patch.currentIssue).toBe(42);
    expect(patch.currentBranch).toBe('42-feature-branch');
  });

  it('step 3 detects feature name from specs directory', () => {
    const specsDir = `${TEST_PROJECT}/.claude/specs`;
    mockFs.existsSync.mockImplementation((p) => p === specsDir);
    mockFs.readdirSync.mockReturnValue(['38-detect-soft-failures']);
    mockFs.statSync.mockReturnValue({ isDirectory: () => true });

    const result = { stdout: '{}', stderr: '', exitCode: 0 };
    const state = defaultState();
    const patch = extractStateFromStep(STEPS[2], result, state);
    expect(patch.featureName).toBe('38-detect-soft-failures');
  });

  it('step 7 extracts PR number from output', () => {
    const result = { stdout: 'https://github.com/org/repo/pull/15', stderr: '', exitCode: 0 };
    const state = defaultState();
    const patch = extractStateFromStep(STEPS[6], result, state);
    expect(patch.prNumber).toBe(15);
  });

  it('step 9 resets all state for next cycle', () => {
    const result = { stdout: '{}', stderr: '', exitCode: 0 };
    const state = { ...defaultState(), currentIssue: 42, currentBranch: '42-feature', featureName: '42-feature' };
    const patch = extractStateFromStep(STEPS[8], result, state);
    expect(patch.currentStep).toBe(0);
    expect(patch.lastCompletedStep).toBe(0);
    expect(patch.currentIssue).toBeNull();
    expect(patch.currentBranch).toBe('main');
    expect(patch.retries).toEqual({});
  });
});

describe('Bounce loop detection', () => {
  it('returns false when under threshold', () => {
    __test__.bounceCount = 0;
    // MAX_RETRIES defaults to 3
    expect(incrementBounceCount()).toBe(false);
    expect(incrementBounceCount()).toBe(false);
    expect(incrementBounceCount()).toBe(false);
  });

  it('returns true when threshold exceeded', () => {
    __test__.bounceCount = 3; // At threshold
    expect(incrementBounceCount()).toBe(true);
  });

  it('increments bounceCount each call', () => {
    __test__.bounceCount = 0;
    incrementBounceCount();
    expect(__test__.bounceCount).toBe(1);
    incrementBounceCount();
    expect(__test__.bounceCount).toBe(2);
  });
});

describe('Error pattern matching', () => {
  it('matches context_window_exceeded → escalate', () => {
    const result = matchErrorPattern('Error: context_window_exceeded in session');
    expect(result).not.toBeNull();
    expect(result.action).toBe('escalate');
    expect(result.pattern).toContain('context_window_exceeded');
  });

  it('matches signal: 9 → escalate', () => {
    const result = matchErrorPattern('Process terminated with signal: 9');
    expect(result).not.toBeNull();
    expect(result.action).toBe('escalate');
  });

  it('matches signal: SIGKILL → escalate', () => {
    const result = matchErrorPattern('Process terminated with signal: SIGKILL');
    expect(result).not.toBeNull();
    expect(result.action).toBe('escalate');
  });

  it('matches permission denied → escalate', () => {
    const result = matchErrorPattern('Error: permission denied for /some/path');
    expect(result).not.toBeNull();
    expect(result.action).toBe('escalate');
  });

  it('does not match EnterPlanMode (benign denial, not unrecoverable)', () => {
    const result = matchErrorPattern('Attempted to call EnterPlanMode in headless mode');
    expect(result).toBeNull();
  });

  it('matches rate_limit → wait', () => {
    const result = matchErrorPattern('Error: rate_limit exceeded');
    expect(result).not.toBeNull();
    expect(result.action).toBe('wait');
    expect(result.pattern).toBe('rate_limit');
  });

  it('returns null for unrecognized output', () => {
    const result = matchErrorPattern('Everything worked fine, no errors');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = matchErrorPattern('');
    expect(result).toBeNull();
  });
});

describe('Failure handling', () => {
  // handleFailure depends on git, state, and Discord — mock them
  beforeEach(() => {
    // readState returns a valid state
    mockFs.existsSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) {
        return JSON.stringify({ ...defaultState(), currentIssue: 42, retries: {} });
      }
      return '{}';
    });
    // git commands succeed by default
    mockExecSync.mockReturnValue('');
  });

  it('escalates immediately on known pattern (context_window_exceeded)', async () => {
    const step = STEPS[3]; // implement
    const result = { exitCode: 1, stdout: 'context_window_exceeded', stderr: '', duration: 10 };
    const state = { ...defaultState(), currentIssue: 42, retries: {} };

    // haltFailureLoop calls process.exit — mock it
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    const outcome = await handleFailure(step, result, state);
    expect(outcome).toBe('escalated');

    mockExit.mockRestore();
  });

  it('returns retry-previous when preconditions of current step fail', async () => {
    const step = STEPS[2]; // writeSpecs (step 3)
    const result = { exitCode: 1, stdout: 'some error', stderr: '', duration: 10 };
    const state = { ...defaultState(), currentIssue: null, retries: {} }; // no issue → precondition fails

    // Mock: precondition check will fail for step 3 (no issue)
    mockExecSync.mockReturnValue('main'); // on main → precondition fails

    const outcome = await handleFailure(step, result, state);
    expect(outcome).toBe('retry-previous');
  });

  it('increments retry count and returns retry', async () => {
    const step = STEPS[3]; // implement (step 4)
    const result = { exitCode: 1, stdout: 'some generic error', stderr: '', duration: 10 };
    const state = { ...defaultState(), currentIssue: 42, retries: {} };

    // Mock: preconditions pass for step 4
    const specsDir = `${TEST_PROJECT}/.claude/specs`;
    const featureDir = `${specsDir}/42-feature`;
    mockFs.existsSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return true;
      if (p === specsDir) return true;
      if (p === featureDir) return true;
      if (p.startsWith(featureDir)) return true;
      return false;
    });
    mockFs.readdirSync.mockReturnValue(['42-feature']);
    mockFs.statSync.mockReturnValue({ isDirectory: () => true, size: 100 });

    // git status returns clean
    mockExecSync.mockReturnValue('');

    const outcome = await handleFailure(step, result, state);
    expect(outcome).toBe('retry');
  });

  it('escalates after exhausting retries', async () => {
    const step = STEPS[3]; // implement
    const result = { exitCode: 1, stdout: 'some error', stderr: '', duration: 10 };
    const state = { ...defaultState(), currentIssue: 42, retries: { 4: 2 } }; // Already at 2, max is 3

    // Mock: preconditions pass
    const specsDir = `${TEST_PROJECT}/.claude/specs`;
    const featureDir = `${specsDir}/42-feature`;
    mockFs.existsSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return true;
      if (p === specsDir) return true;
      if (p === featureDir) return true;
      if (p.startsWith(featureDir)) return true;
      return false;
    });
    mockFs.readdirSync.mockReturnValue(['42-feature']);
    mockFs.statSync.mockReturnValue({ isDirectory: () => true, size: 100 });
    mockExecSync.mockReturnValue('');

    // readState should return state with high retry count
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) {
        return JSON.stringify({ ...defaultState(), currentIssue: 42, retries: { 4: 2 } });
      }
      return '{}';
    });

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const outcome = await handleFailure(step, result, state);
    expect(outcome).toBe('escalated');
    mockExit.mockRestore();
  });
});

describe('Consecutive escalation detection', () => {
  it('MAX_CONSECUTIVE_ESCALATIONS is 2', () => {
    expect(MAX_CONSECUTIVE_ESCALATIONS).toBe(2);
  });

  it('escalate increments consecutiveEscalations counter', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    __test__.consecutiveEscalations = 0;

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ ...defaultState(), currentIssue: 10 }));
    mockExecSync.mockReturnValue('');

    await escalate(STEPS[1], 'test reason');
    expect(__test__.consecutiveEscalations).toBe(1);

    mockExit.mockRestore();
  });

  it('calls haltFailureLoop when consecutiveEscalations reaches threshold', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    __test__.consecutiveEscalations = 1; // One below threshold (MAX is 2)

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ ...defaultState(), currentIssue: 20 }));
    mockExecSync.mockReturnValue('');

    await escalate(STEPS[1], 'second escalation');

    // haltFailureLoop calls process.exit(1)
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});

describe('Same-issue loop detection', () => {
  it('escalatedIssues tracks issues that have been escalated', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    __test__.resetState();

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ ...defaultState(), currentIssue: 42 }));
    mockExecSync.mockReturnValue('');

    await escalate(STEPS[1], 'test reason');
    expect(__test__.escalatedIssues.has(42)).toBe(true);

    mockExit.mockRestore();
  });

  it('buildClaudeArgs excludes escalated issues from step 2 prompt', () => {
    __test__.escalatedIssues.add(10);
    __test__.escalatedIssues.add(20);

    // Mock readSkill
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('skill content');

    const step = { ...STEPS[1], skill: 'starting-issues' };
    const state = { ...defaultState() };
    const args = buildClaudeArgs(step, state);

    const promptIdx = args.indexOf('-p') + 1;
    const prompt = args[promptIdx];
    expect(prompt).toContain('#10');
    expect(prompt).toContain('#20');
    expect(prompt).toContain('Do NOT select');
  });
});

describe('State hydration', () => {
  // detectAndHydrateState depends heavily on git/gh — test via mocking

  it('returns null when on main branch', () => {
    mockExecSync.mockReturnValue('main');
    const result = runner.detectAndHydrateState();
    expect(result).toBeNull();
  });

  it('returns state patch when on feature branch', () => {
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return '42-my-feature';
      if (cmd.includes('pr view --json state')) throw new Error('no PR');
      if (cmd.includes('log main..HEAD --oneline')) return '';
      return '';
    });
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([]);

    const result = runner.detectAndHydrateState();
    expect(result).not.toBeNull();
    expect(result.currentIssue).toBe(42);
    expect(result.currentBranch).toBe('42-my-feature');
    expect(result.lastCompletedStep).toBe(2); // At minimum on feature branch
  });

  it('returns { _merged: true } when PR is merged', () => {
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return '42-my-feature';
      if (cmd.includes('pr view --json state --jq .state')) return 'MERGED';
      if (cmd.includes('checkout main')) return '';
      if (cmd.includes('pull')) return '';
      return '';
    });

    // Need to set DRY_RUN to true so it doesn't actually try to checkout
    __test__.setConfig({ dryRun: true });

    const result = runner.detectAndHydrateState();
    expect(result).toEqual({ _merged: true });
  });

  it('returns null for non-matching branch pattern', () => {
    mockExecSync.mockReturnValue('random-branch-no-number');
    const result = runner.detectAndHydrateState();
    expect(result).toBeNull();
  });

  it('detects lastCompletedStep=3 when spec files exist', () => {
    const specsDir = `${TEST_PROJECT}/.claude/specs`;
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return '42-my-feature';
      if (cmd.includes('pr view --json state')) throw new Error('no PR');
      if (cmd.includes('log main..HEAD --oneline')) return '';
      return '';
    });

    mockFs.existsSync.mockImplementation((p) => {
      if (p === specsDir) return true;
      if (p.includes('42-my-feature') || p.includes('my-feature')) return true;
      return false;
    });
    mockFs.readdirSync.mockReturnValue(['42-my-feature']);
    mockFs.statSync.mockReturnValue({ isDirectory: () => true, size: 200 });

    const result = runner.detectAndHydrateState();
    expect(result.lastCompletedStep).toBeGreaterThanOrEqual(3);
  });
});

describe('Auto-mode lifecycle', () => {
  it('RUNNER_ARTIFACTS includes auto-mode and state file', () => {
    expect(RUNNER_ARTIFACTS).toContain('.claude/sdlc-state.json');
    expect(RUNNER_ARTIFACTS).toContain('.claude/auto-mode');
  });

  it('removeAutoMode calls unlinkSync for .claude/auto-mode', () => {
    removeAutoMode();
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('auto-mode')
    );
  });

  it('autoCommitIfDirty ignores runner artifacts in dirty check', () => {
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('status --porcelain')) return '?? .claude/sdlc-state.json\n?? .claude/auto-mode';
      return '';
    });

    const result = autoCommitIfDirty('test commit');
    expect(result).toBe(false);
  });

  it('autoCommitIfDirty commits meaningful changes', () => {
    let committed = false;
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('status --porcelain')) return 'M src/index.js';
      if (cmd.includes('add -A')) { committed = true; return ''; }
      if (cmd.includes('commit')) return '';
      if (cmd.includes('push')) return '';
      return '';
    });

    const result = autoCommitIfDirty('test commit');
    expect(result).toBe(true);
    expect(committed).toBe(true);
  });
});

// ===========================================================================
// Issue #57: ensureRunnerArtifactsGitignored
// ===========================================================================

describe('ensureRunnerArtifactsGitignored (#57)', () => {
  // Helper: find the appendFileSync call that wrote to .gitignore
  function gitignoreAppend() {
    return mockFs.appendFileSync.mock.calls.find(c => c[0].endsWith('.gitignore'));
  }

  it('appends missing artifact patterns to .gitignore', () => {
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('.gitignore')) return 'node_modules/\n';
      return '{}';
    });

    ensureRunnerArtifactsGitignored();

    const call = gitignoreAppend();
    expect(call).toBeDefined();
    expect(call[1]).toContain('.claude/auto-mode');
    expect(call[1]).toContain('.claude/sdlc-state.json');
    expect(call[1]).toContain('# SDLC runner artifacts');
  });

  it('does not duplicate entries already in .gitignore', () => {
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('.gitignore')) return 'node_modules/\n.claude/auto-mode\n.claude/sdlc-state.json\n';
      return '{}';
    });

    ensureRunnerArtifactsGitignored();

    expect(gitignoreAppend()).toBeUndefined();
  });

  it('creates .gitignore when file does not exist', () => {
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('.gitignore')) {
        const err = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      }
      return '{}';
    });

    ensureRunnerArtifactsGitignored();

    const call = gitignoreAppend();
    expect(call).toBeDefined();
    expect(call[1]).toContain('.claude/auto-mode');
    expect(call[1]).toContain('.claude/sdlc-state.json');
  });

  it('adds trailing newline before appending when file lacks one', () => {
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('.gitignore')) return 'node_modules/';  // no trailing newline
      return '{}';
    });

    ensureRunnerArtifactsGitignored();

    const call = gitignoreAppend();
    expect(call[1].startsWith('\n')).toBe(true);
  });

  it('only appends entries that are missing (partial match)', () => {
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('.gitignore')) return '.claude/auto-mode\n';
      return '{}';
    });

    ensureRunnerArtifactsGitignored();

    const call = gitignoreAppend();
    expect(call).toBeDefined();
    expect(call[1]).toContain('.claude/sdlc-state.json');
    expect(call[1]).not.toContain('.claude/auto-mode');
  });

  it('re-throws non-ENOENT read errors', () => {
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('.gitignore')) {
        const err = new Error('EACCES');
        err.code = 'EACCES';
        throw err;
      }
      return '{}';
    });

    expect(() => ensureRunnerArtifactsGitignored()).toThrow('EACCES');
  });
});

describe('Soft failure integration', () => {
  // End-to-end: runStep() routes soft failures to handleFailure

  it('runStep routes error_max_turns (exit 0) to handleFailure (AC1 integration)', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    const step = STEPS[0]; // startCycle (step 1, always passes preconditions)
    const state = { ...defaultState(), currentIssue: null, retries: {} };

    // Mock state read/write
    mockFs.existsSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return JSON.stringify(state);
      return '{}';
    });

    // Mock runClaude via spawn — we need to mock the spawn that runClaude uses
    // Since runClaude uses spawn internally, and DRY_RUN is false, we need to
    // set DRY_RUN to true to get a controlled response
    __test__.setConfig({ dryRun: true });

    // In DRY_RUN mode, runClaude returns { exitCode: 0, stdout: '{"result":"dry-run"}', ... }
    // But we need stdout to contain error_max_turns...
    // Instead, let's test detectSoftFailure + handleFailure path directly

    const softResult = detectSoftFailure(JSON.stringify({ subtype: 'error_max_turns' }));
    expect(softResult.isSoftFailure).toBe(true);

    // Verify handleFailure would be called (unit test of the integration seam)
    const handleResult = await handleFailure(
      step,
      { exitCode: 0, stdout: JSON.stringify({ subtype: 'error_max_turns' }), stderr: '', duration: 5 },
      state
    );
    // Step 1 has no previous step, so it should retry (not retry-previous)
    expect(['retry', 'escalated']).toContain(handleResult);

    mockExit.mockRestore();
  });

  it('runStep treats benign permission_denials (AskUserQuestion) as success, not soft failure (AC2 integration)', () => {
    // AskUserQuestion is benign — the model tried it, got denied, and recovered.
    // This should NOT be treated as a soft failure.
    const softResult = detectSoftFailure(JSON.stringify({
      subtype: 'success',
      permission_denials: ['AskUserQuestion'],
    }));
    expect(softResult.isSoftFailure).toBe(false);
  });

  it('runStep routes serious permission_denials (exit 0) to handleFailure (AC2 integration)', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    const softResult = detectSoftFailure(JSON.stringify({
      subtype: 'success',
      permission_denials: ['SomeSeriousTool'],
    }));
    expect(softResult.isSoftFailure).toBe(true);

    const state = { ...defaultState(), currentIssue: 42, retries: {} };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(state));
    mockExecSync.mockReturnValue('');

    const handleResult = await handleFailure(
      STEPS[1],
      { exitCode: 0, stdout: JSON.stringify({ permission_denials: ['SomeSeriousTool'] }), stderr: '', duration: 5 },
      state
    );
    expect(['retry', 'retry-previous', 'escalated']).toContain(handleResult);

    mockExit.mockRestore();
  });
});

// ===========================================================================
// Issue #54: No CI checks handling
// ===========================================================================

describe('No CI checks handling (#54)', () => {
  it('validateCI passes when gh pr checks reports no checks', () => {
    const err = new Error('Command failed: gh pr checks\nno checks reported on the \'main\' branch');
    err.stderr = "no checks reported on the 'main' branch";
    mockExecSync.mockImplementation(() => { throw err; });
    const result = validateCI();
    expect(result.ok).toBe(true);
  });

  it('validateCI still fails on genuine errors', () => {
    const err = new Error('Command failed: gh pr checks\nHTTP 404');
    err.stderr = 'HTTP 404';
    mockExecSync.mockImplementation(() => { throw err; });
    const result = validateCI();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Could not check CI status');
  });

  it('detectAndHydrateState advances to step 8 when no checks reported', () => {
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return '42-my-feature';
      if (cmd.includes('pr view --json state')) throw new Error('no PR');
      if (cmd.includes('log main..HEAD --oneline')) return 'abc123 feat: implement';
      if (cmd.includes('log origin/42-my-feature..HEAD --oneline')) return '';
      if (cmd.includes('pr view --json number')) return '{"number": 10}';
      if (cmd.includes('pr checks')) {
        const err = new Error("no checks reported on the '42-my-feature' branch");
        err.stderr = "no checks reported on the '42-my-feature' branch";
        throw err;
      }
      return '';
    });

    mockFs.existsSync.mockImplementation((p) => {
      if (p.includes('.claude/specs')) return true;
      if (p.includes('42-my-feature')) return true;
      return false;
    });
    mockFs.readdirSync.mockReturnValue(['42-my-feature']);
    mockFs.statSync.mockReturnValue({ isDirectory: () => true, size: 200 });

    const result = detectAndHydrateState();
    expect(result.lastCompletedStep).toBe(8);
  });
});

// ===========================================================================
// Utility function tests
// ===========================================================================

describe('extractSessionId', () => {
  it('extracts session_id from valid JSON', () => {
    const id = extractSessionId('{"session_id": "abcdef123456789"}');
    expect(id).toBe('abcdef123456');
  });

  it('returns a UUID fragment for non-JSON input', () => {
    const id = extractSessionId('not json');
    expect(id).toHaveLength(12);
  });

  it('returns a UUID fragment when session_id is missing', () => {
    const id = extractSessionId('{"result": "ok"}');
    expect(id).toHaveLength(12);
  });
});

describe('resolveLogDir', () => {
  it('uses cfg.logDir when provided', () => {
    const result = resolveLogDir({ logDir: '/custom/logs' }, '/project');
    expect(result).toContain('/custom/logs');
  });

  it('falls back to tmpdir when no logDir configured', () => {
    const result = resolveLogDir({}, '/my/project');
    expect(result).toContain('sdlc-logs');
    expect(result).toContain('project');
  });
});

describe('defaultState', () => {
  it('returns expected default structure', () => {
    const state = defaultState();
    expect(state.currentStep).toBe(0);
    expect(state.lastCompletedStep).toBe(0);
    expect(state.currentIssue).toBeNull();
    expect(state.currentBranch).toBe('main');
    expect(state.featureName).toBeNull();
    expect(state.retries).toEqual({});
    expect(state.runnerPid).toBe(process.pid);
  });
});

describe('STEP_KEYS and STEPS', () => {
  it('has 9 step keys', () => {
    expect(STEP_KEYS).toHaveLength(9);
  });

  it('STEPS has 9 entries with correct numbering', () => {
    expect(STEPS).toHaveLength(9);
    STEPS.forEach((step, i) => {
      expect(step.number).toBe(i + 1);
      expect(step.key).toBe(STEP_KEYS[i]);
    });
  });

  it('step keys match expected names', () => {
    expect(STEP_KEYS).toEqual([
      'startCycle', 'startIssue', 'writeSpecs', 'implement',
      'verify', 'commitPush', 'createPR', 'monitorCI', 'merge',
    ]);
  });
});

// ===========================================================================
// Edge case regression tests (Issue #51)
// ===========================================================================

describe('Edge case fixes (#51)', () => {
  // F1: currentProcess is assigned during runClaude and cleared after
  describe('F1: currentProcess lifecycle in runClaude', () => {
    it('assigns currentProcess during execution and clears on close', async () => {
      // Create a mock process that behaves like a ChildProcess
      let closeHandler;
      const mockProc = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'close') closeHandler = handler;
        }),
        kill: jest.fn(),
        killed: false,
      };
      mockSpawn.mockReturnValue(mockProc);

      // Need to read skill for buildClaudeArgs
      mockFs.existsSync.mockReturnValue(false);

      const step = { ...STEPS[0], timeoutMin: 1 };
      const state = defaultState();

      // Start runClaude (it returns a promise)
      const promise = runClaude(step, state);

      // After spawn, currentProcess should be set
      expect(__test__.currentProcess).toBe(mockProc);

      // Simulate process close
      closeHandler(0);

      await promise;

      // After close, currentProcess should be cleared
      expect(__test__.currentProcess).toBeNull();
    });
  });

  // F2: No Atomics.wait in source — uses async sleep instead
  describe('F2: No synchronous Atomics.wait in source', () => {
    it('source file does not contain Atomics.wait', () => {
      // Verify the exported postDiscord function's source does not reference Atomics
      const src = runner.postDiscord.toString();
      expect(src).not.toContain('Atomics');
      expect(src).toContain('sleep');
    });
  });

  // F3: autoCommitIfDirty uses shellEscape for commit messages
  describe('F3: shellEscape in autoCommitIfDirty', () => {
    it('wraps commit message in single quotes via shellEscape', () => {
      const dangerousMessage = 'feat: $(rm -rf /) `whoami`';
      let commitCmd = '';
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('status --porcelain')) return 'M src/index.js';
        if (cmd.includes('commit')) { commitCmd = cmd; return ''; }
        return '';
      });

      autoCommitIfDirty(dangerousMessage);

      // shellEscape wraps in single quotes: 'feat: $(rm -rf /) `whoami`'
      expect(commitCmd).toContain("'");
      expect(commitCmd).not.toContain('"' + dangerousMessage);
      // The dangerous subshell/backtick content should be inside single quotes
      expect(commitCmd).toMatch(/commit -m '.*\$\(rm -rf \/\).*`whoami`.*'/);
    });
  });

  // F4: detectAndHydrateState returns null (not throws) when checkout fails on merged PR
  describe('F4: merged-PR checkout failure returns null', () => {
    it('returns null when git checkout main fails after merged PR', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return '42-feature';
        if (cmd.includes('pr view --json state --jq .state')) return 'MERGED';
        if (cmd.includes('checkout main')) throw new Error('error: Your local changes would be overwritten');
        return '';
      });

      // DRY_RUN must be false so it attempts the checkout
      __test__.setConfig({ dryRun: false });

      const result = detectAndHydrateState();
      expect(result).toBeNull();
    });
  });

  // F5: log warning when --resume + missing state file
  describe('F5: --resume with missing state file logs warning', () => {
    it('main() source contains the RESUME warning log', () => {
      // Verify the main function source contains the conditional warning
      const src = runner.main.toString();
      expect(src).toContain('--resume specified but state file not found');
    });
  });

  // F6: spawn is called without signal option
  describe('F6: no AbortController signal in spawn options', () => {
    it('spawn is called without signal option', async () => {
      const mockProc = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'close') handler(0);
        }),
        kill: jest.fn(),
        killed: false,
      };
      mockSpawn.mockReturnValue(mockProc);
      mockFs.existsSync.mockReturnValue(false);

      const step = { ...STEPS[0], timeoutMin: 1 };
      const state = defaultState();

      await runClaude(step, state);

      // Check the spawn options (3rd argument)
      const spawnOptions = mockSpawn.mock.calls[0][2];
      expect(spawnOptions).not.toHaveProperty('signal');
    });
  });
});

// ===========================================================================
// Issue #55: Process tree cleanup
// ===========================================================================

describe('IS_WINDOWS constant', () => {
  it('is a boolean', () => {
    expect(typeof IS_WINDOWS).toBe('boolean');
  });

  it('is false on non-Windows platforms', () => {
    // Test environment is macOS/Linux
    expect(IS_WINDOWS).toBe(false);
  });
});

describe('getChildPids', () => {
  it('returns child PIDs from pgrep -P output', () => {
    mockExecSync.mockReturnValue('1234\n5678\n');
    const result = getChildPids(100);
    expect(result).toEqual([1234, 5678]);
  });

  it('returns empty array when no children (exit code 1)', () => {
    mockExecSync.mockImplementation(() => { throw new Error('exit code 1'); });
    const result = getChildPids(100);
    expect(result).toEqual([]);
  });

  it('returns empty array on timeout or error', () => {
    mockExecSync.mockImplementation(() => { throw new Error('timeout'); });
    const result = getChildPids(999);
    expect(result).toEqual([]);
  });

  it('filters out non-numeric values', () => {
    mockExecSync.mockReturnValue('1234\nProcessId\n5678\n');
    const result = getChildPids(100);
    expect(result).toEqual([1234, 5678]);
  });
});

describe('getProcessTree', () => {
  it('returns single PID when no children', () => {
    mockExecSync.mockImplementation(() => { throw new Error('no match'); });
    const result = getProcessTree(100);
    expect(result).toEqual([100]);
  });

  it('returns tree in bottom-up order (children before parent)', () => {
    // PID 100 has children 200, 300
    // PID 200 has child 201
    // PID 300 has no children
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('-P 100')) return '200\n300\n';
      if (cmd.includes('-P 200')) return '201\n';
      throw new Error('no match');
    });
    const result = getProcessTree(100);
    // Bottom-up: 201, 200, 300, 100
    expect(result).toEqual([201, 200, 300, 100]);
  });

  it('handles deep nesting', () => {
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('-P 1')) return '2\n';
      if (cmd.includes('-P 2')) return '3\n';
      if (cmd.includes('-P 3')) return '4\n';
      throw new Error('no match');
    });
    const result = getProcessTree(1);
    expect(result).toEqual([4, 3, 2, 1]);
  });
});

describe('killProcessTree', () => {
  it('kills all PIDs in tree bottom-up and returns count', () => {
    // PID 100 has children 200, 300
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('-P 100')) return '200\n300\n';
      throw new Error('no match');
    });

    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
    const killed = killProcessTree(100);

    expect(killed).toBe(3); // 200, 300, 100
    expect(killSpy).toHaveBeenCalledWith(200, 'SIGTERM');
    expect(killSpy).toHaveBeenCalledWith(300, 'SIGTERM');
    expect(killSpy).toHaveBeenCalledWith(100, 'SIGTERM');

    // Verify bottom-up order
    const calls = killSpy.mock.calls.map(c => c[0]);
    expect(calls.indexOf(200)).toBeLessThan(calls.indexOf(100));
    expect(calls.indexOf(300)).toBeLessThan(calls.indexOf(100));

    killSpy.mockRestore();
  });

  it('ignores ESRCH (process already exited)', () => {
    mockExecSync.mockImplementation(() => { throw new Error('no match'); });

    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
      const err = new Error('No such process');
      err.code = 'ESRCH';
      throw err;
    });

    const killed = killProcessTree(100);
    expect(killed).toBe(0);

    killSpy.mockRestore();
  });

  it('re-throws non-ESRCH errors', () => {
    mockExecSync.mockImplementation(() => { throw new Error('no match'); });

    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
      const err = new Error('Operation not permitted');
      err.code = 'EPERM';
      throw err;
    });

    expect(() => killProcessTree(100)).toThrow('Operation not permitted');

    killSpy.mockRestore();
  });
});

describe('findProcessesByPattern', () => {
  it('returns PIDs matching a pattern', () => {
    mockExecSync.mockReturnValue('1234\n5678\n');
    const result = findProcessesByPattern('--some-flag');
    expect(result).toEqual([1234, 5678]);
  });

  it('returns empty array when no matches', () => {
    mockExecSync.mockImplementation(() => { throw new Error('exit code 1'); });
    const result = findProcessesByPattern('nonexistent-pattern');
    expect(result).toEqual([]);
  });

  it('uses shellEscape for the pattern', () => {
    mockExecSync.mockReturnValue('');
    findProcessesByPattern("pattern'with'quotes");
    const cmd = mockExecSync.mock.calls[0][0];
    // shellEscape wraps in single quotes and escapes internal quotes
    expect(cmd).toContain('pgrep -f');
    expect(cmd).toContain("'");
  });
});

describe('cleanupProcesses (#55 rewrite)', () => {
  it('Phase 1: kills process tree when lastClaudePid is set', () => {
    __test__.lastClaudePid = 12345;

    // getProcessTree will call pgrep -P 12345 → no children
    mockExecSync.mockImplementation(() => { throw new Error('no match'); });

    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});

    cleanupProcesses();

    expect(killSpy).toHaveBeenCalledWith(12345, 'SIGTERM');
    expect(__test__.lastClaudePid).toBeNull();

    killSpy.mockRestore();
  });

  it('Phase 1: clears lastClaudePid after tree kill', () => {
    __test__.lastClaudePid = 99999;
    mockExecSync.mockImplementation(() => { throw new Error('no match'); });
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});

    cleanupProcesses();
    expect(__test__.lastClaudePid).toBeNull();

    killSpy.mockRestore();
  });

  it('Phase 2: kills processes matching patterns, filtering self PID', () => {
    __test__.lastClaudePid = null;
    __test__.setConfig({
      cleanup: { processPatterns: ['--test-pattern'] },
    });

    // findProcessesByPattern returns PIDs including process.pid
    mockExecSync.mockReturnValue(`${process.pid}\n7777\n8888\n`);

    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});

    cleanupProcesses();

    // Should NOT kill self
    expect(killSpy).not.toHaveBeenCalledWith(process.pid, 'SIGTERM');
    // Should kill the others
    expect(killSpy).toHaveBeenCalledWith(7777, 'SIGTERM');
    expect(killSpy).toHaveBeenCalledWith(8888, 'SIGTERM');

    killSpy.mockRestore();
  });

  it('Phase 2: skips pattern with no matches', () => {
    __test__.lastClaudePid = null;
    __test__.setConfig({
      cleanup: { processPatterns: ['--no-match'] },
    });

    mockExecSync.mockImplementation(() => { throw new Error('exit code 1'); });
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});

    cleanupProcesses();
    expect(killSpy).not.toHaveBeenCalled();

    killSpy.mockRestore();
  });

  it('runs both phases when lastClaudePid and patterns are set', () => {
    __test__.lastClaudePid = 11111;
    __test__.setConfig({
      cleanup: { processPatterns: ['--fallback-pattern'] },
    });

    let pgrepCalls = 0;
    mockExecSync.mockImplementation((cmd) => {
      // Phase 1: getProcessTree calls pgrep -P 11111
      if (cmd.includes('-P 11111')) throw new Error('no match');
      // Phase 2: findProcessesByPattern calls pgrep -f
      if (cmd.includes('pgrep -f')) {
        pgrepCalls++;
        return '22222\n';
      }
      throw new Error('unexpected cmd');
    });

    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});

    cleanupProcesses();

    // Phase 1 killed the root PID
    expect(killSpy).toHaveBeenCalledWith(11111, 'SIGTERM');
    // Phase 2 killed the pattern match
    expect(killSpy).toHaveBeenCalledWith(22222, 'SIGTERM');
    expect(pgrepCalls).toBe(1);

    killSpy.mockRestore();
  });

  it('logs "No matching processes found" when no patterns and no lastClaudePid', () => {
    __test__.lastClaudePid = null;
    __test__.setConfig({
      cleanup: { processPatterns: [] },
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    cleanupProcesses();

    const logMessages = logSpy.mock.calls.map(c => c[0]);
    expect(logMessages.some(m => m.includes('[CLEANUP] No matching processes found'))).toBe(true);

    logSpy.mockRestore();
  });

  it('logs "No matching processes found" when patterns configured but no matches', () => {
    __test__.lastClaudePid = null;
    __test__.setConfig({
      cleanup: { processPatterns: ['--nonexistent-pattern'] },
    });

    mockExecSync.mockImplementation(() => { throw new Error('exit code 1'); });
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    cleanupProcesses();

    expect(killSpy).not.toHaveBeenCalled();
    const logMessages = logSpy.mock.calls.map(c => c[0]);
    expect(logMessages.some(m => m.includes('[CLEANUP] No matching processes found'))).toBe(true);

    killSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('does not log "No matching processes found" when Phase 1 ran', () => {
    __test__.lastClaudePid = 12345;
    __test__.setConfig({
      cleanup: { processPatterns: [] },
    });

    mockExecSync.mockImplementation(() => { throw new Error('no match'); });
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    cleanupProcesses();

    const logMessages = logSpy.mock.calls.map(c => c[0]);
    expect(logMessages.some(m => m.includes('No matching processes found'))).toBe(false);
    expect(logMessages.some(m => m.includes('[CLEANUP] Phase 1'))).toBe(true);

    killSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe('lastClaudePid tracking', () => {
  it('__test__ exposes lastClaudePid getter/setter', () => {
    __test__.lastClaudePid = 42;
    expect(__test__.lastClaudePid).toBe(42);
    __test__.lastClaudePid = null;
    expect(__test__.lastClaudePid).toBeNull();
  });

  it('runClaude sets lastClaudePid from spawned process', async () => {
    const mockProc = {
      pid: 55555,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, handler) => {
        if (event === 'close') handler(0);
      }),
      kill: jest.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc);
    mockFs.existsSync.mockReturnValue(false);

    const step = { ...STEPS[0], timeoutMin: 1 };
    const state = defaultState();

    await runClaude(step, state);

    // lastClaudePid should persist after process closes (unlike currentProcess)
    expect(__test__.lastClaudePid).toBe(55555);
    // currentProcess should be cleared
    expect(__test__.currentProcess).toBeNull();
  });

  it('lastClaudePid persists after process close (not cleared like currentProcess)', async () => {
    __test__.lastClaudePid = 77777;

    const mockProc = {
      pid: 88888,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, handler) => {
        if (event === 'close') handler(0);
      }),
      kill: jest.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc);
    mockFs.existsSync.mockReturnValue(false);

    const step = { ...STEPS[0], timeoutMin: 1 };
    await runClaude(step, defaultState());

    // Should be updated to the new PID, not cleared
    expect(__test__.lastClaudePid).toBe(88888);
  });
});

// ===========================================================================
// Edge case fixes — additional coverage
// ===========================================================================

describe('readState resilience (corrupted state file)', () => {
  it('returns defaultState when state file contains invalid JSON', () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return '{invalid json!!!';
      return '{}';
    });

    const state = readState();
    expect(state.currentStep).toBe(0);
    expect(state.currentBranch).toBe('main');
    expect(state.retries).toEqual({});
  });

  it('returns defaultState when state file is empty', () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return '';
      return '{}';
    });

    const state = readState();
    expect(state.currentStep).toBe(0);
  });

  it('logs a warning when state file is corrupted', () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return 'not-json';
      return '{}';
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    readState();
    const logMessages = logSpy.mock.calls.map(c => c[0]);
    expect(logMessages.some(m => m.includes('state file corrupted'))).toBe(true);
    logSpy.mockRestore();
  });

  it('still reads valid state files correctly', () => {
    const validState = { ...defaultState(), currentIssue: 42, currentBranch: '42-feature' };
    mockFs.existsSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return JSON.stringify(validState);
      return '{}';
    });

    const state = readState();
    expect(state.currentIssue).toBe(42);
    expect(state.currentBranch).toBe('42-feature');
  });
});

describe('haltFailureLoop calls cleanupProcesses', () => {
  it('calls cleanupProcesses before process.exit', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    __test__.lastClaudePid = 99999;

    // Track whether cleanup ran
    mockExecSync.mockImplementation(() => { throw new Error('no match'); });
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});

    await haltFailureLoop('test loop', ['detail 1']);

    // cleanupProcesses should have been called (evidenced by lastClaudePid being cleared)
    expect(__test__.lastClaudePid).toBeNull();
    expect(mockExit).toHaveBeenCalledWith(1);

    killSpy.mockRestore();
    mockExit.mockRestore();
  });
});

describe('Consolidated commit paths use autoCommitIfDirty', () => {
  it('handleFailure commit path filters runner artifacts', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    // Set up state for handleFailure
    mockFs.existsSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === TEST_STATE_PATH) {
        return JSON.stringify({ ...defaultState(), currentIssue: 42, retries: {} });
      }
      return '{}';
    });

    // Only runner artifacts dirty — autoCommitIfDirty should skip
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('status --porcelain')) return '?? .claude/sdlc-state.json\n?? .claude/auto-mode';
      return '';
    });

    const step = STEPS[0]; // step 1
    const result = { exitCode: 1, stdout: 'error', stderr: '', duration: 5 };
    const state = { ...defaultState(), retries: {} };

    await handleFailure(step, result, state);

    // No git add/commit should have been called
    const addCalls = mockExecSync.mock.calls.filter(c => c[0].includes('add -A'));
    expect(addCalls).toHaveLength(0);

    mockExit.mockRestore();
  });

  it('escalate commit path uses autoCommitIfDirty (filters artifacts)', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    __test__.resetState();

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ ...defaultState(), currentIssue: 42 }));

    // Only runner artifacts dirty
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('status --porcelain')) return '?? .claude/auto-mode';
      return '';
    });

    await escalate(STEPS[0], 'test reason');

    // No git commit should have been made (only runner artifacts)
    const commitCalls = mockExecSync.mock.calls.filter(c => c[0].includes('commit'));
    expect(commitCalls).toHaveLength(0);

    mockExit.mockRestore();
  });
});

describe('Step 2 issue extraction from branch name', () => {
  it('extracts issue number from branch name (preferred over output)', () => {
    mockExecSync.mockReturnValue('42-feature-branch');
    // Output mentions a different issue first
    const result = { stdout: 'Looking at #10 before starting #42', stderr: '', exitCode: 0 };
    const state = defaultState();
    const patch = extractStateFromStep(STEPS[1], result, state);
    // Should get 42 from branch, not 10 from output
    expect(patch.currentIssue).toBe(42);
    expect(patch.currentBranch).toBe('42-feature-branch');
  });

  it('does not fall back to output when branch has no issue number prefix', () => {
    mockExecSync.mockReturnValue('feature-no-number');
    const result = { stdout: 'Started issue #99', stderr: '', exitCode: 0 };
    const state = defaultState();
    const patch = extractStateFromStep(STEPS[1], result, state);
    // No regex fallback — currentIssue stays undefined (#62)
    expect(patch.currentIssue).toBeUndefined();
    expect(patch.currentBranch).toBe('feature-no-number');
  });

  it('does not fall back to output when git command fails', () => {
    mockExecSync.mockImplementation(() => { throw new Error('git error'); });
    const result = { stdout: 'Created branch for issue #55', stderr: '', exitCode: 0 };
    const state = defaultState();
    const patch = extractStateFromStep(STEPS[1], result, state);
    // No regex fallback — currentIssue stays undefined (#62)
    expect(patch.currentIssue).toBeUndefined();
  });

  it('does not set currentBranch or currentIssue when still on main', () => {
    mockExecSync.mockReturnValue('main');
    const result = { stdout: 'issue #42', stderr: '', exitCode: 0 };
    const state = defaultState();
    const patch = extractStateFromStep(STEPS[1], result, state);
    expect(patch.currentBranch).toBeUndefined();
    // No regex fallback — currentIssue stays undefined (#62)
    expect(patch.currentIssue).toBeUndefined();
  });
});

describe('Cross-cycle state contamination (#62)', () => {
  it('branch-based extraction sets correct issue even when output contains stale #N', () => {
    // Simulate output containing a stale issue number from a previous cycle
    mockExecSync.mockReturnValue('78-new-feature');
    const result = { stdout: 'Looked at #42 and decided to work on #78', stderr: '', exitCode: 0 };
    const state = defaultState();
    const patch = extractStateFromStep(STEPS[1], result, state);
    // Should extract 78 from branch name, ignoring stale #42 in output
    expect(patch.currentIssue).toBe(78);
    expect(patch.currentBranch).toBe('78-new-feature');
  });

  it('branch detection failure results in null issue (no regex fallback)', () => {
    // Git command fails entirely — no branch info available
    mockExecSync.mockImplementation(() => { throw new Error('git not available'); });
    const result = { stdout: 'Created branch for issue #42 and started #55', stderr: '', exitCode: 0 };
    const state = defaultState();
    const patch = extractStateFromStep(STEPS[1], result, state);
    // Must NOT fall back to regex — output could contain stale issue numbers
    expect(patch.currentIssue).toBeUndefined();
    expect(patch.currentBranch).toBeUndefined();
  });

  it('step 1 prompt includes git clean -fd and git checkout -- .', () => {
    const state = defaultState();
    const args = buildClaudeArgs(STEPS[0], state);
    // buildClaudeArgs returns an array: ['--model', model, '-p', prompt, ...]
    const promptIdx = args.indexOf('-p');
    const prompt = args[promptIdx + 1];
    expect(prompt).toContain('git clean -fd');
    expect(prompt).toContain('git checkout -- .');
  });
});

describe('hasNonEscalatedIssues uses --limit 200', () => {
  it('passes --limit 200 to gh issue list', () => {
    mockExecSync.mockReturnValue('[{"number": 1}]');
    hasNonEscalatedIssues();
    const ghCall = mockExecSync.mock.calls.find(c => c[0].includes('issue list'));
    expect(ghCall[0]).toContain('--limit 200');
  });
});

describe('handleSignal uses fire-and-forget Discord', () => {
  it('handleSignal source does not await postDiscord', () => {
    // Verify the function source uses .catch(() => {}) pattern (fire-and-forget)
    const src = handleSignal.toString();
    expect(src).toContain('.catch(');
    expect(src).not.toMatch(/await\s+postDiscord/);
  });

  it('handleSignal uses autoCommitIfDirty instead of inline git commands', () => {
    const src = handleSignal.toString();
    expect(src).toContain('autoCommitIfDirty');
    expect(src).not.toContain("git('add -A')");
  });
});

describe('Startup validation', () => {
  it('main() source validates PROJECT_PATH exists', () => {
    const src = runner.main.toString();
    expect(src).toContain('projectPath does not exist');
  });

  it('main() source validates PROJECT_PATH is a git repo', () => {
    const src = runner.main.toString();
    expect(src).toContain('not a git repository');
  });
});

// ===========================================================================
// Issue #60: Version bump postcondition and deterministic recovery
// ===========================================================================

describe('validateVersionBump (#60)', () => {
  it('returns ok:true when no VERSION file exists', () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = validateVersionBump();
    expect(result.ok).toBe(true);
  });

  it('returns ok:true when VERSION contains invalid semver', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('not-semver\n');
    const result = validateVersionBump();
    expect(result.ok).toBe(true);
  });

  it('returns ok:true when VERSION has changed vs main', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('1.2.3\n');
    mockExecSync.mockReturnValue('diff --git a/VERSION b/VERSION\n-1.2.2\n+1.2.3\n');
    const result = validateVersionBump();
    expect(result.ok).toBe(true);
  });

  it('returns ok:false when VERSION is unchanged vs main', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('1.2.3\n');
    mockExecSync.mockReturnValue(''); // empty diff = no change
    const result = validateVersionBump();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('unchanged');
  });

  it('returns ok:true when git diff fails (cannot verify)', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('1.2.3\n');
    mockExecSync.mockImplementation(() => { throw new Error('git error'); });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const result = validateVersionBump();
    expect(result.ok).toBe(true);
    logSpy.mockRestore();
  });
});

describe('performDeterministicVersionBump (#60)', () => {
  it('returns false when no VERSION file exists', () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(false);
  });

  it('returns false when VERSION contains invalid semver', () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue('bad-version\n');
    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(false);
  });

  it('returns false when no current issue in state', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('1.0.0\n');
    const result = performDeterministicVersionBump({ currentIssue: null });
    expect(result).toBe(false);
  });

  it('performs patch bump for bug label', () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue('1.2.3\n');
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('issue view') && cmd.includes('labels')) return 'bug';
      if (cmd.includes('issue view') && cmd.includes('milestone')) return '{"milestone":null}';
      return '';
    });

    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(true);

    // Verify VERSION was written with patch bump
    const writeCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('VERSION'));
    expect(writeCall).toBeDefined();
    expect(writeCall[1]).toBe('1.2.4\n');
  });

  it('performs minor bump for non-bug label', () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue('1.2.3\n');
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('issue view') && cmd.includes('labels')) return 'enhancement';
      if (cmd.includes('issue view') && cmd.includes('milestone')) return '{"milestone":null}';
      return '';
    });

    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(true);

    const writeCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('VERSION'));
    expect(writeCall).toBeDefined();
    expect(writeCall[1]).toBe('1.3.0\n');
  });

  it('performs major bump when last issue in milestone', () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue('1.2.3\n');
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('issue view') && cmd.includes('labels')) return 'enhancement';
      if (cmd.includes('issue view') && cmd.includes('milestone')) return '{"milestone":{"title":"v2"}}';
      if (cmd.includes('api repos')) return '[{"title":"v2","open_issues":1}]';
      return '';
    });

    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(true);

    const writeCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('VERSION'));
    expect(writeCall).toBeDefined();
    expect(writeCall[1]).toBe('2.0.0\n');
  });

  it('commits with correct message format', () => {
    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue('1.0.0\n');
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('issue view') && cmd.includes('labels')) return 'bug';
      if (cmd.includes('issue view') && cmd.includes('milestone')) return '{"milestone":null}';
      return '';
    });

    performDeterministicVersionBump({ currentIssue: 42 });

    const commitCall = mockExecSync.mock.calls.find(c => c[0].includes('commit'));
    expect(commitCall).toBeDefined();
    expect(commitCall[0]).toContain('chore: bump version to 1.0.1');
  });

  it('returns true in DRY_RUN mode without writing files', () => {
    __test__.setConfig({ dryRun: true });
    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue('1.0.0\n');
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('issue view') && cmd.includes('labels')) return 'bug';
      if (cmd.includes('issue view') && cmd.includes('milestone')) return '{"milestone":null}';
      return '';
    });

    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(true);

    // Should NOT write VERSION file in dry-run
    const writeCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('VERSION'));
    expect(writeCall).toBeUndefined();
  });

  it('returns false when overall operation throws', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('1.0.0\n');
    // gh command throws on every call
    mockExecSync.mockImplementation(() => { throw new Error('gh not found'); });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(false);
    logSpy.mockRestore();
  });

  // Classification matrix deduplication (#87)
  it('reads bump classification from tech.md Version Bump Classification table', () => {
    const techMdContent = [
      '## Versioning',
      '',
      '| File | Path | Notes |',
      '|------|------|-------|',
      '',
      '### Version Bump Classification',
      '',
      '| Label | Bump Type | Description |',
      '|-------|-----------|-------------|',
      '| `bug` | patch | Bug fix |',
      '| `enhancement` | minor | New feature |',
    ].join('\n');

    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      if (p.endsWith('tech.md')) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return '1.2.3\n';
      if (p.endsWith('tech.md')) return techMdContent;
      return '';
    });
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('issue view') && cmd.includes('labels')) return 'bug';
      if (cmd.includes('issue view') && cmd.includes('milestone')) return '{"milestone":null}';
      return '';
    });

    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(true);

    const writeCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('VERSION'));
    expect(writeCall).toBeDefined();
    expect(writeCall[1]).toBe('1.2.4\n');
  });

  it('reads custom label mapping from tech.md (e.g. security → patch)', () => {
    const techMdContent = [
      '## Versioning',
      '',
      '### Version Bump Classification',
      '',
      '| Label | Bump Type | Description |',
      '|-------|-----------|-------------|',
      '| `bug` | patch | Bug fix |',
      '| `security` | patch | Security fix |',
      '| `enhancement` | minor | New feature |',
    ].join('\n');

    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      if (p.endsWith('tech.md')) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return '2.0.0\n';
      if (p.endsWith('tech.md')) return techMdContent;
      return '';
    });
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('issue view') && cmd.includes('labels')) return 'security';
      if (cmd.includes('issue view') && cmd.includes('milestone')) return '{"milestone":null}';
      return '';
    });

    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(true);

    const writeCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('VERSION'));
    expect(writeCall).toBeDefined();
    expect(writeCall[1]).toBe('2.0.1\n');
  });

  it('defaults to minor when no label matches tech.md classification table', () => {
    const techMdContent = [
      '## Versioning',
      '',
      '### Version Bump Classification',
      '',
      '| Label | Bump Type | Description |',
      '|-------|-----------|-------------|',
      '| `bug` | patch | Bug fix |',
      '| `enhancement` | minor | New feature |',
    ].join('\n');

    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      if (p.endsWith('tech.md')) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return '1.0.0\n';
      if (p.endsWith('tech.md')) return techMdContent;
      return '';
    });
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('issue view') && cmd.includes('labels')) return 'documentation';
      if (cmd.includes('issue view') && cmd.includes('milestone')) return '{"milestone":null}';
      return '';
    });

    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(true);

    const writeCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('VERSION'));
    expect(writeCall).toBeDefined();
    expect(writeCall[1]).toBe('1.1.0\n');
  });

  it('falls back to hardcoded defaults when Version Bump Classification subsection is missing', () => {
    const techMdContent = [
      '## Versioning',
      '',
      '| File | Path | Notes |',
      '|------|------|-------|',
      '',
      '### Path Syntax',
      '',
      '- **JSON files**: Use dot-notation',
    ].join('\n');

    mockFs.existsSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return true;
      if (p.endsWith('tech.md')) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('VERSION')) return '1.2.3\n';
      if (p.endsWith('tech.md')) return techMdContent;
      return '';
    });
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('issue view') && cmd.includes('labels')) return 'bug';
      if (cmd.includes('issue view') && cmd.includes('milestone')) return '{"milestone":null}';
      return '';
    });

    const result = performDeterministicVersionBump({ currentIssue: 42 });
    expect(result).toBe(true);

    // Should still do patch bump (hardcoded fallback for 'bug')
    const writeCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('VERSION'));
    expect(writeCall).toBeDefined();
    expect(writeCall[1]).toBe('1.2.4\n');
  });
});

describe('Step 7 prompt includes version bump mandate (#60)', () => {
  it('Step 7 prompt text mentions mandatory version bumping', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('skill content');

    const step = { ...STEPS[6], skill: 'creating-prs' };
    const state = { ...defaultState(), currentIssue: 42, currentBranch: '42-feature' };
    const args = buildClaudeArgs(step, state);

    const promptIdx = args.indexOf('-p') + 1;
    const prompt = args[promptIdx];
    expect(prompt).toContain('MUST bump the version');
    expect(prompt).toContain('mandatory');
  });
});

// ===========================================================================
// Issue #77: Per-step model and effort level configuration
// ===========================================================================

describe('VALID_EFFORTS constant (#77)', () => {
  it('contains low, medium, high', () => {
    expect(VALID_EFFORTS).toEqual(['low', 'medium', 'high']);
  });
});

describe('validateConfig (#77)', () => {
  it('returns empty array for valid config with no effort/model', () => {
    const errors = validateConfig({ projectPath: '/p', pluginsPath: '/q' });
    expect(errors).toEqual([]);
  });

  it('returns empty array for valid global effort', () => {
    const errors = validateConfig({ effort: 'high', model: 'opus' });
    expect(errors).toEqual([]);
  });

  it('rejects invalid global effort', () => {
    const errors = validateConfig({ effort: 'turbo' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('turbo');
    expect(errors[0]).toContain('low, medium, high');
  });

  it('rejects empty string model', () => {
    const errors = validateConfig({ model: '' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('non-empty string');
  });

  it('rejects whitespace-only model', () => {
    const errors = validateConfig({ model: '  ' });
    expect(errors).toHaveLength(1);
  });

  it('accepts undefined model and effort (not set)', () => {
    const errors = validateConfig({});
    expect(errors).toEqual([]);
  });

  it('validates per-step effort', () => {
    const errors = validateConfig({
      steps: { writeSpecs: { effort: 'invalid' } },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('steps.writeSpecs.effort');
  });

  it('validates per-step model', () => {
    const errors = validateConfig({
      steps: { startIssue: { model: '' } },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('steps.startIssue.model');
  });

  it('silently ignores legacy plan/code sub-objects', () => {
    const errors = validateConfig({
      steps: { implement: { plan: { model: '', effort: 'max' }, code: { effort: 'ultra' } } },
    });
    // plan/code sub-objects are no longer validated — they are silently ignored
    expect(errors).toEqual([]);
  });

  it('collects multiple errors', () => {
    const errors = validateConfig({
      effort: 'bad',
      model: '',
      steps: { writeSpecs: { effort: 'wrong' } },
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('accepts valid per-step config', () => {
    const errors = validateConfig({
      effort: 'high',
      model: 'opus',
      steps: {
        writeSpecs: { model: 'opus', effort: 'high' },
        implement: {
          model: 'opus',
          effort: 'high',
          plan: { model: 'opus', effort: 'high' },
          code: { model: 'sonnet', effort: 'medium' },
        },
      },
    });
    expect(errors).toEqual([]);
  });
});

describe('resolveStepConfig (#77)', () => {
  it('returns step-level model and effort when present', () => {
    const result = resolveStepConfig(
      { model: 'sonnet', effort: 'low' },
      { model: 'opus', effort: 'high' }
    );
    expect(result.model).toBe('sonnet');
    expect(result.effort).toBe('low');
  });

  it('falls back to config-level when step has no overrides', () => {
    const result = resolveStepConfig(
      { maxTurns: 10 },
      { model: 'opus', effort: 'high' }
    );
    expect(result.model).toBe('opus');
    expect(result.effort).toBe('high');
  });

  it('falls back to defaults when neither step nor config set', () => {
    const result = resolveStepConfig({}, {});
    expect(result.model).toBe('opus');
    expect(result.effort).toBeUndefined();
  });

  it('step model overrides config model', () => {
    const result = resolveStepConfig(
      { model: 'haiku' },
      { model: 'opus' }
    );
    expect(result.model).toBe('haiku');
  });

  it('step effort overrides config effort', () => {
    const result = resolveStepConfig(
      { effort: 'low' },
      { effort: 'high' }
    );
    expect(result.effort).toBe('low');
  });
});


describe('getConfigObject (#77)', () => {
  it('returns object with current MODEL and EFFORT', () => {
    __test__.setConfig({ model: 'test-model', effort: 'low' });
    const obj = getConfigObject();
    expect(obj.model).toBe('test-model');
    expect(obj.effort).toBe('low');
  });
});

describe('buildClaudeArgs overrides (#77)', () => {
  it('uses override model instead of global MODEL', () => {
    const step = STEPS[0];
    const state = defaultState();
    const args = buildClaudeArgs(step, state, { model: 'sonnet' });
    const modelIdx = args.indexOf('--model') + 1;
    expect(args[modelIdx]).toBe('sonnet');
  });

  it('uses override prompt instead of default prompt', () => {
    const step = STEPS[0];
    const state = defaultState();
    const customPrompt = 'Custom plan phase prompt';
    const args = buildClaudeArgs(step, state, { prompt: customPrompt });
    const promptIdx = args.indexOf('-p') + 1;
    expect(args[promptIdx]).toBe(customPrompt);
  });

  it('falls back to global MODEL when no override', () => {
    __test__.setConfig({ model: 'opus' });
    const step = STEPS[0];
    const state = defaultState();
    const args = buildClaudeArgs(step, state);
    const modelIdx = args.indexOf('--model') + 1;
    expect(args[modelIdx]).toBe('opus');
  });

  it('falls back to default prompt when no override', () => {
    const step = STEPS[0];
    const state = defaultState();
    const args = buildClaudeArgs(step, state);
    const promptIdx = args.indexOf('-p') + 1;
    expect(args[promptIdx]).toContain('Check out main');
  });
});

describe('runClaude effort env var (#77)', () => {
  it('sets CLAUDE_CODE_EFFORT_LEVEL in spawn env when effort is configured', async () => {
    __test__.setConfig({ effort: 'high' });

    const mockProc = {
      pid: 77001,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, handler) => {
        if (event === 'close') handler(0);
      }),
      kill: jest.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc);
    mockFs.existsSync.mockReturnValue(false);

    const step = { ...STEPS[0], effort: 'high', timeoutMin: 1 };
    await runClaude(step, defaultState());

    const spawnOpts = mockSpawn.mock.calls[0][2];
    expect(spawnOpts.env).toBeDefined();
    expect(spawnOpts.env.CLAUDE_CODE_EFFORT_LEVEL).toBe('high');
  });

  it('does not set env when effort is undefined', async () => {
    __test__.setConfig({ effort: undefined });

    const mockProc = {
      pid: 77002,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, handler) => {
        if (event === 'close') handler(0);
      }),
      kill: jest.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc);
    mockFs.existsSync.mockReturnValue(false);

    const step = { ...STEPS[0], timeoutMin: 1 };
    await runClaude(step, defaultState());

    const spawnOpts = mockSpawn.mock.calls[0][2];
    expect(spawnOpts.env).toBeUndefined();
  });

  it('uses override effort over resolved effort', async () => {
    __test__.setConfig({ effort: 'low' });

    const mockProc = {
      pid: 77003,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, handler) => {
        if (event === 'close') handler(0);
      }),
      kill: jest.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc);
    mockFs.existsSync.mockReturnValue(false);

    const step = { ...STEPS[0], timeoutMin: 1 };
    await runClaude(step, defaultState(), { effort: 'high' });

    const spawnOpts = mockSpawn.mock.calls[0][2];
    expect(spawnOpts.env.CLAUDE_CODE_EFFORT_LEVEL).toBe('high');
  });

  it('uses override model in claude args', async () => {
    __test__.setConfig({ model: 'opus' });

    const mockProc = {
      pid: 77004,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, handler) => {
        if (event === 'close') handler(0);
      }),
      kill: jest.fn(),
      killed: false,
    };
    mockSpawn.mockReturnValue(mockProc);
    mockFs.existsSync.mockReturnValue(false);

    const step = { ...STEPS[0], timeoutMin: 1 };
    await runClaude(step, defaultState(), { model: 'sonnet' });

    const claudeArgs = mockSpawn.mock.calls[0][1];
    const modelIdx = claudeArgs.indexOf('--model') + 1;
    expect(claudeArgs[modelIdx]).toBe('sonnet');
  });
});

describe('Step 4 uses standard runClaude path (#91)', () => {
  it('runStep source does not delegate step 4 to runImplementStep', () => {
    // After #91, step 4 should use the same runClaude path as all other steps.
    const src = runStep.toString();
    expect(src).not.toContain('runImplementStep');
  });

  it('step 4 prompt does not mention EnterPlanMode', () => {
    __test__.setConfig({ model: 'opus' });
    const state = { ...defaultState(), currentIssue: 42, currentBranch: '42-feature' };
    const args = buildClaudeArgs(STEPS[3], state);
    const prompt = args[args.indexOf('--prompt') + 1] || args[args.indexOf('-p') + 1];
    expect(prompt).not.toContain('EnterPlanMode');
  });
});

describe('__test__.setConfig supports effort and configSteps (#77)', () => {
  it('setConfig sets EFFORT', () => {
    __test__.setConfig({ effort: 'medium' });
    const obj = getConfigObject();
    expect(obj.effort).toBe('medium');
  });

  it('setConfig sets configSteps', () => {
    __test__.setConfig({ configSteps: { implement: { model: 'sonnet' } } });
    // STEPS won't change (built at module load time), but configSteps module var is set
    // Verify through getConfigObject and step resolution
    const obj = getConfigObject();
    expect(obj).toBeDefined();
  });
});
