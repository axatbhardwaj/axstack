import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

test('cleanup evaluator inputs are expectation-free independent-review briefs', () => {
  const data = JSON.parse(read('tests/workflows/cleanup-evaluator-inputs.json'));
  expect(data.version).toBe(1);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'accepted-completion-with-protected-neighbors',
    'scoped-backlog-partial-inventory',
    'non-pr-evidence-preservation',
    'operation-boundaries-and-chat-history',
    'idempotent-retry-after-hook-failure',
  ]);
  for (const entry of data.cases) {
    expect(entry.title).toBeString();
    expect(entry.input.invocation).toBeString();
    expect(entry.input.request).toBeString();
    expect(entry.input.state).toBeString();
    for (const forbidden of ['expected', 'required', 'forbidden', 'verdict']) {
      expect(forbidden in entry).toBe(false);
    }
  }
});

test('cleanup loads shared policy and leaves runtime commands to discovered guides', () => {
  const skill = read('skills/axstack-cleanup/SKILL.md');
  for (const reference of [
    '../axstack/references/contracts.md',
    '../axstack/references/lifecycle.md',
    '../axstack/references/routing.md',
    '../axstack/references/orca-runtime.md',
    '../axstack/references/evidence-archive.md',
  ]) expect(skill).toContain(reference);
  expect(skill).not.toMatch(/orca orchestration (?:send|check|worker-release)|orca terminal close|orca worktree rm/);
});
