import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

// Structural validation of the evaluation contract itself (not behavior proof).
test('scenarios: twelve required cases with inputs and expected decisions', () => {
  const data = JSON.parse(readFileSync(join(root, 'tests', 'workflows', 'scenarios.json'), 'utf8'));
  assert.equal(data.version, 1);
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
    assert.ok(ids.includes(required), `missing scenario: ${required}`);
  }
  for (const c of data.cases) {
    assert.ok(c.title && c.spec_ref && c.input && c.expected, `${c.id}: needs title/spec_ref/input/expected`);
  }
});
