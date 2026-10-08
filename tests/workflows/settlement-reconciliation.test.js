import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const hygiene = 'workspace-hygiene.md';
const read = (file) => readFileSync(`${import.meta.dir}/../../skills/axstack/references/${file}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// S evidence only: a finite instruction corpus, not an all-English parser or
// native nonapplication/idempotency/in-flight/never-issued proof. Mutate actual
// source in memory; the three qualifiers below are concrete bounded holdouts.
const hedges = /\b(?:if possible|when convenient|generally)\b/i;
function rule(name, concepts, rewording, inversions, negative) {
  const accepts = (text) => sentences(text).some((sentence) => !hedges.test(sentence)
    && (negative ? prohibits(sentence, negative, ...concepts) : requires(sentence, ...concepts)));
  test(`settlement: ${name}`, () => {
    const source = read(hygiene);
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
