import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { loadedReferences, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const explain = 'skills/axstack-explain/SKILL.md';
const qa = 'skills/axstack-explain/references/visual-qa.md';
const diagram = '../axstack-diagram/SKILL.md';
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

// Prompt contracts, not live compliance. Existing explain coverage predates
// diagram routing, card exemptions, and finalize-bound QA. Each mutation uses
// the real source in memory; tests never write tracked files.
const rules = [
  ['every diagram', explain, [/load|read|follow/i, /every diagram/i],
    /every/i, 'some', `For every diagram, read [Diagram](${diagram}).`, null, diagram],
  ['inline Mermaid without an agent', explain, [/simple chat/i, /Mermaid rules/i, /inline/i, /agent/i],
    /never dispatch|do not launch/i, 'always dispatch', 'For simple chat answers, do not launch an agent when using its Mermaid rules inline.', /never dispatch|do not launch/i],
  ['complex archify author', explain, [/complex visual/i, /configured/i, /axstack-explainer/i, /archify/i, /use|dispatch/i],
    /archify/i, 'generic', 'For a complex visual, dispatch the configured axstack-explainer through the archify path.'],
  ['explain ownership', explain, [/explain owns/i, /evidence gathering/i, /claim labels/i, /700-word cap/i, /dispatch/i, /delivery/i],
    /explain owns/i, 'diagram owns', 'Explain owns evidence gathering, claim labels, the 700-word cap, dispatch, and delivery.'],
  ['one-way integration', explain, [/diagram/i, /calls?|invokes?/i, /explain/i],
    /never calls|do not let/i, 'always calls', 'Do not let diagram invoke explain.', /never calls|do not let/i],
  ['only archify cards exempt', explain, [/only/i, /archify node detail cards/i, /exempt/i, /700-word cap/i],
    /exempt/i, 'included', 'Only archify node detail cards are exempt from the 700-word cap.'],
  ['card limit and source', explain, [/each card/i, /at most 40 words|40-word ceiling/i, /source/i],
    /at most 40 words|40-word ceiling/i, 'at least 400 words', 'Each card has a 40-word ceiling and cites its source.'],
  ['non-card words counted', explain, [/count|include/i, /node labels/i, /headings/i, /captions/i, /all non-card text/i],
    /count|include/i, 'exclude', 'Include node labels, headings, captions, and all non-card text in the word count.'],
  ['essential answers and evidence visible', explain, [/essential answers/i, /hidden|hide/i, /links/i, /evidence/i, /silently discard/i],
    /must not be hidden behind links, and evidence must not be silently discarded|never hide/i, 'must be hidden', 'Never hide essential answers behind links or silently discard evidence.', /must not be hidden behind links, and evidence must not be silently discarded|never hide/i],
  ['verifier hash binding', qa, [/archify output/i, /\b(?:bind|pin)\b/i, /axstack-ui-verifier/i, /finalize receipt/i, /artifact.sha256/i],
    /\b(?:bind|pin)\b/i, 'unbind', "For archify output, pin the axstack-ui-verifier pass to the finalize receipt's artifact.sha256."],
  ['reviewer hash binding', qa, [/archify output/i, /\b(?:bind|pin)\b/i, /axstack-explainer-review/i, /finalize receipt/i, /artifact.sha256/i],
    /\b(?:bind|pin)\b/i, 'unbind', "For archify output, pin axstack-explainer-review to the finalize receipt's artifact.sha256."],
  ['mandatory nodes and edges', qa, [/archify output/i, /require|obtain/i, /axstack-explainer-review/i, /every node and edge/i, /source/i],
    /require|obtain/i, 'waive', 'For archify output, obtain axstack-explainer-review of every node and edge against source.'],
  ['byte changes refresh both checks', qa, [/any|every/i, /byte change/i, /requires|needs/i, /fresh QA and review/i],
    /fresh/i, 'stale', 'Every byte change needs fresh QA and review.'],
];

const accepts = ([, , concepts, , , , prohibition, reference], text) => {
  const instruction = prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
  return instruction && (!reference || loadedReferences(text).includes(reference));
};

function check(source, rule) {
  const [name, , , flip, inverse, rewording] = rule;
  expect(accepts(rule, source), `${name}: missing instruction`).toBe(true);
  const clauses = source.replace(/\s+/g, ' ').split(/[.!?;]\s+/);
  const matching = clauses.filter((clause) => accepts(rule, clause));
  expect(matching, `${name}: one instruction owns the rule`).toHaveLength(1);
  // Find the actual source span, preserving Markdown, links, and other rules.
  const pattern = new RegExp(matching[0].split(/\s+/).map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
  expect(source).toMatch(pattern);
  const rewrite = (replacement) => source.replace(pattern, () => replacement);
  expect(accepts(rule, rewrite('')), `${name}: removal`).toBe(false);
  expect(matching[0]).toMatch(flip);
  expect(accepts(rule, rewrite(matching[0].replace(flip, inverse))), `${name}: inversion`).toBe(false);
  const reworded = rewrite(rewording.replace(/[.!?]$/, ''));
  expect(accepts(rule, reworded), `${name}: equivalent wording`).toBe(true);
  for (const sibling of rules.filter((row) => row[1] === rule[1])) {
    expect(accepts(sibling, reworded), `${name}: preserves ${sibling[0]}`).toBe(true);
  }
  if (!rule[6]) expect(accepts(rule, rewrite(`Do not ${rewording}`)), `${name}: whole-rule negation`).toBe(false);
}

for (const rule of rules) {
  test(`explain diagram contract: ${rule[0]}`, () => check(read(rule[1]), rule));
}

test('every diagram routing preserves the exact relative skill target', () => {
  const source = read(explain);
  expect(accepts(rules[0], source)).toBe(true);
  expect(accepts(rules[0], source.replaceAll(diagram, '../axstack-explain/SKILL.md'))).toBe(false);
});
