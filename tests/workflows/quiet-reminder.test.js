import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const source = readFileSync(`${import.meta.dir}/../../skills/axstack-watch/references/watch-runtime.md`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
// Bounded semantic contracts, not a harness emulator or an all-English parser.
const softeners = ['unless convenient', 'except when needed', 'usually', 'if possible'];
const softened = /\b(?:unless|except|usually|if possible)\b/i;

function rule(name, concepts, equivalent, inversions, mask = /$^/) {
  test(`quiet reminder: ${name}`, () => {
    const accepts = (text) => sentences(text).some((sentence) =>
      concepts.every((concept) => concept.test(sentence)) && !softened.test(sentence)
      && requires(sentence.replace(mask, ''), /^/));
    checkRule(source, accepts, equivalent.replace(/[.!?]$/, ''), [
      ...inversions,
      ...softeners.flatMap((phrase) => [[/^/, `${phrase}, `], [/$/, ` ${phrase}`]]),
    ], concepts);
    // Factual context outside the owning instruction must not change its force.
    expect(accepts(`${source}\nThe prior report usually describes a reminder.`)).toBe(true);
  });
}

rule('ordinary finish retains the reconciled quiet-wake premise', [
  /\b(?:use|choose)\b/i, /\bordinary\b/i, /\btext-free\b/i,
  /\b(?:completion|finish)\b/i, /\breconciled quiet wake\b/i,
], 'For this reconciled quiet wake, choose ordinary text-free finish.', [
  [/\b(?:use|choose)\b/i, 'Never use'], [/text-free/i, 'visible-text'],
  [/reconciled quiet wake/i, 'unreconciled wake'],
]);

rule('only automatic no-output continuation is distinct from a real request', [
  /\b(?:runtime|harness)\b/i, /\b(?:solely|only)\b/i,
  /\bautomatic no-output (?:META )?reminder\b/i,
  /\bno new substantive input (?:or|and) evidence\b/i,
  /\b(?:treat|classify)\b/i,
  /\bneither a user request nor a requested status question\b/i,
], 'If the harness continues only with an automatic no-output reminder and no new substantive input or evidence, classify it as neither a user request nor a requested status question.', [
  [/\b(?:solely|only)\b/i, 'even alongside other input'],
  [/no new substantive input (?:or|and) evidence/i, 'new substantive input or evidence'],
  [/neither a user request nor a requested status question/i, 'a user request and a requested status question'],
], /no-output|no new substantive input (?:or|and) evidence|neither a user request nor a requested status question/gi);

rule('second ordinary finish reuses valid reconciliation without tools', [
  /\bonly (?:in|for)\b/i, /\breminder-only continuation\b/i, /\b(?:use|reuse)\b/i,
  /\bstill-valid local reconciliation\b/i, /\bsecond ordinary text-free finish\b/i,
  /\bwithout intervening tools\b/i,
], 'Only for that reminder-only continuation, reuse still-valid local reconciliation for a second ordinary text-free finish without intervening tools.', [
  [/\bonly\b/i, 'Even outside'],
  [/still-valid/i, 'stale'], [/second/i, 'unbounded repeated'],
  [/without intervening tools/i, 'with intervening tools'],
]);

rule('silence never uses dummy tools or disguised output', [
  /\b(?:do not|never) add\b/i, /\bdummy tools\b/i, /\btext\b/i,
  /\bsentinels\b/i, /\bhidden output\b/i, /\b(?:obtain|achieve) silence\b/i,
], 'Never add dummy tools, text, sentinels, or hidden output to achieve silence.', [
  [/\b(?:do not|never) add\b/i, 'Add'],
], /\b(?:do not|never) add\b/i);

const protectedInputs = [
  /\bactual new user request\b/i, /\bstatus\b/i, /\bstop\b/i,
  /\bhigher-priority instruction\b/i, /\bsafety refusal\b/i,
  /\bpermission\b/i, /\btrust\b/i, /\bhook\b/i, /\bauth\b/i,
  /\bmodel\b/i, /\bquota\b/i, /\bterminal work\b/i, /\bnew uncertainty\b/i,
];
rule('substantive inputs preserve existing request action and hold guards', [
  ...protectedInputs, /\b(?:follows?|obeys?)\b/i,
  /\bexisting request, action, and hold guards\b/i,
], 'Every actual new user request including status or stop, higher-priority instruction, safety refusal, permission/trust/hook/auth/model/quota prompt, terminal work or new uncertainty obeys the existing request, action, and hold guards.', [
  [/\b(?:follows?|obeys?)\b/i, 'ignores'],
]);

rule('all emitted text counts and cannot be hidden', [
  /\bnever (?:suppress or hide|hide or suppress) emitted text\b/i,
  /\b(?:any|all) emitted text counts\b/i,
], 'Never hide or suppress emitted text, and all emitted text counts.', [
  [/\bnever\b/i, 'Always'],
  [/\b(?:any|all) emitted text counts\b/i, 'only pre-reminder emitted text counts'],
], /\bnever (?:suppress or hide|hide or suppress) emitted text\b/i);

rule('unsupported completion remains an evidenced limitation or hold', [
  /\bnative text-free completion\b/i,
  /\b(?:not supported by every|unavailable in some) harness(?:es)?\b/i,
  /\bunsupported completion\b/i, /\b(?:remains|stays)\b/i,
  /\bevidenced limitation or hold\b/i,
], 'Native text-free completion is unavailable in some harnesses, so unsupported completion stays an evidenced limitation or hold.', [
  [/not supported by every|unavailable in some/i, 'supported by every'],
  [/evidenced limitation or hold/i, 'acceptance success'],
], /\bnot supported by every\b/i);

rule('second unsuccessful finish ends the bounded path rather than looping', [
  /\bsecond ordinary finish\b/i, /\b(?:does not stop|fails to stop)\b/i,
  /\bonly automatic reminders persist\b/i, /\b(?:record|classify)\b/i,
  /\bunsupported completion\b/i, /\bevidenced limitation or hold\b/i,
  /\bexisting reporting rules\b/i, /\brather than cycling tools or finishes\b/i,
], 'If a second ordinary finish fails to stop and only automatic reminders persist, classify unsupported completion as an evidenced limitation or hold under existing reporting rules rather than cycling tools or finishes.', [
  [/second ordinary finish/i, 'indefinitely repeated finish'],
  [/rather than cycling tools or finishes/i, 'by cycling tools or finishes'],
], /\bdoes not stop\b/i);
