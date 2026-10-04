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
  ['performance scope', guidance, [/use|apply/i, /checklist/i, /only (?:for|to)/i, /performance claims/i]],
  ['audit owns workflow counts', guidance, [/keep|leave/i, /workflow count accounting/i, /with axstack-audit/i]],
  ['limiter', guidance, [/identify|name/i, /resource|code path/i, /limits|bounds/i, /profiles|counters/i, /run/i]],
  ['tuning', guidance, [/check|verify/i, /each option|every option/i, /production settings/i, /versions/i, /data/i]],
  ['limits', guidance, [/compare|check/i, /result/i, /hardware limits/i, /changed (?:code|piece)/i, /share|fraction/i, /elapsed time|duration/i]],
  ['errors', guidance, [/verify|check/i, /successful|success/i, /correct outputs|output correctness/i, /error|failure/i, /counts|totals/i]],
  ['reproducibility', guidance, [/report|record/i, /median/i, /range|spread/i, /repeated/i, /alternating|interleaved/i, /runs|trials/i]],
  ['relevance', guidance, [/measure|check/i, /end-to-end/i, /user path/i, /realistic/i, /data/i, /concurrency/i]],
  ['work happened', guidance, [/verify|confirm/i, /intended work/i, /completed|finished/i, /inside|within/i, /timed region|measurement window/i]],
  ...['debug', 'improve', 'review'].map((skill) => [
    `${skill} conditional load`, () => read(`skills/axstack-${skill}/SKILL.md`),
    [/performance claims/i, /only/i, /load|read|consult/i, /Performance checklist/i],
  ]),
];

for (const [name, source, concepts] of rules) {
  test(`performance checklist: ${name}`, () => {
    const accepts = (text) => requires(text, ...concepts);
    expect(accepts(source()), 'missing required instruction').toBe(true);
    expect(sentences(source()).filter(accepts)).toHaveLength(1);
  });
}

test('performance checklist: conditional links resolve to the packaged reference', () => {
  expect(existsSync(`${root}/${referencePath}`), 'missing packaged reference').toBe(true);
  for (const skill of ['debug', 'improve', 'review']) {
    // Check the linked directive itself so unrelated prose cannot supply scope.
    const raw = read(`skills/axstack-${skill}/SKILL.md`).match(/[^.!?\n]*\[Performance checklist\]\([^)]*\)[^.!?\n]*/g) ?? [];
    expect(raw).toHaveLength(1);
    expect(raw[0]).toContain('(../axstack/references/performance-checklist.md)');
    expect(requires(raw[0], /only/i, /performance claims/i, /load|read|consult/i)).toBe(true);
  }
});
