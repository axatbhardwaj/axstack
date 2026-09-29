import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

test('routing loads the extracted roster and pins the reviewed contract bytes', () => {
  const routing = read('skills/axstack/references/routing.md');
  expect(routing).toContain('Load the [Role roster](role-roster.md) for configured roles and authored-review pairings.');
  expect(routing).toContain('For each role record class, resolved exact ID, source');
  expect(routing).toContain('Resume must reuse the snapshot and');
  expect(Bun.CryptoHasher.hash('sha256', routing, 'hex'))
    .toBe('091c5a77736a7806d0a81653c92f034866046058ca7bcce903c8e61209dcdc03');
});

test('roster names class routes for Sonnet and Sol analysis seats', () => {
  const roster = read('skills/axstack/references/role-roster.md');
  expect(roster).toContain('`claude/sonnet` high in mixed/claude-only');
  expect(roster).toContain('`codex/sol` high in');
});

test('routing and roster links resolve inside the packaged references', () => {
  for (const name of ['routing.md', 'role-roster.md']) {
    for (const [, target] of read(`skills/axstack/references/${name}`).matchAll(/\]\(([^)]+)\)/g)) {
      const path = target.split('#')[0];
      expect(path).toMatch(/^[a-z-]+\.md$/);
      expect(existsSync(`${root}/skills/axstack/references/${path}`)).toBe(true);
    }
  }
});
