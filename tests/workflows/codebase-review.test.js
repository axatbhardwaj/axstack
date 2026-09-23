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
  expect(mode).toMatch(/zero findings[^.]*inspected scope/i);
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
