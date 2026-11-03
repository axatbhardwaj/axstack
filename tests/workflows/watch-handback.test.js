import { readFileSync } from 'node:fs';
import { test } from 'bun:test';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => sentences(readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')).join('. ');
const watch = () => read('axstack-watch/SKILL.md');
const readiness = () => read('axstack-watch/references/readiness.md');
const cleanup = () => read('axstack-cleanup/SKILL.md');

// Shipped instructions are the boundary; these checks do not prove live agent behavior.
function rule(name, source, concepts, rewording, inversions, prohibition) {
  test(name, () => checkRule(source(), (text) => prohibition
    ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts),
  rewording, inversions, concepts));
}

rule('active watches retain unresolved changes and required reviews', watch,
  [/watch is active/i, /unwatch/i, /hand back/i, /unresolved/i, /CHANGES_REQUESTED/i, /required review/i],
  'When a watch is active, never hand back or unwatch because a required review or CHANGES_REQUESTED remains unresolved.',
  [[/never/i, 'always'], [/unresolved/i, 'resolved']], /never/i);
rule('review blockers keep authorized repair and watching active', watch,
  [/continue/i, /repairing/i, /watching/i, /within/i, /recorded mode and authority/i, /review blockers/i],
  'For review blockers, continue watching and repairing within the recorded mode and authority.',
  [[/continue/i, 'stop'], [/within/i, 'outside']]);
rule('review state leaves cancellation expiry stop and hold rules intact', watch,
  [/user cancellation/i, /standalone expiry/i, /existing stop and hold rules/i, /unchanged/i],
  'Existing stop and hold rules, standalone expiry and user cancellation remain unchanged.',
  [[/unchanged/i, 'overridden']]);

rule('addressed stale changes use one blocked-on-person notification per review', readiness,
  [/stale/i, /CHANGES_REQUESTED/i, /findings are addressed/i, /blocked-on-person notification/i, /once per review ID/i],
  'For stale CHANGES_REQUESTED when findings are addressed, post the blocked-on-person notification once per review ID.',
  [[/addressed/i, 'outstanding'], [/once/i, 'repeatedly']]);
rule('person blockers never cause review re-requests', readiness,
  [/re-request/i, /review/i, /blocked on a person/i, /stale/i, /CHANGES_REQUESTED/i],
  'Never re-request review for a PR blocked on a person, including stale CHANGES_REQUESTED.',
  [[/never/i, 'always']], /never/i);

for (const skill of ['axstack-align', 'axstack-spec']) {
  const source = () => read(`${skill}/SKILL.md`);
  rule(`${skill} limits question advice to consequential decisions and disagreements`, source,
    [/consult advisers only/i, /consequential decisions/i, /disagreements/i],
    'For questions, consult advisers only for disagreements and consequential decisions.',
    [[/only/i, 'also'], [/consequential/i, 'routine']]);
  rule(`${skill} skips routine question dispatches`, source,
    [/dispatch advisers/i, /every question/i, /routine factual clarification/i, /settled preferences/i],
    'Never dispatch advisers for every question, routine factual clarification or settled preferences.',
    [[/never/i, 'always']], /never/i);
}

rule('cleanup batches eligible resources at run checkpoints', cleanup,
  [/batch/i, /eligible/i, /cleanup/i, /run checkpoints/i, /reviewer worktrees/i],
  'At run checkpoints, batch eligible cleanup including reviewer worktrees.',
  [[/batch/i, 'separate'], [/run checkpoints/i, 'each review']]);
rule('per-review cleanup preserves evidence without immediate retirement', cleanup,
  [/per-review invocations/i, /retire resources individually/i],
  'Per-review invocations never retire resources individually.',
  [[/never/i, 'always']], /never/i);
rule('per-review cleanup records pending resources with evidence', cleanup,
  [/per-review invocations/i, /preserve evidence/i, /record pending cleanup/i, /private run record/i],
  'Per-review invocations record pending cleanup in the private run record and preserve evidence.',
  [[/preserve evidence/i, 'discard evidence'], [/record pending cleanup/i, 'omit pending cleanup']]);
rule('cleanup defines checkpoint events', cleanup,
  [/run checkpoint/i, /\bis\b/i, /merge/i, /phase end/i, /run close-out/i],
  'A run checkpoint is a phase end, run close-out or merge.',
  [[/\bis\b/i, 'is not'], [/phase end/i, 'review completion']]);
rule('checkpoint batch authority is limited to its accepted completions', cleanup,
  [/checkpoint batch/i, /considers only/i, /resources owned by/i, /its accepted completions/i],
  'A checkpoint batch considers only resources owned by its accepted completions.',
  [[/considers only/i, 'also considers'], [/accepted completions/i, 'unaccepted completions']]);
rule('checkpoint batching preserves evidence and per-resource safety', cleanup,
  [/before/i, /checkpoint retirement/i, /preserve/i, /read back/i, /each resource.s evidence/i, /existing eligibility and safety guards/i],
  "Before checkpoint retirement, read back and preserve each resource's evidence and apply existing eligibility and safety guards.",
  [[/before/i, 'after'], [/preserve/i, 'discard']]);
