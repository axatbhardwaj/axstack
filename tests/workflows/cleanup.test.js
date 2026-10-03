import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

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

const skill = () => read('skills/axstack-cleanup/SKILL.md');
const pins = [
  "Never clean a user-created thread, the current driver, a user-taken-over thread, an active or unknown worker, an unsettled descendant, or a resource with ambiguous ownership.",
  "Preserve unknown files, unmerged author work, ambiguous publication, and evidence that has not been durably preserved.",
  "Archive success proves only preservation of the listed bytes; it does not prove settlement, liveness, ownership, a clean worktree, publication, or removal safety.",
  "Keep an author worktree until its PR merges or closes.",
  "For a settled reviewer task, its checkout can be retired while the PR remains open, before merge, after its report and supporting evidence are archived privately and read back.",
  "Require `git status --porcelain=v1 -z --untracked-files=all` to show all dirt as untracked files inside a run-owned scratch prefix.",
  "Prove every remaining untracked file individually belongs to one of those named run-owned scratch prefixes; any tracked, staged, unmerged or unpushed work, dirty source, or dirt outside them enters the salvage check above or holds.",
  "Inspect every descendant for symlinks, hard links, special files, unknown content, user-owned files, or ignored files; any mismatch holds.",
  "For each prefix, perform an exact-path dry-run and exact-path deletion separately.",
  "Immediately before each deletion, including each next deletion, re-read the compact receipt, complete Git status with whole-worktree dirt and ignored files, every remaining prefix inventory, and native ownership and liveness.",
  "Never use `-x`, a glob, a repository-root target, extra force, or broad clean.",
  "Use no unresolved variable as a destructive target.",
  "Require final clean Git status before exact `git worktree remove <path>` without force.",
  "Never delete the author branch or use generic force."
];
// Safety contracts are exact text; changes require deliberate test edits.
const restoredCleanupPins = [
  "A raw reviewer report may be discarded after its verdict and limitations are compacted into that read-back receipt;",
  "use the private evidence archive for the report and supporting evidence.",
  "Preserve the separate author candidate with useful unmerged work; reviewer cleanup never removes it.",
  "Multiple tasks in the same reviewer worktree are recovery for missed earlier cleanup; after independent archives and readback, use per-prefix removal.",
  "Two or more review passes in the same reviewer worktree may leave distinct prefixes; each named run-owned scratch prefix must belong to an accepted settled task in the run.",
  "Check ignored files across the whole worktree too; classified ignored non-cache content enters the verified salvage path, while unknown content holds.",
  "Compare its sole target to the classified directory; an empty, partial, or different result holds.",
  "Only unexpected changes hold.",
  "Recheck clean Git status after the last deletion.",
  "Never unlink through prose or a shell loop.",
];
for (const pin of [...pins, ...restoredCleanupPins]) test(`cleanup exact safety: ${pin}`, () => {
  const text = normalize(skill());
  expect(text).toContain(pin);
  expect(text.split(pin).length).toBe(2);
});
test('cleanup forbids recursive shell deletion', () => {
  expect(skill()).not.toMatch(/\brm\s+-r\b|\bfind\b[^\n]*-delete/);
});
const restoredRelatedPins = [
  ['skills/axstack/references/evidence-archive.md',
    'Completed non-author worktrees with dirty source or unpushed commits use the [Workspace hygiene](workspace-hygiene.md) salvage path before removal; this archive helper never treats source changes as evidence-only cleanup.'],
  ['skills/axstack/references/evidence-archive.md',
    'A user-created or user-taken-over thread, an active or unknown run, an unsettled descendant, ambiguous publication, or an unknown file remains protected.'],
  ['skills/axstack-implement/SKILL.md',
    'After each settled review, run `axstack-cleanup` for its exact reviewer resources before PR merge, preserving and reading back the private evidence archive before eligible worktree retirement.'],
];
for (const [path, pin] of restoredRelatedPins) test(`cleanup related exact safety: ${pin}`, () => {
  const text = normalize(read(path));
  expect(text).toContain(pin);
  expect(text.split(pin).length).toBe(2);
});
test('cleanup uses the shared T3 contract inline and separates operations', () => {
  for (const ref of ['contracts.md', 'lifecycle.md', 'routing.md', 't3-runtime.md', 'workspace-hygiene.md', 'evidence-archive.md']) {
    expect(skill()).toContain(`../axstack/references/${ref}`);
  }
  for (const operation of ['t3_thread_organize', 'git worktree remove', 'git branch -d']) expect(skill()).toContain(operation);
  expect(normalize(skill())).toContain('This skill never dispatches a cleanup worker');
  expect(normalize(skill())).toContain('manifest-bound retirement operation and require an empty pending set');
  expect(skill()).toContain('git clean -nd -- <exact reviewed scratch prefix>');
  expect(skill()).toContain('git clean -fd -- <same exact prefix>');
  expect(normalize(skill())).toContain('expected post-deletion state');
});
test('cleanup AC2 scenario pins author retention and ignored-content preservation', () => {
  const scenario = JSON.parse(read('tests/workflows/t3-recovery-scenarios.json')).cases.find(({ id }) => id === 'cleanup-unmerged-or-ignored-content');
  const text = normalize(read('skills/axstack/references/workspace-hygiene.md'));
  expect(scenario.contracts.length).toBe(7);
  for (const pin of scenario.contracts) {
    expect(text).toContain(pin);
    expect(text.split(pin).length).toBe(2);
  }
});
test('archive helper keeps exact identity, manifest, and per-prefix recovery guards', () => {
  const archive = normalize(read('skills/axstack/references/evidence-archive.md'));
  for (const pin of [
    'An unknown removal hook or a required hook whose provenance is not trusted holds removal; preserve the worktree.',
    'If either readback differs or is unavailable, preserve the worktree.',
    'Never replace either path with a shell loop, broad deletion, force, or a waiver.',
    'Any remaining or uncertain dirt holds worktree removal.',
  ]) {
    expect(archive).toContain(pin);
    expect(archive.split(pin).length).toBe(2);
  }
  expect(archive).toContain('another task');
  expect(archive).toContain('exact per-prefix dry-run');
  expect(archive).toContain('--manifest-hash <recorded-64-character-sha256>');
  expect(archive).toContain('--dispatch <exact-native-run-id>');
  expect(archive).toContain('Pass the delegated childRunId or launched runId to `--dispatch`, never the colon-separated attempt key.');
});
