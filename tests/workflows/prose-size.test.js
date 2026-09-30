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

  // Initial baseline: 249,958 and 21,682 bytes. T3b2 loaded bytes: 23,361;
  // 5% ceiling: 24,530; driver acceptance recorded in run 20260930-workflow-bottleneck-audit.
  expect(total).toBeLessThanOrEqual(262456);
  expect(alwaysLoaded).toBeLessThanOrEqual(24530);
});
