import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const guidance = () => sentences(readFileSync(`${import.meta.dir}/../../AGENTS.md`, 'utf8')
  .replace(/[`*]/g, '')).join('. ');

const rules = [
  ['scope', (text) => requires(text, /only the new helpers/i, /dispatch-plan/, /pr-shape/, /readiness/, /run-init/),
    'Only the new helpers run-init, readiness, pr-shape and dispatch-plan follow this rule.',
    [[/only the new helpers/i, 'all scripts']]],
  ['legacy behavior', (text) => requires(text, /existing six scripts/i, /retain|keep/i, /behavior/i),
    'The existing six scripts keep their behavior.', [[/retain|keep/i, 'change']]],
  ['pure facts', (text) => prohibits(text, /no state between calls/i, /fact.*plan helpers/i,
    /dispatch-plan/, /pr-shape/, /readiness without --run/, /explicit inputs/i, /read-only/i,
    /git/, /gh/, /saved T3 JSON/, /stdout/, /caller-given path/i),
    'Fact and plan helpers dispatch-plan, pr-shape and readiness without --run consume explicit inputs, read-only git/gh or saved T3 JSON, emit to stdout or a caller-given path, and retain no state between calls.',
    [[/no state between calls/i, 'persistent state between calls'], [/read-only/i, 'read-write']]],
  ['writer boundaries', (text) => requires(text, /writer helpers/i, /run-init/, /readiness --run/,
    /every side effect/i, /--help/, /write only those paths/i),
    'Writer helpers run-init and readiness --run must list every side effect in --help and write only those paths.',
    [[/write only those paths/i, 'write any paths'], [/every side effect/i, 'selected side effects']]],
  ['term evidence', (text) => requires(text, /all new helpers/i, /report each term/i,
    /pass/, /fail/, /unknown/, /n\/a/, /evidence/i),
    'All new helpers report each term with evidence as n/a, unknown, fail or pass.',
    [[/report each term/i, 'hide each term']]],
  ['unknown gaps', (text) => requires(text, /API/, /pagination/i, /permission gaps/i, /unknown/),
    'Permission gaps, API gaps and pagination gaps are unknown.', [[/unknown/g, 'pass']]],
  ['authority', (text) => prohibits(text, /never grant/i, /holds/i, /authority/i, /aggregate verdict/i),
    'Helpers can add holds but never grant an aggregate verdict or authority.', [[/never grant/i, 'always grant']]],
  ['counts', (text) => requires(text, /summaries/i, /counts only/i),
    'Summaries are counts only.', [[/counts only/i, 'aggregate judgments']]],
  ['agent invocation', (text) => requires(text, /only agents/i, /call these helpers/i, /own turn/i),
    'Within their own turn, only agents call these helpers.', [[/only agents/i, 'schedulers']]],
  ['action exclusions', (text) => prohibits(text, /never/i, /helpers/i,
    /merge/, /dispatch/, /notify/, /schedule/, /retry/, /pick the next phase/i),
    'Helpers never pick the next phase, retry, schedule, notify, dispatch or merge.', [[/never/i, 'always']]],
  ['help interface', (text) => requires(text, /each new helper/i, /supports --help/i, /lists (?:all|its) flags/i),
    'Each new helper supports --help, which lists all flags.', [[/supports --help/i, 'omits help']]],
];

for (const [name, accepts, rewording, inversions] of rules) {
  test(`helper rule: ${name} survives rewording and rejects removal or inversion`, () => {
    checkRule(guidance(), accepts, rewording, inversions);
  });
}

test('helper exit codes keep failed criteria separate from execution errors and holds', () => {
  const accepts = (text) => requires(text, /new helper exit codes/i, /0 ok \(including failed criteria\)/i,
    /1 error/i, /2 hold or incomplete/i, /10 regression.*readiness only/i);
  checkRule(guidance(), accepts,
    'New helper exit codes: 10 regression (readiness only), 2 hold or incomplete, 1 error, 0 ok (including failed criteria).',
    [[/0 ok \(including failed criteria\)/i, '0 ok (passing criteria only)'], [/2 hold or incomplete/i, '2 success']]);
});
