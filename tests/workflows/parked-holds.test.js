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
  ['chat-only eligibility', [/parked hold/i, /waits only on (?:a )?user reply in chat/i],
    'A parked hold waits only on a user reply in chat.', [/only/i, 'also']],
  ['settled eligibility', [/parked hold/i, /unsettled worker/i, /pending adviser seat/i, /pending receipt/i],
    'A parked hold has no unsettled worker, pending adviser seat or pending receipt.', [/\bno\b/i, 'an'], /\bno\b/i],
  ['forge resolution excluded', [/holds resolved on the forge/i, /user merge/i, /npm stage approval/i, /human review/i, /park/i],
    'Never park holds resolved on the forge, including user merge, npm stage approval and human review.', [/never/i, 'always'], /never/i],
  ['scoped and forge cards retain observation', [/scoped and forge-resolved holds/i, /text card only/i, /watches/i, /60-minute backstop/i, /stay|remain/i],
    'For scoped and forge-resolved holds, watches and the 60-minute backstop remain with a text card only.', [/stay|remain/i, 'stop']],
  ['ordered parking protocol', [/unwatch_pull_request.*each watched member.*then.*text card.*answer the prompt.*then.*update_scheduled_task.*enabled:false.*read.back.*then.*cancel.*queued.*run-watch.*then.*harness question tool/i],
    'Call unwatch_pull_request for each watched member, then post the text card saying answer the prompt, then call update_scheduled_task enabled:false with read-back, then cancel queued run-watch copies, then use the harness question tool.',
    [/enabled:false/i, 'enabled:true']],
  ['question context and choices', [/include|give/i, /question/i, /PR URL/i, /cause/i, /head and base/i, /recommended option first/i, /numbered replies/i],
    'Include the cause, PR URL, head and base in the question, with the recommended option first and numbered replies.', [/include|give/i, 'omit']],
  ['uncertain disable reconciles exact identity', [/disable or (?:its )?read-back fails/i, /reconcile/i, /exact schedule ID/i],
    'If disable or its read-back fails, reconcile the exact schedule ID.', [/reconcile/i, 'ignore']],
  ['enabled rollback restores observation', [/verified enabled/i, /roll back/i, /unparked/i, /re-arm watches/i, /native-watch recovery procedure/i, /cadence to 60 min/i],
    'When verified enabled, roll back to unparked state, re-arm watches using the native-watch recovery procedure and set cadence to 60 min.', [/roll back/i, 'decline rollback']],
  ['enabled rollback skips question', [/verified enabled/i, /post the card/i, /question/i],
    'When verified enabled, post the card without the question.', [/without/i, 'with'], /without/i],
  ['unknown recovery is explicit', [/mark/i, /state remains unknown/i, /card/i, /automatic recovery unproven/i, /hold UNKNOWN/i],
    'When the state remains unknown, mark the card automatic recovery unproven and hold UNKNOWN.', [/mark/i, 'conceal']],
  ['failed read grants no backstop', [/infer/i, /enabled backstop/i, /failed read/i],
    'Never infer an enabled backstop from a failed read.', [/never/i, 'always'], /never/i],
  ['answer reconciles before resumption', [/answer.*question tool or chat/i, /reconcile.*PR and run state first/i, /then bind.*hold key.*head and base/i, /then re-enable.*schedule.*re-arm watches.*native-watch recovery procedure.*continue/i],
    'On an answer from the question tool or chat, reconcile current PR and run state first, then bind the answer to the hold key, head and base, then re-enable the schedule, re-arm watches using the native-watch recovery procedure and continue.',
    [/reconcile.*?first/i, 'resume before reconciling']],
  ['stale answer clears nothing', [/stale answers/i, /clear/i],
    'Stale answers clear nothing.', [/nothing/i, 'everything'], /nothing/i],
  ['parked has no wake source', [/while parked/i, /wake source/i, /text card/i, /lasting signal/i],
    'While parked there is no wake source and the text card is the lasting signal.', [/\bno\b/i, 'a'], /\bno\b/i],
  ['missing question re-asks once on next user message', [/user.s next message/i, /hold is (?:still )?open/i, /t3_pending_request_list/i, /no pending request/i, /re-ask once/i, /same hold key/i],
    "On the user's next message, if the hold is open and t3_pending_request_list shows no pending request, re-ask once under the same hold key.",
    [/re-ask once/i, 're-ask repeatedly'], /no pending request/i],
  ['re-ask is silent', [/re-ask/i, /new alert/i],
    'Re-ask without a new alert.', [/without/i, 'with'], /without/i],
  ['missing tool retains parking order', [/follow/i, /question tool is unavailable/i, /same parking order/i, /record.*question tool unavailable/i],
    'If the question tool is unavailable, follow the same parking order and record question tool unavailable.', [/follow/i, 'reverse']],
  ['missing tool omits question', [/question tool is unavailable/i, /question step/i],
    'If the question tool is unavailable, omit the question step.', [/omit/i, 'attempt'], /omit/i],
];

for (const [name, concepts, rewording, inversion, ban] of rules) {
  test(`parked holds: ${name}`, () => {
    const accepts = (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts);
    checkRule(contracts(), accepts, rewording, [inversion], concepts);
  });
}
