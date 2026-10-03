import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { sentences, requires } from './prose-contract.js';

const path = `${import.meta.dir}/../../skills/axstack/references/test-audit-weekly.md`;
// An absent prompt is an absent instruction, not an import/setup failure.
const policy = existsSync(path) ? readFileSync(path, 'utf8') : '';
const noPublication = (sentence) =>
  /\bpublish nothing\b|\b(?:do not|never) (?:publish|open\b.*\bPR)\b|\bno (?:PR|publication)\b/i.test(sentence)
  && !/\b(?:not|never) publish nothing\b|\b(?:may|must|should) (?:publish|open)\b/i.test(sentence);

test('weekly audits withhold publication on unsafe or empty admission', () => {
  const conditions = [
    [/\b(?:red|fail\w*)\b/i, /\b(?:baseline|starting suite)\b/i],
    [/\b(?:flaky|unstable)\b/i, /\b(?:baseline|starting suite)\b/i],
    [/\b(?:overlap\w*|conflict\w*)\b/i, /\b(?:live|active)\b/i, /\bT3\b/i,
      /\b(?:thread|worktree)\b/i, /\b(?:ownership|owned paths)\b/i],
    [/\b(?:open|pending)\b/i, /\btest-audit\b/i, /\bPR\b/i],
    [/\b(?:zero|no)\b/i, /\bproven\b/i, /\bcandidates\b/i],
  ];
  for (const concepts of conditions) {
    expect(sentences(policy).some((sentence) => concepts.every((concept) => concept.test(sentence))
      && noPublication(sentence)), `publication guard: ${concepts}`).toBe(true);
  }
});

test('weekly test edits forbid weakening and changes to delivery controls', () => {
  const forbidden = [
    [/\bskip\b/i], [/\bonly\b/i], [/\bxfail\b/i],
    [/\brewrit\w*\b/i, /\bsnapshots?\b/i],
    [/\bcoverage[- ]thresholds?\b/i], [/\bCI\b/], [/\bline[- ]caps?\b/i],
  ];
  for (const concepts of forbidden) {
    expect(sentences(policy).some((sentence) =>
      concepts.every((concept) => concept.test(sentence))
      && (/\b(?:forbidden|prohibited)\b/i.test(sentence)
        || (/\b(?:never|do not)\b/i.test(sentence) && /\b(?:edit|rewrite|change)\b/i.test(sentence)))
      && !/\b(?:not forbidden|not prohibited|do not forbid|never prohibit|allowed|permitted)\b/i.test(sentence)),
    `forbidden edit: ${concepts}`).toBe(true);
  }
});

test('weekly F repairs use shared proof and mixed receipts keep both evidence paths', () => {
  expect(requires(policy, /\bF repairs?\b/i, /\b(?:apply|use|follow)\b/i, /\bF proof\b/i)).toBe(true);
  expect(policy).toContain('](test-value.md#f-proof)');
  expect(requires(policy, /\b(?:mix\w*|combin\w*)\b/i, /\bC\s*\/\s*D\b/,
    /\bF repairs?\b/i, /\b(?:record|document)\b/i, /\bboth\b/i, /\bevidence paths?\b/i,
    /\bstructure-preserving\b/i, /\bF proof\b/i, /\breceipt\b/i)).toBe(true);
  expect(sentences(policy).some((sentence) =>
    [/\b(?:never|do not)\b/i, /\b(?:weaken\w*|loosen\w*)\b/i, /\bassertions?\b/i]
      .every((concept) => concept.test(sentence))
    && !/\b(?:may|should|must) (?:weaken|loosen)\b/i.test(sentence))).toBe(true);
});

test('weekly admission holds without authority or a canary and stops on exhausted budget', () => {
  expect(sentences(policy).some((sentence) =>
    [/\bmissing\b/i, /\bauthority\b/i, /\b(?:no|without)\b/i, /\bpassing\b/i,
      /\bnative canary\b/i, /\b(?:hold\w*|held)\b/i, /\badmission\b/i]
      .every((concept) => concept.test(sentence))
    && !/\b(?:do not|never) hold\w*\b/i.test(sentence))).toBe(true);
  expect(sentences(policy).some((sentence) =>
    [/\bbudget\b/i, /\b(?:runs out|exhaust\w*)\b/i, /\bstop\w*\b/i, /\breport\w*\b/i]
      .every((concept) => concept.test(sentence)) && noPublication(sentence))).toBe(true);
});


test('weekly audits use an inherited T3 scheduled binding', () => {
  const concepts = [/schedule_task/, /T3/, /binding/i, /read.?back/i, /stable/i, /clientRequestId/];
  expect(requires(policy, ...concepts)).toBe(true);
  const holdout = 'T3 schedule_task must inherit the binding readback with a stable clientRequestId.';
  expect(requires(holdout, ...concepts)).toBe(true);
  expect(requires(holdout.replace('must', 'must not'), ...concepts)).toBe(false);
  expect(requires('', ...concepts)).toBe(false);
});

test('weekly audits use an unbound weekly fixed_time schedule', () => {
  const concepts = [/schedule_task/, /unbound/i, /weekly/i, /fixed_time/, /bindToCurrentThread:false/];
  expect(requires(policy, ...concepts)).toBe(true);
  const holdout = 'For weekly audits, schedule_task must use an unbound fixed_time schedule with bindToCurrentThread:false.';
  expect(requires(holdout, ...concepts)).toBe(true);
  expect(requires(holdout.replace('must', 'must not'), ...concepts)).toBe(false);
  expect(requires(sentences(policy).filter((sentence) => !requires(sentence, ...concepts)).join('. '), ...concepts)).toBe(false);
});
