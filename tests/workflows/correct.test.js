import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { prohibits, requires, sentences } from './prose-contract.js';

const path = `${import.meta.dir}/../../skills/axstack-correct/SKILL.md`;
const guidance = () => existsSync(path) ? readFileSync(path, 'utf8') : '';

test('correct: Design Usage accepts a correction and explicit or default run selection', () => {
  expect(guidance()).toContain('Usage: /axstack-correct ["<correction>"] [runs=<ids> | last=<N, default 10>]');
});

// Prompt contracts only: these protect declared policy, not live agent conduct.
// Each tuple names a regression, its directional flip, and a semantic holdout.
const rules = [
  ['user invocation', [/run|act/i, /only/i, /user.*request/i],
    /only/i, 'automatically', "Act only on the user's request."],
  ['report only', [/write|produce/i, /report only|only a report/i],
    /report only|only a report/i, 'report and fixes', 'Produce only a report.'],
  ...['edit files', 'dispatch workers', 'merge', 'read transcripts'].map((action) => [
    action, [new RegExp(action, 'i')], /Never|Do not/i, 'Always', `Do not ${action}.`, /never|do not/i,
  ]),
  ['record sources', [/read|inspect/i, /run records/i, /Decisions/i, /deviations/i, /Learnings/i, /FAILED receipts/i, /audit proposals/i],
    /Read|Inspect/i, 'Ignore', 'Inspect run records: Decisions, deviations, Learnings, FAILED receipts, audit proposals.'],
  ['bounded history', [/read|inspect/i, /git history|git log/i, /bounded by|within/i, /selected runs/i],
    /bounded by|within/i, 'without bounds', 'Inspect git log within the selected runs.'],
  ['named reviews only', [/read|inspect/i, /only/i, /PR reviews/i, /named in/i, /records/i],
    /only/i, 'all', 'Inspect only PR reviews named in the records.'],
  ['record bounds', [/record|report/i, /selected runs/i, /git bounds/i],
    /Record|Report/i, 'Omit', 'Report selected runs and git bounds.'],
  ['inaccessible evidence', [/report|record/i, /inaccessible|unavailable/i, /evidence/i],
    /Report|Record/i, 'Ignore', 'Record unavailable evidence.'],
  ['distinct incident threshold', [/class/i, /needs|requires/i, /at least two|>=2/i, /distinct incidents/i],
    /at least two|>=2/i, 'one', 'A class requires >=2 distinct incidents.'],
  ['incident pointers', [/each|every/i, /incident/i, /needs|requires/i, /distinct pointer/i, /run id \+ attempt/i, /file:line/i, /SHA/i, /PR or review URL/i],
    /needs|requires/i, 'can omit', 'Every incident requires a distinct pointer: run id + attempt or file:line, SHA, or PR or review URL.'],
  ['one incident echoed in two records counts once', [/count|tally/i, /incident/i, /echoed|repeated/i, /records/i, /once|one time/i],
    /once|one time/i, 'twice', 'Tally an incident repeated in multiple records one time.'],
  ['missing pointer keeps recurrence UNKNOWN and the class open', [/pointer/i, /missing|absent/i, /report|record/i, /recurrence UNKNOWN/i, /keep|leave/i, /class open/i],
    /recurrence UNKNOWN/i, 'recurrence confirmed', 'When a pointer is absent, record recurrence UNKNOWN and leave the class open.'],
  ['strongest fix first', [/try|consider/i, /order/i, /remove.*copied pattern\s*>\s*script or helper error.*fix\s*>\s*brief or receipt template\s*>\s*bun test\s*>\s*prose/i],
    /remove.*copied pattern\s*>\s*script or helper error.*fix\s*>\s*brief or receipt template\s*>\s*bun test\s*>\s*prose/i,
    'prose > bun test > brief or receipt template > script or helper error naming the fix > remove copied pattern',
    'Consider fixes in order: remove the copied pattern > script or helper error naming the fix > brief or receipt template > bun test > prose.'],
  ['label every rule', [/label|mark/i, /each|every/i, /rule/i, /shipped/i, /runtime: advisory/i],
    /each|every/i, 'some', 'Mark every rule shipped or runtime: advisory.'],
  ['shipped means CI fails on the mistake', [/use|assign/i, /shipped/i, /only when/i, /check/i, /fails in CI/i, /mistake itself/i],
    /fails in CI/i, 'passes in CI', 'Assign shipped only when a check fails in CI on the mistake itself.'],
  ['audit-only observation is advisory', [/only audit/i, /observe/i, /rule/i, /label|mark/i, /runtime: advisory/i],
    /runtime: advisory/i, 'shipped', 'When only audit can observe a rule, mark it runtime: advisory.'],
  ['passing prose-contract test alone stays advisory', [/prose-contract test alone/i, /leaves|keeps/i, /rule/i, /runtime: advisory/i],
    /runtime: advisory/i, 'shipped', 'A passing prose-contract test alone keeps a rule runtime: advisory.'],
  ['fix route', [/propose|route/i, /fixes/i, /through|via/i, /small-change intent/i, /axstack-implement/i],
    /through|via/i, 'directly without', 'Route fixes via a small-change intent and axstack-implement.'],
  ['table change belongs to check PR', [/change|update/i, /Enforced rules/i, /table/i, /AGENTS\.md/i, /only in/i, /PR/i, /adds its check/i],
    /only in/i, 'outside', 'Update the Enforced rules table in AGENTS.md only in the PR that adds its check.'],
  ['first row adds disappearing-path check', [/first row/i, /PR/i, /add|include/i, /test/i, /fails/i, /row/i, /enforcement path/i, /disappears|vanishes/i],
    /fails/i, 'passes', "In the first row's PR, include a test that fails when any row's enforcement path vanishes."],
  ['shipped row misses a later recorded recurrence: enforcement failed', [/shipped/i, /check/i, /missed|fails to stop/i, /later recorded recurrence/i, /report|record/i, /enforcement failed/i],
    /enforcement failed/i, 'enforcement succeeded', 'When a shipped check fails to stop a later recorded recurrence, record enforcement failed.'],
  ['failed enforcement proposes advisory through separate review', [/failure/i, /propose/i, /relabelling|relabeling/i, /row/i, /runtime: advisory/i, /separately reviewed PR/i],
    /runtime: advisory/i, 'shipped', 'For that failure, propose relabeling the row runtime: advisory in a separately reviewed PR.'],
];

for (const [name, concepts, flip, inverse, rewording, prohibition] of rules) {
  test(`correct: ${name}`, () => {
    const accepts = (text) => prohibition
      ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    const clauses = sentences(guidance());
    const matching = clauses.filter(accepts);
    expect(matching, 'required directive').toHaveLength(1);
    const rewrite = (replace) => clauses.map((clause) =>
      matching.includes(clause) ? replace(clause) : clause).join('. ');
    expect(accepts(rewrite(() => '')), 'removal').toBe(false);
    expect(matching[0]).toMatch(flip);
    expect(accepts(rewrite((clause) => clause.replace(flip, inverse))), 'inversion').toBe(false);
    expect(accepts(rewrite(() => rewording)), 'rewording').toBe(true);
    if (!prohibition) expect(accepts(rewrite(() => `Do not ${rewording}`)), 'negated holdout').toBe(false);
  });
}
