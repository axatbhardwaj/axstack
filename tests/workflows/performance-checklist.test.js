import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const referencePath = 'skills/axstack/references/performance-checklist.md';
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const guidance = () => read(referencePath);

// Independent prompt contracts: existing coverage does not vet performance claims.
// Absent guidance produces assertion failures rather than missing-module errors.
const rules = [
  ['performance scope', guidance, [/use|apply/i, /checklist/i, /only (?:for|to)/i, /performance claims/i],
    2, 'also for', 'Apply this checklist only to performance claims.'],
  ['audit owns workflow counts', guidance, [/keep|leave/i, /workflow count accounting/i, /with axstack-audit/i],
    2, 'with this checklist', 'Leave workflow count accounting with axstack-audit.'],
  ['limiter', guidance, [/identify|name/i, /resource|code path/i, /limits|bounds/i, /profiles|counters/i, /run/i],
    3, 'source guesses', 'Name the resource or code path that bounds the result using profiles or counters from a run.'],
  ['tuning', guidance, [/check|verify/i, /each option|every option/i, /production settings/i, /versions/i, /data/i],
    2, 'arbitrary defaults', 'Verify every option with comparable production settings, versions, and data.'],
  ['limits', guidance, [/compare|check/i, /result/i, /hardware limits/i, /changed (?:code|piece)/i, /share|fraction/i, /elapsed time|duration/i],
    2, 'unrelated targets', "Check the result against hardware limits and the changed piece's fraction of the total duration."],
  ['errors', guidance, [/verify|check/i, /successful|success/i, /correct outputs|output correctness/i, /error|failure/i, /counts|totals/i],
    1, 'fast failures', 'Check success and output correctness using failure totals from the measurement run.'],
  ['reproducibility', guidance, [/report|record/i, /median/i, /range|spread/i, /repeated/i, /alternating|interleaved/i, /runs|trials/i],
    3, 'single selected', 'Record the median and spread from repeated interleaved trials of each option.'],
  ['relevance', guidance, [/measure|check/i, /end-to-end/i, /user path/i, /realistic/i, /data/i, /concurrency/i],
    1, 'isolated helper', 'Check the end-to-end user path with realistic concurrency and data.'],
  ['work happened', guidance, [/verify|confirm/i, /intended work/i, /completed|finished/i, /inside|within/i, /timed region|measurement window/i],
    2, 'was skipped', 'Confirm that the intended work finished within the measurement window.'],
  ...['debug', 'improve', 'review'].map((skill) => [
    `${skill} conditional load`, () => read(`skills/axstack-${skill}/SKILL.md`),
    [/performance claims/i, /only/i, /load|read|consult/i, /Performance checklist/i],
    1, 'Regardless of whether',
    'Only when assessing performance claims, consult [Performance checklist](../axstack/references/performance-checklist.md).',
  ]),
];

const acceptsRule = ([, , concepts]) => (text) => requires(text, ...concepts);

function checkRule(text, rule) {
  const [, , concepts, flipIndex, inverse] = rule;
  const accepts = acceptsRule(rule);
  expect(accepts(text), 'missing required instruction').toBe(true);
  const clauses = sentences(text);
  const matching = clauses.filter(accepts);
  expect(matching).toHaveLength(1);
  const rewrite = (replacement) => clauses.map((clause) =>
    matching.includes(clause) ? replacement(clause) : clause).join('. ');
  expect(accepts(rewrite(() => '')), 'removal must be red').toBe(false);
  // Use the accepted concept itself, including every spelling and occurrence.
  const flip = new RegExp(concepts[flipIndex].source, 'gi');
  expect(matching[0]).toMatch(flip);
  expect(accepts(rewrite((clause) => clause.replace(flip, inverse))), 'inversion must be red').toBe(false);
}

for (const rule of rules) {
  const [name, source, , , , rewording] = rule;
  test(`performance checklist: ${name}`, () => checkRule(source(), rule));
  test(`performance checklist real-source rewording: ${name}`, () => {
    const text = source();
    const originals = text.split('\n').filter(acceptsRule(rule));
    expect(originals).toHaveLength(1);
    // Replace the real instruction in the full file string; never write the file.
    const reworded = text.replace(originals[0], rewording);
    for (const sibling of rules.filter((row) => row[1] === source)) checkRule(reworded, sibling);
    if (name.endsWith('conditional load')) checkLink(reworded);
  });
}

function checkLink(text) {
  // Check the linked directive itself so unrelated prose cannot supply scope.
  const raw = text.match(/[^.!?\n]*\[Performance checklist\]\([^)]*\)[^.!?\n]*/g) ?? [];
  expect(raw).toHaveLength(1);
  expect(raw[0]).toContain('(../axstack/references/performance-checklist.md)');
  expect(requires(raw[0], /only/i, /performance claims/i, /load|read|consult/i)).toBe(true);
}

test('performance checklist: conditional links resolve to the packaged reference', () => {
  expect(existsSync(`${root}/${referencePath}`), 'missing packaged reference').toBe(true);
  for (const skill of ['debug', 'improve', 'review']) checkLink(read(`skills/axstack-${skill}/SKILL.md`));
});
