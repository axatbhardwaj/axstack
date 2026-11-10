import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8');
const diligence = 'axstack/references/diligence.md';
const publication = 'axstack/references/candidate-publication.md';
const review = 'axstack-review/references/review-candidate.md';
const readiness = 'axstack-watch/references/readiness.md';
const proof = 'axstack-watch/references/proven-verification.md';

// Instruction contracts only. Each semantic rule rejects removal/inversion and
// accepts independent wording; the status field is a receipt wire contract.
function rule(name, path, concepts, wording, direction, inverse, ban) {
  test(`combined review: ${name}`, () => {
    checkRule(read(path).replace(/```[\s\S]*?```/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' '), (text) => ban
      ? prohibits(text, ban, ...concepts) : requires(text, ...concepts),
    wording, [[direction, inverse]], concepts);
  });
}

rule('eligibility binds small intent, one PR and absence of risk', diligence,
  [/combined review/i, /only/i, /small-change intent/i, /one PR/i, /non-risk-path/i],
  'Combined review applies only to one PR with a snapshotted small-change intent and a non-risk-path classification.',
  /only/i, 'also');
rule('combined reviewer remains cross-provider', diligence,
  [/combined reviewer/i, /provider (?:that )?differs/i, /every author and repair provider/i],
  'The combined reviewer uses a provider that differs from every author and repair provider.',
  /differs/i, 'matches');
rule('review risk extends the existing merge list without changing merge authority', diligence,
  [/review-depth risk/i, /includes/i, /merge-risk list/i, /merge, dispatch or authority rules/i,
    /driver or reviewer/i, /security, data-loss or major-design concern/i],
  'Review-depth risk includes the merge-risk list, changes to merge, dispatch or authority rules, and anything the driver or reviewer flags as a security, data-loss or major-design concern.',
  /includes/i, 'excludes');
rule('substantial, spec, risk and release retain separate diligence', diligence,
  [/separate diligence/i, /required/i, /substantial work/i, /spec checkpoints/i, /risk paths/i, /release reconciliation/i],
  'Separate diligence is required for substantial work, spec checkpoints, risk paths and release reconciliation.',
  /required/i, 'waived');
rule('combined pass covers every applicable diligence check', diligence,
  [/combined reviewer/i, /performs every applicable diligence check/i,
    /scope/i, /dropped, added or softened/i, /author evidence/i, /red\/green logs/i,
    /PR body and commits/i, /claims, counts, SHAs and paths/i, /diff/i],
  'The combined reviewer performs every applicable diligence check: scope for dropped, added or softened obligations, author evidence and red/green logs, and PR body and commits claims, counts, SHAs and paths against the diff.',
  /every applicable/i, 'selected');
rule('scope status carries head and base with evidence', diligence,
  [/combined reviewer/i, /returns Scope: PASS\|FINDINGS\|UNKNOWN/i, /exact head and base/i, /evidence/i, /limitations/i],
  'The combined reviewer returns Scope: PASS|FINDINGS|UNKNOWN at the exact head and base with evidence and limitations.',
  /exact head and base/i, 'previous head only');
rule('pre-publication evidence readback belongs to driver', publication,
  [/before publication/i, /driver/i, /combined review/i, /verifies/i, /author.*evidence folder/i,
    /named red\/green logs exist/i, /counts, SHAs and paths match/i],
  "Before publication for combined review, the driver verifies the author's evidence folder: named red/green logs exist and counts, SHAs and paths match.",
  /verifies/i, 'assumes');
rule('evidence gaps block publication', publication,
  [/missing|mismatched/i, /evidence/i, /holds? publication/i,
    /responsible package or integration author/i, /existing session/i, /worktree/i],
  'Missing or mismatched evidence holds publication and returns to the responsible package or integration author in its existing session and worktree.',
  /holds? publication/i, 'allows publication');
rule('combined review follows remote publication', review,
  [/combined review/i, /runs after publication/i, /confirmed remote head/i, /pinned base/i],
  'Combined review runs after publication at the confirmed remote head and pinned base.',
  /after publication/i, 'before publication');
rule('reviewer is the scope producer instead of a second dispatch', review,
  [/eligible small non-risk-path/i, /same cross-provider reviewer/i, /Scope:/i, /separate diligence dispatch/i],
  'For eligible small non-risk-path work, the same cross-provider reviewer returns Scope: PASS|FINDINGS|UNKNOWN without a separate diligence dispatch.',
  /without a separate diligence dispatch/i, 'with a separate diligence dispatch',
  /without a separate diligence dispatch/i);
for (const [name, path] of [['readiness', readiness], ['verification', proof]]) {
  rule(`${name} accepts combined approval and scope pass`, path,
    [/eligible small non-risk-path/i, /APPROVE/i, /Scope: PASS/i, /same cross-provider reviewer/i,
      /exact head and base/i, /satisf(?:y|ies)/i, /diligence/i],
    'For eligible small non-risk-path work, APPROVE and Scope: PASS from the same cross-provider reviewer at the exact head and base satisfy the diligence gate.',
    /Scope: PASS/i, 'Scope: UNKNOWN');
}
rule('failed or unknown scope blocks readiness', readiness,
  [/Scope: FINDINGS/i, /Scope: UNKNOWN/i, /blocks? merge-ready/i],
  'Scope: FINDINGS or Scope: UNKNOWN blocks merge-ready.',
  /blocks? merge-ready/i, 'allows merge-ready');
