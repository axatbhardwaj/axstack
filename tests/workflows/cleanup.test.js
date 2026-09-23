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
    'open-pr-settled-reviewer',
    'two-review-passes-one-checkout',
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

test('reviewer checkout with two passes requires per-file proof and per-prefix removal', () => {
  const skill = read('skills/axstack-cleanup/SKILL.md');
  const scratch = skill.match(/Use only a named run-owned scratch prefix[\s\S]*?(?=\n\n## Apply distinct native operations)/)?.[0];
  expect(scratch).toBeString();
  expect(scratch).toMatch(/two\s+or\s+more[^.]*review passes[^.]*same (?:reviewer )?worktree/is);
  expect(scratch).toMatch(/every (?:remaining )?untracked file[^.]*individually[^.]*named\s+run-owned scratch prefix/is);
  expect(scratch).toMatch(/each[^.]*prefix[^.]*settled Dispatch/is);
  expect(scratch).toMatch(/each[^.]*prefix[^.]*exact-path dry-run[^.]*exact-path deletion/is);
  expect(scratch).toMatch(/final clean (?:Git )?status[^.]*native\s+exact-workspace removal[^.]*without force/is);
  expect(scratch).toMatch(/expected\s+post-deletion state/is);
  expect(scratch).toMatch(/every remaining (?:proven )?prefix[^.]*inventory/is);
  expect(scratch).toMatch(/whole-worktree dirt[^.]*ignored files/is);
  expect(scratch).toMatch(/before each deletion[^.]*each next deletion[^.]*native ownership and liveness/is);
  expect(scratch).toMatch(/only unexpected changes[^.]*hold/is);
  expect(scratch).toMatch(/dirt outside (?:them|those prefixes) enters the salvage check above or holds/is);
  expect(scratch).toMatch(/ignored files across the whole\s+worktree too/is);
  expect(scratch).toMatch(/unknown or ignored non-cache content holds/is);
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
  expect(skill).toMatch(/manifest-bound retirement[^.]*empty\s+pending set/i);
  expect(skill).toMatch(/Archive Script[^.]*unknown[^.]*untrusted[^.]*holds/i);
  for (const outcome of ['unconfigured', 'passed', 'failed', 'unknown']) expect(skill).toContain(`\`${outcome}\``);
  expect(skill).toMatch(/never[^.]*shell loop/i);
  expect(skill).not.toMatch(/\brm\s+-r\b|\bfind\b[^\n]*-delete/);
});

test('settled reviewer scratch needs a durable receipt and exact-path removal', () => {
  const skill = read('skills/axstack-cleanup/SKILL.md');
  const receipt = skill.match(/For a settled reviewer Dispatch[\s\S]*?(?=\n\nUse only a named)/)?.[0];
  expect(receipt).toBeString();
  expect(receipt).toMatch(/PR remains open[^.]*before merge/is);
  expect(receipt).toMatch(/reviewer\s+scratch[^.]*disposable/is);
  for (const detail of [
    'exact head SHA', 'base SHA', 'review verdict', 'limitations',
    'test and CI result pointers', 'user authorization', 'scope',
  ]) expect(receipt).toContain(detail);
  expect(receipt).toMatch(/raw reviewer report[^.]*discard/is);
  expect(receipt).toMatch(/private evidence archive[^.]*report and supporting evidence/is);
  expect(skill).toMatch(/git status --porcelain=v1 -z --untracked-files=all/);
  expect(skill).toMatch(/all dirt[^.]*run-owned scratch prefix/is);
  expect(skill).toMatch(/symlinks[^.]*special files[^.]*unknown content/is);
  expect(skill).toMatch(/dry-run[^.]*exact scoped path/is);
  expect(skill).toContain('git clean -nd -- <exact reviewed scratch prefix>');
  expect(skill).toMatch(/sole target[^.]*classified directory/is);
  expect(skill).toContain('git clean -fd -- <same exact prefix>');
  expect(skill).toMatch(/recheck[^.]*clean (?:Git )?status/is);
  expect(skill).toMatch(/never[^.]*repository-root target/is);
  expect(skill).not.toMatch(/nonrecursive\s+exact-path unlink|\brm\s+-r\b|git clean[^`\n]*-x\b|git clean[^`\n]*-ff\b/);
  expect(skill).toMatch(/no unresolved variable[^.]*destructive target/is);
  expect(skill).toMatch(/unmerged[^.]*unpushed[^.]*dirty source/is);
  expect(skill).toMatch(/unknown content[^.]*user-owned\s+files/is);
  expect(skill).toMatch(/active[^.]*user_takeover/is);
});

test('shared reviewer evidence rules honor the guarded compact-receipt path', () => {
  const cleanup = read('skills/axstack-cleanup/SKILL.md');
  const runtime = read('skills/axstack/references/orca-runtime.md');
  const automations = read('skills/axstack/references/automations.md');
  expect(cleanup).toMatch(/settled reviewer Dispatch[\s\S]*?raw reviewer report may be discarded/is);
  expect(runtime).toMatch(/before removing a reviewer worktree[\s\S]*?private run evidence folder[\s\S]*?legacy in-worktree evidence[\s\S]*?settled reviewer Dispatch[\s\S]*?axstack-cleanup/is);
  expect(runtime).toMatch(/preserve\s+active[^.]*unknown[^.]*unique evidence/is);
  expect(automations).toMatch(/settled PR job[\s\S]*?private evidence archive[\s\S]*?read back[\s\S]*?axstack-cleanup/is);
  expect(automations).toMatch(/reviewer and PR-job worktrees in the same pass/is);
});

test('open PR reviewer retirement preserves the author and starts a fresh later review', () => {
  const cleanup = read('skills/axstack-cleanup/SKILL.md');
  const runtime = read('skills/axstack/references/orca-runtime.md');
  const archive = read('skills/axstack/references/evidence-archive.md');
  const implement = read('skills/axstack-implement/SKILL.md');
  expect(cleanup).toMatch(/reviewer worktree[^.]*PR remains open[^.]*before merge/is);
  expect(cleanup).toMatch(/preserve[^.]*author candidate[^.]*unmerged/is);
  expect(cleanup).toMatch(/each Dispatch archive[^.]*manifest readback/is);
  expect(cleanup).toMatch(/multiple\s+Dispatches[^.]*same reviewer worktree[^.]*per-prefix/is);
  expect(runtime).toMatch(/later review[^.]*fresh[^.]*child worktree/is);
  expect(runtime).not.toMatch(/Reuse that reviewer's own child/);
  expect(archive).toMatch(/another Dispatch's scratch[\s\S]*?per-prefix dry-run/is);
  expect(implement).toMatch(/after each[^.]*review[^.]*axstack-cleanup[^.]*before PR merge/is);
  expect(implement).toMatch(/author candidate[^.]*until[^.]*merge/is);
});

test('PR-job and reviewer cleanup archives and reads back evidence in the same pass', () => {
  const automations = read('skills/axstack/references/automations.md');
  const reviewerCleanup = automations.match(/For a settled PR job[\s\S]*?same pass\./)?.[0];
  expect(reviewerCleanup).toBeString();
  expect(reviewerCleanup).toMatch(/private evidence archive[\s\S]*read back[\s\S]*reviewer and PR-job worktrees/is);
  expect(automations).not.toMatch(/reviewer scratch may instead[^.]*compact receipt/is);
  expect(automations).toMatch(/merged or closed PR[^.]*never keep a job worktree/i);
});

test('removed reviewer checkout ref is deleted only with proven provenance and reachable tip', () => {
  const cleanup = read('skills/axstack-cleanup/SKILL.md');
  expect(cleanup).toMatch(/re-list both native workspaces\s+and Git refs[\s\S]*?Read back each remaining local review ref/is);
  expect(cleanup).toMatch(/unknown origin[^.]*unique commits[^.]*active\s+worktree[^.]*remote counterpart[^.]*preserved/is);
  expect(cleanup).toMatch(/created for the removed reviewer checkout[^.]*tip[^.]*reachable[^.]*preserved author candidate[^.]*confirmed remote PR\s+head/is);
  expect(cleanup).toMatch(/expected-old[^.]*ref deletion/is);
  expect(cleanup).toMatch(/never delete\s+the author branch[^.]*generic force/is);
});

test('finished non-author PR jobs can use verified salvage while genuine holds remain', () => {
  const manager = read('skills/axstack/references/automations.md');
  const archive = read('skills/axstack/references/evidence-archive.md');
  expect(manager).toMatch(/completed non-author\s+PR-job worktree[\s\S]*workspace-hygiene\.md[\s\S]*salvage/i);
  expect(manager).toMatch(/unknown liveness[^.]*user_takeover[^.]*ambiguous publication/i);
  expect(archive).toMatch(/completed non-author[\s\S]*workspace-hygiene\.md[\s\S]*salvage/i);
  expect(archive).toMatch(/ambiguous\s+publication[^.]*unknown file[^.]*protected/i);
});
