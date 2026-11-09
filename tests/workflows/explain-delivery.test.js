import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const explain = 'skills/axstack-explain/SKILL.md';
const delivery = 'skills/axstack-explain/references/delivery.md';

// Independent instruction contracts, not a simulation of agent compliance.
// Each keeper exercises the actual source with removal, reversal and paraphrase.
const rules = [
  ['requested format remains acceptance', explain, [/requested/i, /visual.*inline/i, /format/i, /remains.*acceptance requirement/i],
    'The requested visual or inline format remains an acceptance requirement.', /remains/i, 'ceases to be'],
  ['progress continues with owner and fresh review', explain, [/continue/i, /measurable.progress/i, /repairs/i, /same author/i, /fresh independent review/i, /exact.*bytes/i],
    'Continue measurable-progress repairs with the same author and fresh independent review of the exact final bytes.', /continue/i, 'stop'],
  ['stalled repairs change approach', explain, [/repeated.*same unresolved failure/i, /no.*progress/i, /diagnos/i, /change.*approach/i, /existing scope/i, /requires/i],
    'Repeated same unresolved failure or no progress requires diagnosis and a change of approach within existing scope.', /requires/i, 'waives'],
  ['dependency holds are specific', delivery, [/missing.*access/i, /tool/i, /model/i, /evidence/i, /material new scope/i, /hold/i, /specific dependency/i, /reason/i, /resume condition/i],
    'Missing access, tool, model or evidence, or material new scope, holds the specific dependency with its reason and resume condition.', /holds?/i, 'waives'],
  ['blocked prose is interim', delivery, [/prose status/i, /interim blocked status/i, /requested visual/i, /incomplete/i],
    'Prose status is interim blocked status and leaves the requested visual incomplete.', /incomplete/i, 'complete'],
  ['all source claims before design', explain, [/before design/i, /check|verify/i, /every claim/i, /conditions/i, /branches/i, /source range/i, /supports?/i, /complete claim/i],
    'Before design, verify every claim including conditions and branches, checking that the source range supports the complete claim.', /before/i, 'after'],
  ['full claim set on every review', explain, [/every review/i, /verify|check/i, /full claim set/i, /first review/i, /regression/i, /prior findings/i, /subsequent/i],
    'On every review, check the full claim set from the first review onward, including regression of prior findings on subsequent checks.', /full/i, 'partial'],
];
for (const [name, path, concepts, rewording, flip, inverse] of rules) {
  test(`Explain recovery: ${name}`, () => checkRule(sentences(read(path)).join('. '),
    (source) => name === 'stalled repairs change approach'
      ? prohibits(source, /no (?:measurable )?progress/i, ...concepts)
      : requires(source, ...concepts), rewording, [[flip, inverse]], concepts));
}
for (const [name, path, negative, concepts, rewording, inverse] of [
  ['count cannot abandon format or demand permission', explain, /never/i,
    [/repair count alone/i, /replace.*prose/i, /declare.*done/i, /renewed permission/i, /factual/i, /citation/i, /layout/i],
    'Never use repair count alone to replace the visual with prose, declare it done, or require renewed permission for authorized factual, citation or layout corrections.', 'Always'],
  ['oversized file cannot complete explicit inline request', 'skills/axstack-anatomy/SKILL.md', /never/i,
    [/oversized file/i, /completed/i, /explicitly requested inline delivery/i],
    'Never count an oversized file handoff as completed explicitly requested inline delivery.', 'Always'],
  ['prior conversation is not source proof', explain, /never/i, [/prior chat/i, /authoritative evidence/i],
    'Never treat prior chat as authoritative evidence.', 'Always'],
]) {
  test(`Explain recovery: ${name}`, () => checkRule(sentences(read(path)).join('. '),
    (source) => prohibits(source, negative, ...concepts), rewording, [[negative, inverse]], concepts));
}

test('height repair then facts repair leaves a new citation or fact finding actionable', () => {
  const policy = read(delivery);
  // At the next review after height >2000px and facts were repaired, the
  // user-ID overclaim and six weak links still require repair. Check the
  // operative policy, not a test-side repair counter or mocked agent.
  expect(requires(policy, /continue/i, /measurable.progress/i, /same author/i,
    /fresh independent review/i, /exact.*bytes/i)).toBe(true);
  expect(requires(policy, /record/i, /improved/i, /remains/i, /newly found actionable/i)).toBe(true);
  expect(requires(read(explain), /every review/i, /full claim set/i, /regression/i,
    /prior findings/i)).toBe(true);
  expect(prohibits(policy, /never/i, /repair count alone/i, /replace.*prose/i,
    /declare.*done/i, /renewed permission/i)).toBe(true);
  expect(requires(policy, /prose status/i, /interim blocked status/i, /incomplete/i)).toBe(true);
});

