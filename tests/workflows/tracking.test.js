import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const lifecycle = () => read('skills/axstack/references/lifecycle.md');
const pins = [
  'Delegated completion requires persisted `task_status` before `t3_thread_read`, terminal `completed`, `result_available`, `hasPendingChildRuns:false`, and final `AXSTACK-DONE`.',
  'Writer completion requires `AXSTACK-DONE` plus terminal `t3_thread_wait` on the recorded run and candidate checks: non-empty diff, clean tree, and named red/green logs.',
  'Completion must match the current attempt key and candidate SHA; an older attempt never completes a newer one.',
  'End a driver turn with an unsettled launched thread only while the bound run watch is armed; each wake reconciles all unsettled runs.',
  'Tracking grants no merge, release, model-substitution, or scope authority.',
];
for (const pin of pins) test(`tracking safety: ${pin}`, () => {
  const text = normalize(lifecycle());
  expect(text).toContain(pin);
  expect(text.replace(pin, '')).not.toContain(pin);
  expect(text.replace(pin, pin.replace(/^\S+/, '$& not'))).not.toContain(pin);
});
const rules = [
  ['next transition', [/update/i, /Next:/i, /transition/i, /owner/i, /hold/i], 'At each transition update Next: with owner and hold.'],
  ['dependent advancement', [/dispatch/i, /unblocked dependent/i, /verify/i, /scope/i, /dependencies/i], 'Verify scope and dependencies and dispatch each unblocked dependent.'],
  ['native handoff reconcile', [/reconcile/i, /T3 threads/i, /runs/i, /Git revisions/i, /pending receipts/i], 'Reconcile pending receipts and Git revisions with T3 threads and runs.'],
  ['review schedule', [/review manager/i, /T3 scheduled task/i, /15-minute/i], 'The review manager runs on a 15-minute T3 scheduled task.'],
];
for (const [name, concepts, holdout] of rules) test(`tracking rule: ${name}`, () => {
  expect(requires(lifecycle(), ...concepts)).toBe(true);
  const clauses = sentences(lifecycle());
  const matching = clauses.filter((clause) => requires(clause, ...concepts));
  expect(requires(clauses.filter((clause) => !matching.includes(clause)).join('. '), ...concepts)).toBe(false);
  expect(requires(clauses.map((clause) => matching.includes(clause) ? `Do not ${clause}` : clause).join('. '), ...concepts)).toBe(false);
  expect(requires(holdout, ...concepts)).toBe(true);
  expect(requires(`Do not ${holdout}`, ...concepts)).toBe(false);
});
test('tracking scenarios retain thirteen explicit decision boundaries', () => {
  const data = JSON.parse(read('tests/workflows/tracking-scenarios.json'));
  expect(data.version).toBe(2);
  expect(data.cases).toHaveLength(13);
  expect(new Set(data.cases.map(({ id }) => id)).size).toBe(13);
  for (const scenario of data.cases) {
    expect(scenario.input.before).toBeTruthy();
    expect(scenario.input.event).toBeTruthy();
    expect(scenario.expected.after).toBeTruthy();
    expect(scenario.expected.actions.length).toBeGreaterThan(0);
    expect(scenario.expected.forbidden.length).toBeGreaterThan(0);
  }
});
