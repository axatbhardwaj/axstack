import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const entry = read('skills/axstack-implement/SKILL.md');
const procedure = read('skills/axstack-implement/references/step-back.md');
const record = read('skills/axstack/references/run-record.md').replace(/`/g, '').replace(/\s+/g, ' ');

// A copied entry can already exceed round 3 without consuming its extension.
// These are instruction contracts, not a simulated runtime or live driver proof.
test('Step-back repair: copied rounds >= 3 with an unused budget still trigger', () => {
  const concepts = [/\bany counted failing review round\b/i, /\bleaves rounds at (?:3 or more|least 3)\b/i,
    /\bwhile step-back: unused\b/i, /\bdriver steps back\b/i];
  checkRule(entry.replace(/`/g, '').replace(/\s+/g, ' '), (text) => requires(text, ...concepts),
    'On any counted failing review round that leaves rounds at least 3 while step-back: unused, the driver steps back.',
    [[/\b(?:3 or more|least 3)\b/i, 'exactly 3'], [/\bstep-back: unused\b/i, 'step-back: used']], concepts);
});

const consume = [/\b(?:write step-back: used r<n> before dispatching|before dispatching\b[^.]*\bwrite step-back: used r<n>)/i,
  /\bany repair from the step-back\b/i, /\bincluding\b.*\buser-picked path\b.*\badvised step-back card\b/i];
test('Step-back repair: every dispatched path consumes the budget, including a user pick', () => {
  checkRule(record, (text) => requires(text, ...consume),
    'Write step-back: used r<n> before dispatching any repair from the step-back, including a user-picked path from the advised step-back card.',
    [[/\bbefore dispatching\b/i, 'after dispatching'],
      [/\bincluding\b/i, 'excluding']], consume);
});

test('Step-back repair: legacy initialization supplies zero rounds as well as unused', () => {
  const concepts = [/\bpre-field entry starts\b/i, /\brounds: 0\b/i, /\bstep-back: unused\b/i, /\bonly if the field is absent\b/i];
  checkRule(record, (text) => requires(text, ...concepts),
    'Such a pre-field entry starts with rounds: 0 and step-back: unused only if the field is absent.',
    [[/\brounds: 0\b/i, 'rounds: 3']], concepts);
});

test('Step-back scenario: user picks repair at round 3, round 4 fails and gets an advised hold', () => {
  const hold = [/\bany counted failing review round after the extension records held\b/i, /\badvised card\b/i];
  const accepts = (text) => requires(text, ...consume) && requires(text, ...hold);
  expect(accepts(record)).toBe(true);
  const dispatch = sentences(record).find((unit) => requires(unit, ...consume));
  const failure = sentences(record).find((unit) => requires(unit, ...hold));
  expect(dispatch).toBeDefined();
  expect(failure).toBeDefined();
  // The real-source chain must reject either missing edge, an excluded user
  // path, a write delayed until after dispatch, or a ready result after failure.
  for (const [original, inversion] of [
    [dispatch, ''], [failure, ''],
    [dispatch, dispatch.replace(/\bincluding\b/i, 'excluding')],
    [dispatch, dispatch.replace(/\bbefore dispatching\b/i, 'after dispatching')],
    [failure, failure.replace(/\brecords held\b/i, 'records merge-ready')],
  ]) expect(accepts(record.replace(original, inversion))).toBe(false);
  expect(accepts(record.replace(dispatch,
    'Before dispatching any repair from the step-back, write step-back: used r<n>, including a user-picked path from the advised step-back card.')
    .replace(failure,
      'With an advised card, any counted failing review round after the extension records held.'))).toBe(true);
});

for (const [name, source, target] of [
  ['step 4 loads Review-round budgets', entry.split('4. Route the verdict.')[1].split('The T3 run watch')[0],
    '../axstack/references/run-record.md#review-round-budgets'],
  ['step-back loads Advised holds', procedure, '../../axstack/references/contracts.md#advised-holds'],
]) test(`Step-back repair: ${name} (removal/inversion red, rewording green)`, () => {
  const directive = [...source.matchAll(/^[^\n]*\[[^\]]+\]\([^)]+\)[\s\S]*?\./gm)]
    .map(([text]) => text.trim()).find((text) => loadedReferences(text).includes(target));
  expect(directive).toBeDefined();
  expect(loadedReferences(source)).toContain(target);
  expect(loadedReferences(source.replace(directive, ''))).not.toContain(target);
  expect(loadedReferences(source.replace(directive, `Never ${directive}`))).not.toContain(target);
  const rewording = directive.replace(/^[^[]+/,
    directive.startsWith('Consult') ? 'Read and follow ' : 'Consult ');
  expect(rewording).not.toBe(directive);
  expect(loadedReferences(source.replace(directive, rewording))).toContain(target);
});
