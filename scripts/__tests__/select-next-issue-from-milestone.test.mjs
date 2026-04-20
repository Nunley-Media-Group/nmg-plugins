/**
 * Unit tests for selectNextIssueFromMilestone()
 *
 * Derived from: specs/feature-add-first-class-epic-support-and-multi-pr-delivery-flow-to-nmg-sdlc/
 * Issue: #149
 *
 * The function is pure — it takes an injectable `ghRunner` so tests feed
 * deterministic responses without touching the real GitHub CLI.
 */

import { jest } from '@jest/globals';

const runner = await import('../sdlc-runner.mjs');
const { selectNextIssueFromMilestone } = runner;

/**
 * Build a mock `ghRunner` that responds to `issue list` with the given list
 * and `issue view <N>` with per-issue details. Unknown commands throw.
 */
function makeGhRunner({ list, details }) {
  return (cmd) => {
    if (cmd.startsWith('issue list')) {
      return JSON.stringify(list.map((n) => ({ number: n })));
    }
    const viewMatch = cmd.match(/^issue view (\d+)\b/);
    if (viewMatch) {
      const n = Number(viewMatch[1]);
      const d = details[n];
      if (!d) throw new Error(`unexpected view for #${n}`);
      return JSON.stringify({
        number: n,
        state: d.state || 'OPEN',
        body: d.body || '',
        parent: d.parent || null,
        closedByPullRequestsReferences: d.prs || [],
      });
    }
    throw new Error(`unexpected gh call: ${cmd}`);
  };
}