rule('every head or base change invalidates the combined receipt', diligence,
  [/every head or base change/i, /invalidates/i, /combined receipt/i, /fresh/i, /review/i, /Scope/i],
  'Every head or base change invalidates the combined receipt and requires fresh review and Scope evidence.',
  /invalidates/i, 'preserves');

// Reviewer M2: pin each source rule at its owning boundary, not a sibling gate.
rule('driver readback cannot self-issue Scope PASS', publication,
  [/driver readback/i, /Scope: PASS/],
  'Driver readback never supplies Scope: PASS.', /never supplies/i, 'supplies', /never supplies/i);
rule('unknown eligibility holds the combined route', diligence,
  [/unknown eligibility/i, /holds the combined route/i],
  'Unknown eligibility holds the combined route.', /holds/i, 'opens');
rule('unclassified eligibility uses separate diligence', diligence,
  [/use separate diligence/i, /pending classification|while eligibility remains unclassified/i],
  'Use separate diligence while eligibility remains unclassified.', /use separate diligence/i, 'waive separate diligence');
rule('shared gate UNKNOWN holds with a recorded reason', diligence,
  [/Scope: UNKNOWN/, /holds merge-ready/i, /reason recorded/i, /driver disposition/i],
  'Scope: UNKNOWN holds merge-ready with its reason recorded for driver disposition.', /holds merge-ready/i, 'permits merge-ready');
rule('shared gate FINDINGS returns to the author and blocks', diligence,
  [/Scope: FINDINGS/, /returns to/i, /responsible package or integration author/i,
    /existing session/i, /worktree/i, /same round/i, /blocks merge-ready/i],
  'Scope: FINDINGS returns to the responsible package or integration author in its existing session and worktree in the same round and blocks merge-ready.', /blocks merge-ready/i, 'permits merge-ready');
rule('disposition cannot convert unknown evidence into PASS', diligence,
  [/disposition/i, /unknown evidence/i, /pass/i],
  'A disposition never converts unknown evidence into a pass.', /never converts/i, 'converts', /never converts/i);
rule('missing or stale Scope receipts cannot satisfy the gate', diligence,
  [/missing or stale Scope receipt/i, /this gate/i],
  'A missing or stale Scope receipt never satisfies this gate.', /never satisfies/i, 'satisfies', /never satisfies/i);
rule('only eligible combined approval satisfies diligence', diligence,
  [/APPROVE/, /Scope: PASS/, /satisfies the applicable diligence gate/i, /only for eligible work/i],
  'APPROVE plus Scope: PASS satisfies the applicable diligence gate only for eligible work.', /only for eligible work/i, 'for all work');
rule('ineligible missing or stale combined receipts block readiness', readiness,
  [/missing, stale or ineligible combined receipts/i, /block/i],
  'Missing, stale or ineligible combined receipts block readiness.', /block/i, 'permit readiness');
rule('separate diligence gaps hold publication', publication,
  [/diligence UNKNOWN/i, /missing\/stale receipt/i, /holds publication/i],
  'A diligence UNKNOWN or missing/stale receipt holds publication.', /holds publication/i, 'permits publication');
rule('base-only retargets require fresh review and diligence evidence', 'axstack-implement/SKILL.md',
  [/any head or base change/i, /requires fresh review/i, /applicable diligence evidence/i, /base-only retargets/i],
  'Any head or base change requires fresh review and applicable diligence evidence, including base-only retargets.', /requires fresh review/i, 'retains old review');
rule('authored review UNKNOWN holds readiness', 'axstack-review/SKILL.md',
  [/UNKNOWN/, /holds merge-ready/i],
  'UNKNOWN holds merge-ready.', /holds merge-ready/i, 'permits merge-ready');
rule('driver dispositions cannot replace required PASS', 'axstack/references/contracts.md',
  [/disposition/i, /required diligence PASS/i, /combined Scope: PASS/i],
  'A disposition never substitutes for required diligence PASS or combined Scope: PASS.', /never substitutes/i, 'substitutes', /never substitutes/i);
rule('implement returns combined findings within the round', 'axstack-implement/SKILL.md',
  [/combined Scope: FINDINGS/i, /return to/i, /same package\/integration repair route/i, /within the review round/i],
  'Combined Scope: FINDINGS return to the same package/integration repair route within the review round.', /return to/i, 'advance without repair');
rule('review candidate returns combined findings by the same repair route', review,
  [/combined Scope: FINDINGS/i, /same repair route/i],
  'Combined Scope: FINDINGS uses the same repair route.', /same repair route/i, 'approval route');
rule('review candidate UNKNOWN holds merge-ready', review,
  [/Scope: UNKNOWN\s+(?:holds?|blocks?) merge-ready/i],
  'Scope: UNKNOWN blocks merge-ready.', /holds?|blocks?/i, 'permits');