// Guard against contradictory operative surfaces, including generated preset inputs.
const surfaces = [delivery, 'skills/axstack-explain/references/whiteboard-defense.md',
  'skills/axstack-explain/references/visual-qa.md', 'skills/axstack-publish/SKILL.md',
  ...['mixed', 'codex-only', 'claude-only'].map((name) => `profiles/presets/${name}.json`)];
for (const path of surfaces) {
  test(`Explain recovery: no inherited blocking repair cap in ${path}`, () => {
    const text = path.endsWith('.json')
      ? JSON.parse(read(path)).roles.find((role) => role.id === 'axstack-explainer-review').notes : read(path);
    const caps = sentences(text).filter((line) => /two.round|two repair rounds/i.test(line));
    expect(caps).toEqual([]);
  });
}

const operativeText = (path) => path.endsWith('.json')
  ? JSON.parse(read(path)).roles.find((role) => role.id === 'axstack-explainer-review').notes : read(path);
const normalized = (text) => sentences(text).join('. ');

for (const path of [explain, delivery]) {
  test(`cosmetic preferences cannot withhold Explain delivery: ${path}`, () => {
    checkRule(normalized(read(path)),
      (s) => prohibits(s, /never/i, /cosmetic preferences alone/i, /block Explain delivery/i),
      'Cosmetic preferences alone never block Explain delivery.', [[/never/i, 'always']]);
    checkRule(normalized(read(path)),
      (s) => requires(s, /deliver/i, /Explain visual/i, /cosmetic preference/i, /named/i),
      'Deliver the Explain visual with every remaining cosmetic preference named.', [[/deliver/i, 'withhold']]);
    checkRule(normalized(read(path)),
      (s) => requires(s, /decency/i, /hard.rule/i, /factual/i, /remain blockers/i),
      'Decency, hard-rule and factual failures remain blockers.', [[/remain blockers/i, 'become preferences']]);
  });
}

for (const path of [delivery, 'skills/axstack-publish/SKILL.md']) {
  test(`cosmetic exception excludes factual and citation failures: ${path}`, () => {
    const text = normalized(operativeText(path));
    checkRule(text, (s) => requires(s, /design.only/i, /means|limited to/i, /cosmetic preferences/i),
      'Design-only is limited to cosmetic preferences.', [[/cosmetic preferences/i, 'factual errors']]);
    const boundary = /exclud/i;
    checkRule(text, (s) => requires(s, /factual/i, /citation/i, boundary),
      'Factual and citation failures are excluded from the cosmetic exception.',
      [[boundary, 'included']]);
  });
}

test('blind retries are prohibited', () => checkRule(normalized(read(delivery)),
  (s) => prohibits(s, /never/i, /repeat/i, /blind retries/i),
  'Never repeat blind retries without a diagnosis.', [[/never/i, 'Always']]));

test('diagnosis without a workable approach holds rather than loops', () => checkRule(normalized(read(delivery)),
  (s) => prohibits(s, /no workable approach/i, /diagnosis/i, /hold/i, /blocker/i, /resume condition/i),
  'When diagnosis finds no workable approach within scope, hold with the blocker and resume condition.',
  [[/hold/i, 'continue']], [/diagnosis/i, /hold/i, /blocker/i, /resume condition/i]));

test('oversized inline delivery holds with a reason', () => checkRule(normalized(read('skills/axstack-anatomy/SKILL.md')),
  (s) => prohibits(s, /cannot/i, /tool limit/i, /within scope/i, /hold inline delivery/i, /reason/i),
  'If the tool limit cannot be met within scope, hold inline delivery and state the reason.',
  [[/hold inline delivery/i, 'complete inline delivery']]));

for (const path of surfaces.filter((p) => p.endsWith('.json'))) {
  test(`preset preserves progress repairs: ${path}`, () => {
    const text = normalized(operativeText(path));
    checkRule(text, (s) => requires(s, /apply|follow/i, /Delivery/i, /progress.based repairs/i, /dependency holds/i),
      "Follow Delivery's progress-based repairs and dependency holds.", [[/apply|follow/i, 'Skip']]);
    checkRule(text, (s) => prohibits(s, /never/i, /repair count alone/i, /abandons/i, /requested format/i),
      'Repair count alone never abandons the requested format.', [[/never/i, 'always']]);
  });
}

// Detect affirmative fallback directives even when the repair count is changed.
const hasFallback = (text) => sentences(text).some((s) =>
  !/\bnever\b/i.test(s) && (/plain.prose fallback/i.test(s) ||
    (/after|once|limit|exhaust|round|count/i.test(s) && /repair|round|attempt/i.test(s) &&
     /replace|use|deliver|answer/i.test(s) && /prose|text summary/i.test(s))));
