import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const recipe = readFileSync(`${import.meta.dir}/../../.agents/skills/verify-axstack/features/workflows.md`, 'utf8');
const compact = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' ');

// The verifier's real instructions are the subject, not a simulated scheduler
// or supplied PASS fixtures. Rewordings are independent contract examples.
function rule(name, source, concepts, equivalent, expectedNegative) {
  test(`parallel-first recipe: ${name}; removal/inversion/rewording`, () => {
    const accepts = (text) => expectedNegative
      ? prohibits(text, expectedNegative, /must|require|shall/i, ...concepts)
      : requires(text, /must|require|shall/i, ...concepts);
    checkRule(compact(source), accepts,
      equivalent, [[/must|require|shall/gi, 'need not']], concepts);
  });
}

rule('bind instructions and outputs to the integrated revision', recipe,
  [/candidate head/i, /constituent/i, /loaded/i, /hash/i, /installed/i, /separate/i],
  'The verifier must record candidate head, constituent tips and loaded instruction hashes, separate from installed-version preflight.');
rule('measure actual useful activity', recipe,
  [/native/i, /tool|command|model.turn/i, /substantive/i, /intersection/i, /duration/i],
  'Require native command endpoints or active model-turn evidence to calculate substantive activity intersection and duration.');
rule('uncertain endpoints hold the gate', recipe,
  [/endpoint/i, /unknown/i, /hold/i, /merge/i, /release/i],
  'Unreliable endpoints must yield UNKNOWN and hold merge and release.');
rule('run envelopes and useful activity are separate conditions', recipe,
  [/run/i, /interval/i, /overlap/i, /substantive/i, /both/i],
  'Both native run intervals and substantive activity intervals must overlap.');
rule('negative controls reject misleading overlap', recipe,
  [/reject/i, /serial/i, /staggered/i, /run/i, /substantive/i],
  'Require rejection of serial controls and staggered controls with overlapping runs but disjoint substantive activity.');
rule('engineering, analysis and verification each need live acceptance', recipe,
  [/separate/i, /native/i, /engineering/i, /analysis/i, /verification/i, /correctness/i],
  'Require separate native engineering, analysis and verification overlap evidence and joined correctness.');
rule('native F1 and F2 observation accompanies deterministic proof', recipe,
  [/F1/i, /F2/i, /native/i, /deterministic/i, /observ/i],
  'Require native observation of F1 and F2 alongside deterministic controls.');
rule('integration receipt proves both accepted outputs and ancestry', recipe,
  [/both/i, /accepted/i, /output/i, /integration receipt/i, /ancestr/i, /head/i, /base/i],
  'Both accepted package outputs must have an integration receipt with ancestry and final head/base.');
rule('required evidence cannot be waived by fixtures or disposition', recipe,
  [/every/i, /fixture/i, /control/i, /PASS/i, /FAIL/i, /UNKNOWN/i, /hold/i],
  'Every required fixture and control must PASS while FAIL or UNKNOWN holds acceptance.');
rule('changed identities invalidate evidence', recipe,
  [/changed/i, /head/i, /input/i, /hash|digest/i, /invalidat/i],
  'Changed head, input identities or instruction hashes must invalidate affected evidence.');
rule('seeded repairs never become natural observations', recipe,
  [/seeded/i, /repair/i, /fixture/i, /natural/i, /not observed/i],
  'Require seeded repairs to be labelled fixtures and natural repairs to be reported not observed unless they occur.', /not observed/i);
rule('supported artifact mode does not acquire engineering prerequisites', recipe,
  [/nonrepo/i, /artifact/i, /configured/i, /owned/i, /without/i, /Git/i, /engineering/i],
  'The nonrepo artifact fixture must retain configured roles and owned directories without Git or engineering author prerequisites.');

// Each row protects a distinct failure/authority boundary in the live recipe.
// These checks prove required scenarios are instructed, never that they ran.
const scenarios = [
  ['F1', [/consumer/i, /input/i, /unrelated/i, /proceed/i], 'A consumer must wait for its input while unrelated work proceeds.'],
  ['F2', [/shared/i, /resource/i, /serial/i], 'Shared resource conflicts must serialize competing work.'],
  ['F3', [/tiny/i, /direct|serial/i, /reason/i], 'Tiny indivisible work must stay direct with its reason.'],
  ['F4', [/producer/i, /drift/i, /invalidat/i, /affected/i], 'Producer revision drift must invalidate affected consumers.'],
  ['F5', [/failed|unavailable/i, /preserv/i, /writer/i, /model/i], 'Failed or unavailable work must preserve its writer and model binding.'],
  ['F6', [/first.binding/i, /reject/i, /sibling/i, /unrelated/i], 'First-binding rejection must hold siblings while unrelated configurations progress.'],
  ['F7', [/ambiguous/i, /launch/i, /reconcil/i, /replacement/i], 'Ambiguous launch identity must be reconciled before replacement.'],
  ['F8', [/package/i, /integration/i, /repair/i, /owner/i], 'Package and integration repair findings must return to their respective owner.'],
  ['F9', [/same.binding/i, /contributor/i, /review/i, /independent/i], 'Same-binding contributors must retain independent review.'],
  ['F10', [/divergent/i, /unknown/i, /provenance/i, /hold/i], 'Divergent or unknown provenance must hold the candidate.'],
  ['F11', [/resume/i, /cleanup/i, /preserv/i, /attempt/i, /evidence/i], 'Resume and cleanup must preserve attempt identities and evidence.'],
  ['F12', [/seeded/i, /same.author/i, /repair/i, /settlement/i], 'The seeded same-author repair must follow settlement.'],
  ['F13', [/seeded/i, /independent/i, /repair/i, /overlap/i, /budget/i], 'Seeded independent repairs must overlap and retain one per-PR budget.'],
  ['F14', [/small/i, /two.package/i, /combined/i, /review/i], 'Small two-package work must retain eligible combined review.'],
  ['F15', [/risk.path/i, /separate/i, /diligence/i], 'Risk-path work must require separate diligence.'],
];
for (const [id, concepts, equivalent] of scenarios) {
  const row = recipe.split('\n').find((line) => line.startsWith(`| ${id} |`)) ?? '';
  rule(`${id} boundary`, row, concepts, equivalent);
}
