import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const watch = 'axstack-watch/references/watch-runtime.md';
const audit = 'axstack-audit/SKILL.md';
const record = 'axstack-audit/references/record.md';
const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// Independent weakening probes: prefix and suffix placements preserve the
// obligation's concepts. The corpus is separate from the acceptance guard.
const softenerProbes = [
  [/^/, 'Optionally '], [/^/, 'Ideally, '], [/^/, 'Preferably, '], [/^/, 'Usually, '],
  [/[.!?]?$/, ' when convenient'], [/[.!?]?$/, ' where practical'],
  [/[.!?]?$/, ' when time permits'],
];

// Independent instruction boundaries missing from the old digest-only silence
// check. These real-source mutations prove semantic sensitivity, not native T3.
function rule(name, path, concepts, rewording, inversions, mask = /$^/) {
  test(`autonomy reconciliation: ${name}`, () => {
    const required = [...concepts, ...inversions.map(([direction]) => direction)];
    const accepts = (text) => sentences(text).some((sentence) =>
      required.every((concept) => concept.test(sentence))
      && !/\b(?:unless|except|optionally|ideally|preferably|usually|when (?:convenient|time permits)|where practical)\b/i.test(sentence)
      && requires(sentence.replace(mask, ''), /^/));
    checkRule(read(path), accepts, rewording,
      [...inversions, [/[.!?]?$/, ' unless convenient'], [/[.!?]?$/, ' except when inconvenient'],
        ...softenerProbes], required);
  });
}

rule('local reconciliation precedes silence even with unchanged forge', watch,
  [/local receipts/i, /actionable work/i, /silence/i, /forge digest/i],
  'Even when the forge digest is unchanged, check local receipts and actionable work before deciding on silence.',
  [[/\b(?:reconcile|check)\b/i, 'ignore'], [/\bbefore\b/i, 'after'],
    [/even when/i, 'unless'], [/forge digest is unchanged/i, 'forge digest has changed']]);
rule('completion advances in the same turn under existing safeguards', watch,
  [/completed work/i, /existing acceptance/i, /settlement\/readback/i, /authorized unblocked next action/i],
  'Handle completed work under existing acceptance and settlement/readback, then advance every authorized unblocked next action in the same turn without another phase-start approval.',
  [[/\b(?:process|handle)\b/i, 'ignore'], [/\bthen advance\b/i, 'then defer'],
    [/\bevery\b/i, 'selected'], [/same turn/i, 'next wake'], [/without another/i, 'only after another'],
    [/without another/i, 'usually without another'], [/same turn/i, 'same turn when convenient']]);
rule('quiet automatic waits require reconciled positive health and no pending work', watch,
  [/automatic unchanged scheduled wake/i, /end the turn/i, /no text or notification/i,
    /local reconciliation/i, /nothing reportable/i, /active work.*(?:when|if) present.*positively known/i,
    /no unconsumed terminal receipt/i, /no pending local action/i,
    /no new question or permission request/i, /no unresolved failure or liveness\/coverage uncertainty/i],
  'On an automatic unchanged scheduled wake, end the turn with no text or notification only after local reconciliation confirms nothing reportable: active work if present is positively known, no unconsumed terminal receipt, no pending local action, no new question or permission request, and no unresolved failure or liveness/coverage uncertainty.',
  [[/only after/i, 'even before'], [/positively known/i, 'presumed'],
    [/(?:when|if) present/i, 'whether present or absent'],
    [/no pending local action/i, 'pending local action allowed']],
  /no text or notification|no unconsumed terminal receipt|no pending local action|no new question or permission request|no unresolved failure or liveness\/coverage uncertainty/gi);
rule('settled worker-free waits retain silence under the same checks', watch,
  [/settled worker-free waits/i, /CI/i, /external review/i, /human step/i,
    /reconciliation and reportability checks/i],
  'Settled worker-free waits on CI, external review, or a human step remain quiet under the same reconciliation and reportability checks.',
  [[/\b(?:stay silent|remain quiet)\b/i, 'emit waiting messages'], [/\bsame\b/i, 'relaxed']]);
