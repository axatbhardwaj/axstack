import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

// Match checkRule's link normalization when substituting real-source rewordings.
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const publication = 'skills/axstack/references/candidate-publication.md';
const diligence = 'skills/axstack/references/diligence.md';
const readiness = 'skills/axstack-implement/SKILL.md';

// Declared prompt contracts, not a test-only policy interpreter or live agent proof.
// Existing diligence checks cover revision binding, not these auditor gaps.
// PR fact comparisons are covered by pr-shape-proof.test.js (R1).
// Each direction targets its rule; an independent paraphrase must also pass.
const rules = [
  ['proof is rendered and checked before reviewer dispatch', publication,
    [/(?:before|ahead of) reviewer dispatch/i, /render/i, /check|verify/i, /PR facts/i, /proof mode/i],
    /before|ahead of/i, 'after',
    'Ahead of reviewer dispatch, render and verify PR facts using PR body proof mode.'],
  ['proof runs after every push before diligence or merge-ready', publication,
    [/(?:after|following) (?:every|each) push/i, /(?:before|ahead of) (?:post-push )?diligence (?:or|and) merge-ready/i, /run|execute/i, /proof mode/i, /live PR body/i],
    /before|ahead of/i, 'after',
    'Following each push, ahead of diligence or merge-ready, execute proof mode against the live PR body and save its JSON evidence.'],
  ['proof JSON is retained after every push', publication,
    [/(?:after|following) (?:every|each) push/i, /retain|keep|save/i, /JSON evidence/i],
    /retain|keep|save/i, 'discard',
    'Following each push, ahead of diligence or merge-ready, execute proof mode against the live PR body and save its JSON evidence.'],
  ['failed or unknown terms hold publication progression', publication,
    [/hold|block|stop/i, /publication (?:progression|progress)/i, /any|every/i, /failed or unknown/i, /term/i],
    /hold|block|stop/i, 'continue',
    'Block publication progress on every failed or unknown term.'],
  ['B1: keep output from every full-suite run', diligence,
    [/retain|keep|save/i, /(?:full|complete) output/i, /(?:each|every) full[- ]suite run/i, /named log|log file/i, /private evidence (?:folder|directory)/i],
    /(?:each|every) full[- ]suite run/i, 'successful full-suite runs',
    'Save the complete output from each full suite run in a log file in the private evidence directory.'],
  ['B1: unattributed failure is UNKNOWN', diligence,
    [/unattributed (?:full[- ]suite failure|failure of the full suite)|full[- ]suite failure cannot be attributed/i, /report|return/i, /`UNKNOWN`/i],
    /`UNKNOWN`/i, '`PASS`',
    'An unattributed failure of the full suite is reported `UNKNOWN`.'],
  ['B1: unattributed failure cannot PASS', diligence,
    [/unattributed (?:full[- ]suite failure|failure of the full suite)/i, /`PASS`/i],
    /never (?:(?:be )?reported|report|certify)/i, 'report',
    'Never certify an unattributed failure of the full suite as `PASS`.', /never (?:(?:be )?reported|report|certify)/i],
  ['driver records failure disposition', diligence,
    [/driver/i, /records?|enters?|logs?/i, /disposition/i, /(?:each|every) (?:full[- ]suite failure|failure of the full suite)/i, /run record/i],
    /(?:each|every) (?:full[- ]suite failure|failure of the full suite)/i, 'selected full-suite failures',
    'The driver logs in the run record the disposition of every failure of the full suite.'],
  ['B1 holdout: retained attributed failure reports normally', diligence,
    [/report/i, /attributed failure/i, /(?:retained|preserved) output/i, /normally|usual way/i],
    /normally|usual way/i, 'as PASS',
    'An attributed failure is reported in the usual way with preserved output.'],
  ['UNKNOWN or attribution cannot turn a failed suite green', diligence,
    [/observed full-suite failure/i, /still fails|remains failed/i, /attributed/i, /`UNKNOWN`/i],
    /still fails|remains failed/i, 'passes',
    'Even if attributed or reported `UNKNOWN`, an observed full-suite failure remains failed.'],
  ['full-suite failure requires no reruns', diligence,
    [/reruns?/i], /no reruns are required|reruns are not required|a rerun is not mandatory/i, 'reruns are required',
    'A rerun is not mandatory.', /no reruns are required|reruns are not required|a rerun is not mandatory/i],
  ['A-P3: contradictory Learning is an owning PR finding before merge-ready', readiness,
    [/(?:before|ahead of) merge-ready/i, /run-record `Learning`/i, /(?:contradicts|conflicts with) a shipped rule/i, /finding (?:on the owning PR|for the PR that owns the change)/i, /(?:hold|block) merge-ready/i, /until.*(?:contradiction|conflict).*resolved/i],
    /(?:hold|block) merge-ready/i, 'allow merge-ready',
    'Ahead of merge-ready, classify a run-record `Learning` that conflicts with a shipped rule as a finding for the PR that owns the change and block merge-ready until the conflict is resolved.'],
  ['A-P3 holdout: unrelated Learning leaves readiness unchanged', readiness,
    [/unrelated run-record `Learning`/i, /merge-ready eligibility/i, /unchanged|untouched/i],
    /unchanged|untouched/i, 'blocked',
    'An unrelated run-record `Learning` keeps merge-ready eligibility untouched.'],
  ['diligence UNKNOWN holds the PR with a recorded reason', readiness,
    [/diligence/i, /`UNKNOWN`/i, /PR/i, /`held`/i, /reason/i, /run record/i, /blocks? merge-ready/i, /pending|until/i, /driver.*disposition/i],
    /`held`/i, '`merge-ready`',
    'For diligence `UNKNOWN`, keep the PR `held`, enter its reason in the run record, and block merge-ready until the driver records its disposition.'],
];

const acceptsRule = ([, , concepts, , , , prohibition]) => (text) => prohibition
  ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);

function checkContract(text, rule) {
  const [, , concepts, flip, inverse, rewording] = rule;
  const accepts = acceptsRule(rule);
  expect(sentences(text).filter(accepts)).toHaveLength(1);
  checkRule(text, accepts, rewording, [[flip, inverse], [/^/, 'Do not ']], concepts);
}

for (const rule of rules) {
  const [name, source, , , , rewording] = rule;
  test(`publication integrity: ${name}`, () => checkContract(read(source), rule));
  // Substitute in memory; check sibling rules to preserve shared clauses.
  test(`publication integrity real-source rewording: ${name}`, () => {
    const originalSource = read(source);
    const original = sentences(read(source)).find(acceptsRule(rule));
    expect(original, 'missing source instruction').toBeTruthy();
    const pattern = new RegExp(original.split(/\s+/).map((word) =>
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
    expect(originalSource).toMatch(pattern);
    const reworded = originalSource.replace(pattern, rewording.replace(/[.!?]$/, ''));
    for (const sibling of rules.filter((row) => row[1] === source)) checkContract(reworded, sibling);
    expect(read(source), 'source remains unchanged').toBe(originalSource);
  });
}
