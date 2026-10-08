import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const hygiene = 'workspace-hygiene.md';
const read = (file) => readFileSync(`${import.meta.dir}/../../skills/axstack/references/${file}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' ');

// S evidence only: a finite instruction corpus, not an all-English parser or
// native nonapplication/idempotency/in-flight/never-issued proof. Mutate actual
// source in memory; the three qualifiers below are concrete bounded holdouts.
const hedges = /\b(?:if possible|when convenient|generally)\b/i;
function rule(name, concepts, rewording, inversions, negative, file = hygiene) {
  const accepts = (text) => sentences(text).some((sentence) => !hedges.test(sentence)
    && (negative ? prohibits(sentence, negative, ...concepts) : requires(sentence, ...concepts)));
  test(`settlement: ${name}`, () => {
    const source = read(file);
    checkRule(source, accepts, rewording, inversions, concepts);
    const targets = sentences(source).filter(accepts);
    for (const qualifier of ['if possible', 'when convenient', 'generally']) {
      const weakened = targets.reduce((text, target) => text.replace(target, `${qualifier}, ${target}`), source);
      expect(accepts(weakened)).toBe(false);
    }
  });
}

rule('already settled is adopted without replay',
  [/settled:\s*true/i, /adopt/i, /without/i, /settle call/i, /second acceptance/i, /duplicate downstream dispatch/i],
  'On settled: true readback, adopt the effect without a settle call, second acceptance or duplicate downstream dispatch.',
  [[/without/i, 'with'], [/settled:\s*true/i, 'settled: false']]);
rule('adoption still advances authorized remaining work',
  [/advance/i, /still-unperformed/i, /authorized next action/i, /same turn/i],
  'In the same turn, advance each still-unperformed authorized next action.',
  [[/advance/i, 'skip'], [/same turn/i, 'next user turn']]);
rule('first call requires positive never-issued evidence',
  [/first settle call/i, /only/i, /settled:\s*false/i, /positive evidence/i, /never issued/i],
  'With settled: false, permit the first settle call only on positive evidence that settlement was never issued for this accepted completion.',
  [[/only/i, 'optionally'], [/positive evidence/i, 'missing logs'], [/never issued/i, 'possibly issued']], /never issued/i);
rule('missing logs and interrupted intent cannot establish first-call proof',
  [/missing logs/i, /interrupted pending intent/i, /never prove/i, /never-issued/i],
  'An interrupted pending intent and missing logs never prove never-issued settlement.',
  [[/never prove/i, 'prove']], /never prove|never-issued/gi);
rule('uncertain prior effects are reconciled first',
  [/reconcile/i, /earlier settle/i, /succeeded/i, /errored/i, /timed out/i, /lost its reply/i, /before/i, /another call/i],
  'Before another call, reconcile an earlier settle that succeeded, errored, timed out or lost its reply.',
  [[/before/i, 'after'], [/reconcile/i, 'skip']]);
rule('negative snapshots and timeout are insufficient safety proof',
  [/settled:\s*false/i, /timeout/i, /absence of a request ID/i, /never prove/i, /non-application/i, /prior request/i, /cannot later apply/i],
  'A settled: false snapshot, timeout or absence of a request ID never prove non-application or that a prior request cannot later apply.',
  [[/never prove/i, 'prove'], [/cannot later apply/i, 'can later apply']], /never prove/i);
rule('additional execution is bounded and transport-only',
  [/only one additional/i, /t3_thread_organize/i, /action:\s*settle/i, /only after/i, /explicit transport failure or lost response/i, /for that settlement/i],
  'Allow only one additional t3_thread_organize action: settle execution, only after explicit transport failure or lost response for that settlement.',
  [[/only one additional/i, 'two additional'], [/only after/i, 'even without'], [/for that settlement/i, 'for any operation']]);
rule('eligibility and native safety proof are both mandatory',
  [/retry only after/i, /fresh shared settlement eligibility/i, /and either/i, /definitive native non-application evidence/i,
    /or native-verified idempotent settlement/i, /same unchanged accepted completion/i],
  'Retry only after fresh shared settlement eligibility checks and either definitive native non-application evidence or native-verified idempotent settlement for the same unchanged accepted completion.',
  [[/and either/i, 'or either'], [/definitive native/i, 'plausible local'], [/native-verified/i, 'assumed'], [/same unchanged/i, 'any']]);
rule('old request must be finished or harmless to current and later runs',
  [/prior request/i, /must be/i, /finished or proven unable/i, /affect/i, /later\/current run/i],
  'The prior request must be finished or proven unable to affect a later/current run before retry.',
  [[/must be/i, 'may be'], [/proven unable/i, 'assumed unable'], [/later\/current run/i, 'old run']]);
rule('in-flight and unavailable proof hold read-only',
  [/unresolved in-flight/i, /unavailable native safety proof/i, /hold/i, /read-only reconciliation/i],
  'Unavailable native safety proof or unresolved in-flight state requires a hold with read-only reconciliation.',
  [[/hold/i, 'retry'], [/read-only/i, 'mutating']]);
rule('completion allowance identity is bound to thread and accepted artifacts',
  [/allowance identity/i, /original dispatch key/i, /accepted terminal run ID/i, /candidate head/i, /report-only source identity/i, /bound to/i, /thread/i],
  'The allowance identity is bound to the thread, original dispatch key, accepted terminal run ID and candidate head or report-only source identity.',
  [[/accepted terminal run ID/i, 'latest active run ID'], [/original dispatch key/i, 'new request ID'], [/bound to/i, 'independent of']]);
rule('persist consumed allowance before additional execution',
  [/persist/i, /consumed allowance/i, /before/i, /additional call/i],
  'Before the additional call, persist the consumed allowance in the run record.',
  [[/before/i, 'after'], [/persist/i, 'skip']]);
rule('first call leaves allowance unconsumed',
  [/first call/i, /never consumes/i, /additional-call allowance/i],
  'The first call never consumes the additional-call allowance.',
  [[/never consumes/i, 'consumes']], /never consumes/i);
rule('same-completion allowance survives every resume and replacement',
  [/wakes/i, /compaction/i, /request-ID changes/i, /replacement attempts/i, /cleanup re-invocation/i,
    /ambiguous interruption/i, /never reset/i, /same completion/i, /allowance/i],
  'Wakes, compaction, request-ID changes, replacement attempts, cleanup re-invocation and ambiguous interruption never reset the allowance for the same completion.',
  [[/never reset/i, 'reset'], [/same completion/i, 'new completion']], /never reset/i);
rule('genuine new accepted completion gets distinct identity without fabrication',
  [/genuinely new accepted repair\/replacement completion/i, /own identity and allowance/i, /without/i, /fabricating/i, /bypass a hold/i],
  'A genuinely new accepted repair/replacement completion gets its own identity and allowance without fabricating a completion to bypass a hold.',
  [[/accepted/i, 'unaccepted'], [/without/i, 'by']]);
rule('merge and close reuse the last accepted allowance',
  [/merge\/close settlement/i, /reuses/i, /last accepted completion/i, /existing allowance/i],
  "Merge/close settlement reuses the last accepted completion's existing allowance.",
  [[/reuses/i, 'resets'], [/last accepted/i, 'next proposed']]);
rule('second failure or ambiguity holds dispatch advancement',
  [/second failed or ambiguous execution/i, /holds/i, /dispatch/i, /advancement/i],
  "A second failed or ambiguous execution holds that dispatch's advancement.",
  [[/holds/i, 'allows'], [/second/i, 'third']]);
rule('exhausted settlement never causes source repair',
  [/second failed or ambiguous execution/i, /never causes source repair/i],
  'A second failed or ambiguous execution never causes source repair.',
  [[/never causes source repair/i, 'causes source repair']], /never causes source repair/i);
rule('holds retain receipt and resume condition',
  [/record/i, /operation/i, /consumed allowance/i, /reason/i, /resume condition/i],
  'Record the consumed allowance, operation, reason and resume condition for a settlement hold.',
  [[/record/i, 'skip']]);
rule('changed holds reported once and requested status answered',
  [/report/i, /new or materially changed hold/i, /once/i, /driver thread/i, /answer/i, /requested status/i, /hold/i],
  'In the driver thread, report a new or materially changed hold once and answer requested status with the hold.',
  [[/once/i, 'on every wake'], [/answer/i, 'skip']]);
rule('unchanged holds stay quiet automatically',
  [/unchanged holds/i, /never repeated automatically/i],
  'Unchanged holds are never repeated automatically.',
  [[/never repeated automatically/i, 'repeated automatically']], /never repeated automatically/i);
rule('resume requires fresh native success and guards or authorized user decision',
  [/resume only when/i, /fresh native evidence/i, /succeeded and guards remain valid/i, /or/i, /user resolves/i, /decision within existing authority/i],
  'Resume only when fresh native evidence establishes settlement succeeded and guards remain valid, or the user resolves a decision within existing authority.',
  [[/only when/i, 'without'], [/succeeded and guards remain valid/i, 'succeeded or guards remain valid'], [/fresh native evidence/i, 'recorded intent']]);
rule('protected failures remain excluded from transport recovery',
  [/denial/i, /refusal/i, /permission/i, /trust/i, /hook/i, /auth/i, /model/i, /quota/i, /explicit user stops/i, /never transient/i],
  'Denial, refusal, permission, trust, hook, auth, model, quota and explicit user stops are never transient settlement errors.',
  [[/never transient/i, 'transient']], /never transient/i);

const runtime = 't3-runtime.md';
const record = 'run-record.md';
rule('runtime consults sole decision owner before settlement on every digest',
  [/before/i, /settlement call/i, /follow/i, /Settlement decision/i, /workspace hygiene/i, /even/i, /unchanged forge digest/i],
  'Even with an unchanged forge digest, before any settlement call follow the Settlement decision in workspace hygiene.',
  [[/before/i, 'after'], [/follow/i, 'skip'], [/even/i, 'except']], undefined, runtime);
rule('lost delegated launch reconciles a fully identified request',
  [/lost delegated-launch response/i, /reconcile/i, /recorded request/i, /fully paginated/i,
    /exact-title\/project\/parent\/role\/attempt evidence/i, /before adoption/i],
  'Before adoption on a lost delegated-launch response, reconcile the recorded request and fully paginated exact-title/project/parent/role/attempt evidence.',
  [[/fully paginated/i, 'first-page'], [/before adoption/i, 'after adoption']], undefined, runtime);
rule('lost task adoption requires native identity and configuration',
  [/adopt one exact matching task/i, /only after/i, /native task identity and configuration/i, /verified/i,
    /otherwise hold/i, /read-only reconciliation/i],
  'Only after native task identity and configuration are verified, adopt one exact matching task, otherwise hold with read-only reconciliation.',
  [[/only after/i, 'even before'], [/identity and configuration/i, 'identity or configuration'], [/otherwise hold/i, 'otherwise retry']], undefined, runtime);
rule('lost queued send reconciles exact target and native message/run effect',
  [/lost queued-send response/i, /reconcile/i, /exact target thread/i, /message\/request receipt/i, /resulting run evidence/i],
  'For a lost queued-send response, reconcile resulting run evidence, the message/request receipt and the exact target thread.',
  [[/reconcile/i, 'skip'], [/exact target thread/i, 'similar thread title']], undefined, runtime);
rule('title alone is insufficient delivery proof',
  [/matching thread title alone/i, /never proves delivery/i],
  'A matching thread title alone never proves delivery.',
  [[/never proves delivery/i, 'proves delivery']], /never proves delivery/i, runtime);
rule('proven send effects are adopted otherwise held',
  [/adopt/i, /proven delivered effect/i, /otherwise hold/i, /read-only reconciliation/i],
  'Adopt a proven delivered effect, otherwise hold with read-only reconciliation.',
  [[/proven delivered effect/i, 'assumed delivered effect'], [/otherwise hold/i, 'otherwise resend']], undefined, runtime);
rule('lost replies grant no new launch or send retries',
  [/lost delegated-launch or queued-send replies/i, /never grant/i, /new launch or send retry authority/i],
  'Lost delegated-launch or queued-send replies never grant new launch or send retry authority.',
  [[/never grant/i, 'grant']], /never grant/i, runtime);
rule('merge-close uses settlement procedure and original allowance',
  [/merge\/close/i, /apply/i, /Settlement decision/i, /last accepted completion/i, /existing allowance/i],
  'At merge/close apply the Settlement decision using the existing allowance of the last accepted completion.',
  [[/apply/i, 'skip'], [/last accepted completion/i, 'new synthetic completion']], undefined, runtime);
rule('durable settlement fields carry intent result consumption and safety evidence',
  [/record/i, /settlement_identity/i, /settlement_intent/i, /settlement_result/i, /additional_settle_consumed/i, /safety_proof/i],
  'Record settlement_identity, additional_settle_consumed, safety_proof, settlement_intent and settlement_result as compact fields or evidence pointers.',
  [[/record/i, 'skip']], undefined, record);
rule('intent and allowance are persisted before their respective calls',
  [/persist/i, /first-call intent/i, /before the first call/i, /consumed allowance/i, /before the additional call/i],
  'Persist the consumed allowance before the additional call and the first-call intent before the first call.',
  [[/before the first call/i, 'after the first call'], [/before the additional call/i, 'after the additional call']], undefined, record);
rule('intent and consumption are not native success',
  [/recorded intent or allowance consumption/i, /never proves/i, /native action or success/i],
  'Recorded intent or allowance consumption never proves native action or success.',
  [[/never proves/i, 'proves']], /never proves/i, record);
rule('time fields keep T1 audit meanings',
  [/accepted_at/i, /acceptance/i, /settlement_readback_at/i, /native readback/i, /ready_at/i, /authorized readiness/i, /action_at/i, /verified action/i, /observed_at/i, /observation time/i],
  'Record observed_at for observation time, ready_at for authorized readiness, action_at for verified action, accepted_at for acceptance and settlement_readback_at for native readback.',
  [[/native readback/i, 'recorded intent'], [/verified action/i, 'proposed action']], undefined, record);
rule('hold intervals are evidenced and incomplete times remain unknown',
  [/hold_intervals/i, /start_at/i, /end_at/i, /evidence/i, /missing times/i, /UNKNOWN/i, /open intervals/i],
  'Keep evidence for hold_intervals with start_at and end_at, preserving open intervals and missing times as UNKNOWN.',
  [[/UNKNOWN/i, 'zero elapsed'], [/open intervals/i, 'invented endpoints']], undefined, record);

// Existing-tool recovery contracts, using the same finite actual-source probes.
// These checks protect instructions; they neither call T3 nor prove native ACs.
rule('successful delegated reply immediately preserves task identity',
  [/persist/i, /taskId/i, /immediately/i, /successful/i, /delegate_task/i, /response/i],
  'Immediately persist taskId from the successful delegate_task response.',
  [[/immediately/i, 'eventually'], [/persist/i, 'skip']], undefined, runtime);
rule('delegated discovery exhausts native cursor pages and exact identity filters',
  [/t3_thread_list/i, /projectId/i, /includeSubagents/i, /titleContains/i, /nextCursor/i, /null/i,
    /whole-title equality/i, /parentThreadId/i, /role/i, /attempt/i],
  'Use t3_thread_list with projectId, includeSubagents and titleContains, following nextCursor to null and filtering by whole-title equality, parentThreadId, role and attempt.',
  [[/nextCursor/i, 'first page'], [/whole-title equality/i, 'substring similarity']], undefined, runtime);
rule('context transfers prove thread candidates only',
  [/t3_thread_transfers/i, /only/i, /thread-identity evidence/i],
  'Read t3_thread_transfers only for thread-identity evidence.',
  [[/only/i, 'also'], [/thread-identity evidence/i, 'task identity']], undefined, runtime);
rule('task IDs cannot be fabricated from other native identities',
  [/synthesize/i, /taskId/i, /threadId/i, /transfer ID/i],
  'Do not synthesize taskId from a transfer ID or threadId.',
  [[/do not|never/i, 'Always']], /do not synthesize|never synthesize/i, runtime);
rule('completion notification supplies candidate identity only',
  [/completion notification/i, /containing taskId/i, /only/i, /candidate identity/i],
  'A completion notification containing taskId supplies only a candidate identity.',
  [[/only/i, 'automatically'], [/candidate identity/i, 'accepted completion']], undefined, runtime);
rule('notification task status is verified against bound request and attempt',
  [/task_status/i, /exact taskId/i, /cross-check/i, /childThreadId/i, /childRunId/i,
    /latestTerminalRunId/i, /providerInstanceId/i, /recorded request/i, /scope/i, /attempt/i, /before adoption/i],
  'Before adoption, call task_status on the exact taskId and cross-check childThreadId, childRunId, latestTerminalRunId and providerInstanceId against recorded request, scope and attempt.',
  [[/before adoption/i, 'after adoption'], [/exact taskId/i, 'guessed taskId'], [/cross-check/i, 'skip']], undefined, runtime);
rule('unknown task identity forbids delegated child reads',
  [/taskId is unknown/i, /t3_thread_read/i, /delegated child/i],
  'While taskId is unknown, do not call t3_thread_read on a delegated child.',
  [[/do not call|never call/i, 'Always call']], /do not call|never call/i, runtime);
rule('unknown task discovery metadata cannot accept a delegated result',
  [/taskId is unknown/i, /t3_thread_list/i, /t3_thread_transfers/i, /t3_thread_configuration/i,
    /only/i, /thread candidates/i, /without acknowledging or accepting/i],
  'While taskId is unknown, inspect t3_thread_configuration, t3_thread_transfers and t3_thread_list only as thread candidates without acknowledging or accepting delegated completion.',
  [[/only/i, 'also'], [/without acknowledging or accepting/i, 'while acknowledging and accepting']], undefined, runtime);
rule('native child state follows persisted status and precedes acceptance',
  [/after persisting/i, /task_status essentials/i, /t3_thread_read/i, /native thread\/run state/i,
    /completion checks/i, /before accepting/i],
  'After persisting task_status essentials, read native thread/run state with t3_thread_read and apply the completion checks before accepting.',
  [[/after persisting/i, 'before persisting'], [/before accepting/i, 'after accepting']], undefined, runtime);
rule('notification delivery and durable message exposure remain uncertain',
  [/assume/i, /notification delivery/i, /durable thread-message availability/i],
  'Do not assume notification delivery or durable thread-message availability.',
  [[/do not assume|never assume/i, 'Always assume']], /do not assume|never assume/i, runtime);
rule('missing task identity holds only its dispatch without retry',
  [/missing taskId/i, /only/i, /affected dispatch/i, /no resend or relaunch/i],
  'Missing taskId holds only the affected dispatch with no resend or relaunch.',
  [[/only/i, 'all work beyond'], [/no resend or relaunch/i, 'automatic resend and relaunch']], /no resend or relaunch/i, runtime);
rule('localized hold preserves independent work and native wake reconciliation',
  [/continue/i, /independent authorized work/i, /reconcile/i, /held dispatch/i, /next native wake/i],
  'Continue independent authorized work and reconcile the held dispatch at the next native wake.',
  [[/continue/i, 'skip'], [/next native wake/i, 'next user decision']], undefined, runtime);
rule('recovery waits use native watches notifications and required bound schedules',
  [/native PR watch/i, /completion notifications/i, /required bound run schedule/i, /event-driven/i],
  'Use the native PR watch, completion notifications and required bound run schedule for event-driven reconciliation.',
  [[/event-driven/i, 'model-polled'], [/required bound run schedule/i, 'optional unbound timer']], undefined, runtime);
rule('existing calls cannot prove silent end or reprompt suppression',
  [/existing tool calls/i, /never prove/i, /silent-end-turn control/i, /Claude reprompt suppression/i],
  'Existing tool calls never prove silent-end-turn control or Claude reprompt suppression.',
  [[/never prove/i, 'prove']], /never prove/i, runtime);
rule('missing silent mechanism preserves failed or unverified acceptance',
  [/schema lacks/i, /supported silent mechanism/i, /retain/i, /AC1/i, /failed\/unverified/i, /report/i],
  'If the schema lacks a supported silent mechanism, retain AC1 as failed/unverified and report that limitation.',
  [[/retain/i, 'skip'], [/failed\/unverified/i, 'passed']], undefined, runtime);

test('settlement decision and receipt links resolve to their owning references', () => {
  const raw = (file) => readFileSync(`${import.meta.dir}/../../skills/axstack/references/${file}`, 'utf8');
  expect(raw(runtime)).toContain('(workspace-hygiene.md#settlement-decision)');
  expect(raw(hygiene)).toContain('(run-record.md#settlement-receipts)');
  expect(raw(record)).toContain('(workspace-hygiene.md#settlement-decision)');
  expect(raw(hygiene)).toMatch(/^### Settlement decision$/m);
  expect(raw(record)).toMatch(/^## Settlement receipts$/m);
});