for (const path of surfaces) {
  test(`no count-based prose replacement: ${path}`, () => {
    const text = operativeText(path);
    expect(hasFallback(text)).toBe(false);
    for (const regression of ['After three repairs, replace the visual with plain prose.',
      'After 4 rounds, answer in prose.', 'Once two repairs fail, answer in prose.',
      'Stop after the third attempt and deliver a text summary.', 'Inline delivery may use the plain-prose fallback above.']) {
      expect(hasFallback(text + '\n' + regression)).toBe(true);
    }
  });
}

test('UI improvement keeps its own stopping rules', () => checkRule(normalized(read('skills/axstack/references/ui-improvement-loop.md')),
  (s) => prohibits(s, /do not/i, /Explain/i, /delivery rules/i, /apply.*loop/i),
  "Explain's delivery rules do not apply to this loop.", [[/do not/i, 'do']]));

test('factual blockers cannot also count as design-only', () => {
  const accepts = (text) => sentences(text).some((s) =>
    requires(s, /factual/i, /citation/i, /blockers/i, /excluded/i) && !/count as design.only/i.test(s));
  const text = normalized(read(delivery));
  checkRule(text, accepts,
    'Factual and citation failures are blockers, excluded from the cosmetic exception.',
    [[/blockers/i, 'blockers that also count as design-only'], [/excluded/i, 'included']],
    [/blockers/i, /excluded/i]);
});

test('held whiteboard explanations cannot bypass review', () => checkRule(normalized(read(delivery)),
  (s) => prohibits(s, /never/i, /deliver/i, /held whiteboard.defense explanation/i, /unreviewed/i, /as reviewed/i),
  'Never deliver a held whiteboard-defense explanation unreviewed or describe it as reviewed.', [[/never/i, 'Always']],
  [/held whiteboard.defense explanation/i, /unreviewed/i, /as reviewed/i]));

test('inline size repairs retain the same author', () => checkRule(normalized(read('skills/axstack-anatomy/SKILL.md')),
  (s) => requires(s, /explicitly requested inline/i, /return|send/i, /size repairs/i, /same author/i),
  'For explicitly requested inline delivery, send size repairs back to the same author.', [[/same/i, 'different']],
  [/explicitly requested inline/i, /size repairs/i, /same author/i]));

// Entrypoint guards protect resumed sessions that have not loaded a reference yet.
// These finite lexical probes are instruction evidence, not an agent simulator.
for (const [name, concepts, rewording, inversions] of [
  ['resume reloads current rules', [/resume/i, /skill reload/i, /re-read/i, /current SKILL.md/i, /linked delivery rules/i, /before continuing/i],
    'Before continuing on resume or skill reload, re-read the current SKILL.md and its linked delivery rules.',
    [[/re-read/i, 'ignore'], [/before continuing/i, 'after delivery']]],
  ['blocked work stays explicitly incomplete', [/still blocked/i, /diagnosis/i, /changed approach/i, /state/i, /named incomplete hold/i, /blocker/i, /resume condition/i],
    'If still blocked after diagnosis and a changed approach, state a named incomplete hold with its blocker and resume condition.',
    [[/state/i, 'hide'], [/incomplete/i, 'complete']]],
]) {
  test(`Explain entrypoint: ${name}`, () => checkRule(normalized(read(explain)),
    (s) => requires(s, ...concepts), rewording, inversions, concepts));
}

test('Explain entrypoint: factual structure and omissions remain blocking', () => {
  const concepts = [/factual steps/i, /branches/i, /edges/i, /omissions/i, /remain blockers/i, /cosmetic/i];
  checkRule(normalized(read(explain)), (s) => prohibits(s, /never cosmetic/i, ...concepts),
    'Factual steps, branches, edges and omissions remain blockers, never cosmetic.',
    [[/remain blockers/i, 'become preferences'], [/never cosmetic/i, 'sometimes cosmetic']], concepts);
});

test('legacy cosmetic exception is scoped to Anatomy and Publish', () => checkRule(normalized(read(delivery)),
  (s) => requires(s, /Anatomy and Publish only/i, /only design findings remain/i, /second round/i, /deliver/i, /finding.*named/i),
  'For Anatomy and Publish only, if only design findings remain after the second round, deliver the visual with each finding named.',
  [[/Anatomy and Publish only/i, 'Explain too'], [/second round/i, 'first round']], [/Anatomy and Publish only/i]));

for (const path of ['skills/axstack-explain/references/visual-qa.md', ...surfaces.filter((p) => p.endsWith('.json'))]) {
  test(`Explain delegates legacy exceptions without a round cue: ${path}`, () => {
    const text = normalized(operativeText(path));
    checkRule(text, (s) => requires(s, /Anatomy and Publish only/i, /retain/i, /Delivery/i, /design.only exception/i),
      "For Anatomy and Publish only, retain Delivery's design-only exception.",
      [[/Anatomy and Publish only/i, 'Explain too'], [/retain/i, 'discard']]);
    expect(text).not.toMatch(/after the second round/i);
  });
}
