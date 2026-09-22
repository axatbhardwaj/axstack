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

test('cleanup binds archived evidence retirement and native hook trust', () => {
  const skill = read('skills/axstack-cleanup/SKILL.md');
  expect(skill).toMatch(/manifest-bound retirement[^.]*empty pending set/i);
  expect(skill).toMatch(/Archive Script[^.]*unknown[^.]*untrusted[^.]*holds/i);
  for (const outcome of ['unconfigured', 'passed', 'failed', 'unknown']) expect(skill).toContain(`\`${outcome}\``);
  expect(skill).toMatch(/never[^.]*shell loop/i);
  expect(skill).not.toMatch(/\bgit clean\b|\brm\s+-rf\b|\bfind\b[^\n]*-delete/);
});

test('merged-run reviewer scratch needs a durable receipt and exact-path removal', () => {
  const skill = read('skills/axstack-cleanup/SKILL.md');
  const receipt = skill.match(/For a settled merged run[\s\S]*?(?=\n\nUse only a named)/)?.[0];
  expect(receipt).toBeString();
  expect(receipt).toMatch(/forge[^.]*confirmed/is);
  expect(receipt).toMatch(/reviewer\s+scratch[^.]*disposable/is);
  for (const detail of [
    'exact head SHA', 'base SHA', 'review verdict', 'limitations',
    'test and CI result pointers', 'user authorization', 'scope',
  ]) expect(receipt).toContain(detail);
  expect(receipt).toMatch(/raw reviewer report[^.]*discard/is);
  expect(receipt).toMatch(/private evidence archive[^.]*unique evidence/is);
  expect(skill).toMatch(/git status --porcelain=v1 -z --untracked-files=all/);
  expect(skill).toMatch(/all dirt[^.]*run-owned scratch prefix/is);
  expect(skill).toMatch(/symlinks[^.]*special files[^.]*unknown content/is);
  expect(skill).toMatch(/dry-run[^.]*exact scoped path/is);
  expect(skill).toContain('rm -r -- "$scratch_dir"');
  expect(skill).toMatch(/recheck[^.]*clean (?:Git )?status/is);
  expect(skill).toMatch(/never[^.]*repository-root target/is);
  expect(skill).not.toMatch(/nonrecursive\s+exact-path unlink|\bgit clean\b|\brm\s+-rf\b/);
  expect(skill).toMatch(/unmerged[^.]*unpushed[^.]*dirty source/is);
  expect(skill).toMatch(/unknown content[^.]*user-owned files/is);
  expect(skill).toMatch(/active[^.]*user_takeover/is);
});
