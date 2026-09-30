import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// These check instruction contracts, not live agent compliance. Synonyms allow
// prose edits; removal/inversion and paraphrase probes live in the run evidence.
const reference = '../axstack/references/test-value.md';
const linkedPolicy = (skill) => readFileSync(
  `${import.meta.dir}/../../skills/${skill}/SKILL.md`, 'utf8',
).split(/\n\s*\n/).find((paragraph) => paragraph.includes(`](${reference})`)) ?? '';
const sentences = (text) => text.replace(/\[[^\]]+\]\([^)]+\)/g, 'reference')
  .replace(/\s+/g, ' ').split(/[.!?]\s+/);
const requires = (text, ...concepts) => sentences(text).some((sentence) =>
  !/\b(?:not|never|skip|avoid|optional|may)\b/i.test(sentence)
  && concepts.every((concept) => concept.test(sentence)));

test('authors gate all new and changed tests and reject failures', () => {
  const policy = linkedPolicy('axstack-implement');
  expect(requires(policy,
    /\b(?:apply|use|enforce)\b/i, /\bgate\b/i, /\b(?:every|each|all)\b/i,
    /\b(?:new|added)\b/i, /\b(?:changed|modified)\b/i, /\btests?\b/i,
  )).toBe(true);
  expect(sentences(policy).some((sentence) =>
    /\btests?\b.*\b(?:fail\w*|reject\w*)\b.*\bgate\b.*\b(?:is|are|must be) not added\b/i.test(sentence)
    || /\b(?:reject|exclude)\b.*\btests?\b.*\b(?:fail\w*)\b.*\bgate\b/i.test(sentence),
  )).toBe(true);
});

test('reviewers assess every test hunk and inspect removal keepers without editing peer code', () => {
  const policy = linkedPolicy('axstack-review');
  expect(requires(policy,
    /\b(?:check|assess|evaluate)\b/i, /\badded\b/i,
    /\b(?:changed|modified)\b/i, /\b(?:removed|deleted)\b/i, /\btest hunks?\b/i,
  )).toBe(true);
  expect(requires(policy,
    /\b(?:inspect|verify|examine)\b/i, /\b(?:removed|deleted)\b/i,
    /\btests?\b/i, /\b(?:named|identified)\b/i, /\bkeepers?\b/i,
  )).toBe(true);
  expect(requires(policy, /\bpeer\b/i, /\breport[- ]only\b/i)).toBe(true);
});
