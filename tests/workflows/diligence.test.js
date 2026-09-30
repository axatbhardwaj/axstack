import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');
const sonnetRows = (roles) => roles.filter(({ modelClass, model }) =>
  modelClass === 'sonnet' || (typeof model === 'string' && model.startsWith('claude-sonnet-')));

test('diligence role is configured in every preset with supported effort', () => {
  for (const [preset, provider, modelClass] of [
    ['mixed', 'claude', 'sonnet'],
    ['claude-only', 'claude', 'sonnet'],
    ['codex-only', 'codex', 'sol'],
  ]) {
    const { roles } = JSON.parse(read(`profiles/presets/${preset}.json`));
    expect(roles.map(({ id }) => id)).toEqual(JSON.parse(read('profiles/presets/mixed.json')).roles.map(({ id }) => id));
    expect(roles.find(({ id }) => id === 'axstack-diligence')).toMatchObject({
      provider, modelClass, thinkingOptionId: 'high',
    });
  }
});

test('every Sonnet preset row stays at high effort or below', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const { roles } = JSON.parse(read(`profiles/presets/${preset}.json`));
    const sonnet = sonnetRows(roles);
    if (preset !== 'codex-only') expect(sonnet.length).toBeGreaterThan(0);
    for (const role of sonnet) {
      expect(['low', 'medium', 'high'], `${preset}: ${role.id}`).toContain(role.thinkingOptionId);
    }
  }
});

test('Sonnet effort guard includes legacy exact model pins', () => {
  const legacy = { provider: 'claude', model: 'claude-sonnet-5-5', thinkingOptionId: 'xhigh' };
  expect(sonnetRows([legacy])).toEqual([legacy]);
  expect(['low', 'medium', 'high']).not.toContain(legacy.thinkingOptionId);
});

test('diligence contract checks intent, claims, metadata and evidence without edits', () => {
  const rule = compact('skills/axstack/references/diligence.md');
  for (const term of [
    'read-only', 'PASS', 'FINDINGS', 'changed line', 'in scope', 'silently weakened',
    'PR body', 'commit messages', 'author receipt', 'numbers', 'IDs', 'versions',
    'test counts', 'sizes', 'paths', 'stale references', 'version bump', 'merged PRs',
  ]) expect(rule).toContain(term);
  expect(rule).toMatch(/never (?:authors|edits)/);
});

test('every review round has independent exact-revision diligence and a PASS gate', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  const implement = compact('skills/axstack-implement/SKILL.md');
  expect(review).toMatch(/peer and authored.*axstack-diligence.*same exact revision/);
  expect(review).toMatch(/independent.*configured reviewer/);
  expect(review).toMatch(/diligence `FINDINGS`.*same author.*same round/);
  expect(implement).toMatch(/Merge-ready.*diligence `PASS`/);
});

for (const [phase, path, rule] of [
  ['research', 'skills/axstack-research/SKILL.md', /Before the driver folds verified claims.*axstack-diligence.*reopen cited sources.*answer-changing claims/],
  ['spec', 'skills/axstack-spec/SKILL.md', /Before user approval.*axstack-diligence.*draft against.*Align decisions/],
  ['tickets', 'skills/axstack-tickets/SKILL.md', /axstack-diligence.*every spec acceptance item.*capability's acceptance/],
  ['publication', 'skills/axstack/references/candidate-publication.md', /Before publication.*axstack-diligence.*author receipt.*evidence folder.*red\/green.*counts.*SHAs.*paths/],
  ['release', 'skills/axstack/references/candidate-publication.md', /version-bump PR.*axstack-diligence.*bump.*merged PRs/],
]) {
  test(`${phase} runs diligence at its decision boundary`, () => {
    expect(compact(path)).toMatch(rule);
  });
}

test('routing and docs describe all role IDs with a roster entry', () => {
  expect(read('skills/axstack/references/routing.md')).toContain('all role IDs');
  expect(read('skills/axstack/references/role-roster.md')).toMatch(/^- `axstack-diligence`:.*\(diligence\.md\)/m);
  for (const path of [
    'README.md', 'docs/installation.md', 'docs/workflows.md',
    'skills/axstack/references/orca-runtime.md',
    'tests/workflows/routing-scenarios.json',
    'tests/workflows/debug-scenarios.json',
  ]) expect(read(path), path).toMatch(/role IDs/i);
});
