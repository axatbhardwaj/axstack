import { expect, test } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
    /only (?:for|to)/i, 'also for',
    'Apply this guidance only to user-facing output that is new or materially changed.'],
  ['output types', guidance,
    [/user-facing output/i, /includes?|covers?/i, /reports/i, /PR bodies/i, /briefs/i, /read-backs/i, /packaged (?:guidance|prose)/i],
    /includes?|covers?/i, 'excludes',
    'User-facing output covers reports, PR bodies, briefs, read-backs, and packaged prose.'],
  ['preserve existing prose', guidance,
    [/rewrite|rework/i, /existing|unchanged/i, /prose/i, /style/i],
    /do not rewrite|never rework/i, 'Rewrite',
    'Never rework unchanged prose for style.', /do not rewrite|never rework/i],
  ...['exact identifiers', 'quotes', 'safety contracts', 'prompt-byte contracts'].map((term) => [
    `preserve ${term}`, guidance, [/keep|preserve/i, new RegExp(term, 'i'), /unchanged|intact/i],
    /unchanged|intact/i, 'revised', `Preserve ${term} intact.`,
  ]),
  ['one instruction per sentence', guidance,
    [/each sentence|per sentence/i, /one|single/i, /instruction/i],
    /one|single/i, 'several',
    'Use a single instruction per sentence.'],
  ['short sentences', guidance,
    [/sentences?/i, /short|brief/i, /keep|make/i],
    /short|brief/i, 'long', 'Make sentences brief.'],
  ['active voice', guidance,
    [/write|use/i, /active voice/i], /active voice/i, 'passive voice', 'Use active voice.'],
  ['condition before step', guidance,
    [/condition/i, /before|ahead of/i, /step|action/i, /state|place/i],
    /before|ahead of/i, 'after',
    'When an action has a condition, place that condition ahead of the action.'],
  ['define terms before use', guidance,
    [/define|explain/i, /technical terms/i, /before|ahead of/i, /first use/i],
    /before|ahead of/i, 'after', 'Explain technical terms ahead of their first use.'],
  ['consistent terms', guidance,
    [/one name|single name/i, /consistently|throughout/i, /each term|every term/i],
    /one name|single name/i, 'several names', 'Use a single name throughout for every term.'],
  ['words for conjunctions', guidance,
    [/use|write/i, /words (?:instead of|rather than) slashes/i, /and/i, /or/i],
    /words (?:instead of|rather than) slashes/i, 'slashes instead of words',
    'Write words rather than slashes for the conjunctions and and or.'],
  ['contracts loads writing guidance for user-facing output', contracts,
    [/user-facing output/i, /follow|apply/i, /STE-inspired writing/i],
    /follow|apply/i, 'ignore', 'Apply [STE-inspired writing](ste-writing.md) to user-facing output.'],
];

const acceptsRule = ([, , concepts, , , , prohibition]) => (text) => prohibition
  ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);

function checkRule(text, rule) {
  const [, , , flip, inverse, rewording, prohibition] = rule;
  const accepts = acceptsRule(rule);
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
}

for (const rule of rules) {
  const [name, source, , , , rewording] = rule;
  test(`STE-inspired writing: ${name}`, () => checkRule(source(), rule));
  // Synchronous source writes restore even when a sibling assertion fails.
  test(`STE-inspired writing real-source rewording: ${name}`, () => {
    const path = `${root}/${source === guidance ? referencePath : 'skills/axstack/references/contracts.md'}`;
    const backup = readFileSync(path);
    // Keep raw Markdown links while matching normalized, possibly wrapped prose.
    const original = backup.toString().replace(/\s+/g, ' ').split(/[.!?;]\s+/).find(acceptsRule(rule));
    expect(original, 'missing source instruction').toBeTruthy();
    const pattern = new RegExp(original.split(/\s+/).map((word) =>
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
    expect(backup.toString()).toMatch(pattern);
    try {
      writeFileSync(path, backup.toString().replace(pattern, rewording.replace(/[.!?]$/, '')));
      for (const sibling of rules.filter((row) => row[1] === source)) checkRule(source(), sibling);
    } finally {
      writeFileSync(path, backup);
    }
    expect(readFileSync(path).equals(backup), 'byte-for-byte restore').toBe(true);
  });
}

test('STE-inspired writing: contracts links the packaged reference once', () => {
  expect(existsSync(`${root}/${referencePath}`), 'missing writing reference').toBe(true);
  expect(contracts().match(/\]\(ste-writing\.md\)/g) ?? []).toHaveLength(1);
});
