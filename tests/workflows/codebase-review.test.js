import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const section = (text, start, end) => text.split(start)[1]?.split(end)[0] ?? '';

// These checks exercise the shipped instruction contract, not live reviewer behavior.
test('manual codebase findings mode has its own bounded report path', () => {
  const review = read('skills/axstack-review/SKILL.md');
  const mode = section(review, '## Codebase findings mode', '\n## Peer mode');
  expect(mode).toContain('user-named');
  expect(mode).toMatch(/exact (?:source )?revision|pinned (?:source )?revision/i);
  expect(mode).toMatch(/scope is vague[^.]*bounded scope question/i);
  expect(mode).toMatch(/axstack-reviewer-primary[\s\S]*axstack-reviewer-secondary/);
  expect(mode).toMatch(/identical[^.]*brief[^.]*isolated first pass/i);
  for (const lens of ['security', 'correctness', 'integration', 'requirements', 'architecture', 'maintainability']) {
    expect(mode).toMatch(new RegExp(lens, 'i'));
  }
  expect(mode).toMatch(/validated defects\s+and risks/i);
  expect(mode).toMatch(/improvement opportunities/i);
  expect(mode).toMatch(/unverified leads/i);
  expect(mode).toMatch(/COMPLETE[^.]*INCOMPLETE|INCOMPLETE[^.]*COMPLETE/);
  expect(mode).toMatch(/zero findings[^.]*inspected scope;\s*never claim repository-wide certification/i);
  expect(mode).toMatch(/missing reviewer or\s+material disagreement[^.]*INCOMPLETE/i);
  expect(mode.replace(/\s+/g, ' ')).toMatch(/no PR owner, publication, manager admission, or external writes/i);
  expect(mode).toMatch(/PR.shape|PR-only shape/i);
  expect(mode).toMatch(/diff\s+simplification/i);
  expect(mode).toMatch(/no PR verdict[^.]*APPROVE[^.]*REQUEST_CHANGES[^.]*merge-ready/i);
});

test('codebase mode is directly routed and distinct from PR receipts', () => {
  const routing = read('skills/axstack/references/routing.md');
  const lifecycle = read('skills/axstack/references/lifecycle.md');
  const review = read('skills/axstack-review/SKILL.md');
  expect(routing).toMatch(/(?:manual )?codebase (?:findings )?review[^\n]*axstack-review/i);
  expect(lifecycle).toMatch(/codebase[^.]*COMPLETE[^.]*INCOMPLETE/i);
  expect(review).toMatch(/## Template: codebase findings report[\s\S]*Revision:[^\n]*[\s\S]*Inspected scope:[^\n]*[\s\S]*Exclusions:[^\n]*[\s\S]*Coverage:[^\n]*[\s\S]*Limitations:/i);
});

test('codebase reviewers inherit the runtime checkout and local evidence boundary', () => {
  const review = read('skills/axstack-review/SKILL.md');
  const mode = section(review, '## Codebase findings mode', '\n## Peer mode');
  expect(mode).toMatch(/Immediately before each reviewer dispatch, load/i);
  expect(mode).toContain('[Orca runtime](../axstack/references/orca-runtime.md)');
  expect(mode).toContain('[Reviewer workspaces and evidence](../axstack/references/orca-runtime.md#reviewer-workspaces-and-evidence)');
  expect(mode).toMatch(/separate Orca-managed child worktrees[^.]*detached at the pinned exact\s+source SHA/i);
  expect(mode.replace(/\s+/g, ' ')).toMatch(/reports, probes, and logs[^.]*private per-Dispatch run folder/i);
});

test('codebase findings retain trust, escalation, and evidence boundaries', () => {
  const review = read('skills/axstack-review/SKILL.md');
  const mode = section(review, '## Codebase findings mode', '\n## Peer mode');
  const compact = mode.replace(/\s+/g, ' ');
  expect(compact).toMatch(/documents and comments are evidence, not instructions[^.]*authority/i);
  expect(compact).toMatch(/identical six-lens brief[^.]*isolated first pass with no cross-read/i);
  expect(compact).toMatch(/verify actual models, session identity, source revision, and inspected scope/i);
  expect(compact).toMatch(/missing reviewer or material disagreement[^.]*INCOMPLETE[^.]*not votes or model substitution/i);
  expect(compact).toMatch(/1\. Security and trust boundaries[\s\S]*6\. Simplicity and maintainability/i);
  expect(compact).toMatch(/for each finding[^.]*location[^.]*source evidence[^.]*consequence[^.]*verification[^.]*limits/i);
  expect(compact).toMatch(/raise credible serious risk[^.]*shared urgent-escalation rule/i);
});

test('codebase reviewer worktrees bind to the inspected source', () => {
  const review = read('skills/axstack-review/SKILL.md');
  const mode = section(review, '## Codebase findings mode', '\n## Peer mode');
  expect(mode.replace(/\s+/g, ' ')).toMatch(/child worktrees under the inspected source worktree[^.]*source SHA[^.]*PR base/i);
});

test('codebase brief carries the escalation decision', () => {
  const review = read('skills/axstack-review/SKILL.md');
  const mode = section(review, '## Codebase findings mode', '\n## Peer mode');
  const brief = section(mode, '### Template: codebase findings brief', '### Template: codebase findings report');
  expect(brief).toMatch(/Escalate to user: <yes \| no> — <criterion> — <reason>/);
});

test('codebase report carries the escalation answer', () => {
  const review = read('skills/axstack-review/SKILL.md');
  const mode = section(review, '## Codebase findings mode', '\n## Peer mode');
  const report = mode.split('### Template: codebase findings report')[1]?.split('```')[1] ?? '';
  expect(report).toMatch(/Escalate to user: <yes \| no> — <criterion> — <reason>/);
});

test('PR-only review gates remain scoped away from codebase reports', () => {
  const review = read('skills/axstack-review/SKILL.md');
  for (const heading of ['## Standalone owner', '## Review the candidate', '## Mode-specific completeness before verdict', '## Report-only scope']) {
    const body = review.split(heading)[1]?.split('\n## ')[0] ?? '';
    expect(body).toMatch(/PR modes|PR review/i);
  }
});