rule('healthy active workers alone do not force output', watch,
  [/healthy running workers/i, /alone/i, /never/i, /force/i, /message or notification/i],
  'Healthy running workers alone never force a message or notification.',
  [[/never/i, 'always']], /never/i);
rule('requested status is answered during quiet waits', watch,
  [/requested status/i, /healthy wait/i],
  'Answer requested status even during a healthy wait.',
  [[/\banswer\b/i, 'ignore'], [/even during/i, 'except during']]);
rule('failed held and unknown work stays incomplete and unhealthy', watch,
  [/failed, held, or unknown work/i, /incomplete/i, /never/i, /healthy/i],
  'Classify failed, held, or unknown work as incomplete, never as healthy.',
  [[/\b(?:keep|classify)\b/i, 'skip'], [/incomplete/i, 'complete'], [/never/i, 'also']], /never/i);
rule('new holds report once with resume condition', watch,
  [/new or materially changed hold or unknown/i, /driver thread/i, /once/i, /resume condition/i],
  'Report each new or materially changed hold or unknown in the driver thread once with its resume condition.',
  [[/\breport\b/i, 'ignore'], [/\beach\b/i, 'selected'], [/\bonce\b/i, 'repeatedly']]);
rule('unchanged holds stay quiet and appear in requested status', watch,
  [/unchanged holds/i, /no automatic repeat/i, /requested status/i],
  'Unchanged holds receive no automatic repeat, and requested status answers name them.',
  [[/no automatic repeat/i, 'an automatic repeat'], [/\bname\b/i, 'omit']], /no automatic repeat/i);
rule('audit loads all three measurements from their sole schema owner', audit,
  [/three autonomy measurements/i, /audit record schema/i, /evidence/i, /denominators/i, /coverage/i, /UNKNOWN/i],
  'Measure the three autonomy measurements using the audit record schema with evidence, denominators, coverage and UNKNOWN reasons.',
  [[/\b(?:record|measure)\b/i, 'skip']]);
rule('wake counts separate requested answers', record,
  [/automatic_unchanged_wake_messages/i, /eligible_unchanged_wakes/i, /requested_status_answers/i,
    /automatic driver text and relay/i, /reconciled healthy unchanged scheduled wakes/i],
  'Count automatic driver text and relay as automatic_unchanged_wake_messages / eligible_unchanged_wakes over reconciled healthy unchanged scheduled wakes, with requested_status_answers separate.',
  [[/\bcount\b/i, 'skip'], [/\bseparate\b/i, 'included']]);
rule('settlement counts separate unconsumed and protected cases', record,
  [/accepted_pending_settlement/i, /accepted_completions/i, /matching accepted completions/i,
    /settled:false/i, /completed_unconsumed/i, /protected_completions/i],
  'Count accepted_pending_settlement / accepted_completions from matching accepted completions at the observation time, using settled:false for pending and reporting completed_unconsumed and protected_completions separately.',
  [[/\bcount\b/i, 'skip'], [/settled:false/i, 'settled:true'], [/\bseparately\b/i, 'as accepted pending']]);
rule('action lag excludes only evidenced holds', record,
  [/authorized-ready-to-action lag/i, /ready_at/i, /action_at/i, /hold_intervals/i, /evidence/i],
  'Measure authorized-ready-to-action lag from ready_at to action_at, excluding only hold_intervals supported by evidence.',
  [[/\bmeasure\b/i, 'skip'], [/excluding only/i, 'including all'], [/supported by evidence/i, 'assumed']]);
rule('lag covers open intervals without inventing action times', record,
  [/observed_intervals/i, /open_intervals/i, /observation time/i, /action_at/i],
  'Report observed_intervals individually and open_intervals through the observation time without inventing action_at.',
  [[/\breport\b/i, 'skip'], [/without inventing/i, 'by inventing']]);
rule('coverage and missing inputs remain explicit by evidence class', record,
  [/each autonomy measurement/i, /coverage/i, /denominators/i, /timestamps/i, /UNKNOWN/i,
    /reason/i, /native/i, /replay/i, /source/i],
  'For each autonomy measurement, report coverage and UNKNOWN with the reason for missing denominators or timestamps, separating native, replay and source evidence.',
  [[/\breport\b/i, 'skip'], [/\beach\b/i, 'selected'], [/\bUNKNOWN\b/i, 'PASS'], [/\bseparating\b/i, 'combining']]);
