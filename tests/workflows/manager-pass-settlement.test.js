import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const read = (name) => sentences(readFileSync(`${import.meta.dir}/../../skills/axstack/references/${name}`, 'utf8')).join('. ');
const noDescendants = /(?:no|zero) unsettled descendants/i;
const noHold = /(?:no|zero) open holds naming (?:it|the thread), recorded or directly observed/i;
const noTakeover = /(?:no user takeover|free of user takeover)/i;
const excluded = /(?:exclusion of|excluding) the live owner and current pass/i;
// Mask only the required negative guards; reject other denials and exceptions.
const guarded = (text, concepts, masks = []) => sentences(text).some((sentence) =>
  !/\b(?:unless|except|allow\w*|permit\w*)\b/i.test(sentence) && concepts.every((concept) => concept.test(sentence))
  && requires(masks.reduce((value, mask) => value.replace(mask, ''), sentence), /^/));

const rules = [
  ['automations.md', 'every pass settles finished lane passes at start',
    [/after lane reconciliation/i, /at pass start/i, /every pass|each pass/i,
      /including (?:a )?duplicate/i, /t3_thread_organize/, /\bsettle\b/i,
      /finished predecessor and duplicate lane pass threads/i, /metadata only/i, /before discovery or admission/i],
    'At pass start after lane reconciliation, each pass including a duplicate must settle finished predecessor and duplicate lane pass threads via t3_thread_organize as metadata only before discovery or admission.',
    [[/every pass|each pass/i, 'only the owner pass'], [/including (?:a )?duplicate/i, 'excluding duplicates'],
      [/at pass start/i, 'at owner teardown'], [/\bsettle\b/i, 'leave unsettled'],
      [/metadata only/i, 'metadata only, allowing PR work'], [/before discovery or admission/i, 'after discovery and admission']]],
  ['automations.md', 'settlement guards belong to the other lane pass thread',
    [/settle another lane pass thread/i, /only with/i, /(?<!non-)\bterminal run evidence/i,
      noDescendants, noHold, noTakeover, excluded],
    'Settle another lane pass thread only with terminal run evidence, zero unsettled descendants, zero open holds naming the thread, recorded or directly observed, free of user takeover, excluding the live owner and current pass.',
    [[/terminal run evidence/i, 'non-terminal run evidence'], [noDescendants, 'unsettled descendants'],
      [noHold, 'an open hold naming it'], [noTakeover, 'user takeover'],
      [excluded, 'including the live owner and current pass'], [/only with/i, 'even without'],
      [/only with/i, 'only with, permitting settlement without these guards,']],
    [noDescendants, noHold, noTakeover]],
  ['automations.md', 'held and stuck passes remain visible',
    [/leave|keep/i, /held passes, wedged passes and stalled owners/i, /\bunsettled\b/i, /visible/i],
    'Keep held passes, wedged passes and stalled owners unsettled and visible.',
    [[/unsettled/i, 'settled'], [/held passes, wedged passes and stalled owners/i, 'completed passes'],
      [/unsettled/i, 'unsettled while allowing their settlement'], [/visible/i, 'hidden']]],
  ['automations.md', 'retirement and continuity remain owner-only',
    [/settlement/i, /separate from/i, /owner.only/i, /worktree removal/i, /branch deletion/i, /continuity writes/i],
    'Settlement remains separate from owner-only worktree removal, branch deletion and continuity writes.',
    [[/separate from/i, 'combined with'], [/owner.only/i, 'any-pass'],
      [/owner.only/i, 'owner-only while permitting duplicates to perform']]],
  ['automations.md', 'duplicate exception is limited to eligible pass metadata',
    [/duplicate/i, /private pass note/i, /the flag and alert exception below/i, /only shared mutation/i, /pass.start settlement/i, /eligible terminal lane pass threads/i,
      /Finite.session teardown/i],
    'Besides its private pass note and the flag and alert exception below, a duplicate performs its only shared mutation as pass-start settlement of eligible terminal lane pass threads under Finite-session teardown.',
    [[/only shared mutation/i, 'unrestricted mutation'], [/eligible terminal lane pass threads/i, 'live manager PR-job threads'],
      [/only shared mutation/i, 'only shared mutation while allowing PR-job settlement']]],
  ['review-manager-prompt.md', 'prompt directs every pass to settle before admission',
    [/at pass start/i, /every pass|each pass/i, /including (?:a )?duplicate/i, /\bsettles?\b/i,
      /finished predecessor and duplicate pass threads/i, /Finite.session teardown guards/i, /before admission/i],
    'At pass start, each pass including a duplicate must settle finished predecessor and duplicate pass threads under the Finite-session teardown guards before admission.',
    [[/every pass|each pass/i, 'only the owner pass'], [/including (?:a )?duplicate/i, 'excluding duplicates'],
      [/at pass start/i, 'at owner teardown'], [/\bsettles?\b/i, 'leave unsettled'],
      [/before admission/i, 'after admission'], [/before admission/i, 'before admission, allowing held-pass settlement']]],
];

for (const [path, name, concepts, rewording, inversions, masks] of rules) {
  test(`manager pass settlement: ${name}`, () => {
    checkRule(read(path), (text) => guarded(text, concepts, masks), rewording,
      [...inversions, [/^/, 'Except when held, '], [/^/, 'Unless the owner is busy, ']], concepts);
  });
}
