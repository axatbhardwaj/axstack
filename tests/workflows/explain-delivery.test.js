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
  ['dependency holds are specific', delivery, [/missing.*access/i, /tool/i, /model/i, /evidence/i, /material new scope/i, /hold/i, /specific dependency/i, /reason/i],
    'Missing access, tool, model or evidence, or material new scope, holds the specific dependency with its reason.', /holds?/i, 'waives'],
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
