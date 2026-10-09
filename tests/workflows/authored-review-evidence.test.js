import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires } from './prose-contract.js';

const review = readFileSync(`${import.meta.dir}/../../skills/axstack-review/SKILL.md`, 'utf8');
// Template lines are independent fields; semicolons join clauses within a field.
const compactFields = (text) => text.trim().split('\n').map((line) =>
  line.trim().replace(/;/g, ',')).join('. ').replace(/\s+/g, ' ');
const sections = [
  ['candidate brief', review.split('## Template: candidate review brief')[1].split('## Template: review receipt')[0]],
  ['review receipt', review.split('## Template: review receipt')[1].split('## Prompt-only urgent escalation')[0]],
];

// Shipped instruction contracts, not proof of live reviewer compliance.
const fields = [
  ['coverage status and scope',
    [/Coverage:/i, /COMPLETE/, /INCOMPLETE/, /angles|lenses/i, /acceptance/i, /executable evidence|executed checks/i],
    'Coverage: COMPLETE | INCOMPLETE — report the lenses, acceptance and executed checks covered.',
    [[/COMPLETE \| INCOMPLETE/, 'COMPLETE only'], [/acceptance/i, 'file count']]],
  ['changed behavior limitations',
    [/Limitations:|limitation/i, /each|every/i, /changed.behavio[u]?r/i, /unexercised|untested/i,
      /unverified|unconfirmed/i, /changed-behavior: unproven/, /whatever words|regardless of wording|however described/i],
    'Limitations: tag every limitation leaving changed behavior untested or unconfirmed, however described, changed-behavior: unproven.',
    [[/each|every/i, 'selected'], [/changed-behavior: unproven/, 'changed-behavior: proven'],
      [/whatever words|regardless of wording|however described/i, 'only with these exact words']]],
  ['reviewer check at final head',
    [/Final-head check:/i, /command/i, /->/, /log path/i, /reviewer/i, /ran|run|executed/i, /final head/i],
    'Final-head check: <command> -> <log path> for a check executed by the reviewer at the final head.',
    [[/reviewer/i, 'author'], [/final head/i, 'earlier head']]],
  ['check log retained in run evidence',
    [/Final-head check:/i, /log/i, /kept|keep|retain/i, /run.?s? evidence folder/i],
    "Final-head check: retain the log in the run's evidence folder.",
    [[/kept|keep|retain/i, 'discard'], [/run.?s? evidence folder/i, 'temporary scratch folder']]],
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

for (const [section, text] of sections) {
  for (const [field, concepts, rewording, inversions] of fields) {
    test(`authored evidence ${section}: ${field} survives rewording and rejects removal/inversion`, () => {
      checkRule(compactFields(text), (source) => requires(source, ...concepts), rewording, inversions, concepts);
    });
  }
}

test('candidate brief keeps authored requirements inside the dispatched block before escalation', () => {
  const block = sections[0][1].split('```text')[1].split('```')[0];
  for (const [, concepts] of fields) expect(requires(compactFields(block), ...concepts)).toBe(true);
  expect(block.trim().split('\n').at(-1)).toMatch(/^Escalate to user:/);
});
