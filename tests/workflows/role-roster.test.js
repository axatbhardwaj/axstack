import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

test('routing loads the extracted roster and preserves every other base byte', () => {
  const routing = read('skills/axstack/references/routing.md');
  expect(routing).toContain('Load the [Role roster](role-roster.md) for configured roles and authored-review pairings.');
  // origin/main routing, changing only the 28 -> 31 count and replacing its
  // complete role-roster block with the single load pointer above.
  expect(Bun.CryptoHasher.hash('sha256', routing, 'hex'))
    .toBe('0d8f9c939b88f98a4ac89b7f8f5c46c06890d85af0c3c440686cc6ec36242604');
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
