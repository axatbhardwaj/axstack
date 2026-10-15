import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const review = () => read('skills/axstack-review/SKILL.md');
const peer = () => review().split('## Peer mode (colleague PR)')[1].split('## Authored mode')[0].replace(/\s+/g, ' ');

// Each independent prompt contract is tested against removal, inversion and an
// equivalent rewording in memory. These checks do not prove agent compliance.
const positive = (source, concepts, rewording, direction, inversion) =>
  checkRule(source.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'), (text) => requires(text, ...concepts), rewording,
    [[direction, inversion]], concepts);
const negative = (source, prohibition, concepts, rewording, inversion) =>
  checkRule(source.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'), (text) => prohibits(text, prohibition, ...concepts), rewording,
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

test('B4 first review is broad and follow-ups stay bounded', () => {
  positive(peer(), [/first review/i, /axstack-reviewer-primary/i, /axstack-reviewer-peer/i, /full diff/i, /all six angles/i],
    'First review dispatches axstack-reviewer-primary and axstack-reviewer-peer on the full diff and all six angles.',
    /full diff/i, 'delta only');
  negative(peer(), /never/i, [/peer/i, /diligence/i], 'Never dispatch diligence in peer mode.', 'Always');
  positive(peer(), [/follow-up/i, /one reviewer/i, /prior blockers?/i, /fixed or open/i, /author.*replies/i, /PR comments/i, /only the delta/i, /last reviewed head/i],
    'Follow-up uses one reviewer to mark prior blockers fixed or open, read author replies and PR comments, and inspect only the delta since the last reviewed head.',
    /one reviewer/i, 'two reviewers');
  positive(peer(), [/new blocker/i, /only/i, /behaviour defect introduced by the delta/i, /missed serious security/i, /data.loss/i, /funds/i],
    'A new blocker qualifies only for a behaviour defect introduced by the delta or missed serious security, data-loss or funds defects.',
    /only/i, 'also');
  negative(peer(), /no new notes/i, [/unchanged code/i], 'Add no new notes on unchanged code.', 'Add new notes');
  positive(peer(), [/closed point/i, /fixed or accepted/i, /stays closed unless/i, /same defect reproduces/i, /new head/i],
    'A closed point, fixed or accepted, stays closed unless the same defect reproduces at the new head.',
    /stays closed unless/i, 'reopens even without proof that');
});

test('B5 author replies require an evidenced decision by the reviewer', () => {
  positive(peer(), [/author explanations are evidence/i, /weigh each reply/i, /accept.*close/i, /reject with concrete evidence/i],
    'Author explanations are evidence: weigh each reply and accept to close or reject with concrete evidence.',
    /are evidence/i, 'are irrelevant');
  negative(peer(), /never/i, [/punt/i, /third party/i], 'Never punt the decision to a third party.', 'Always');
});

test('peer follow-up recovers an unavailable delta without restarting the pair', () => {
  positive(peer(), [/last reviewed head is unreachable/i, /rebase or force-push/i,
    /delta cannot be recovered/i, /single follow-up reviewer/i, /reviews the full current diff once/i,
    /peer blocking bar/i, /closed points stay closed/i],
  'If the delta cannot be recovered, or the last reviewed head is unreachable following a rebase or force-push, the single follow-up reviewer reviews the full current diff once, preserving the peer blocking bar while closed points stay closed.',
  /reviews the full current diff once/i, 'reports incomplete coverage');
  negative(peer(), /never/i, [/fallback/i, /fresh two-reviewer round/i],
    'The fallback is never a fresh two-reviewer round.', 'always');
});

test('peer context preserves scope and angles without requiring a ticket or spec', () => {
  negative(peer(), /cannot alter/i, [/context/i, /user-authorized scope/i, /six review angles/i, /authority/i],
    'The six review angles and authority, along with user-authorized scope, are boundaries context cannot alter.', 'can alter');
  negative(peer(), /not/i, [/missing ticket or spec/i, /peer coverage gap/i],
    'Treat a missing ticket or spec as context, not a peer coverage gap.', 'always');
});

test('interactive peer review retains the bounded prompt-only serious-risk path', () => {
  const escalation = review().split('## Prompt-only urgent escalation')[1].split('## Publishing rule')[0]
    .replace(/\s+/g, ' ');
  positive(escalation, [/peer reviews/i, /including interactive non-manager reviews/i,
    /only credible serious security\/funds risk/i, /prompt-only hold/i, /Notification policy \(c\)/i],
  'The prompt-only hold and Notification policy (c) address only credible serious security/funds risk in peer reviews, including interactive non-manager reviews.',
  /including interactive non-manager reviews/i, 'excluding interactive non-manager reviews');
});

test('peer follow-up and no-diligence exceptions reach shared routing', () => {
  for (const path of ['lifecycle.md', 'role-roster.md']) {
    const source = read(`skills/axstack/references/${path}`).replace(/\s+/g, ' ');
    positive(source, [/peer follow-up/i, /one reviewer/i],
      'Peer follow-up uses one reviewer.', /one reviewer/i, 'two reviewers');
  }
  negative(read('skills/axstack/references/diligence.md').replace(/\s+/g, ' '),
    /never/i, [/peer review/i, /diligence/i], 'Never dispatch diligence for peer review.', 'Always');
});

test('B6 sixth change request goes through an independent adviser panel', () => {
  positive(peer(), [/at most five/i, /REQUEST_CHANGES/i, /bot markers/i, /PR/i],
    'Allow at most five ordinary REQUEST_CHANGES per PR, counting bot markers.', /five/i, 'six');
  negative(peer(), /do not publish/i, [/sixth/i, /REQUEST_CHANGES/i, /panel/i],
    'Do not publish a sixth REQUEST_CHANGES before the adviser panel.', 'Publish');
  positive(peer(), [/dispatch/i, /axstack-advisor-astra/i, /axstack-advisor-opus/i, /independently/i,
    /open blockers/i, /author.*replies/i, /delta/i, /code/i],
    'Dispatch axstack-advisor-astra and axstack-advisor-opus independently with open blockers, author replies, delta and code.',
    /independently/i, 'jointly');
  negative(peer(), /no cross-read/i, [/advisers/i], 'Advisers have no cross-read.', 'shared cross-read');
  positive(peer(), [/both judge/i, /explanation or fix/i, /justifies approval/i],
    'Both judge whether the explanation or fix justifies approval.', /justifies approval/i, 'needs human approval');
  positive(peer(), [/both accept/i, /APPROVE/i, /advisers accepted the author's explanation/i],
    "Both accept -> APPROVE with one line: advisers accepted the author's explanation.", /APPROVE/, 'REQUEST_CHANGES');
  positive(peer(), [/both reject/i, /REQUEST_CHANGES/i, /short reasons/i, /final/i, /later heads/i, /only/i],
    'Both reject -> REQUEST_CHANGES with short reasons that are final, and later heads are checked only against those points.',
    /final/i, 'provisional');
  positive(peer(), [/split/i, /one reconciliation reply each/i, /then/i, /axstack-escalation-fable/i, /decides/i, /contracts/i],
    'On a split, take one reconciliation reply each, then axstack-escalation-fable decides under contracts.',
    /one reconciliation reply each/i, 'unlimited reconciliation');
  positive(peer(), [/credible serious security\/funds risk/i, /serious-risk/i, /Notification policy/i, /\(c\)/i],
    'Credible serious security/funds risk follows the serious-risk and Notification policy (c) path.', /\(c\)/i, '(b)');
  negative(peer(), /no other human ping/i, [], 'Send no other human ping.', 'Send another human ping');
});

test('B7 peer output has bounded findings and compact follow-up status', () => {
  positive(peer(), [/first peer review/i, /400 words/i, /one verdict line/i, /location/i, /breakage/i, /evidence/i, /one-line fix hint/i],
    'First peer review stays within about 400 words: one verdict line and blockers with location, breakage, evidence and a one-line fix hint.',
    /400 words/i, '1000 words');
  negative(peer(), /Not verified:/i, [/at most five one-line notes/i, /one/i],
    'Include at most five one-line notes and one Not verified: line.', 'Verified:');
  positive(peer(), [/follow-up/i, /150 words/i, /blocker status/i, /new qualifying blocker/i],
    'Follow-up stays within about 150 words: blocker status and any new qualifying blocker.', /150 words/i, '1000 words');
  negative(peer(), /no/i, [/process narration/i, /disposition essays/i, /decision needed/i],
    'Use no process narration, disposition essays or decision needed sections.', 'Include');
});

test('B8 authored rubric, diligence and review authority retain their contracts', () => {
  const source = review().replace(/\s+/g, ' ');
  const severity = source.split('## Finding severity')[1].split('## Codebase findings mode')[0];
  positive(severity, [/medium/i, /high/i, /block/i, /APPROVE/i],
    'Medium and high findings block APPROVE.', /block/i, 'allow');
  negative(severity, /nobody can/i, [/lower a rating/i], 'Nobody can lower a rating.', 'Everybody can');
  positive(source, [/In authored PR review rounds/i, /dispatch/i, /axstack-diligence/i, /independently/i, /same exact revision and base/i],
    'In authored PR review rounds dispatch axstack-diligence independently on the same exact revision and base.',
    /dispatch/i, 'skip');
  positive(source, [/authored reviewer/i, /checks/i, /Revert/i, /diff/i],
    'The authored reviewer checks the Revert line against the diff.', /checks/i, 'ignores');
  positive(source, [/authored mode/i, /verify the recorded shape/i, /pinned head and base/i],
    'In authored mode verify the recorded shape against the pinned head and base.', /verify/i, 'ignore');
  positive(source, [/recorded owning watch thread/i, /applies/i, /guarded merge and card rules/i],
    'The recorded owning watch thread applies guarded merge and card rules.', /applies/i, 'ignores');
});

test('manager authority uses bounded peer rounds and no process escalation', () => {
  const source = read('skills/axstack/references/automations.md').replace(/\s+/g, ' ');
  positive(source, [/first review/i, /two isolated configured reviewers/i, /follow-up/i, /one reviewer/i, /diligence excluded/i],
    'First review uses two isolated configured reviewers and follow-up one reviewer, with diligence excluded.',
    /one reviewer/i, 'two reviewers');
  negative(source, /never/i, [/peer/i, /architecture decision/i, /permanent on-chain state change/i, /process approval/i, /ping/i],
    'Never ping for peer architecture decision, permanent on-chain state change or process approval alone.', 'Always');
});
