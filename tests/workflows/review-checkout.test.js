import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const skillsDir = join(import.meta.dir, '..', '..', 'skills');
const read = (rel) => readFileSync(join(skillsDir, rel), 'utf8').replace(/\s+/g, ' ');

// Regression: review drivers satisfied "detached immutable checkout" with a
// `git clone` into a temp dir plus `orca repo add`, which registers a new
// top-level Orca repo per review and leaves stale records when /tmp is wiped.
test('review checkout: the immutable checkout is an Orca worktree of the registered repo, never a clone + repo add', () => {
  const pub = read('axstack/references/candidate-publication.md');
  const runtime = read('axstack/references/orca-runtime.md');

  expect(pub).toMatch(/immutable checkout[^.]*worktree[^.]*(already[- ]registered|registered|existing) repo/i);
  expect(pub).toMatch(/git checkout --detach/);
  expect(pub).toMatch(/never[^.]*(git clone|clone)[^.]*repo add/i);
  expect(pub).toMatch(/orca worktree rm|worktree rm/i);

  expect(runtime).toMatch(/worktree create[^.]*--repo/i);
  expect(runtime).toMatch(/repo add[^.]*(new|second|duplicate)[^.]*repo/i);
});
