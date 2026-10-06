import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires, sentences } from './prose-contract.js';

const publication = 'skills/axstack/references/candidate-publication.md';
const shape = 'skills/axstack/references/pr-shape.md';
const implement = 'skills/axstack-implement/SKILL.md';
const review = 'skills/axstack-review/SKILL.md';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const compact = (path) => read(path).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// B1-B3 are shipped instruction contracts, not a simulation of agent or forge behavior.
// Existing publication and severity checks do not protect revert classification.
const rules = [
  ...[publication, shape, implement].map((path) => [
    `B1 exactly one line (${path})`, path,
    [/every|each/i, /own PR description/i, /exactly one|a single/i, /Revert/i, /line/i],
    'Each own PR description must contain a single Revert line.',
    [/exactly one|a single/i, 'several'],
  ]),
  ['B2 single merge-commit revert restores behavior and CI', publication,
    [/clean/i, /only when/i, /single|one/i, /git revert/i, /merge commit/i,
      /restores?/i, /previous behavio[u]?r/i, /CI green/i],
    'Use clean only when one git revert of the merge commit restores previous behavior with CI green.',
    [/only when/i, 'even unless']],
  ['B2 no residual effects', publication,
    [/clean/i, /data/i, /schema/i, /config/i, /external/i, /published/i, /effect/i, /behind/i],
    'A clean revert has no data, schema, config, external, or published effect left behind.',
    [/leaves no|has no/i, 'leaves some'], /leaves no|has no/i],
  ['B2 other cases require steps or irreversible', publication,
    [/otherwise|in other cases/i, /use|choose/i, /steps/i, /or/i, /irreversible/i],
    'In other cases choose steps or irreversible.', [/steps.*irreversible/i, 'clean']],
  ['B2 every release is irreversible', publication,
    [/every|each/i, /release PR/i, /classify|mark/i, /irreversible/i],
    'Mark each release PR irreversible.', [/irreversible/i, 'clean']],
  ['B3 authored reviewer checks against diff', review,
    [/authored/i, /reviewer/i, /check|verif/i, /`?Revert`? line/i, /against the diff/i],
    'The authored reviewer verifies the Revert line against the diff.', [/against the diff/i, 'without the diff']],
  ['B3 reviewer records line in receipt', review,
    [/record|log/i, /`?Revert`? line/i, /review receipt/i],
    'Log the Revert line in the review receipt.', [/record|log/i, 'omit']],
  ['B3 wrong and missing lines are at least medium', review,
    [/rate/i, /wrong/i, /or/i, /missing/i, /`?Revert`? line/i, /at least/i, /medium/i],
    'Rate a wrong or missing Revert line at least medium.', [/medium/i, 'low']],
];
const accepts = ([, , concepts, , , prohibition]) => (text) => prohibition
  ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);

for (const rule of rules) {
  const [name, path, concepts, rewording, inversion] = rule;
  test(`revert contract: ${name}`, () => {
    checkRule(compact(path), accepts(rule), rewording, [inversion], concepts);
  });
  test(`revert real-source rewording: ${name}`, () => {
    const text = compact(path);
    const targets = sentences(text).filter(accepts(rule));
    expect(targets.length).toBeGreaterThan(0);
    const reworded = targets.reduce((source, target) => source.replace(target, rewording), text);
    for (const sibling of rules.filter((row) => row[1] === path)) {
      expect(accepts(sibling)(reworded), sibling[0]).toBe(true);
    }
  });
}

test('B1 exact PR line formats include manual steps and irreversible reason', () => {
  const text = read(publication);
  for (const format of ['Revert: clean', 'Revert: steps: <manual steps>', 'Revert: irreversible: <why>']) {
    expect(text).toContain(`\`${format}\``);
  }
});

test('author, body policy, and reviewer load the shared revert definition', () => {
  for (const [path, link] of [
    [shape, 'candidate-publication.md#revert-line'],
    [implement, '../axstack/references/candidate-publication.md#revert-line'],
    [review, '../axstack/references/candidate-publication.md#revert-line'],
  ]) {
    expect(loadedReferences(read(path))).toContain(link);
  }
});

test('authored review receipt carries the declared line and diff assessment', () => {
  const receipt = read(review).split('## Template: review receipt')[1].split('## Prompt-only urgent escalation')[0];
  expect(receipt).toMatch(/^Revert: <.*declared line.*diff.*authored.*>$/m);
});
