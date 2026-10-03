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
  expect(text.split(pin).length).toBe(2);
});
const rules = [
  ['writer marker delivery', [/launched writer/i, /sends/i, /marker/i, /t3_thread_send/i, /mode: queue/i, /recorded driver thread/i], 'Using t3_thread_send with mode: queue, the launched writer sends its marker to the recorded driver thread.'],
  ['forbidden wait loops', [/sleep/i, /poll loops/i, /forbidden/i], 'Sleep and poll loops are forbidden.'],
  ['wait timeout re-arm', [/t3_thread_wait/i, /recorded watch/i, /re-arm/i, /waits/i, /timeout/i], 'Re-arm waits on timeout using t3_thread_wait and the recorded watch.'],
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

test('execution binds the T3 driver thread and one authoritative dispatch attempt', () => {
  const implement = normalize(read('skills/axstack-implement/SKILL.md'));
  const runtime = normalize(read('skills/axstack/references/t3-runtime.md'));
  expect(implement).toMatch(/T3 driver thread[^.]*one authoritative[^.]*dispatch attempt/i);
  expect(runtime).toContain("The driver must be the sole run-record writer and enforce one writer per candidate; it never writes tracked candidate source or tests or repairs an author's source.");
  expect(runtime).toContain('Input acceptance, started state, effective settings and completed work must remain distinct evidence.');
  expect(runtime).toContain('Never answer trust or permission prompts; brief confirmation adds no authority and does not answer a harness or tool dialog.');
});

test('delivery and recovery preserve runtime identity and ownership', () => {
  const runtime = normalize(read('skills/axstack/references/t3-runtime.md'));
  for (const pin of [
    'An older attempt never completes a newer one; stale or duplicate receipts remain evidence, deduplicated by runtime identity.',
    'On a T3 `threadId/runId` mismatch the driver must stop consuming and reconcile the recorded driver identity with native state; never forge a sender or borrow an identity to bypass the mismatch.',
    'The driver must retain a user-taken-over T3 thread; never send cleanup commands to it, including `t3_thread_organize` settle or archive.',
    'A repair must use `t3_thread_send(writerThreadId, mode:queue)` to the same author in the same attempt and worktree; pin the new candidate revision.',
  ]) expect(runtime).toContain(pin);
});

test('review automation and manual watch boundaries remain explicit', () => {
  const watch = normalize(read('skills/axstack-watch/SKILL.md'));
  const workflows = normalize(read('docs/workflows.md'));
  expect(watch).toMatch(/observation-only/i);
  expect(watch).toMatch(/authorized maintenance/i);
  expect(watch).not.toMatch(/watch-manager|scheduled pass/i);
  expect(workflows).toMatch(/optional native review manager/i);
  expect(workflows).toMatch(/user-driven `axstack-watch`/i);
});
