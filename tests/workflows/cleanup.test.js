import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

test('cleanup evaluator inputs are expectation-free independent-review briefs', () => {
  const data = JSON.parse(read('tests/workflows/cleanup-evaluator-inputs.json'));
  expect(data.version).toBe(1);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'accepted-completion-with-protected-neighbors',
    'settled-terminal-protected-worktree',
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

test('cleanup binds evidence retirement and native hook trust without shell deletion', () => {
  const skill = read('skills/axstack-cleanup/SKILL.md');
  expect(skill).toMatch(/manifest-bound retirement[^.]*empty pending set/i);
  expect(skill).toMatch(/Archive Script[^.]*unknown[^.]*untrusted[^.]*holds/i);
  for (const outcome of ['unconfigured', 'passed', 'failed', 'unknown']) expect(skill).toContain(`\`${outcome}\``);
  expect(skill).toMatch(/never[^.]*shell loop/i);
  expect(skill).not.toMatch(/\bgit clean\b|\brm\s+-r|\bfind\b[^\n]*-delete/);
});

test('merged-run reviewer scratch needs a durable receipt and exact-path removal', () => {
  const skill = read('skills/axstack-cleanup/SKILL.md');
  const receipt = skill.match(/For a settled merged run[\s\S]*?(?=\n\nClassify each proposed)/)?.[0];
  expect(receipt).toBeString();
  expect(receipt).toMatch(/forge[^.]*confirmed/is);
  expect(receipt).toMatch(/reviewer\s+scratch[^.]*disposable/is);
  for (const detail of [
    'exact head SHA', 'base SHA', 'review verdict', 'limitations',
    'test and CI result pointers', 'user authorization', 'scope',
  ]) expect(receipt).toContain(detail);
  expect(receipt).toMatch(/unique evidence[^.]*private evidence archive/is);
  expect(skill).toMatch(/exact-path dry-run[^.]*removal/is);
  expect(skill).toMatch(/re-read[^.]*before[^.]*unlink/is);
  expect(skill).toMatch(/dirty source[^.]*unmerged[^.]*unpushed/is);
  expect(skill).toMatch(/unknown[^.]*user-owned[^.]*active[^.]*user_takeover/is);
});
