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
  ['requested format remains acceptance', delivery, [/requested/i, /visual.*inline/i, /format/i, /remains.*acceptance requirement/i],
    'The requested visual or inline format remains an acceptance requirement.', /remains/i, 'ceases to be'],
  ['progress continues with owner and fresh review', delivery, [/continue/i, /measurable.progress/i, /repairs/i, /same author/i, /fresh independent review/i, /exact.*bytes/i],
    'Continue measurable-progress repairs with the same author and fresh independent review of the exact final bytes.', /continue/i, 'stop'],
  ['stalled repairs change approach', delivery, [/repeated.*same unresolved failure/i, /no.*progress/i, /diagnos/i, /change.*approach/i, /existing scope/i, /requires/i],
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
  ['count cannot abandon format or demand permission', delivery, /never/i,
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

for (const path of [delivery, 'skills/axstack-explain/references/visual-qa.md',
  'skills/axstack-publish/SKILL.md', ...surfaces.filter((path) => path.endsWith('.json'))]) {
  test(`cosmetic exception excludes factual and citation failures: ${path}`, () => {
    const text = normalized(operativeText(path));
    checkRule(text, (s) => requires(s, /design.only/i, /means|limited to/i, /cosmetic preferences/i),
      'Design-only is limited to cosmetic preferences.', [[/cosmetic preferences/i, 'factual errors']]);
    const boundary = path === delivery ? /blockers/i : /exclud/i;
    checkRule(text, (s) => requires(s, /factual/i, /citation/i, boundary),
      path === delivery ? 'Factual and citation failures are blockers.' : 'Factual and citation failures are excluded from the cosmetic exception.',
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
    (/after|limit|exhaust|round|count/i.test(s) && /repair|round/i.test(s) &&
     /replace|use|deliver|answer/i.test(s) && /prose/i.test(s))));
for (const path of surfaces) {
  test(`no count-based prose replacement: ${path}`, () => {
    const text = operativeText(path);
    expect(hasFallback(text)).toBe(false);
    for (const regression of ['After three repairs, replace the visual with plain prose.',
      'After 4 rounds, answer in prose.', 'Inline delivery may use the plain-prose fallback above.']) {
      expect(hasFallback(text + '\n' + regression)).toBe(true);
    }
  });
}

test('UI loop names only the cosmetic exception', () => checkRule(normalized(read('skills/axstack/references/ui-improvement-loop.md')),
  (s) => prohibits(s, /does not/i, /Explain/i, /design.only delivery rule/i, /apply.*loop/i),
  "Explain's second-round design-only delivery rule does not apply to this loop.", [[/does not/i, 'does']]));
