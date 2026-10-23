import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const peer = 'skills/axstack-review/references/peer-mode.md';
const candidate = 'skills/axstack-review/references/review-candidate.md';
const skill = 'skills/axstack-review/SKILL.md';
const automation = 'skills/axstack/references/automations.md';

// Each contract rejects removal, loss of a required concept and inversion,
// and accepts a paraphrase. This proves prompt obligations, not live execution.
const rules = [
  [peer, [/owner/i, /refute/i, /first/i, /evidence/i],
    'First, the owner can refute an allegation with evidence.', /refute/i, 'confirm'],
  [peer, [/surviving single-source blockers/i, /fresh session/i, /other peer-pair role/i, /batched per direction/i],
    'Send surviving single-source blockers, batched per direction, to a fresh session of the other peer-pair role.', /other peer-pair role/i, 'original reviewer'],
  [peer, [/at most two verifiers/i, /first review/i, /one/i, /follow-up/i],
    'Use at most two verifiers for a first review and one for a follow-up.', /at most two/i, 'unlimited'],
  [peer, [/verifier brief/i, /allegation/i, /author replies/i, /context/i, /pinned head and base/i, /code/i],
    'Give the verifier brief the allegation, relevant author replies and context, pinned head and base, and code.', /pinned head and base/i, 'unpinned branch'],
  [peer, [/verifier brief/i, /reviewer verdicts/i],
    'Never include reviewer verdicts in the verifier brief.', /never/i, 'Always', /never/i],
  [peer, [/each blocker/i, /CONFIRMED/i, /REFUTED/i, /UNSETTLED/i, /verifier.*own evidence/i],
    "For each blocker return CONFIRMED, REFUTED or UNSETTLED with the verifier's own evidence.", /own evidence/i, 'reviewer votes'],
  [peer, [/single-provider presets/i, /other model/i, /session\/model independence/i, /cross-family/i],
    'For single-provider presets use the other model and disclose session/model independence instead of cross-family independence.', /other model/i, 'same model'],
  [peer, [/verifier receipt/i, /reviewer receipt/i, /five-request cap/i],
    'A verifier receipt never replaces a reviewer receipt or counts toward the five-request cap.', /never/i, 'always', /never/i],
  [peer, [/blocker stands only/i, /both first-pass reviewers/i, /same concrete defect/i, /behavioural evidence/i, /verifier CONFIRMED/i],
    'A blocker stands only if both first-pass reviewers raised the same concrete defect with behavioural evidence or a verifier CONFIRMED it.', /only/i, 'even without proof'],
  [peer, [/any rating/i, /ambiguous match/i, /single-source/i],
    'Match defects at any rating and treat an ambiguous match as single-source.', /single-source/i, 'corroborated'],
  [peer, [/REFUTED/i, /dropped/i, /privately/i, /rejected with evidence/i],
    'Keep REFUTED allegations dropped and privately recorded as rejected with evidence.', /dropped/i, 'published'],
  [peer, [/REFUTED/i, /posted/i],
    'REFUTED allegations are never posted.', /never/i, 'always', /never/i],
  [peer, [/UNSETTLED/i, /non-blocking note/i, /Not verified:/i, /five-note limit/i],
    'Turn UNSETTLED into a non-blocking note plus Not verified: within the five-note limit.', /non-blocking note/i, 'blocker', /Not verified:/i],
  [peer, [/verifier unavailable or failed/i, /INCOMPLETE/i],
    'Verifier unavailable or failed means INCOMPLETE.', /INCOMPLETE/i, 'APPROVE'],
  [peer, [/verifier unavailable or failed/i, /submit nothing/i],
    'Submit nothing when the verifier unavailable or failed outcome holds.', /submit nothing/i, 'submit APPROVE', /submit nothing/i],
  [peer, [/Pre-existing disputes/i, /settle before corroboration/i],
    'Pre-existing disputes must settle before corroboration.', /before/i, 'after'],
  [peer, [/prior open blockers/i, /rejected rebuttals/i, /follow-up/i],
    'On follow-up, prior open blockers and rejected rebuttals skip the verifier.', /skip/i, 'require', /skip the verifier/i],
  [peer, [/new or reopened blockers/i, /full-diff fallback/i, /require verification/i],
    'New or reopened blockers, including full-diff fallback findings, require verification.', /require/i, 'bypass'],
  [peer, [/downgraded notes/i, /re-block/i, /unless/i, /delta changes them/i, /serious risk/i],
    'Downgraded notes never re-block unless the delta changes them or there is serious risk.', /never re-block unless/i, 'always re-block even without', /never re-block unless/i],
  [candidate, [/\buse\b/i, /peer/i, /unresolved disagreement/i, /verifier route/i, /corroboration/i],
    'For peer unresolved disagreement, use the verifier route under corroboration.', /use/i, 'bypass'],
  [candidate, [/peer/i, /verifiers/i, /fresh other-role sessions/i, /same checkout isolation/i],
    'Peer verifiers use fresh other-role sessions with the same checkout isolation.', /same checkout isolation/i, 'owner checkout'],
  [skill, [/Peer complete/i, /requires/i, /verifier receipts/i, /when dispatched/i],
    'Peer complete also requires verifier receipts when dispatched.', /requires/i, 'ignores'],
  [skill, [/Automation exception/i, /route unresolved disagreement through/i, /peer verifier route/i],
    'Under the Automation exception, route unresolved disagreement through the peer verifier route.', /route unresolved disagreement through/i, 'ignore unresolved disagreement and bypass'],
  [automation, [/\bresolve\b/i, /peer/i, /unresolved disagreement/i, /verifier route/i, /corroboration/i],
    'Resolve peer unresolved disagreement through the verifier route under corroboration.', /resolve/i, 'ignore'],
];

for (const [path, concepts, rewording, direction, inversion, prohibition] of rules) {
  test(`peer corroboration: ${rewording}`, () => {
    const source = readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
    const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    checkRule(source, accepts, rewording, [[direction, inversion]], concepts);
  });
}
