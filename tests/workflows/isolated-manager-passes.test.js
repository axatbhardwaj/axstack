import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Source-contract regression checks, not model or live-runtime proof.
test('scheduled manager uses one dedicated workspace and finite fresh sessions', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toContain('native existing-workspace mode');
  expect(text).toContain('`--fresh-session`');
  expect(text).toContain('never `--reuse-session`');
  expect(text).toContain('A confirmed live manager for the same lane remains authoritative');
  expect(text).toContain('never checks out a PR branch');
  expect(compact('skills/axstack/references/review-manager-prompt.md')).toContain('dedicated existing Orca workspace');
  expect(text).not.toMatch(/new isolated workspace for every scheduled pass|repo-created worktree mode|terminal close --worktree|earlier pass workspaces/);
});

test('settled PR jobs release terminals and retire both worktree levels after archive', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toContain('worker-release');
  expect(text).toMatch(/private evidence archive[\s\S]*?read back[\s\S]*?axstack-cleanup[\s\S]*?reviewer and PR-job worktrees/i);
  expect(text).toMatch(/merged or closed PR[^.]*never[^.]*keep a job worktree/i);
  expect(text).toMatch(/dirty source[^.]*unpushed commits[^.]*`user_takeover`[^.]*unknown liveness[^.]*ambiguous publication/i);
});

test('continuity stays bounded and both command kinds use workspace-local TMPDIR', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/current lane state[^.]*open holds[^.]*watermarks[^.]*last pass summary/i);
  expect(text).toMatch(/older pass history[^.]*archive file beside[^.]*never re-read by default/i);
  expect(text).toMatch(/TMPDIR[^.]*manager and job commands[^.]*inside[^.]*owning workspace/i);
  expect(text).not.toMatch(/self-close|self-retirement|three-workspace threshold/);
});

test('manual invocations do not enter scheduled lifecycle', () => {
  for (const skill of ['review', 'watch']) {
    const text = read(`skills/axstack-${skill}/SKILL.md`);
    expect(text).toMatch(/Manual (review|watch) keeps the user’s chat and workspace open/);
  }
  expect(read('skills/axstack-watch/SKILL.md')).not.toMatch(/scheduled pass|watch-manager/i);
});
