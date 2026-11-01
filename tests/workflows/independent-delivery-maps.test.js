import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const compact = (text) => text.replace(/\s+/g, ' ');

test('Spec format loads outcome planning without adding an artifact', () => {
  const format = read('skills/axstack-spec/references/format.md');
  expect(loadedReferences(format)).toContain('../../axstack/references/independent-delivery.md');
  checkRule(compact(format), (text) => requires(text, /describe|state/i,
    /each outcome/i, /acceptance/i, /produced and consumed interfaces/i, /execution requirements/i),
  'In execution requirements, state each outcome with acceptance and produced and consumed interfaces.',
  [[/describe|state/i, 'omit']], [/each outcome/i, /acceptance/i, /produced and consumed interfaces/i]);
});

test('Tickets map carries scope, boundaries and milestone evidence into execution', () => {
  const tickets = read('skills/axstack-tickets/SKILL.md');
  const template = tickets.match(/## Template: capability to task map\s+```text\n([\s\S]*?)```/)?.[1] ?? '';
  // Template field contracts, not exact prompt bytes or a synthetic task planner.
  for (const field of [
    /outcome[^\n]*independently deliverable/i,
    /scope[^\n]*accepted boundar/i,
    /driver[^\n]*accepted or proposed/i,
    /writes[^\n]*resources[^\n]*boundar/i,
    /produces[^\n]*consumes[^\n]*(?:interfaces|artifacts)/i,
    /milestones[^\n]*acceptance state[^\n]*identity/i,
    /evidence[^\n]*invalidation[^\n]*receipt[^\n]*changes/i,
    /branch[^\n]*main[^\n]*integration[^\n]*reviewed[^\n]*code predecessor/i,
  ]) expect(template).toMatch(field);
});

test('Implement receipt binds the map to current execution evidence', () => {
  const implement = read('skills/axstack-implement/SKILL.md');
  const receipt = implement.match(/```text\n(Record:[\s\S]*?)```/)?.[1] ?? '';
  expect(receipt).toMatch(/Delivery map:[^\n]*record[^\n]*outcomes[^\n]*accepted scope drivers[^\n]*current milestone evidence[^\n]*held launches/i);
});
