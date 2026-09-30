import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const skills = `${root}/skills`;

test('packaged guidance stays within the aggregate and always-loaded budgets', () => {
  const markdown = readdirSync(skills, { recursive: true }).filter((path) => path.endsWith('.md'));
  const bytes = (path) => readFileSync(`${skills}/${path}`).byteLength;
  const total = markdown.reduce((sum, path) => sum + bytes(path), 0);
  const alwaysLoaded = ['contracts.md', 'lifecycle.md', 'routing.md']
    .reduce((sum, path) => sum + bytes(`axstack/references/${path}`), 0);

  // Aggregate baseline: 268,118 bytes on main; 273,308 with #245/#246; 2% headroom: 278,775.
  // driver acceptance recorded in run 20260930-test-slop-audit.
  // Always-loaded baseline: 23,361 bytes; 5% ceiling: 24,530.
  // Driver acceptance recorded in run 20260930-workflow-bottleneck-audit.
  expect(total).toBeLessThanOrEqual(278775);
  expect(alwaysLoaded).toBeLessThanOrEqual(24530);
});
