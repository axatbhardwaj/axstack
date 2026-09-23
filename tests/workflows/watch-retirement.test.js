import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

test('active guidance offers one scheduled review manager and manual own-PR watch', () => {
  expect(existsSync(`${root}/skills/axstack/references/watch-manager-prompt.md`)).toBe(false);
  const manager = read('skills/axstack/references/automations.md');
  expect(manager).toMatch(/review manager/i);
  expect(manager).not.toMatch(/watch manager|watch lane|own-PR repair/i);
  const watch = read('skills/axstack-watch/SKILL.md');
  expect(watch).toMatch(/observation-only/i);
  expect(watch).toMatch(/authorized maintenance/i);
  expect(watch).not.toMatch(/watch-manager session|scheduled pass/i);
});

test('manual adopted repair reviews its local SHA before publication, while implementation publishes first', () => {
  const repair = read('skills/axstack-watch/references/repair-publication.md');
  const localReview = repair.indexOf('independent review of the exact local candidate SHA');
  const publish = repair.indexOf('publish through `gh stack`');
  expect(localReview).toBeGreaterThan(-1);
  expect(publish).toBeGreaterThan(localReview);
  const ordinary = read('skills/axstack/references/candidate-publication.md');
  expect(ordinary).toMatch(/remote ref back[^.]*candidate SHA/);
  expect(ordinary).not.toMatch(/manager PR repair/);
});

test('current user guidance contains no scheduled own-PR repair path', () => {
  for (const path of ['README.md', 'docs/installation.md', 'docs/workflows.md']) {
    const guidance = read(path);
    expect(guidance, path).not.toMatch(/watch.manager|watch lane|manager repairs|bounded PR job repairs|fast-forward `git push`/i);
  }
  const workflows = read('docs/workflows.md');
  expect(workflows).toMatch(/Manual adopted-PR repair[^.]*local SHA[^.]*`gh stack` publication/i);
});

test('manual watch keeps a concrete fallback when relay is unavailable', () => {
  const watch = read('skills/axstack-watch/SKILL.md');
  expect(watch).toMatch(/absent policy\s+or failed relay[^.]*current Orca conversation[^.]*hold open/i);
});

test('review distinguishes implementation publication from local-SHA maintenance review', () => {
  const review = read('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/For an owned implementation candidate,\s*load and verify the\s*\[candidate-publication boundary\]/);
});
