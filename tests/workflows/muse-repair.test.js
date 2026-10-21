import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');

// Each rule is checked at its owning instruction. The same check must reject
// deletion and a directional inversion, while accepting equivalent wording.
function policy(path, anchor, concepts, direction, inverse, equivalent, forbidden) {
  const clauses = sentences(read(path));
  const matches = clauses.filter((clause) => anchor.test(clause));
  expect(matches, `${path}: one owner clause`).toHaveLength(1);
  const accepts = (clause) => concepts.every((concept) => concept.test(clause))
    && (!forbidden || !forbidden.test(clause));
  const clause = matches[0];
  expect(accepts(clause), `${path}: declared rule`).toBe(true);
  expect(clauses.filter((item) => item !== clause).some((item) => anchor.test(item) && accepts(item)), `${path}: removal`).toBe(false);
  expect(direction.test(clause), `${path}: mutation target`).toBe(true);
  expect(accepts(clause.replace(direction, inverse)), `${path}: inversion`).toBe(false);
  expect(accepts(equivalent), `${path}: rewording`).toBe(true);
}

test('mixed self-close needs both required advisers before same-option advice can act', () => {
  policy('skills/axstack/references/contracts.md', /advised-hold self-close/i,
    [/mixed/i, /self-close/i, /Astra/i, /Opus/i, /both.*(?:ran|run)|Astra and Opus must run/i],
    /Astra and Opus must both have run/i, 'Muse alone may act',
    'In mixed, advised-hold self-close needs both Astra and Opus to run before the driver acts.');
});

test('the one configured single-provider adviser must run and agree for self-close', () => {
  policy('skills/axstack/references/contracts.md', /In single-provider presets, the one configured adviser/i,
    [/single-provider/i, /one configured adviser/i, /must (?:have )?run/i, /agree with the driver/i, /self-close/i],
    /must (?:have )?run/i, 'may be absent',
    'In single-provider presets, the one configured adviser must run and agree with the driver for self-close.');
});

test('arena holds an unavailable required Fable judge in round 2', () => {
  policy('skills/axstack-brainstorm/references/arena.md', /A required adviser, candidate, or judge/i,
    [/required/i, /Fable/i, /round 2/i, /unavailable/i, /holds that question/i],
    /Fable in round 2/i, 'optional Muse in round 2',
    'A required judge, including Fable in round 2, unavailable at launch holds that question.',
    /never Fable|Fable.*(?:not|required.*not)/i);
});

test('codex-only keeps its explicit null Opus round-1 hold', () => {
  policy('skills/axstack-brainstorm/references/arena.md', /codex-only/i,
    [/codex-only/i, /axstack-arena-judge-opus/i, /model: null/i, /round 1/i, /holds/i],
    /holds/i, 'continues',
    'In codex-only, axstack-arena-judge-opus has model: null, so round 1 holds.');
});

test('workflow guide states the routed arena judges and the new round-2 trigger', () => {
  const block = read('docs/workflows.md').split('- `axstack-brainstorm`')[1]?.split('- `axstack-')[0] ?? '';
  const routes = /mixed[^.]*round 1[^.]*Astra[^.]*Muse[^.]*claude-only[^.]*round 1[^.]*Opus/i;
  const trigger = /round 2[^.]*driver[^.]*completed round-1 judges[^.]*disagree[^.]*user rejects/i;
  expect(block).toMatch(routes);
  expect(block).toMatch(trigger);
  expect(block.replace(routes, '')).not.toMatch(routes);
  expect(block.replace(trigger, '')).not.toMatch(trigger);
  expect(block.replace(routes, 'all presets use Opus round 1')).not.toMatch(routes);
  expect(block.replace(trigger, 'round 2 never runs')).not.toMatch(trigger);
  expect('In mixed round 1 use Astra and Muse; in claude-only round 1 use Opus.').toMatch(routes);
  expect('Round 2 starts if the driver and completed round-1 judges disagree or the user rejects the recommendation.').toMatch(trigger);
});

test('verified Muse absence limits exit-2 to before dispatch', () => {
  policy('skills/axstack/references/role-roster.md', /Verified Muse absence is recorded/i,
    [/Muse absence/i, /pre-dispatch|before dispatch/i, /dispatch-plan/i, /exit-2|exit 2/i],
    /pre-dispatch/i, 'post-launch',
    'Verified Muse absence is recorded when dispatch-plan exit 2 occurs before dispatch.');
});

test('general optional-seat absence requires exit-2 before dispatch', () => {
  policy('skills/axstack/references/role-roster.md', /Only a launch failure/i,
    [/launch failure/i, /pre-dispatch|before dispatch/i, /dispatch-plan/i,
      /exit-2|exit 2/i, /absent/i],
    /pre-dispatch/i, 'post-launch',
    'Only a launch failure or dispatch-plan exit 2 before dispatch makes an optional seat absent.',
    /or post-launch|or after launch/i);
});

test('post-launch settings mismatch stays unresolved and never becomes absence', () => {
  policy('skills/axstack/references/role-roster.md', /post-launch configuration read-back mismatch/i,
    [/post-launch|after launch/i, /mismatch/i, /unresolved/i, /not absence|never absent/i],
    /not absence/i, 'absence',
    'After launch, a configuration mismatch remains unresolved, never absent.');
});

