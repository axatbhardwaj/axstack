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
    checkRule(read(path).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' '), (text) => ban
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
  [/missing|mismatched/i, /evidence/i, /holds? publication/i, /same author/i],
  'Missing or mismatched evidence holds publication and returns to the same author.',
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
