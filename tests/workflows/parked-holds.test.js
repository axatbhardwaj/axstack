import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const contracts = () => readFileSync(`${import.meta.dir}/../../skills/axstack/references/contracts.md`, 'utf8')
  .split('### Parked user-reply holds')[1]?.split('## Serious risk')[0]
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ') ?? '';

// The public instruction boundary is the hold procedure, not live T3 behavior.
// Each case removes the real rule, reverses its direction and substitutes a
// genuinely equivalent instruction in memory. Negations are explicit contracts.
const rules = [
  ['chat-only eligibility', [/parked hold/i, /(?:waits|depends) only on (?:a )?user reply in chat/i],
    'A parked hold depends only on a user reply in chat.', [/only/i, 'also']],
  ['settled eligibility', [/parked hold/i, /unsettled worker/i, /pending adviser seat/i, /pending receipt/i],
    'Classify a parked hold with no pending receipt, unsettled worker or pending adviser seat.', [/\bno\b/i, 'an'], /\bno\b/i],
  ['forge resolution excluded', [/holds resolved on the forge/i, /user merge/i, /npm stage approval/i, /human review/i, /park/i],
    'Holds resolved on the forge, such as human review, npm stage approval and user merge, must never park.', [/never/i, 'always'], /never/i],
  ['other forge holds and member events prevent run parking', [/parked run/i, /no forge-resolved hold/i, /no other member PR needing watch events/i],
    'With no forge-resolved hold and no other member PR needing watch events, classify a parked run.', [/no forge-resolved hold/i, 'a forge-resolved hold'], /\bno\b/gi],
  ['scoped and forge cards retain observation', [/scoped and forge-resolved holds/i, /text card only/i, /watches/i, /60-minute backstop/i, /stay|remain/i],
    'For scoped and forge-resolved holds, watches and the 60-minute backstop remain with a text card only.', [/stay|remain/i, 'stop']],
  ['question context and choices', [/include|give/i, /question/i, /PR URL/i, /cause/i, /head and base/i, /recommended option first/i, /numbered replies/i],
    'Include the cause, PR URL, head and base in the question, with the recommended option first and numbered replies.', [/include|give/i, 'omit']],
  ['uncertain disable reconciles exact identity', [/disable or (?:its )?read-back fails/i, /reconcile/i, /exact schedule ID/i],
    'Reconcile the exact schedule ID when disable or read-back fails.', [/reconcile/i, 'ignore']],
  ['failed-disable card correction is a same-key repost', [/either failed-disable branch/i, /update.*existing text card/i, /posting a corrected version/i, /same hold key/i, /new alert/i],
    'For either failed-disable branch, update the existing text card under the same hold key by posting a corrected version without a new alert.', [/without/i, 'with'], /without/i],
  ['enabled rollback restores observation', [/verified enabled/i, /roll back/i, /unparked/i, /re-arm watches/i, /native-watch recovery procedure/i],
    'For a schedule verified enabled, roll back to unparked state and re-arm watches under the native-watch recovery procedure.', [/roll back/i, 'decline rollback']],
  ['enabled rollback updates the existing card and skips question', [/verified enabled/i, /update.*existing text card/i, /remove.*answer the prompt/i, /omit the question/i],
    'When verified enabled, update the existing text card to remove answer the prompt and omit the question.', [/omit the question/i, 'ask the question']],
  ['unknown recovery updates the existing card and skips question', [/update.*existing text card/i, /state remains unknown/i, /remove.*answer the prompt/i, /mark/i, /automatic recovery unproven/i, /hold UNKNOWN/i, /omit the question/i],
    'Update the existing text card when the state remains unknown to remove answer the prompt, mark automatic recovery unproven, hold UNKNOWN and omit the question.', [/omit the question/i, 'ask the question']],
  ['successful re-arm restores hourly cadence', [/successful native re-arm/i, /set cadence to 60 min/i],
    'Set cadence to 60 min after successful native re-arm.', [/successful/i, 'failed']],
  ['failed or rate-limited re-arm retains recovery cadence', [/native re-arm fails or is rate-limited/i, /use/i, /5-minute recovery cadence/i, /native-watch recovery procedure/i],
    'Use the 5-minute recovery cadence under the native-watch recovery procedure if native re-arm fails or is rate-limited.', [/5-minute/i, '60-minute']],
  ['late advice re-evaluates parking without another card', [/late advice completes/i, /hold becomes user-only/i, /re-evaluate parking eligibility/i, /update.*existing text card/i, /same hold key/i],
    'Re-evaluate parking eligibility when late advice completes and the hold becomes user-only, then update the existing text card under the same hold key.', [/re-evaluate/i, 'ignore']],
  ['failed read grants no backstop', [/infer/i, /enabled backstop/i, /failed read/i],
    'From a failed read, never infer an enabled backstop.', [/never/i, 'always'], /never/i],
  ['tool and chat answers use the resumption procedure', [/on an answer|for an answer/i, /question tool or chat|chat or question tool/i],
    'For an answer from chat or question tool:', [/question tool or chat|chat or question tool/i, 'chat alone']],
  ['stale answer clears nothing', [/stale answers/i, /clear/i],
    'Stale answers must clear nothing at the current revision.', [/nothing/i, 'everything'], /nothing/i],
  ['parked has no wake source', [/while parked/i, /wake source/i, /text card/i, /lasting signal/i],
    'The text card is the lasting signal while parked, with no wake source.', [/\bno\b/i, 'a'], /\bno\b/i],
  ['missing question re-asks once on next user message', [/user.s next message/i, /hold (?:is |that is )(?:still )?open/i, /t3_pending_request_list/i, /no pending request/i, /re-ask once/i, /same hold key/i],
    "For a hold that is open on the user's next message, when t3_pending_request_list shows no pending request, re-ask once using the same hold key.",
    [/re-ask once/i, 're-ask repeatedly'], /no pending request/i],
  ['re-ask is silent', [/re-ask/i, /new alert/i],
    'Without a new alert, re-ask the user.', [/without/i, 'with'], /without/i],
  ['missing tool retains parking order', [/follow/i, /question tool is unavailable/i, /same parking order/i, /record.*question tool unavailable/i],
    'Follow the same parking order when the question tool is unavailable and record question tool unavailable.', [/follow/i, 'reverse']],
  ['missing tool omits question', [/question tool is unavailable/i, /question step/i],
    'Omit the question step when the question tool is unavailable.', [/omit/i, 'attempt'], /omit/i],
];

for (const [name, concepts, rewording, inversion, ban] of rules) {
  test(`parked holds: ${name}`, () => {
    const accepts = (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts);
    checkRule(contracts(), accepts, rewording, [inversion], concepts);
  });
}
