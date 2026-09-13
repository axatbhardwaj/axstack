import { test, expect } from 'bun:test';
// Filesystem access uses the approved narrow exception: node:fs and
// node:fs/promises are Bun-implemented built-ins. No Node.js runtime is
// required. Path handling below is local (import.meta.dir), not node:.
import { readFileSync } from 'node:fs';

function dirname(p) {
  const clean = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
  const i = clean.lastIndexOf('/');
  if (i < 0) return '.';
  if (i === 0) return '/';
  return clean.slice(0, i);
}

const here = import.meta.dir;
const root = dirname(dirname(here));

// Structural validation of the evaluation contract itself (not behavior proof).
test('scenarios: twelve required cases with inputs and expected decisions', () => {
  const data = JSON.parse(readFileSync(root + '/tests/workflows/scenarios.json', 'utf8'));
  expect(data.version).toBe(1);
  const ids = data.cases.map((c) => c.id);
  for (const required of [
    'model-outage',
    'changed-parent',
    'spec-drift',
    'two-reviewer-disagreement',
    'serious-risk-relay-failure',
    'duplicate-launch-uncertainty',
    'linear-done-drift',
    'watch-expiry',
    'strict-tdd-violation',
    'missing-mcp-access',
    'model-materialization',
    'rollout-publish',
  ]) {
    expect(ids.includes(required), `missing scenario: ${required}`).toBeTruthy();
  }
  for (const c of data.cases) {
    expect(c.title && c.spec_ref && c.input && c.expected, `${c.id}: needs title/spec_ref/input/expected`).toBeTruthy();
  }
});
