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
  ['other forge hold prevents run parking', [/parked run/i, /forge-resolved hold/i],
    'With no forge-resolved hold, the run can be a parked run.', [/\bno\b/i, 'a'], /\bno\b/i],
  ['scoped and forge cards retain observation', [/scoped and forge-resolved holds/i, /text card only/i, /watches/i, /60-minute backstop/i, /stay|remain/i],
    'For scoped and forge-resolved holds, watches and the 60-minute backstop remain with a text card only.', [/stay|remain/i, 'stop']],
  ['ordered parking protocol', [/unwatch_pull_request.*each watched member.*then.*text card.*answer the prompt.*then.*update_scheduled_task.*enabled:false.*read.back.*then.*cancel.*queued.*run-watch.*then.*harness question tool/i],
    'Call unwatch_pull_request for each watched member, then post the text card saying answer the prompt, then call update_scheduled_task enabled:false with read-back, then cancel queued run-watch copies, then use the harness question tool.',
    [/enabled:false/i, 'enabled:true']],
  ['question context and choices', [/include|give/i, /question/i, /PR URL/i, /cause/i, /head and base/i, /recommended option first/i, /numbered replies/i],
    'Include the cause, PR URL, head and base in the question, with the recommended option first and numbered replies.', [/include|give/i, 'omit']],
  ['uncertain disable reconciles exact identity', [/disable or (?:its )?read-back fails/i, /reconcile/i, /exact schedule ID/i],
    'Reconcile the exact schedule ID when disable or read-back fails.', [/reconcile/i, 'ignore']],
  ['enabled rollback restores observation', [/verified enabled/i, /roll back/i, /unparked/i, /re-arm watches/i, /native-watch recovery procedure/i, /cadence to 60 min/i],
    'For a schedule verified enabled, set cadence to 60 min and roll back to unparked state, then re-arm watches under the native-watch recovery procedure.', [/roll back/i, 'decline rollback']],
  ['enabled rollback skips question', [/verified enabled/i, /post the card/i, /question/i],
    'Post the card without the question when the schedule is verified enabled.', [/without/i, 'with'], /without/i],
  ['unknown recovery is explicit', [/mark/i, /state remains unknown/i, /card/i, /automatic recovery unproven/i, /hold UNKNOWN/i],
    'Mark the card automatic recovery unproven and hold UNKNOWN when the state remains unknown.', [/mark/i, 'conceal']],
  ['failed read grants no backstop', [/infer/i, /enabled backstop/i, /failed read/i],
    'From a failed read, never infer an enabled backstop.', [/never/i, 'always'], /never/i],
  ['answer reconciles before resumption', [/answer.*question tool or chat/i, /reconcile.*PR and run state first/i, /then bind.*hold key.*head and base/i, /then re-enable.*schedule.*re-arm watches.*native-watch recovery procedure.*continue/i],
    'On an answer from the question tool or chat, reconcile current PR and run state first, then bind the answer to the hold key, head and base, then re-enable the schedule, re-arm watches using the native-watch recovery procedure and continue.',
    [/reconcile.*?first/i, 'resume before reconciling']],
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