rule('measurements use existing receipts and readbacks', record,
  [/existing run receipts/i, /native readbacks/i, /identities/i, /observation times/i],
  'Use existing run receipts and native readbacks with identities and observation times.',
  [[/\buse\b/i, 'skip']]);
rule('measurements add no telemetry or runtime', record,
  [/no telemetry or runtime/i],
  'Add no telemetry or runtime.',
  [[/\badd\b/i, 'remove'], [/no telemetry or runtime/i, 'new telemetry and runtime']], /no telemetry or runtime/i);
rule('completion counts deduplicate the accepted identity', record,
  [/dispatch key/i, /accepted terminal run/i, /candidate head or report source identity/i],
  'Deduplicate by dispatch key, accepted terminal run and candidate head or report source identity.',
  [[/\bdeduplicate\b/i, 'duplicate'], [/\bor\b/i, 'and']]);
rule('unconsumed completions stay outside accepted counts', record,
  [/unconsumed completions/i, /accepted denominator/i],
  'Unconsumed completions are outside the accepted denominator.',
  [[/\boutside\b/i, 'inside']]);
rule('protected cases retain classification without implying violations', record,
  [/protected cases/i, /accepted\/unaccepted classification/i, /not counted as settlement violations/i,
    /remaining unsettled/i],
  'Protected cases retain their accepted/unaccepted classification and are not counted as settlement violations merely for remaining unsettled.',
  [[/\bretain\b/i, 'discard'], [/not counted as settlement violations/i, 'counted as settlement violations']],
  /not counted as settlement violations/i);
rule('missing readbacks stay unknown', record,
  [/missing settlement readbacks/i, /unknown/i, /not pending or settled/i],
  'Missing settlement readbacks are unknown, not pending or settled.',
  [[/\bunknown\b/i, 'known'], [/not pending or settled/i, 'pending or settled']], /not pending or settled/i);
rule('readiness means verified prerequisites and authority', record,
  [/ready_at/i, /prerequisites and authority/i],
  'ready_at marks when prerequisites and authority are verified.',
  [[/\bverified\b/i, 'assumed']]);
rule('action means observed effect rather than intent', record,
  [/action_at/i, /observed action/i, /not a recorded intent/i],
  'action_at marks the observed action, not a recorded intent.',
  [[/not a recorded intent/i, 'a recorded intent']], /not a recorded intent/i);
rule('hold intervals have named endpoints and evidence', record,
  [/hold intervals/i, /start_at/i, /end_at/i, /open/i, /evidence pointers/i],
  'Hold intervals carry start_at, end_at (or open) and evidence pointers.',
  [[/\bcarry\b/i, 'omit'], [/\bopen\b/i, 'zero']]);
rule('hold exclusions subtract overlap once within the interval', record,
  [/within the measured interval/i],
  'Subtract their union within the measured interval.',
  [[/\bsubtract\b/i, 'add'], [/their union/i, 'their sum']]);
rule('coverage includes open intervals and unknown eligibility cannot become zero', record,
  [/coverage/i, /evidenced items \/ eligible items/i, /open intervals/i],
  'Coverage states evidenced items / eligible items, including open intervals.',
  [[/\b(?:states|reports)\b/i, 'omits'], [/\bincluding\b/i, 'excluding']]);
rule('unknown eligibility keeps its denominator unknown', record,
  [/unknown eligibility/i, /denominator/i],
  'Unknown eligibility leaves the denominator UNKNOWN.',
  [[/leaves the denominator UNKNOWN/i, 'sets the denominator to zero']]);
rule('acceptance observation timestamps have stable receipt fields', record,
  [/accepted_at/i, /settlement_readback_at/i, /observed_at/i, /acceptance/i, /native readback/i, /observation time/i],
  'Use accepted_at for acceptance, settlement_readback_at for native readback, and observed_at for the observation time.',
  [[/\buse\b/i, 'omit']]);
