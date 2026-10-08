import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const shape = 'skills/axstack/references/pr-shape.md';
const review = 'skills/axstack-review/SKILL.md';
const tickets = 'skills/axstack-tickets/SKILL.md';
const audit = 'skills/axstack-audit/SKILL.md';
const record = 'skills/axstack-audit/references/record.md';
const docs = 'docs/workflows.md';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// Independent instruction contracts: the prior band checks enforced approval
// gates. These protect informational sizing and coverage without simulating agents.
const rules = [
  ['total counts every added and deleted line from helper output', [shape],
    [/total\s*(?:=|is|as|equals)\s*additions\s*(?:\+|plus)\s*deletions/i, /all files|every file/i, /JSON|helper(?:'s)? output/i],
    'The helper output defines total as additions plus deletions across every file.', [/\+|\bplus\b/i, 'minus']],
  ['threshold is informational', [shape], [/above|over/i, /2,?500/, /changed lines|changed LOC/i, /informational only|advisory only/i],
    'Totals over 2,500 changed LOC are advisory only.', [/informational only|advisory only/i, 'an approval gate']],
  ['flags are informational', [review, tickets, audit, record, docs], [/size flags/i, /informational only|advisory only/i],
    'Size flags are advisory only.', [/informational only|advisory only/i, 'approval gates']],
  ['size alone cannot gate', [shape, review, tickets, docs],
    [/size alone|size by itself/i, /block review/i, /reject a PR/i, /require split attempts|mandate splitting/i, /cohesion\/exception rationale|cohesion or exception justification/i, /hold approval/i],
    'Size by itself cannot block review, reject a PR, mandate splitting, demand cohesion or exception justification, or hold approval.',
    [/must never|cannot/i, 'must'], /must never|cannot/i],
  ['review actual complexity incrementally', [shape, review, docs],
    [/review/i, /actual footprint|real change footprint/i, /complexity/i, /required context|necessary context/i, /incrementally/i, /when needed|as needed/i],
    'Review the real change footprint, complexity and necessary context incrementally as needed.',
    [/incrementally (?:when|as) needed/i, 'in one fixed pass']],
  ['approval needs coverage', [shape, review, docs], [/approval/i, /requires|needs/i, /sufficient review coverage|adequate review coverage/i],
    'Approval needs adequate review coverage.', [/requires|needs/i, 'may skip']],
  ['missing coverage stays incomplete', [shape, review, docs], [/report|record/i, /INCOMPLETE/, /required coverage/i, /missing|absent/i],
    'Record INCOMPLETE when required coverage is absent.', [/INCOMPLETE/, 'APPROVE']],
  ['theme splitting depends on coherence', [shape], [/unrelated themes|independent themes/i, /split|separate/i, /regardless of size|at any size/i],
    'Separate independent themes at any size.', [/split|separate/i, 'combine']],
  ['no invented safe budget', [shape], [/universal safe LOC limit|universally safe line limit/i, /fixed token percentage|fixed percentage of tokens/i],
    'There is no universally safe line limit or fixed percentage of tokens.', [/no/i, 'a'], /no/i],
  ['size needs no user approval', [shape, review, docs], [/size alone|size by itself/i, /user approval|user sign-off/i],
    'Size by itself never needs user sign-off.', [/never/i, 'always'], /never/i],
  ['review verifies recorded shape', [review], [/angle 6/i, /verify|check/i, /recorded (?:shape|size)/i, /head/i, /base/i],
    'Under angle 6, check the recorded size against the pinned head and base.', [/verify|check/i, 'never verify']],
];

for (const [name, paths, concepts, rewording, inversion, prohibition] of rules) {
  const accepts = (text) => prohibition
    ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
  for (const path of paths) {
    test(`PR shape: ${name} (${path}); removal/inversion red, rewording green`, () => {
      checkRule(read(path), accepts, rewording, [inversion], concepts);
    });
  }
}

test('active callers and audit schema retire size gates and retain measurement evidence', () => {
  for (const path of [shape, review, tickets, audit, record, docs]) {
    expect(read(path), path).not.toMatch(/≤2000|2001[–-]2500|>2500|rationale.band|exception.band|within band|missing rationale.{0,80}blocks approval/i);
  }
  expect(read(tickets)).toMatch(/Size est: <coarse size estimate>/);
  expect(read(tickets)).toMatch(/actual measurement[^.]*bulk disclosure[^.]*implement receipt/i);
  expect(readFileSync(`${import.meta.dir}/../../${review}`, 'utf8')).not.toMatch(/^\s*7\.\s/m);
  for (const path of [audit, record]) {
    const text = read(path);
    expect(text).toMatch(/size flag \/ total PRs/i);
    expect(text).toMatch(/UNKNOWN[^.]*measurement/i);
    expect(text).toMatch(/totals[^.]*bulk[^.]*head[^.]*base/i);
  }
  expect(read(review)).toMatch(/mismatch[^.]*measured total[^.]*finding/i);
  expect(read(review)).toMatch(/bulk buckets[^.]*reproducible command/i);
  expect(read(shape)).toMatch(/material.scope[^.]*security[^.]*downtime[^.]*data.loss[^.]*major.design.risk[^.]*unavailable.model hold/i);
});
