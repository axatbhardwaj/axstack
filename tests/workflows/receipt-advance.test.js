import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const lifecycle = () => read('skills/axstack/references/lifecycle.md');
const autopilot = () => read('skills/axstack/references/autopilot.md');
const record = () => read('skills/axstack/references/run-record.md');

test('accepted worker receipt advances every ready dependent in the same turn', () => {
  const text = lifecycle();
  expect(text).toMatch(/Dispatch each unblocked dependent[^;]*dependencies in the same driver turn/i);
  expect(text).toMatch(/record why others are not\s+ready/i);
  expect(text).toMatch(/Next:[\s\S]*owner[\s\S]*last receipt time[\s\S]*next\s+action[\s\S]*hold/i);
  expect(text).toMatch(/reconcile it for\s+status questions/i);
  expect(text).toMatch(/Completion must match the current attempt key and candidate SHA; an older attempt never completes a newer one/i);
});

test('incomplete receipt returns to its author once before a task hold', () => {
  const text = lifecycle();
  expect(text).toMatch(/required change with an empty base-to-head diff/i);
  expect(text).toMatch(/missing named artifact,[\s\S]*retain the incomplete state/i);
  expect(text).toMatch(/same author once[^.]*hold on repeat/i);
});

test('autopilot scopes holds by dependency while preserving run-wide gates', () => {
  const text = autopilot();
  expect(text).toMatch(/run-wide holds[\s\S]*authority[\s\S]*scope[\s\S]*cancellation[\s\S]*serious risk/i);
  expect(text).toMatch(/task, PR, resource, or operation hold[\s\S]*dependants/i);
  expect(text).toMatch(/unclear impact[\s\S]*potentially affected work/i);
  expect(text).toMatch(/spec approval[\s\S]*human approval/i);
  expect(text).toMatch(/Human npm stage approval[\s\S]*decision hold/i);
});

test('run record has one actionable Next line', () => {
  expect(record()).toMatch(/^Next: <owner; last receipt time; next action; hold or none>$/m);
});

test('receipt advancement evaluator cases are input-only', () => {
  const corpus = JSON.parse(read('tests/workflows/receipt-advance-evaluator-inputs.json'));
  expect(corpus.version).toBe(1);
  const ids = corpus.cases.map(({ id }) => id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ['same-turn-t01', 'ack-only-redelivery', 'scoped-hold',
    'spec-approval-hold', 'npm-approval-hold', 'stale-dispatch',
    'aurora-v301-no-dispatch', 'super-7-no-question', 't03-reachability']) {
    expect(ids).toContain(id);
  }
  for (const { input, expected } of corpus.cases) {
    expect(input.request && input.run_state).toBeTruthy();
    expect(expected).toBeUndefined();
  }
});
