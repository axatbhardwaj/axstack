import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { prohibits, requires, sentences } from './prose-contract.js';

const path = `${import.meta.dir}/../../skills/axstack-correct/SKILL.md`;
const guidance = () => existsSync(path) ? readFileSync(path, 'utf8') : '';

test('correct: Design Usage accepts a correction and explicit or default run selection', () => {
  expect(guidance()).toContain('Usage: /axstack-correct ["<correction>"] [runs=<ids> | last=<N, default 10>]');
});

// Prompt contracts only: these protect declared policy, not live agent conduct.
// Each tuple names a regression, the accepted concept to flip, and a holdout.
const rules = [
  ['user invocation', [/run|act/i, /only/i, /user.*request/i],
    1, 'automatically', "Act only on the user's request."],
  ['report only', [/write|produce/i, /report only|only a report/i],
    1, 'report and fixes', 'Produce only a report.'],
  ...[
    ['edit files', /\bedit\s+(?:(?:any|a|the)\s+)?files?\b/i],
    ['dispatch workers', /\bdispatch\s+(?:(?:any|a|the)\s+)?workers?\b/i],
    ['merge', /\bmerge\b/i],
    ['read transcripts', /\bread\s+(?:(?:any|a|the)\s+)?transcripts?\b/i],
  ].map(([action, concept]) => [
    action, [concept], 0, 'Always', `Do not ${action}.`, /never|do not/i,
  ]),
  ['record sources', [/read|inspect/i, /run records/i, /Decisions/i, /deviations/i, /Learnings/i, /FAILED receipts/i, /audit proposals/i],
    0, 'Ignore', 'Inspect [run records](../axstack/references/run-record.md): Decisions, deviations, Learnings, FAILED receipts, audit proposals.'],
  ['bounded history', [/read|inspect/i, /git history|git log/i, /bounded by|within/i, /selected runs/i],
    2, 'without bounds', 'Inspect git log within the selected runs.'],
  ['named reviews only', [/read|inspect/i, /only/i, /PR reviews/i, /named in/i, /records/i],
    1, 'all', 'Inspect only PR reviews named in the records.'],
  ['record bounds', [/record|report/i, /selected runs/i, /git bounds/i],
    0, 'Omit', 'Report selected runs and git bounds.'],
  ['inaccessible evidence', [/report|record/i, /inaccessible|unavailable/i, /evidence/i],
    0, 'Ignore', 'Record unavailable evidence.'],
  ['distinct incident threshold', [/class/i, /needs|requires/i, /at least two|>=2/i, /distinct incidents/i],
    2, 'one', 'A class requires >=2 distinct incidents.'],
  ['incident pointers', [/each|every/i, /incident/i, /needs|requires/i, /distinct pointer/i, /run id \+ attempt/i, /file:line/i, /SHA/i, /PR or review URL/i],
    2, 'can omit', 'Every incident requires a distinct pointer: run id + attempt or file:line, SHA, or PR or review URL.'],
  ['one incident echoed in two records counts once', [/count|tally/i, /incident/i, /echoed|repeated/i, /records/i, /once|one time/i],
    4, 'twice', 'Tally an incident repeated in multiple records one time.'],
  ['missing pointer keeps recurrence UNKNOWN and the class open', [/pointer/i, /missing|absent/i, /report|record/i, /recurrence UNKNOWN/i, /keep|leave/i, /class open/i],
    3, 'recurrence confirmed', 'When a pointer is absent, record recurrence UNKNOWN and leave the class open.'],
  ['strongest fix first', [/try|consider/i, /order/i, /remove.*copied pattern\s*>\s*script or helper error.*fix\s*>\s*brief or receipt template\s*>\s*bun test\s*>\s*prose/i],
    2,
    'prose > bun test > brief or receipt template > script or helper error naming the fix > remove copied pattern',
    'Consider fixes in order: remove the copied pattern > script or helper error naming the fix > brief or receipt template > bun test > prose.'],
  ['label every rule', [/label|mark/i, /each|every/i, /rule/i, /shipped/i, /runtime: advisory/i],
    1, 'some', 'Mark every rule shipped or runtime: advisory.'],
  ['shipped means CI fails on the mistake', [/use|assign/i, /shipped/i, /only when/i, /check/i, /fails in CI/i, /mistake itself/i],
    4, 'passes in CI', 'Assign shipped only when a check fails in CI on the mistake itself.'],
  ['audit-only observation is advisory', [/only audit/i, /observe/i, /rule/i, /label|mark/i, /runtime: advisory/i],
    4, 'shipped', 'When only audit can observe a rule, mark it runtime: advisory.'],
  ['passing prose-contract test alone stays advisory', [/prose-contract test alone/i, /leaves|keeps/i, /rule/i, /runtime: advisory/i],
    3, 'shipped', 'A passing prose-contract test alone keeps a rule runtime: advisory.'],
  ['fix route', [/propose|route/i, /fixes/i, /through|via/i, /small-change intent/i, /axstack-implement/i],
    2, 'directly without', 'Route fixes via a small-change intent and [axstack-implement](../axstack-implement/SKILL.md).'],
  ['table change belongs to check PR', [/change|update/i, /Enforced rules/i, /table/i, /AGENTS\.md/i, /only in/i, /PR/i, /adds its check/i],
    5, 'outside', 'Update the Enforced rules table in AGENTS.md only in the PR that adds its check.'],
  ['first row adds disappearing-path check', [/first row/i, /PR/i, /add|include/i, /test/i, /fails/i, /row/i, /enforcement path/i, /disappears|vanishes/i],
    4, 'passes', "In the first row's PR, include a test that fails when any row's enforcement path vanishes."],
  ['shipped row misses a later recorded recurrence: enforcement failed', [/shipped/i, /check/i, /\bmiss(?:ed|es)\b|fails to stop/i, /later recorded recurrence/i, /report|record/i, /enforcement failed/i],
    5, 'enforcement succeeded', 'When a shipped check fails to stop a later recorded recurrence, record enforcement failed.'],
  ['failed enforcement proposes advisory through separate review', [/failure/i, /propose/i, /relabelling|relabeling/i, /row/i, /runtime: advisory/i, /separately reviewed PR/i],
    4, 'shipped', 'For that failure, propose relabeling the row runtime: advisory in a separately reviewed PR.'],
];

