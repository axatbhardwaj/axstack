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
  // driver acceptance in run 20261003-t3code-migration (T1;
  // T5b lowers it after orca-runtime.md is deleted).
  // Base total: 276,480 bytes; T3 reference: 13,197 bytes; retained headroom: 2,295 bytes.
  // Aggregate ceiling = 276,480 + 13,197 + 2,295 = 291,972 bytes (old ceiling + reference).
  // Always-loaded baseline: 23,361 bytes; 5% ceiling: 24,530.
  // Driver acceptance recorded in run 20260930-workflow-bottleneck-audit.
  expect(total).toBeLessThanOrEqual(291972);
  expect(alwaysLoaded).toBeLessThanOrEqual(24530);
});
