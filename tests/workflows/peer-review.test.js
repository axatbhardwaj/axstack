import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const review = () => read('skills/axstack-review/SKILL.md');
const peer = () => review().split('## Peer mode (colleague PR)')[1].split('## Authored mode')[0].replace(/\s+/g, ' ');

// Each independent prompt contract is tested against removal, inversion and an
// equivalent rewording in memory. These checks do not prove agent compliance.
const positive = (source, concepts, rewording, direction, inversion) =>
  checkRule(source, (text) => requires(text, ...concepts), rewording,
    [[direction, inversion]], concepts);
const negative = (source, prohibition, concepts, rewording, inversion) =>
  checkRule(source, (text) => prohibits(text, prohibition, ...concepts), rewording,
    [[prohibition, inversion]], concepts);

test('peer usage: marker selects first review or follow-up', () => {
  positive(peer(), [/first review/i, /absent|missing/i, /bot verdict marker/i],
    'A missing bot verdict marker selects the first review.', /first review/i, 'full restart');
  positive(peer(), [/follow-up/i, /existing|present/i, /bot verdict marker/i, /verdict head=/i],
    'An existing bot verdict marker selects follow-up from verdict head=.', /follow-up/i, 'full restart');
});

test('B1 peer intent is context and author decisions are accepted', () => {
  positive(peer(), [/peer scope/i, /code and design only/i],
    'Peer scope covers code and design only.', /only/i, 'and process');
  positive(peer(), [/ticket/i, /PR description/i, /author comments/i, /context/i, /defects/i],
    'Ticket, PR description and author comments supply context for finding defects.', /context/i, 'binding obligations');
  negative(peer(), /never ask/i, [/author/i, /approvals/i, /sign-offs/i, /spec approver/i, /process decision/i],
    'Never ask the author for approvals, sign-offs, a spec approver or a process decision.', 'Always ask');
  positive(peer(), [/accept/i, /author/i, /scope or design/i, /approved or decided elsewhere/i],
    'Accept an author statement that a scope or design point was approved or decided elsewhere.', /accept/i, 'Reject');
});

test('B2 peer blockers require a validated current behaviour defect', () => {
  positive(peer(), [/peer blocker/i, /validated behaviour defect/i, /current head/i, /reproduction or quoted code/i,
    /wrong results/i, /security/i, /data loss/i, /funds/i, /availability regression/i, /broken caller contract/i],
  'A peer blocker requires a validated behaviour defect at the current head with reproduction or quoted code: wrong results, security, data loss or funds, availability regression, or a broken caller contract.',
  /validated/i, 'suspected');
  positive(peer(), [/PR description/i, /counts/i, /SHAs/i, /test adequacy/i, /mutation survivors/i, /missing tests/i,
    /docs/i, /style/i, /simplification/i, /process/i, /non-blocking notes/i],
  'PR description, counts, SHAs, test adequacy, mutation survivors, missing tests, docs, style, simplification and process belong in non-blocking notes.',
  /non-blocking notes/i, 'blocking findings');
  negative(peer(), /no follow-up issue required/i, [/notes/i],
    'Peer notes have no follow-up issue required.', 'a follow-up issue required');
  positive(peer(), [/uncertainty/i, /limitation/i, /instead of/i, /higher rating/i],
    'Record uncertainty as a limitation instead of a higher rating.', /limitation/i, 'blocker');
  positive(peer(), [/peer bar overrides/i, /medium and high block/i, /nobody can lower a rating/i, /peer findings only/i],
    'The peer bar overrides medium and high block and nobody can lower a rating for peer findings only.', /overrides/i, 'preserves');
});

test('B3 peers receive a binding verdict without merge authority', () => {
  positive(peer(), [/every published peer verdict/i, /binding/i, /APPROVE/i, /REQUEST_CHANGES/i],
    'Every published peer verdict is binding APPROVE or REQUEST_CHANGES.', /binding/i, 'advisory');
  negative(peer(), /never/i, [/COMMENT review/i], 'Never publish a COMMENT review.', 'Always');
  negative(peer(), /no blocker remains open/i, [/APPROVE/i, /notes/i, /body/i],
    'APPROVE when no blocker remains open, with notes in the body.', 'any blocker remains open');
  negative(peer(), /never/i, [/bot/i, /merges peer PRs/i], 'The bot never merges peer PRs.', 'always');
});
