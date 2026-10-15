import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8').replace(/`/g, '');
const record = () => read('axstack/references/run-record.md');
// Written contracts only: these checks do not prove native settlement.
test('settle readback: dispatch schema records success evidence or a hold', () => {
  const rows = record().split('\n');
  const header = rows.find((line) => line.startsWith('| Dispatch key |')) ?? '';
  checkRule(header, (text) => requires(text, /\| Settle readback \|/),
    '| Dispatch key | Settle readback |', [[/Settle readback/, 'Task completion']]);
  const example = rows.find((line) => line.startsWith('| <key> |')) ?? '';
  expect(example.split('|').length).toBe(header.split('|').length);
  checkRule(example, (text) => requires(text, /settled: true/i, /t3_thread_read/i, /held: <reason>/i),
    '| <key> | held: <reason> or settled: true (t3_thread_read evidence) |',
    [[/settled: true/i, 'settled: false']], [/t3_thread_read/i, /held: <reason>/i]);
});

test('settle readback: mandatory close-out row covers all run-owned workers', () => {
  const row = record().split('\n').find((line) => /\| Every run-owned delegated child/i.test(line)) ?? '';
  const concepts = [/every run-owned delegated child/i, /launched writer/i, /settled/i, /passed/i];
  checkRule(row, (text) => requires(text, ...concepts),
    '| Every run-owned delegated child and launched writer settled | passed | <inventory ref> | none |',
    [[/Every run-owned delegated child/i, 'Some delegated children']], concepts);
});

const rules = [
  ['axstack/references/run-record.md', 'only current thread-bound readback passes',
    [/mandatory/i, /every run-owned delegated child/i, /launched writer/i, /pass only/i, /current/i, /thread.bound/i, /t3_thread_read/i, /settled: true/i],
    'For every run-owned delegated child and launched writer the mandatory row can pass only with current thread-bound t3_thread_read evidence showing settled: true.',
    [/settled: true/i, 'settled: false']],
  ['axstack/references/run-record.md', 'missing or failed readback holds',
    [/missing or failed/i, /read.?back/i, /hold/i],
    'Missing or failed read-back requires a hold.', [/hold/i, 'pass']],
  ['axstack/references/run-record.md', 'each exception needs user acceptance',
    [/close.out/i, /pending unless/i, /each/i, /unsettled exception/i, /user.accepted hold/i, /Decisions row/i],
    'Close-out remains pending unless each unsettled exception has a user-accepted hold linked to its Decisions row.',
    [/user.accepted hold/i, 'driver-recorded reason']],
  ['axstack/references/workspace-hygiene.md', 'pinned children still settle',
    [/pinned run.owned child/i, /still/i, /settled/i],
    'A pinned run-owned child is still settled.', [/still/i, 'never']],
  ['axstack/references/workspace-hygiene.md', 'settle clears inherited pins',
    [/settle/i, /clears/i, /pin/i, /inherited from/i, /parent/i],
    "T3 settle clears the pin, including one inherited from the parent at creation.",
    [/clears/i, 'preserves']],
  ['axstack/references/workspace-hygiene.md', 'keep-pinned request holds settlement',
    [/user/i, /asked to keep/i, /child pinned/i, /hold/i, /settlement/i, /reason/i],
    'If the user asked to keep a child pinned, hold its settlement with that reason.',
    [/hold/i, 'complete']],
  ['axstack/references/workspace-hygiene.md', 'refusal records the error in the column',
    [/T3 refusal/i, /parent_not_active/i, /calling driver/i, /own run/i, /live/i, /column/i, /held/i, /error/i],
    "A T3 refusal such as parent_not_active (the calling driver's own run is not live) puts held: <error> in the column.",
    [/held/i, 'passed']],
  ['axstack-brainstorm/references/arena.md', 'synthesis settles candidate and judge threads',
    [/candidate/i, /judge/i, /threads/i, /follow/i, /same.turn settle/i],
    'For candidate and judge threads, follow the same-turn settle rule during synthesis.',
    [/same.turn/i, 'eventual']],
];

for (const [path, name, concepts, wording, inversion] of rules) {
  test(`settle readback: ${name}`, () => {
    // A refusal's explanation contains the expected negative "not live".
    const accepts = (text) => sentences(text).some((clause) =>
      concepts.every((concept) => concept.test(clause))
      && requires(clause.replace(/own run is not live/i, 'own run is inactive'), /^/));
    checkRule(sentences(read(path)).join('. '), accepts, wording, [inversion], concepts);
  });
}

const prohibitions = [
  ['axstack/references/run-record.md', 'task completion is not settlement', /does not pass/i,
    [/task completion/i, /result_available/i, /alone/i],
    'Task completion or result_available alone does not pass.', [/does not pass/i, 'passes']],
  ['axstack/references/run-record.md', 'plain reasons cannot satisfy the row', /does not satisfy/i,
    [/plain recorded reason/i, /row/i],
    'A plain recorded reason does not satisfy the row.', [/does not satisfy/i, 'satisfies']],
  ['axstack/references/workspace-hygiene.md', 'no separate unpin step', /no separate unpin step/i,
    [], 'There is no separate unpin step.', [/no separate unpin step/i, 'a required separate unpin step']],
  ['axstack/references/workspace-hygiene.md', 'refusals never reactivate parents', /never reactivate/i,
    [/parent/i], 'Never reactivate a parent.', [/never reactivate/i, 'Reactivate']],
  ['axstack/references/lifecycle.md', 'finished task cannot replace settle and readback', /does not count/i,
    [/settle each worker thread/i, /t3_thread_organize/i, /read back/i, /settled: true/i, /finished task/i],
    'Settle each worker thread with t3_thread_organize and read back settled: true, because a finished task does not count.',
    [/does not count/i, 'counts']],
];

for (const [path, name, negative, concepts, wording, inversion] of prohibitions) {
  test(`settle readback: ${name}`, () => {
    checkRule(sentences(read(path)).join('. '), (text) => prohibits(text, negative, ...concepts),
      wording, [inversion], concepts);
  });
}

test('settle readback: brainstorm pointer targets the shared settlement rule', () => {
  expect(read('axstack-brainstorm/references/arena.md'))
    .toContain('../../axstack/references/workspace-hygiene.md#settlement');
});
