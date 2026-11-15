import { expect, test } from 'bun:test';
import { checkRule, prohibits, requires } from './prose-contract.js';

// Historical cases: stage-a-auditor-sol-K01/verdict.md, corpus
// axat-vps.jsonl:170 (settled), :1994 (expected), :3390 (alternate inversion).
for (const [concept, opposite] of [['settled', 'unsettled'], ['expected', 'unexpected']]) {
  test(`a ${concept} requirement rejects ${opposite}`, () => {
    const terms = [/verify/i, new RegExp(concept, 'i')];
    expect(requires(`Verify ${concept} state.`, ...terms)).toBe(true);
    expect(requires(`Verify ${opposite} state.`, ...terms)).toBe(false);
    checkRule(`Verify ${concept} state.`, (text) => requires(text, ...terms),
      `Check and verify the ${concept} state.`,
      [[new RegExp(concept, 'i'), opposite]], terms);
  });
}

test('explicit regex stems still accept inflected directives', () => {
  expect(requires('Record verified evidence.', /record/i, /verif/i)).toBe(true);
});

test('concept regex state cannot change repeated acceptance results', () => {
  const concept = /record/gi;
  for (let attempt = 0; attempt < 3; attempt++) {
    expect(requires('Record evidence.', concept, /evidence/gi)).toBe(true);
  }
  expect(concept.lastIndex).toBe(0);
});

test('prohibitions require their negative phrase, including after rewording', () => {
  // The negative outcome "no match" is a concept, not the directive's negator.
  const rule = (text) => prohibits(text.replace(/no match/gi, 'empty result'),
    /never|do not/i, /treat/i, /lookup failure/i, /empty result/i);
  expect(rule('Treat lookup failure as no match.')).toBe(false);
  checkRule('Never treat lookup failure as no match.', rule,
    'Do not treat a lookup failure as no match.', [[/never|do not/i, 'Always']]);
});

test('mutations find directives in wrapped Markdown and retain sibling rules', () => {
  const source = 'Before acting, read\n[Standing contracts](contracts.md).\nRecord evidence.';
  const accepts = (text) => requires(text, /before acting/i, /read|consult/i, /Standing contracts/i);
  checkRule(source, accepts, 'Consult Standing contracts before acting.',
    [[/read|consult/i, 'Ignore']], [/before acting/i, /Standing contracts/i]);
  checkRule(source, (text) => requires(text, /record|save/i, /evidence/i),
    'Save evidence.', [[/record|save/i, 'Omit']], [/evidence/i]);
});

test('mutations replace every matching directive, including duplicates', () => {
  const accepts = (text) => requires(text, /record|save/i, /evidence/i);
  checkRule('Record evidence. Record evidence. Save evidence.', accepts,
    'Save the evidence.', [[/record|save/i, 'Omit']], [/evidence/i]);
});

test('concept deletion accepts already-global regexes', () => {
  const terms = [/record|save/gi, /evidence/gi];
  checkRule('Record evidence.', (text) => requires(text, ...terms),
    'Save evidence.', [[/record|save/gi, 'Omit']], terms);
});

test('inversion replaces repeated spellings within a directive', () => {
  checkRule('Record evidence, then record evidence.',
    (text) => requires(text, /record|save/i, /evidence/i),
    'Save evidence, then save evidence.', [[/record|save/i, 'Omit']]);
});

test('an inversion must change both the source and the alternate wording', () => {
  const accepts = (text) => requires(text, /before (?:committing|you commit)/i, /redact/i);
  expect(() => checkRule('Before you commit, redact secrets.', accepts,
    'Before committing, redact secrets.', [[/before committing/i, 'After committing']])).toThrow();
  expect(() => checkRule('Before committing, redact secrets.', accepts,
    'Before you commit, redact secrets.', [[/before committing/i, 'After committing']])).toThrow();
  checkRule('Before you commit, redact secrets.', accepts,
    'Before committing, redact secrets.',
    [[/before (?:committing|you commit)/i, 'After committing']]);
});

test('removal and whole-rule negation still kill a valid requirement', () => {
  checkRule('Record evidence.', (text) => requires(text, /record|save/i, /evidence/i),
    'Save evidence.', [[/^/, 'Do not ']], [/evidence/i]);
});
