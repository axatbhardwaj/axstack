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
  // Driver acceptance in run 20261003-t3code-migration (T5b): restore the
  // 278,775-byte aggregate ceiling after retiring the legacy runtime reference.
  // 20261004-brainstorm-skill: new skill, user-approved; minimal ceiling 279,126.
  // 20261004-correct-ste T1: +86 bytes for literal owned-scratch cleanup and whole-worktree scope.
  // 20261004-correct-ste T2: +1322 bytes for close-out acceptance and spec receipt revisions.
  // 20261004-correct-ste T2 repair1: +78 bytes for explicit hold, high-stakes exception, and archive receipt.
  // 20261004-correct-ste T3: +1391 bytes for body-head checks, diligence logs, and Learning findings.
  // 20261004-correct-ste T3 repair1: +151 bytes for the diligence UNKNOWN hold and recorded reason.
  // Always-loaded baseline: 23,361 bytes; 5% ceiling: 24,530.
  // Driver acceptance recorded in run 20260930-workflow-bottleneck-audit.
  expect(total).toBeLessThanOrEqual(282154);
  expect(alwaysLoaded).toBeLessThanOrEqual(24530);
});
