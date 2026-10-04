import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const referencePath = 'skills/axstack/references/ste-writing.md';
const guidance = () => read(referencePath);
const contracts = () => read('skills/axstack/references/contracts.md');

// These guard the new prompt policy; existing tests do not cover writing scope.
// Missing prose is a contract failure, not an import or setup error.
const rules = [
  ['prospective scope', guidance,
    [/new/i, /materially (?:revised|changed)/i, /user-facing output/i, /follow|apply/i, /rules|guidance/i, /only (?:for|to)/i],
    /only for new or materially revised/i, 'for all existing',
    'Apply this guidance only to user-facing output that is new or materially changed.'],
  ['output types', guidance,
    [/user-facing output/i, /includes?|covers?/i, /reports/i, /PR bodies/i, /briefs/i, /read-backs/i, /packaged (?:guidance|prose)/i],
    /includes/i, 'excludes',
    'User-facing output covers reports, PR bodies, briefs, read-backs, and packaged prose.'],
  ['preserve existing prose', guidance,
    [/rewrite|rework/i, /existing|unchanged/i, /prose/i, /style/i],
    /Do not rewrite/i, 'Rewrite',
    'Never rework unchanged prose for style.', /do not rewrite|never rework/i],
  ...['exact identifiers', 'quotes', 'safety contracts', 'prompt-byte contracts'].map((term) => [
    `preserve ${term}`, guidance, [/keep|preserve/i, new RegExp(term, 'i'), /unchanged|intact/i],
    /unchanged/i, 'revised', `Preserve ${term} intact.`,
  ]),
  ['one instruction per sentence', guidance,
    [/each sentence|per sentence/i, /one|single/i, /instruction/i],
    /one instruction/i, 'several instructions',
    'Use a single instruction per sentence.'],
  ['short sentences', guidance,
    [/sentences?/i, /short|brief/i, /keep|make/i],
    /short/i, 'long', 'Make sentences brief.'],
  ['active voice', guidance,
    [/write|use/i, /active voice/i], /active voice/i, 'passive voice', 'Use active voice.'],
  ['condition before step', guidance,
    [/condition/i, /before|ahead of/i, /step|action/i, /state|place/i],
    /before the step/i, 'after the step',
    'When an action has a condition, place that condition ahead of the action.'],
  ['define terms before use', guidance,
    [/define|explain/i, /technical terms/i, /before|ahead of/i, /first use/i],
    /before/i, 'after', 'Explain technical terms ahead of their first use.'],
  ['consistent terms', guidance,
    [/one name|single name/i, /consistently|throughout/i, /each term|every term/i],
    /one name/i, 'several names', 'Use a single name throughout for every term.'],
  ['words for conjunctions', guidance,
    [/use|write/i, /words (?:instead of|rather than) slashes/i, /and/i, /or/i],
    /words instead of slashes/i, 'slashes instead of words',
    'Write words rather than slashes for the conjunctions and and or.'],
  ['contracts loads writing guidance for user-facing output', contracts,
    [/user-facing output/i, /follow|apply/i, /STE-inspired writing/i],
    /follow/i, 'ignore', 'Apply STE-inspired writing to user-facing output.'],
];

for (const [name, source, concepts, flip, inverse, rewording, prohibition] of rules) {
  test(`STE-inspired writing: ${name}`, () => {
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
    if (!prohibition) expect(accepts(rewrite(() => `Do not ${rewording}`)), 'negated rewording').toBe(false);
  });
}

test('STE-inspired writing: contracts links the packaged reference once', () => {
  expect(existsSync(`${root}/${referencePath}`), 'missing writing reference').toBe(true);
  expect(contracts().match(/\]\(ste-writing\.md\)/g) ?? []).toHaveLength(1);
});
