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

// Contract validation for the repair evaluation file itself (not behavior
// proof). Behavior is verified by a fresh evaluator executing each case
// against skill prompts; keyword matching is not behavior. The existing
// 12 scenarios in scenarios.json are left untouched.
test('owned-scenarios: seven repair cases with inputs and expected decisions', () => {
  const data = JSON.parse(readFileSync(root + '/tests/workflows/owned-scenarios.json', 'utf8'));
  expect(data.version).toBe(1);
  const ids = data.cases.map((c) => c.id);
  expect(new Set(ids).size, 'scenario ids must be unique').toBe(ids.length);
  for (const required of [
    'conditional-scope',
    'peer-request-changes-submit',
    'report-only-verdict',
    'observation-dominance',
    'adoption-authority',
    'monitor-watchdog-split',
    'ambiguous-publish',
  ]) {
    expect(ids.includes(required), `missing scenario: ${required}`).toBeTruthy();
  }
  const ownedSkills = ['axstack', 'axstack-review', 'axstack-watch', 'axstack-implement'];
  for (const c of data.cases) {
    expect(c.title && c.skill_ref && c.input && c.expected, `${c.id}: needs title/skill_ref/input/expected`).toBeTruthy();
    expect(
      ownedSkills.includes(c.skill_ref),
      `${c.id}: skill_ref must name an owned core skill`,
    ).toBeTruthy();
    expect(c.input.request && c.input.facts, `${c.id}: needs request and facts`).toBeTruthy();
  }
});
