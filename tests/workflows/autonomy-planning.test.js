import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, prohibits } from './prose-contract.js';

const read = (name) => readFileSync(`${import.meta.dir}/../../skills/${name}/SKILL.md`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// Prompt contracts only. Mutate actual source in memory, including every
// meaning-carrying qualifier; no live adviser or schedule behavior is claimed.
function rule(name, source, concepts, rewording, inversions, negative) {
  test(`autonomy planning: ${name}`, () => {
    const required = [...concepts, ...inversions.map(([direction]) => direction)];
    const accepts = negative
      ? (text) => prohibits(text, negative, ...required)
      : (text) => requires(text, ...required);
    checkRule(source(), accepts, rewording, inversions, required);
  });
}

for (const name of ['axstack-align', 'axstack-spec']) {
  const source = () => read(name);
  rule(`${name} full rounds cover first drafts and meaning changes`, source,
    [/full adviser round/i, /first draft/i, /every|any/i, /revision/i,
      /changes meaning|alters meaning/i, /criteria/i, /scope/i, /decisions/i, /authority/i],
    'Perform a full adviser round on the first draft and any revision that alters meaning in criteria, scope, decisions or authority.',
    [[/\b(?:run|perform)\b/i, 'skip'], [/\b(?:every|any)\b/i, 'no']]);
  rule(`${name} diligence covers first draft and approval revision`, source,
    [/axstack-diligence/i, /first draft/i, /revision/i, /presented|submitted/i, /approval/i],
    'Dispatch axstack-diligence on the first draft and the revision submitted for approval.',
    [[/\b(?:run|dispatch)\b/i, 'skip']]);
  rule(`${name} minor findings share one final pass`, source,
    [/low/i, /wording.only/i, /findings/i, /one|single/i, /final pass/i],
    'Collect low and wording-only findings into a single final pass.',
    [[/\b(?:batch|collect)\b/i, 'separate'], [/\b(?:one|single)\b/i, 'repeated']]);
  rule(`${name} minor findings never restart a full round`, source,
    [/new full adviser round/i, /low/i, /wording.only/i, /findings/i],
    'Never start a new full adviser round for low or wording-only findings.',
    [[/\bnever\b/i, 'always']], /never/i);
  rule(`${name} batching never waives blockers`, source,
    [/high/i, /medium/i, /findings/i],
    'Never waive high or medium findings.', [[/\bnever waive\b/i, 'Always waive']], /never waive/i);
  fableRules(name, source);
  rule(`${name} changed draft text defaults to fresh receipts`, source,
    [/by default/i, /changed draft text|edited draft wording/i,
      /fresh receipts|new receipts/i, /new revision|updated revision/i],
    'By default, edited draft wording needs new receipts on the updated revision.',
    [[/\b(?:requires|needs)\b/i, 'forgoes'], [/\bby default\b/i, 'Only when claimed material']]);
  rule(`${name} delta confirmation is the only changed-text exception`, source,
    [/only exception/i, /default/i, /each configured adviser seat/i,
      /confirms/i, /driver.s meaning-preservation claim/i],
    "The only exception to this default is delta confirmation, available only after each configured adviser seat confirms the driver's meaning-preservation claim.",
    [[/\bonly exception\b/i, 'optional exception'],
      [/\bonly after\b/i, 'before'], [/\beach configured adviser seat\b/i, 'one adviser seat']]);
  rule(`${name} each seat confirms a meaning-preserving delta`, source,
    [/driver claims/i, /edit/i, /preserves/i, /criterion/i, /scope/i, /decision/i,
      /instruction meaning/i, /each configured adviser seat/i, /on the delta/i,
      /prior receipt/i, /new revision/i],
    'If the driver claims an edit preserves criterion, scope, decision and instruction meaning, each configured adviser seat verifies that claim on the delta, naming its prior receipt, the delta and the new revision.',
    [[/\b(?:confirms|verifies)\b/i, 'ignores'], [/\beach configured adviser seat\b/i, 'one adviser seat'],
      [/\bpreserves\b/i, 'changes']]);
  rule(`${name} disagreement or consequential changes need full review`, source,
    [/seat disagrees/i, /blocking finding|blocker/i, /high-stakes decision/i, /meaning changes/i,
      /full fresh review/i, /new revision/i],
    'If a seat disagrees, a blocker exists, a high-stakes decision arises, or meaning changes, obtain full fresh review on the new revision.',
    [[/\b(?:requires?|obtain)\b/i, 'skip']]);
  rule(`${name} unavailable seat holds`, source, [/adviser seat/i, /unavailable/i],
    'An unavailable adviser seat blocks the affected phase.',
    [[/\b(?:holds?|blocks?)\b/i, 'advances']]);
}

// Receipt validity and escalation ordering also live at the shared boundary.
fableRules('standing contracts', () => readFileSync(
  `${import.meta.dir}/../../skills/axstack/references/contracts.md`, 'utf8').replace(/\s+/g, ' '));

function fableRules(name, source) {
  rule(`${name} Fable follows ordinary blockers under existing triggers`, source,
    [/existing triggers/i, /axstack-escalation-fable/i, /ordinary/i,
      /high/i, /medium/i, /findings/i, /settle|resolved/i],
    'When existing triggers apply, dispatch axstack-escalation-fable only after ordinary high and medium findings are resolved.',
    [[/\b(?:run|dispatch)\b/i, 'skip'], [/\bonly after\b/i, 'before']]);
  rule(`${name} Fable receipt remains valid while meaning holds`, source,
    [/Fable receipt/i, /reviewed meaning/i, /holds|unchanged/i],
    'Reuse the Fable receipt while the reviewed meaning is unchanged.',
    [[/\breuse\b/i, 'discard'], [/\bwhile\b/i, 'regardless of whether']]);
  rule(`${name} Fable-caused meaning change gets fresh Fable review`, source,
    [/Fable.s own findings/i, /change meaning|alter meaning/i, /fresh Fable session/i,
      /revised result|updated result/i],
    "If Fable's own findings alter meaning, a fresh Fable session must review the updated result.",
    [[/\b(?:reviews?|must review)\b/i, 'ignores'], [/\bfresh\b/i, 'reused']]);
}

const align = () => read('axstack-align');
rule('questions are limited to unresolved consequential choices', align,
  [/unresolved/i, /consequential/i, /preferences/i, /authority/i],
  'Present only unresolved, consequential preferences or authority as questions.',
  [[/\b(?:ask|present) only\b/i, 'Ask all'], [/\bunresolved\b/i, 'settled'],
    [/\bconsequential\b/i, 'incidental']]);
rule('settled preferences are applied and disclosed', align,
  [/preferences/i, /fixed by/i, /user instructions/i, /AGENTS\.md/i,
    /prior decision within its scope/i, /list/i, /defaulted/i, /read-back/i],
  'Use preferences fixed by user instructions, AGENTS.md, or a prior decision within its scope, and list them as defaulted in the read-back.',
  [[/\b(?:apply|use) preferences\b/i, 'Question preferences'],
    [/\bwithin its scope\b/i, 'outside its scope'], [/\blist\b/i, 'hide']]);
rule('defaults never grant authority', align, [/defaults/i, /grant authority/i],
  'Defaults never grant authority.', [[/never/i, 'always']], /never/i);
rule('completion has no mandatory refinement offer', align,
  [/deeper-refinement offer/i, /completion requirement/i],
  'Never make a deeper-refinement offer a completion requirement.',
  [[/never/i, 'always']], /never/i);

test('autonomy planning: completion does not require asking about refinement', () => {
  const source = align();
  const accepts = (text) => !/read back[^.]*ask whether[^.]*deeper refinement/i.test(text);
  expect(accepts(source)).toBe(true);
  expect(accepts(`${source} At completion, read back the result and ask whether the user wants deeper refinement.`)).toBe(false);
});