rule('receipt uses separate diligence for all other authored work', 'axstack-review/references/review-receipt.md',
  [/all other authored work\s+(?:uses|reports) n\/a\s*[—–-]\s*separate diligence/i],
  'All other authored work reports n/a — separate diligence.', /uses|reports/i, 'omits');
rule('combined review preserves mapping independence and checkout rules', diligence,
  [/keep/i, /authored mode.s mapped reviewer/i, /non-author\/non-owner session independence/i, /checkout rules/i],
  "Keep the authored mode's mapped reviewer, non-author/non-owner session independence and checkout rules.", /keep/i, 'drop');
rule('combining replaces a dispatch without reducing diligence coverage', diligence,
  [/replaces a dispatch/i, /diligence coverage/i],
  'This replaces a dispatch, not diligence coverage.', /not diligence coverage/i, 'including diligence coverage', /not diligence coverage/i);
rule('authored publication selects combined or separate evidence', 'axstack-review/SKILL.md',
  [/authored mode requires/i, /one current eligible configured reviewer receipt/i, /Scope: PASS/,
    /eligible small non-risk-path/i, /otherwise a separate diligence PASS receipt/i],
  'Authored mode requires one current eligible configured reviewer receipt and Scope: PASS for eligible small non-risk-path work, otherwise a separate diligence PASS receipt.',
  /otherwise a separate diligence PASS receipt/i, 'otherwise approval alone');

// Missing producer/eligibility rules are the normal red slice for this repair.
rule('driver decides combined eligibility', diligence,
  [/driver decides/i, /eligibility/i, /combined review/i],
  'The driver decides eligibility for combined review.', /driver decides/i, 'author decides');
rule('reviewer rechecks eligibility against review-depth risk', diligence,
  [/combined reviewer/i, /rechecks/i, /eligibility/i, /diff/i, /review-depth risk/i],
  'The combined reviewer rechecks eligibility against the diff and review-depth risk.', /rechecks/i, 'assumes');
rule('same-provider mappings are ineligible', diligence,
  [/same-provider reviewer/i, /single-provider presets/i, /makes combined review ineligible/i],
  'A same-provider reviewer under single-provider presets makes combined review ineligible.', /makes combined review ineligible/i, 'makes combined review eligible');
rule('Scope verdict is bound to receipt head and base', 'axstack-review/references/review-receipt.md',
  [/Scope: verdict/i, /bound to/i, /same head and base/i, /Reviewer: line/i],
  'The Scope: verdict is bound to the same head and base as the Reviewer: line.', /same head and base/i, 'previous head only');
rule('brief requests receipt verdict through the distinct combined line', review,
  [/receipt.s Scope: verdict line/i, /requested by/i, /brief.s Combined review: line/i],
  "The receipt's Scope: verdict line is requested by the brief's Combined review: line.", /requested by/i, 'unrelated to');

test('combined review: receipt verdict wire follows Verdict and is unambiguous', () => {
  const source = read('axstack-review/references/review-receipt.md');
  const line = 'Scope: <PASS | FINDINGS | UNKNOWN | n/a — separate diligence>';
  const accepts = (text) => /^Verdict:[^\n]*\nScope: <PASS \| FINDINGS \| UNKNOWN \| n\/a — separate diligence>$/m.test(text)
    && text.match(/^Scope:/gm)?.length === 1;
  expect(accepts(source)).toBe(true);
  expect(accepts(source.replace(line, ''))).toBe(false);
  expect(accepts(source.replace(line, line.replace('UNKNOWN', 'PASS-BY-DEFAULT')))).toBe(false);
  expect(accepts(source.replace(line, `${line}\n${line}`))).toBe(false);
});
test('combined review: brief request wire preserves scope identity', () => {
  const source = read('axstack-review/references/candidate-brief.md');
  const line = 'Combined review: <yes — return the Scope verdict | no — separate diligence>';
  const accepts = (text) => text.split('\n').includes(line)
    && /^Scope: <spec rev or linked issue \+ ticket \+ current base \+ exclusions>$/m.test(text);
  expect(accepts(source)).toBe(true);
  expect(accepts(source.replace(line, ''))).toBe(false);
  expect(accepts(source.replace(line, line.replace('return the Scope verdict', 'skip the Scope verdict')))).toBe(false);
  expect(accepts(source.replace(/^Scope:.*$/m, 'Scope: PASS'))).toBe(false);
});

// Check discoverability at each consumer boundary, rather than copying the full
// policy into each reader. Existing checks keep separate diligence semantics.
for (const path of [
  'axstack/references/lifecycle.md', 'axstack/references/pr-chain.md',
  'axstack/references/role-roster.md', 'axstack/references/autopilot.md',
  'axstack/references/contracts.md', 'axstack-watch/references/escalation.md',
  'axstack-review/SKILL.md', 'axstack-implement/SKILL.md',
  'axstack-implement/references/step-back.md',
]) {
  test(`combined review: ${path} loads the applicable diligence gate`, () => {
    const refs = loadedReferences(read(path));
    expect(refs.some((ref) => /(?:^|\/)diligence\.md(?:#.*)?$/.test(ref))).toBe(true);
  });
}