test('arena provider floor binds candidates rather than judges', () => {
  policy('skills/axstack-brainstorm/references/arena.md', /This arena floor binds/i,
    [/arena/i, /floor/i, /candidates/i, /not judges|rather than judges/i],
    /not judges/i, 'and judges',
    'In arena, this floor binds candidates rather than judges.');
});

test('verified Muse absence skips the arena seat without holding its phase', () => {
  policy('skills/axstack-brainstorm/references/arena.md', /Verified Muse absence is skipped/i,
    [/Muse absence/i, /skip|continue/i, /without a phase hold|does not hold/i],
    /without a phase hold/i, 'with a phase hold',
    'Verified Muse absence lets the arena skip that seat; it does not hold the phase.');
});

test('a launched Muse arena judge remains outstanding', () => {
  policy('skills/axstack-brainstorm/references/arena.md', /a launched Muse judge/i,
    [/launched/i, /Muse judge/i, /remains outstanding|stays pending/i],
    /remains outstanding/i, 'is absent',
    'A launched Muse judge stays pending after the arena dispatch.');
});

test('single-provider card reports one adviser when the configured seat ran', () => {
  policy('skills/axstack/references/contracts.md', /Single-provider ordinary advice reports/i,
    [/single-provider/i, /one adviser/i, /configured seat/i, /ran|run/i],
    /one adviser/i, 'two advisers',
    'In a single-provider preset, ordinary advice reports one adviser after the configured seat ran.');
});

test('audit counts only advisers that ran and excludes verified Muse absence', () => {
  policy('skills/axstack-audit/SKILL.md', /Adviser receipts counted/i,
    [/adviser receipts/i, /advisers that ran/i],
    /advisers that ran/i, 'all configured advisers',
    'Count adviser receipts from advisers that ran.');
  policy('skills/axstack-audit/SKILL.md', /exclude verified Muse absences/i,
    [/exclude/i, /verified Muse absences/i],
    /exclude/i, 'include',
    'Exclude verified Muse absences.');
});

test('Spec reviewable draft includes a Muse receipt when the trio ran', () => {
  policy('skills/axstack-spec/SKILL.md', /A reviewable draft covers/i,
    [/reviewable draft/i, /Astra/i, /Opus/i, /Muse/i, /receipt/i, /when.*ran|if.*ran/i],
    /Muse/i, 'another adviser',
    "A reviewable draft includes Astra and Opus receipts plus Muse's receipt if Muse ran.");
});

test('Scout Spark exit-2 absence is pre-dispatch only', () => {
  policy('skills/axstack-scout/SKILL.md', /a pre-dispatch.*dispatch-plan/i,
    [/pre-dispatch|before dispatch/i, /dispatch-plan/i, /exit-2|exit 2/i, /absent/i],
    /pre-dispatch/i, 'post-launch',
    'Before dispatch, a dispatch-plan exit 2 for Spark records absent (reason).',
    /or post-launch|or after launch/i);
});

test('Scout Spark post-launch mismatch remains unresolved', () => {
  policy('skills/axstack-scout/SKILL.md', /a post-launch settings mismatch/i,
    [/post-launch|after launch/i, /mismatch/i, /unresolved/i, /not absent|never absent/i],
    /not absent/i, 'absent',
    'After launch, a Spark settings mismatch remains unresolved and never absent.');
});

test('Research arena provider floor binds candidates rather than judges', () => {
  policy('skills/axstack-research/SKILL.md', /For arena, this floor/i,
    [/arena/i, /floor/i, /candidates/i, /rather than judges|not judges/i],
    /rather than judges/i, 'and judges',
    'For arena, the provider floor binds candidates, not judges.');
});

for (const phase of ['axstack-align', 'axstack-spec']) {
  test(`${phase} requires Astra and Opus while excluding verified Muse absence`, () => {
    policy(`skills/${phase}/SKILL.md`, /Astra and Opus must run/i,
      [/Astra/i, /Opus/i, /must run/i, /verified Muse absence/i, /excluded/i],
      /must run/i, 'may be skipped',
      'Astra and Opus must run; verified Muse absence is excluded.');
  });
}

test('debug drops a hypothesis only when every adviser that ran refutes it', () => {
  policy('skills/axstack-debug/SKILL.md', /drops a hypothesis only when/i,
    [/drops a hypothesis|removes a hypothesis/i, /only when|only if/i,
      /every adviser that ran|all participating advisers/i, /refute/i],
    /every adviser that ran/i, 'one adviser',
    'The driver removes a hypothesis only if all participating advisers refute it.');
});

test('Scout applies the verified Muse absence rule to Spark', () => {
  policy('skills/axstack-scout/SKILL.md', /For Spark, apply/i,
    [/Spark/i, /verified Muse absence rule/i, /Role roster/i],
    /verified Muse absence rule/i, 'Flash hold rule',
    'For Spark, follow the verified Muse absence rule in Role roster.');
});
