import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const compact = (text) => text.replace(/`/g, '').replace(/\s+/g, ' ');
test('getting started explains check rows and its live evidence limits', () => {
  const doc = read('docs/getting-started.md');
  for (const row of ['bun', 'git', 'gh', 't3']) expect(doc).toContain(`| \`${row}\` |`);
  const terms = [/check/i, /live provider readiness/i, /schedule activation/i, /mobile delivery/i];
  checkRule(compact(doc), (text) => prohibits(text, /does not prove/i, ...terms),
    'Check does not prove live provider readiness, schedule activation or mobile delivery.',
    [[/does not prove/i, 'proves']], terms);
  expect(doc).toContain('$axstack-implement');
  expect(doc).toContain('/axstack-implement');
  expect(doc).toContain('](guides.md#small-fix)');
});

test('concepts and guides cover the requested learning journeys', () => {
  for (const concept of ['Driver thread', 'Phases', 'Small and substantial work', 'Roles and presets', 'Holds', 'Run record', 'T3 runtime boundary', 'Provider bindings']) {
    expect(read('docs/concepts.md'), concept).toContain(`## ${concept}`);
  }
  for (const journey of ['Scope and build a feature', 'Small fix', 'Review a PR', 'Watch own PRs', 'Debug', 'Release']) {
    expect(read('docs/guides.md'), journey).toContain(`## ${journey}`);
  }
});
