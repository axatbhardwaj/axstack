import { readSkillFile } from './skill-source.js';
import { test } from 'bun:test';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const watch = sentences(readSkillFile(
  `${import.meta.dir}/../../skills/axstack-watch/SKILL.md`, 'utf8',
)).join('. ');

// The shipped team-mode instruction is the interface, not live forge behavior.
test('counted collaborator approval survives feedback repairs at a new head', () => {
  const concepts = [/collaborator approval/i, /carries over|remains valid/i,
    /or to a new head/i, /repairs/i, /addressing review feedback/i,
    /that reviewer's comments/i, /other review threads/i,
    /authored-review or diligence findings/i, /CI fixes/i,
    /while the forge still counts it/i];
  checkRule(watch, (text) => requires(text, ...concepts),
    "A collaborator approval remains valid across unchanged-patch base updates or to a new head from repairs addressing review feedback: that reviewer's comments, other review threads, authored-review or diligence findings, or CI fixes, while the forge still counts it.",
    [[/carries over|remains valid/i, 'expires'],
      [/or to a new head/i, 'but never to a new head'],
      [/addressing review feedback/i, 'unrelated to review feedback'],
      [/while the forge still counts it/i, 'even when the forge rejects it']], concepts);
});

test('carryover requires an effective review and compatible repository rules', () => {
  const concepts = [/carryover requires/i, /undismissed approval/i,
    /no later `CHANGES_REQUESTED` from that reviewer/i,
    /repository rules/i, /require neither last-push approval nor stale-review dismissal/i];
  checkRule(watch, (text) => prohibits(text, /no later/i, ...concepts),
    'Carryover requires repository rules that require neither last-push approval nor stale-review dismissal, an undismissed approval, and no later `CHANGES_REQUESTED` from that reviewer.',
    [[/undismissed approval/i, 'dismissed approval'],
      [/no later/i, 'a later'],
      [/require neither last-push approval nor stale-review dismissal/i,
        'require last-push approval and stale-review dismissal']], concepts);
});