describe('selectNextIssueFromMilestone', () => {
  test('returns lowest-numbered issue when all candidates are ready', () => {
    const ghRunner = makeGhRunner({
      list: [42, 7, 100],
      details: {
        7: {},
        42: {},
        100: {},
      },
    });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    expect(result.issue).toBe(7);
    expect(result.blockedIssues).toEqual([]);
  });

  test('returns null and blockedIssues when every candidate is blocked', () => {
    const ghRunner = makeGhRunner({
      list: [1, 2],
      details: {
        1: { body: 'Depends on: #2' },
        2: { body: 'Depends on: #1' },
      },
    });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    expect(result.issue).toBeNull();
    expect(result.blockedIssues).toEqual([
      { issue: 1, blockers: [2] },
      { issue: 2, blockers: [1] },
    ]);
  });

  test('skips blocked issue and returns next ready issue', () => {
    const ghRunner = makeGhRunner({
      list: [10, 20],
      details: {
        10: { body: 'Depends on: #20' }, // blocked (20 is open)
        20: {}, // ready
      },
    });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    expect(result.issue).toBe(20);
    expect(result.blockedIssues).toEqual([{ issue: 10, blockers: [20] }]);
  });

  test('treats CLOSED+merged dependency as satisfied', () => {
    const ghRunner = makeGhRunner({
      list: [10, 20],
      details: {
        10: { body: 'Depends on: #20' },
        20: { state: 'CLOSED', prs: [{ state: 'MERGED', mergedAt: '2026-04-19T00:00:00Z' }] },
      },
    });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    // 20 is CLOSED so it wouldn't be in list anymore; this test covers the
    // case where it still appears (edge case where the gh list includes a
    // just-closed issue). Both should be ready.
    expect(result.issue).toBe(10);
    expect(result.blockedIssues).toEqual([]);
  });

  test('treats in-pool CLOSED-without-merged-PR dependency as NOT satisfied', () => {
    const ghRunner = makeGhRunner({
      list: [10, 20],
      details: {
        10: { body: 'Depends on: #20' },
        20: { state: 'CLOSED', prs: [] }, // closed but no merged PR — #10 still blocked
      },
    });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    // #20 has no deps so it's ready on its own; #10 is blocked because #20 closed without a merged PR.
    expect(result.issue).toBe(20);
    expect(result.blockedIssues).toEqual([{ issue: 10, blockers: [20] }]);
  });

  test('dependency outside milestone pool is treated as external/satisfied', () => {
    const ghRunner = makeGhRunner({
      list: [10],
      details: {
        10: { body: 'Depends on: #999' }, // #999 not in pool
      },
    });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    expect(result.issue).toBe(10);
    expect(result.blockedIssues).toEqual([]);
  });

  test('GitHub sub-issue parent field counts as a dependency', () => {
    const ghRunner = makeGhRunner({
      list: [10, 20],
      details: {
        10: { parent: { number: 20 } }, // parent is 20, in-pool, not merged → blocked
        20: {},
      },
    });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    expect(result.issue).toBe(20);
    expect(result.blockedIssues).toEqual([{ issue: 10, blockers: [20] }]);
  });

  test('"Blocks:" body lines also produce dependency edges', () => {
    const ghRunner = makeGhRunner({
      list: [10, 20],
      details: {
        10: { body: 'Blocks: #20' }, // 10 blocks 20 → 10 depends on 20 via regex
        20: {},
      },
    });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    // Regex treats Blocks and Depends on uniformly — #10's body cross-ref to #20 means #10 won't be picked until #20 merges.
    expect(result.issue).toBe(20);
    expect(result.blockedIssues).toEqual([{ issue: 10, blockers: [20] }]);
  });

  test('excluded issues are filtered before dependency graph is built', () => {
    const ghRunner = makeGhRunner({
      list: [10, 20],
      details: {
        10: {},
        20: {},
      },
    });
    const result = selectNextIssueFromMilestone('M1', {
      ghRunner,
      excluded: new Set([10]),
    });
    expect(result.issue).toBe(20);
    expect(result.blockedIssues).toEqual([]);
  });

  test('self-references in Depends on body are ignored', () => {
    const ghRunner = makeGhRunner({
      list: [10],
      details: {
        10: { body: 'Depends on: #10' }, // self-ref → ignored
      },
    });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    expect(result.issue).toBe(10);
    expect(result.blockedIssues).toEqual([]);
  });

  test('empty milestone returns {issue:null, blockedIssues:[]}', () => {
    const ghRunner = makeGhRunner({ list: [], details: {} });
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    expect(result.issue).toBeNull();
    expect(result.blockedIssues).toEqual([]);
  });

  test('throws when gh issue list fails', () => {
    const ghRunner = () => { throw new Error('gh auth failed'); };
    expect(() => selectNextIssueFromMilestone('M1', { ghRunner }))
      .toThrow(/Failed to list milestone issues/);
  });

  test('per-issue fetch failure excludes the issue from the ready set', () => {
    let call = 0;
    const ghRunner = (cmd) => {
      if (cmd.startsWith('issue list')) return JSON.stringify([{ number: 10 }, { number: 20 }]);
      call++;
      if (call === 1) throw new Error('gh rate-limited');
      return JSON.stringify({ number: 20, state: 'OPEN', body: '', parent: null, closedByPullRequestsReferences: [] });
    };
    const result = selectNextIssueFromMilestone('M1', { ghRunner });
    // #10 fetch failed → treated as blocked (not ready); #20 ready.
    expect(result.issue).toBe(20);
    expect(result.blockedIssues).toEqual([{ issue: 10, blockers: [], reason: 'fetch-failed' }]);
  });

  test('milestone name with quotes is single-quoted-escaped in list command', () => {
    const seen = [];
    const ghRunner = (cmd) => {
      seen.push(cmd);
      if (cmd.startsWith('issue list')) return '[]';
      throw new Error('unexpected');
    };
    selectNextIssueFromMilestone("Sprint 'Q2'", { ghRunner });
    // shellEscape wraps in single quotes and escapes embedded single quotes via '\''
    expect(seen[0]).toContain(`'Sprint '\\''Q2'\\'''`);
  });

  test('null milestone omits -m flag for repo-wide selection', () => {
    const seen = [];
    const ghRunner = (cmd) => {
      seen.push(cmd);
      if (cmd.startsWith('issue list')) return '[]';
      throw new Error('unexpected');
    };
    selectNextIssueFromMilestone(null, { ghRunner });
    expect(seen[0]).not.toContain('-m');
    expect(seen[0]).toContain('--label automatable');
  });
});
