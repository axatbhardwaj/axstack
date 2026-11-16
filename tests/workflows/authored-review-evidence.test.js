import { readSkillFile as readFileSync } from './skill-source.js';
import { expect, test } from 'bun:test';

import { checkRule, requires } from './prose-contract.js';

const review = readFileSync(`${import.meta.dir}/../../skills/axstack-review/SKILL.md`, 'utf8');
// Template lines are independent fields; semicolons join clauses within a field.
const compactFields = (text) => text.trim().split('\n').map((line) =>
  line.trim().replace(/;/g, ',')).join('. ').replace(/\s+/g, ' ');
const sections = [
  ['review receipt', review.split('## Template: review receipt')[1].split('## Prompt-only urgent escalation')[0]],
];

// Shipped instruction contracts, not proof of live reviewer compliance.
const fields = [
  ['coverage status and scope',
    [/Coverage:/i, /COMPLETE/, /INCOMPLETE/, /angles|lenses/i, /acceptance/i, /executable evidence|executed checks/i],
    'Coverage: COMPLETE | INCOMPLETE — report the lenses, acceptance and executed checks covered.',
    [[/COMPLETE \| INCOMPLETE/, 'COMPLETE only'], [/acceptance/i, 'file count']]],
  ['safety fact concerns the change',
    [/Safety fact:/i, /change itself/i, /rather than|instead of/i, /review process/i],
    'Safety fact: give evidence about the change itself instead of the review process.',
    [[/change itself/i, 'review itself'], [/rather than|instead of/i, 'including']]],
  ['every non-agent comment rated at head',
    [/non-agent comments?/i, /each|every/i, /current head|the head/i,
      /above low/, /(?<!above )\blow\b/, /addressed/, /uncertain/],
    'Non-agent comments: rate every comment at the current head uncertain, addressed, low, or above low.',
    [[/each|every/gi, 'selected'], [/non-agent/gi, 'agent-authored'], [/current head|the head/i, 'an old revision'],
      [/above low/, 'high only'], [/(?<!above )\blow\b/, 'medium'],
      [/addressed/, 'resolved'], [/uncertain/, 'assumed safe']]],
  ['comments re-rated for each head',
    [/re-rate|rate anew/i, /each|every/i, /non-agent comment/i, /(?:new|changed) head/i],
    'Re-rate every non-agent comment at each changed head.',
    [[/re-rate|rate anew/i, 'carry over ratings for'], [/each|every/gi, 'selected'],
      [/(?:new|changed) head/i, 'initial head']]],
];

test('review receipt tags every changed behavior limitation by meaning', () => {
  const concepts = [/reviewer/i, /tags?|marks?/i, /each|every/i, /limitation/i,
    /changed behavior/i, /unexercised|untested/i, /unverified|unconfirmed/i,
    /whatever words|however described/i, /changed-behavior: unproven/i];
  checkRule(sections[0][1], text => requires(text, ...concepts),
    'The reviewer marks every limitation leaving changed behavior untested or unconfirmed, however described, changed-behavior: unproven.',
    [[/tags?|marks?/gi, 'Drop'], [/each|every/gi, 'selected'],
      [/whatever words|however described/gi, 'only with exact wording'],
      [/changed-behavior: unproven/gi, 'changed-behavior: proven']], concepts);
});

for (const [section, text] of sections) {
  for (const [field, concepts, rewording, inversions] of fields) {
    test(`authored evidence ${section}: ${field} survives rewording and rejects removal/inversion`, () => {
      checkRule(compactFields(text), (source) => requires(source, ...concepts), rewording, inversions, concepts);
    });
  }
}

test('candidate brief dispatches the review receipt contract before escalation', () => {
  const brief = review.split('## Template: candidate review brief')[1].split('## Template: review receipt')[0];
  const block = brief.split('```text')[1].split('```')[0];
  checkRule(block, text => requires(text, /follow/i, /Review receipt/i),
    'Follow Review receipt for authored requirements.', [[/follow/gi, 'ignore']], [/follow/i, /Review receipt/i]);
  for (const [name, path] of [
    ['Capture receipts', 'skills/axstack/references/capture-receipts.md'],
    ['Review receipt', 'skills/axstack-review/references/review-receipt.md'],
  ]) {
    const accepts = text => requires(text, /follow/i, new RegExp(path.replaceAll('.', '\\.')), /resolved from/i, /absolute Workspace checkout/i);
    checkRule(block, accepts, `Follow ${name} at ${path}, resolved from the absolute Workspace checkout.`,
      [[/absolute Workspace checkout/gi, 'brief file directory']], []);
  }
  expect(block.trim().split('\n').at(-1)).toMatch(/^Escalate to user:/);
});
