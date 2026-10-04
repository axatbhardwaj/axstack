import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const publication = () => read('skills/axstack/references/candidate-publication.md').split('## Immutable checkout shape')[0];
const diligence = () => read('skills/axstack/references/diligence.md');
const readiness = () => read('skills/axstack-implement/SKILL.md').split('4. Route the verdict.')[1]?.split('The T3 run watch')[0] ?? '';

// Declared prompt contracts, not a test-only policy interpreter or live agent proof.
// Existing diligence checks cover revision binding, not these three auditor gaps.
// Each direction targets its rule; an independent paraphrase must also pass.
const rules = [
  ['A-P5: check after every push before diligence and merge-ready', publication,
    [/(?:after|following) (?:each|every) push/i, /(?:before|ahead of) (?:post-push )?diligence (?:or|and) merge-ready/i, /compare|check|verify/i, /PR body|PR body's/i, /head SHA/i, /Confirmed remote SHA/i],
    /before (?:post-push )?diligence/i, 'after diligence',
    'Following each push, verify the PR body head SHA against Confirmed remote SHA ahead of diligence and merge-ready.'],
  ['A-P5: record the body head after each push', publication,
    [/(?:after|following) (?:each|every) push/i, /record|enter|log/i, /PR body head SHA/i, /sha or none/i],
    /record|enter/i, 'omit',
    'Following each push, log PR body head SHA: <sha or none> in the publication receipt.'],
  ['A-P5 holdout: absent head uses none and passes', publication,
    [/accept|allow|passes/i, /`none`/i, /without (?:a )?(?:stated )?head SHA/i, /PR body/i],
    /accept|allow/i, 'reject',
    'A PR body without a head SHA passes with `none`.'],
  ['A-P5 holdout: matching full head passes', publication,
    [/accept|allow|passes/i, /full head SHA/i, /only (?:when|if)/i, /equals|matches/i, /Confirmed remote SHA/i],
    /only (?:when|if)/i, 'even unless',
    'A full head SHA passes only if it matches Confirmed remote SHA.'],
  ['A-P5 holdout: matching abbreviated head passes at seven characters', publication,
    [/accept|allow|passes/i, /abbreviated head SHA/i, /only (?:when|if)/i, /matching prefix/i, /Confirmed remote SHA/i, /(?:at least (?:7|seven)|(?:7|seven) or more) (?:hexadecimal|hex) characters/i],
    /at least (?:7|seven)/i, 'at least 6',
    'An abbreviated head SHA passes only if it is a matching prefix of Confirmed remote SHA with seven or more hex characters.'],
  ['A-P5: stale body head holds the candidate', publication,
    [/hold|block|stop/i, /mismatched head SHA/i],
    /hold|block/i, 'advance',
    'Stop on a mismatched head SHA.'],
  ['short abbreviations cannot bypass the match', publication,
    [/hold|block|stop/i, /abbreviation/i, /shorter than (?:7|seven) characters/i],
    /shorter than (?:7|seven)/i, 'longer than 7',
    'Stop on an abbreviation shorter than seven characters.'],
  ['other body SHAs remain untouched', publication,
    [/leave|keep|preserve/i, /other SHAs/i, /PR body/i, /unchanged|untouched/i],
    /unchanged|untouched/i, 'updated',
    'Preserve other SHAs in the PR body untouched.'],
  ['B1: keep output from every full-suite run', diligence,
    [/retain|keep|save/i, /(?:full|complete) output/i, /(?:each|every) full[- ]suite run/i, /named log|log file/i, /private evidence (?:folder|directory)/i],
    /(?:each|every) full-suite run/i, 'successful full-suite runs',
    'Save the complete output from each full suite run in a log file in the private evidence directory.'],
  ['B1: unattributed failure is UNKNOWN', diligence,
    [/unattributed (?:full[- ]suite failure|failure of the full suite)/i, /report|return/i, /`UNKNOWN`/i],
    /`UNKNOWN`/i, '`PASS`',
    'An unattributed failure of the full suite is reported `UNKNOWN`.'],
  ['B1: unattributed failure cannot PASS', diligence,
    [/unattributed (?:full[- ]suite failure|failure of the full suite)/i, /`PASS`/i],
    /never report/i, 'report',
    'Never certify an unattributed failure of the full suite as `PASS`.', /never (?:report|certify)/i],
  ['driver records failure disposition', diligence,
    [/driver/i, /records?|enters?|logs?/i, /disposition/i, /(?:each|every) (?:full[- ]suite failure|failure of the full suite)/i, /run record/i],
    /(?:each|every) full-suite failure/i, 'selected full-suite failures',
    'The driver logs in the run record the disposition of every failure of the full suite.'],
  ['B1 holdout: retained attributed failure reports normally', diligence,
    [/report/i, /attributed failure/i, /(?:retained|preserved) output/i, /normally|usual way/i],
    /normally/i, 'as PASS',
    'An attributed failure is reported in the usual way with preserved output.'],
  ['UNKNOWN or attribution cannot turn a failed suite green', diligence,
    [/observed full-suite failure/i, /still fails|remains failed/i, /attributed/i, /`UNKNOWN`/i],
    /still fails|remains failed/i, 'passes',
    'Even if attributed or reported `UNKNOWN`, an observed full-suite failure remains failed.'],
  ['full-suite failure requires no reruns', diligence,
    [/reruns?/i], /no reruns are required/i, 'reruns are required',
    'A rerun is not mandatory.', /no reruns are required|reruns are not required|a rerun is not mandatory/i],
  ['A-P3: contradictory Learning is an owning PR finding before merge-ready', readiness,
    [/(?:before|ahead of) merge-ready/i, /run-record `Learning`/i, /(?:contradicts|conflicts with) a shipped rule/i, /finding (?:on the owning PR|for the PR that owns the change)/i, /(?:hold|block) merge-ready/i, /until.*(?:contradiction|conflict).*resolved/i],
    /hold merge-ready/i, 'allow merge-ready',
    'Ahead of merge-ready, classify a run-record `Learning` that conflicts with a shipped rule as a finding for the PR that owns the change and block merge-ready until the conflict is resolved.'],
  ['A-P3 holdout: unrelated Learning leaves readiness unchanged', readiness,
    [/unrelated run-record `Learning`/i, /merge-ready eligibility/i, /unchanged|untouched/i],
    /unchanged|untouched/i, 'blocked',
    'An unrelated run-record `Learning` keeps merge-ready eligibility untouched.'],
];

for (const [name, source, concepts, flip, inverse, rewording, prohibition] of rules) {
  test(`publication integrity: ${name}`, () => {
    const accepts = (text) => prohibition
      ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    const text = source();
    expect(accepts(text), 'missing required instruction').toBe(true);
    const clauses = sentences(text);
    const matching = clauses.filter(accepts);
    expect(matching).toHaveLength(1);
    const rewrite = (replacement) => clauses.map((clause) =>
      matching.includes(clause) ? replacement(clause) : clause).join('. ');
    expect(accepts(rewrite(() => '')), 'removal').toBe(false);
    expect(matching[0]).toMatch(flip);
    expect(accepts(rewrite((clause) => clause.replace(flip, inverse))), 'inversion').toBe(false);
    expect(accepts(rewrite(() => rewording)), 'equivalent rewording').toBe(true);
    expect(accepts(rewrite(() => `Do not ${rewording}`)), 'negated rewording').toBe(false);
  });
}

test('publication receipt records the head SHA or none alongside confirmed remote SHA', () => {
  const template = publication().match(/```text\n([\s\S]*?)```/)?.[1];
  expect(template).toMatch(/^Confirmed remote SHA: <sha>$/m);
  expect(template).toMatch(/^PR body head SHA: <sha or none>$/m);
});
