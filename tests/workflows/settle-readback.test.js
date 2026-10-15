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
  checkRule(example, (text) => requires(text, /settled: true/i, /t3_thread_read/i, /<UTC>/i, /held: <reason>/i),
    '| <key> | held: <reason> or settled: true (t3_thread_read <UTC>) |',
    [[/settled: true/i, 'settled: false']], [/t3_thread_read/i, /<UTC>/i, /held: <reason>/i]);
});

test('settle readback: mandatory close-out row covers all run-owned workers', () => {
  const row = record().split('\n').find((line) => /\| Every run-owned delegated child/i.test(line)) ?? '';
  const concepts = [/every run-owned delegated child/i, /launched writer/i, /\bsettled\b/i];
  const accepts = (text) => {
    const cells = text.split('|');
    return requires(cells[1] ?? '', ...concepts) && requires(cells[2] ?? '', /passed/i);
  };
  checkRule(row, accepts,
    '| Every run-owned delegated child and launched writer settled | passed | <inventory ref> | none |',
    [[/Every run-owned delegated child/i, 'Some delegated children'], [/\bsettled\b/i, 'unsettled']], [...concepts, /passed/i]);
});

const rules = [
  ['axstack/references/run-record.md', 'only current thread-bound readback passes',
    [/mandatory/i, /every run-owned delegated child/i, /launched writer/i, /pass(?:es)? only/i, /current/i, /thread.bound/i, /t3_thread_read/i, /settled: true/i],
    'For every run-owned delegated child and launched writer the mandatory row passes only with current thread-bound t3_thread_read evidence showing settled: true.',
    [/settled: true/i, 'settled: false']],
  ['axstack/references/run-record.md', 'missing or failed readback holds',
    [/missing or failed/i, /read.?back/i, /hold/i],
    'Treat a missing or failed read-back as a hold.', [/hold/i, 'pass']],
  ['axstack/references/run-record.md', 'each exception needs user acceptance',
    [/close.out/i, /pending unless/i, /each/i, /unsettled exception/i, /user.accepted hold/i, /Decisions row/i],
    'Close-out is pending unless each unsettled exception carries a user-accepted hold and a link to its Decisions row.',
    [/user.accepted hold/i, 'driver-recorded reason']],
  ['axstack/references/workspace-hygiene.md', 'pinned children still settle',
    [/pinned run.owned child/i, /\b(?:still|too)\b/i, /\bsettled\b|\bsettle(?= a pinned)/i],
    'Settle a pinned run-owned child too.', [/(?:still|too)/i, 'never'],
    [[/\bsettled\b|settle(?= a pinned)/i, 'left unsettled']]],
  ['axstack/references/workspace-hygiene.md', 'settle clears inherited pins',
    [/settle/i, /clears/i, /pin/i, /inherited from/i, /parent/i],
    'Settle clears a pin inherited from the parent as well as a direct pin.',
    [/clears/i, 'preserves']],
  ['axstack/references/workspace-hygiene.md', 'keep-pinned request holds settlement',
    [/user/i, /asked to keep/i, /child pinned/i, /hold/i, /settlement/i, /reason/i],
    'When the user asked to keep a child pinned, hold settlement and record that reason.',
    [/hold/i, 'complete']],
  ['axstack/references/workspace-hygiene.md', 'refusal records the error in the column',
    [/T3 refusal/i, /parent_not_active/i, /calling driver/i, /own run/i, /live/i, /column/i, /held/i, /error/i],
    "Record a T3 refusal, including parent_not_active (the calling driver's own run is not live), as held: <error> in the run-record Settle readback column.",
    [/held/i, 'passed']],
  ['axstack-brainstorm/references/arena.md', 'synthesis settles candidate and judge threads',
    [/candidate/i, /judge/i, /threads/i, /follow/i, /same.turn settle/i],
    'Follow the same-turn settle rule for candidate threads and judge threads before presenting the synthesis.',
    [/same.turn/i, 'eventual']],
];

for (const [path, name, concepts, wording, inversion, extraInversions = []] of rules) {
  test(`settle readback: ${name}`, () => {
    // A refusal's explanation contains the expected negative "not live".
    const accepts = (text) => sentences(text).some((clause) =>
      concepts.every((concept) => concept.test(clause))
      && requires(clause.replace(/own run is not live/i, 'own run is inactive'), /^/));
    checkRule(sentences(read(path)).join('. '), accepts, wording, [inversion, ...extraInversions], concepts);
  });
}

const prohibitions = [
  ['axstack/references/run-record.md', 'task completion is not settlement', /does not pass|never passes|cannot pass|is not enough to pass/i,
    [/task completion/i, /result_available/i, /alone/i],
    'Task completion or result_available alone never passes.', [/does not pass|never passes|cannot pass|is not enough to pass/i, 'passes']],
  ['axstack/references/run-record.md', 'plain reasons cannot satisfy the row', /does not satisfy|cannot satisfy|is insufficient for/i,
    [/plain recorded reason/i, /row/i],
    'A plain recorded reason is insufficient for the row.', [/does not satisfy|cannot satisfy|is insufficient for/i, 'satisfies']],
  ['axstack/references/workspace-hygiene.md', 'no separate unpin step', /no separate unpin step/i,
    [], 'No separate unpin step is needed.', [/no separate unpin step/i, 'a required separate unpin step']],
  ['axstack/references/workspace-hygiene.md', 'refusals never reactivate parents', /(?:never|do not) reactivate/i,
    [/parent/i], 'Do not reactivate a parent.', [/(?:never|do not) reactivate/i, 'Reactivate']],
  ['axstack/references/lifecycle.md', 'finished task cannot replace settle and readback', /does not count|is not settlement/i,
    [/settle each worker thread/i, /t3_thread_organize/i, /read back/i, /settled: true/i, /finished task/i],
    'A finished task is not settlement, so settle each worker thread with t3_thread_organize and read back settled: true.',
    [/does not count|is not settlement/i, 'counts']],
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
