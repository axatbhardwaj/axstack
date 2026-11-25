import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const guidance = () => sentences(readFileSync(`${import.meta.dir}/../../AGENTS.md`, 'utf8')
  .replace(/[`*]/g, '')).join('. ');
const newHelperNames = [/usage-split/i, /evidence[- ](?:inspector|inspection)/i, /lane[- ]owner facts/i,
  /pr-fresh/i, /image[- ]resource extraction/i, /scratch/i, /capture/i, /sandbox/i,
  /drift[- ](?:check|inspection)/i, /quiet[- ]gate (?:facts|observations)/i];
const writerConcepts = [/process(?:es)?\b/i, /file[- ]?system/i, /containers?\b/i, /networks?\b/i,
  /clean[- ]?up/i, /scratch (?:execution|running)/i, /capture/i, /sandbox (?:run\/reap|reap\/run)/i];

const rules = [
  ['scope', (text) => requires(text, /only the new helpers/i, /dispatch-plan/, /pr-shape/, /readiness/, /run-init/, /hooks-check/, ...newHelperNames),
    'Only the new helpers quiet gate observations, drift inspection, image resource extraction, sandbox, capture, scratch, pr-fresh, lane owner facts, evidence inspection, usage-split, hooks-check, run-init, readiness, pr-shape and dispatch-plan follow this rule.',
    [[/only the new helpers/i, 'all scripts']], [/hooks-check/, ...newHelperNames]],
  ['legacy behavior', (text) => requires(text, /existing scripts/i, /retain|keep/i, /behavior/i),
    'The existing scripts keep their behavior.', [[/retain|keep/i, 'change']]],
  ['pure facts', (text) => prohibits(text, /no state between calls/i, /fact.*plan helpers/i,
    /dispatch-plan/, /pr-shape/, /readiness without --run/, /hooks-check/, /explicit inputs/i, /read-only/i,
    /git/, /gh/, /saved T3 JSON/, /SQLite (?:exports|snapshots)/i, /stdout/, /caller-given path/i),
    'Fact and plan helpers dispatch-plan, pr-shape, hooks-check and readiness without --run consume explicit inputs, read-only git/gh or saved T3 JSON or SQLite snapshots, emit to stdout or a caller-given path, and retain no state between calls.',
    [[/no state between calls/i, 'persistent state between calls'], [/read-only/i, 'read-write']], [/hooks-check/, /SQLite (?:exports|snapshots)/i]],
  ['writer boundaries', (text) => requires(text, /writer helpers/i, /run-init/, /readiness --run/,
    /every side effect/i, /--help/, /write only (?:those|disclosed) paths/i, ...writerConcepts),
    'Writer helpers capture, scratch running, sandbox reap/run, readiness --run and run-init must list every side effect in --help covering processes, file system, containers, networks and clean-up, and write only disclosed paths.',
    [[/write only (?:those|disclosed) paths/i, 'write any paths'], [/every side effect/i, 'selected side effects']], writerConcepts],
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
  ['agent invocation', (text) => requires(text, /agents/i, /call these helpers/i, /own turn/i),
    'Within their own turn, agents can call these helpers.', [[/own turn/i, 'other agents’ turns']]],
  ['workflow module boundary', (text) => prohibits(text, /not helpers|outside the helper rule/i, /workflow modules/i),
    'Workflow modules are outside the helper rule.', [[/not helpers|outside the helper rule/i, 'subject to the helper rule']]],
  ['workflow helper invocation', (text) => requires(text, /workflow steps/i, /call|invoke/i,
    /fact and plan helpers|fact\/plan helpers/i, /existing sandbox reap/i, /only/i),
    'Workflow steps can invoke only the existing sandbox reap and fact/plan helpers.',
    [[/only/i, 'unrestricted'], [/existing sandbox reap/i, 'any sandbox command']]],
  ['action exclusions', (text) => prohibits(text, /never/i, /helpers/i,
    /merge/, /dispatch/, /notify/, /schedule/, /retry/, /pick the next phase/i),
    'Helpers never pick the next phase, retry, schedule, notify, dispatch or merge.', [[/never/i, 'always']]],
  ['help interface', (text) => requires(text, /(?:each|every) new helper/i, /(?:supports|provides) --help/i, /(?:lists|enumerates) (?:all|its) flags/i),
    'Every new helper provides --help, which enumerates all flags.', [[/(?:supports|provides) --help/i, 'omits help']]],
];

for (const [name, accepts, rewording, inversions, concepts] of rules) {
  test(`helper rule: ${name} survives rewording and rejects removal or inversion`, () => {
    checkRule(guidance(), accepts, rewording, inversions, concepts);
  });
}

test('helper exit codes keep failed criteria separate from execution errors and holds', () => {
  const accepts = (text) => requires(text, /new helper exit codes/i, /0 ok \(including failed criteria\)/i,
    /1 error/i, /2 hold or incomplete/i, /10 regression.*readiness only/i);
  checkRule(guidance(), accepts,
    'New helper exit codes: 10 regression (readiness only), 2 hold or incomplete, 1 error, 0 ok (including failed criteria).',
    [[/0 ok \(including failed criteria\)/i, '0 ok (passing criteria only)'], [/2 hold or incomplete/i, '2 success']]);
});
