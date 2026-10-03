import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

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
for (const pin of pins) test(`cleanup exact safety: ${pin}`, () => {
  const text = normalize(skill());
  expect(text).toContain(pin);
  expect(text.replace(pin, '')).not.toContain(pin);
  expect(text.replace(pin, pin.replace(/^\S+/, '$& not'))).not.toContain(pin);
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
    expect(text.replace(pin, '')).not.toContain(pin);
    expect(text.replace(pin, pin.replace(/^\S+/, '$& not'))).not.toContain(pin);
  }
});
test('archive helper keeps exact identity, manifest, and per-prefix recovery guards', () => {
  const archive = normalize(read('skills/axstack/references/evidence-archive.md'));
  for (const pin of [
    'If either readback differs or is unavailable, preserve the worktree.',
    'Never replace either path with a shell loop, broad deletion, force, or a waiver.',
    'Any remaining or uncertain dirt holds worktree removal.',
  ]) {
    expect(archive).toContain(pin);
    expect(archive.replace(pin, '')).not.toContain(pin);
    expect(archive.replace(pin, pin.replace(/^\S+/, '$& not'))).not.toContain(pin);
  }
  expect(archive).toContain('another task');
  expect(archive).toContain('exact per-prefix dry-run');
  expect(archive).toContain('--manifest-hash <recorded-64-character-sha256>');
  expect(archive).toContain('--dispatch <exact-native-run-id>');
  expect(archive).toContain('Pass the delegated childRunId or launched runId to `--dispatch`, never the colon-separated attempt key.');
});