const acceptsRule = ([, concepts, , , , prohibition]) => (text) => prohibition
  ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);

function checkRule(text, rule) {
  const [, concepts, flipIndex, inverse, , prohibition] = rule;
  const accepts = acceptsRule(rule);
  const clauses = sentences(text);
  const matching = clauses.filter(accepts);
  expect(matching, 'required directive').toHaveLength(1);
  const rewrite = (replace) => clauses.map((clause) =>
    matching.includes(clause) ? replace(clause) : clause).join('. ');
  expect(accepts(rewrite(() => '')), 'removal must be red').toBe(false);
  // Flip every occurrence of the accepted concept, with all accepted spellings.
  const flip = new RegExp((prohibition ?? concepts[flipIndex]).source, 'gi');
  expect(matching[0]).toMatch(flip);
  expect(accepts(rewrite((clause) => clause.replace(flip, inverse))), 'inversion must be red').toBe(false);
  if (!prohibition) expect(accepts(rewrite((clause) => `Do not ${clause}`)), 'negated directive').toBe(false);
}

function checkRewording(text, rule) {
  const [, , , , rewording] = rule;
  const originals = text.split('\n').filter(acceptsRule(rule));
  expect(originals).toHaveLength(1);
  // Substitute in the full real-file string; tests never write tracked files.
  const reworded = text.replace(originals[0], rewording);
  if (originals[0] !== rewording) expect(reworded).not.toBe(text);
  for (const sibling of rules) checkRule(reworded, sibling);
  return reworded;
}

for (const rule of rules) {
  const [name] = rule;
  test(`correct: ${name}`, () => checkRule(guidance(), rule));
  test(`correct real-source rewording: ${name}`, () => {
    const reworded = checkRewording(guidance(), rule);
    // The same checks must pass when the source already uses the holdout wording.
    checkRewording(reworded, rule);
  });
}

const naturalRewordings = [
  ['edit files', ['Never edit any file.', 'Do not edit a file.']],
  ['dispatch workers', ['Do not dispatch any worker.']],
  ['read transcripts', ['Never read any transcript.']],
  ['shipped row misses a later recorded recurrence: enforcement failed', [
    'When a shipped check misses a later recorded recurrence, record enforcement failed.',
    'When a shipped check fails to stop a later recorded recurrence, record enforcement failed.',
  ]],
];

for (const [name, rewordings] of naturalRewordings) {
  test(`correct natural real-source rewording: ${name}`, () => {
    const text = guidance();
    const rule = rules.find(([ruleName]) => ruleName === name);
    const originals = text.split('\n').filter(acceptsRule(rule));
    expect(originals).toHaveLength(1);
    for (const rewording of rewordings) {
      const reworded = text.replace(originals[0], rewording);
      for (const sibling of rules) checkRule(reworded, sibling);
      checkRewording(reworded, rule);
    }
  });
}
