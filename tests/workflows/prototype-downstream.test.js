import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const raw = (path) => readFileSync(`${root}/skills/${path}`, 'utf8');
const read = (path) => raw(path).replace(/^#{1,6} .*$/gm, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' ').trim();
const implement = () => read('axstack-implement/SKILL.md');
const runtime = () => read('axstack/references/t3-runtime.md');

// Independent instruction contracts, not proof of live agent compliance.
// checkRule removes each rule, inverts it, and substitutes equivalent wording.
for (const verb of ['merge', 'cherry-pick']) {
  test(`prototype downstream: Implement must never ${verb} the prototype branch`, () => {
    const prohibition = new RegExp(`(?:never|must not) ${verb}`, 'i');
    const accepts = (source) => prohibits(source, prohibition, /prototype branch/i);
    checkRule(implement(), accepts,
      `Implement must not ${verb} the prototype branch.`,
      [[prohibition, `may ${verb}`]], [/prototype branch/i]);
  });
}

test('prototype downstream: Decisions rows bind even for uncaptured prototype details', () => {
  checkRule(implement(), (source) => requires(source, /Decisions rows/i, /bind|govern/i),
    'Decisions rows govern implementation.', [[/bind|govern/i, 'may guide']], [/Decisions rows/i]);
  const accepts = (source) => prohibits(source, /no row captures/i, /prototype/i, /follow (?:the )?rows/i)
    || requires(source, /prototype/i, /absent from (?:the )?rows/i, /follow (?:the )?(?:Decisions )?rows/i);
  checkRule(implement(), accepts,
    'For prototype details absent from the rows, follow the Decisions rows.',
    [[/follow (?:the )?(?:Decisions )?rows/i, 'follow the prototype instead']]);
});

test('prototype downstream: copied code retains strict TDD and ordinary cross-model review', () => {
  const terms = [/copied prototype code/i, /strict TDD/i, /ordinary review/i, /cross-model review/i];
  checkRule(implement(), (source) => requires(source, ...terms),
    'Strict TDD and ordinary review, including cross-model review, are required for copied prototype code.',
    [[/ordinary review/i, 'optional review'], [/strict TDD/i, 'optional TDD'],
      [/cross-model review/i, 'same-model review']], terms);
  expect(requires(implement(), /read/i, /pinned (?:prototype )?commit/i, /reference only/i)).toBe(true);
});

test('prototype downstream: unfetchable SHA is unavailable reference, not a hold', () => {
  const accepts = (source) => sentences(source).some((sentence) =>
    /unfetchable SHA/i.test(sentence) && /reference unavailable|unavailable reference/i.test(sentence)
    && /(?:not a hold|does not (?:hold|block))/i.test(sentence)
    && !/reference (?:is )?(?:available|usable)|(?:must|should) hold/i.test(sentence));
  checkRule(implement(), accepts,
    'An unfetchable SHA leaves an unavailable reference and does not block implementation.',
    [[/reference unavailable|unavailable reference/i, 'reference available'],
      [/not a hold|does not (?:hold|block)/i, 'must hold']]);
});

test('prototype downstream: Tickets copy the record into every affected task', () => {
  const terms = [/copy/i, /prototype record line/i, /(?:each|every) affected task/i];
  checkRule(read('axstack-tickets/SKILL.md'), (source) => requires(source, ...terms),
    'For every affected task, copy the prototype record line from the spec.',
    [[/copy/i, 'may copy']], terms);
});

test('prototype downstream: completion log exemption belongs only to prototype authors', () => {
  const accepts = (source) => sentences(source).some((sentence) =>
    /^Only prototype authors (?:use|receive) the no-red\/green-log completion exemption\b/i.test(sentence)
    || /^The no-red\/green-log completion exemption\b.*\bapplies only to prototype authors$/i.test(sentence));
  checkRule(read('axstack/references/lifecycle.md'), accepts,
    'The no-red/green-log completion exemption under Spec prototypes applies only to prototype authors',
    [[/prototype authors/i, 'authors'], [/prototype authors/i, 'prototype authors and repair authors'],
      [/only/i, 'also'], [/no-red\/green-log/i, 'mandatory-red/green-log']]);
  expect(raw('axstack/references/lifecycle.md')).toMatch(/\]\(\.\.\/\.\.\/axstack-spec\/references\/prototype\.md\)/);
});

test('prototype downstream: only the driver create-only prototype push skips candidate rules', () => {
  const accepts = (source) => sentences(source).some((sentence) => {
    const match = sentence.match(/^Only (.+?) (?:skips|bypasses) candidate-publication (.+?), (?:only )?because (?:that|the) ref never merges$/i);
    if (!match) return false;
    // Bound the entire subject. Mentioning a prototype among all pushes is unsafe.
    return /^(?:the )?driver's create-only prototype-axstack-<slug> push$/i.test(match[1])
      && /^(?:diligence, review and PR rules|PR rules, review and diligence)$/i.test(match[2]);
  });
  checkRule(read('axstack/references/candidate-publication.md'), accepts,
    "Only the driver's create-only prototype-axstack-<slug> push bypasses candidate-publication PR rules, review and diligence, because the ref never merges",
    [[/driver's create-only prototype-axstack-<slug> push/i, 'driver\'s pushes'],
      [/driver's create-only prototype-axstack-<slug> push/i, 'driver\'s candidates'],
      [/prototype-axstack-<slug> push/i, 'prototype-axstack-<slug> push and all candidate pushes'],
      [/create-only/i, 'force'], [/never merges/i, 'may merge'], [/Only/i, 'Also']]);
});

test('prototype downstream: prototype author dispatch substitutes question and draft identity', () => {
  const terms = [/prototype author dispatch/i, /deferred question/i, /current draft revision/i,
    /(?:in place of|instead of) an approved identity/i];
  checkRule(runtime(), (source) => requires(source, ...terms),
    'The prototype author dispatch uses the deferred question and current draft revision instead of an approved identity.',
    [[/deferred question/i, 'approved question'], [/current draft revision/i, 'any draft revision'],
      [/in place of|instead of/i, 'in addition to']], terms);
});

test('prototype downstream: UI verifier dispatch pins a detached prototype SHA checkout', () => {
  const terms = [/prototype/i, /axstack-ui-verifier/i, /dispatch/i, /prototype SHA/i, /detached checkout/i];
  checkRule(runtime(), (source) => requires(source, ...terms),
    'For a prototype, dispatch axstack-ui-verifier with a detached checkout pinned to the prototype SHA.',
    [[/detached checkout/i, 'author checkout'], [/prototype SHA/i, 'branch name']], terms);
});
