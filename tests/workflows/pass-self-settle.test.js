import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const read = (name) => sentences(readFileSync(`${import.meta.dir}/../../skills/axstack/references/${name}.md`, 'utf8').replace(/`/g, '')).join('. ');
const passes = ['automations', 'review-manager-prompt', 'pr-triage-nightly', 'test-audit-weekly'];
const guards = [/owns no PR watch/i, /zero unsettled descendants/i, /no pending receipt/i, /not held, wedged or a stalled owner/i];
const action = [/at pass end/i, /unbound/i, /t3_thread_organize/i, /action: settle/i, /own thread only/i, /only when/i];
const wording = 'Only when it has no pending receipt, is not held, wedged or a stalled owner, owns no PR watch and has zero unsettled descendants, the unbound scheduled pass must at pass end request action: settle through t3_thread_organize for its own thread only.';
const accepts = (text) => sentences(text).some((s) => [...action, ...guards].every((r) => r.test(s))
  && requires(guards.reduce((v, r) => v.replace(r, ''), s), /^/)
  && !/\b(?:unless|except|allow\w*|permit\w*)\b/i.test(s));

for (const path of passes) {
  test(`pass self-settle: ${path} owns the guarded end action`, () => {
    checkRule(read(path), accepts, wording,
      [[/own thread only/i, 'any thread'], [/only when/i, 'even when'],
        [/owns no PR watch/i, 'owns a PR watch'], [/zero unsettled descendants/i, 'active descendants'],
        [/no pending receipt/i, 'a pending receipt'], [/not held, wedged or a stalled owner/i, 'held, wedged or a stalled owner'],
        [/action: settle/i, 'action: archive'], [/^/, 'Never ']], [...action, ...guards]);
  });
}

const rules = [
  ...['automations', 't3-runtime', 'workspace-hygiene'].map((path) => [path, 'deferred exception and next-pass verification',
    [/self.settle/i, /one exception/i, /terminal.before.settle/i, /settlesWhenTurnEnds:true/i, /next pass/i, /verif\w*/i, /settled: true/i],
    'The next pass must verify settled: true after T3 reports settlesWhenTurnEnds:true for self-settle, the one exception to terminal-before-settle.',
    [[/one exception/i, 'no exception'], [/settled: true/i, 'settled: false'], [/next pass/i, 'unrelated thread']]]),
  ['t3-runtime', 'visible titles at launch and rename',
    [/visible.*driver.*titles/i, /plain outcome/i, /at most 30 characters/i, /launch and rename/i],
    'At launch and rename, visible driver thread titles express a plain outcome of at most 30 characters.',
    [[/at most 30 characters/i, 'unlimited length'], [/launch and rename/i, 'launch only']]],
  ['t3-runtime', 'visible title prefix prohibition',
    [/visible.*driver.*titles/i, /no repo, issue or size prefix/i],
    'Visible driver thread titles use no repo, issue or size prefix.',
    [[/no repo, issue or size prefix/i, 'a repo, issue or size prefix']], [/no repo, issue or size prefix/i]],
  ['t3-runtime', 'hidden children retain dispatch identity',
    [/hidden children/i, /keep|retain/i, /dispatch.key titles/i],
    'Hidden children retain dispatch-key titles.', [[/dispatch.key titles/i, 'short outcome titles']]],
  ['workspace-hygiene', 'native attribution excludes driver settle',
    [/record settle: native only/i, /no driver settle was issued/i, /that thread/i],
    'Record settle: native only when no driver settle was issued for that thread.',
    [[/no driver settle was issued/i, 'a driver settle was issued']], [/no driver settle was issued/i]],
];
for (const [path, name, concepts, rewording, inversions, masks = []] of rules) {
  test(`pass self-settle: ${path} ${name}`, () => {
    const check = (text) => sentences(text).some((s) => concepts.every((r) => r.test(s))
      && requires(masks.reduce((v, r) => v.replace(r, ''), s), /^/));
    checkRule(read(path), check, rewording, [...inversions, [/^/, 'Never ']], concepts);
  });
}

const repairRules = [
  ['automations', 'quiet teardown carve-out', [/quiet exit/i, /bypasses/i, /except the guarded pass.end self.settle/i],
    'A quiet exit bypasses teardown except the guarded pass-end self-settle.', [[/except the guarded/i, 'including the guarded']]],
  ['review-manager-prompt', 'quiet gate routes to self-settle', [/every busy condition is false/i, /apply the guarded pass.end self.settle below/i],
    'When every busy condition is false, apply the guarded pass-end self-settle below before ending.', [[/apply the guarded/i, 'skip the guarded']], [/no text/i, /no skill load/i, /no sweep/i, /no other continuity write/i]],
  ...passes.slice(1).flatMap((path) => [
    [path, 'all exit kinds self-settle', [/applies to quiet, skipped and empty passes too/i],
      'The guarded action applies to quiet, skipped and empty passes too.', [[/applies to/i, 'excludes']]],
    [path, 'shared verification pointer', [/follow/i, /Finite.session teardown/i, /deferred self.settle/i, /next.pass verification/i],
      'For next-pass verification and deferred self-settle, follow Finite-session teardown.', [[/follow/i, 'ignore']]],
    [path, 'durable pass identity', [/record (?:the )?own pass threadId/i, /(?:review.manager continuity|activation record)/i],
      `Record the own pass threadId in the ${path === 'review-manager-prompt' ? 'review-manager continuity' : 'activation record'}.`, [[/record/i, 'discard']]],
  ]),
  ['review-manager-prompt', 'only unguarded unsettled predecessors force full pass', [/run the full pass/i, /recorded prior pass thread/i, /unsettled/i, /only when/i, /no guard keeps it unsettled/i],
    'Run the full pass only when the recorded prior pass thread is unsettled and no guard keeps it unsettled.', [[/run the full pass/i, 'exit quietly'], [/no guard keeps it unsettled/i, 'a guard keeps it unsettled']], [/no guard keeps it unsettled/i]],
  ['review-manager-prompt', 'read predecessor before quiet decision', [/before evaluating the quiet gate/i, /read/i, /recorded prior pass thread/i, /t3_thread_read/i],
    'Read the recorded prior pass thread through t3_thread_read before evaluating the quiet gate.', [[/before evaluating/i, 'after evaluating']]],
  ['review-manager-prompt', 'unknown predecessor forces full pass', [/unknown identity or readback/i, /forces a full pass/i],
    'Unknown identity or readback forces a full pass.', [[/forces a full pass/i, 'stays quiet']]],
  ['automations', 'unknown guards preserve predecessor', [/identity, guards or readback are unavailable/i, /preserve the thread/i, /report that gap/i, /instead of settling it/i],
    'Preserve the thread and report that gap instead of settling it if identity, guards or readback are unavailable.', [[/preserve the thread/i, 'settle the thread'], [/report that gap/i, 'hide that gap']]],
  ...['automations', 'review-manager-prompt'].map((path) => [path, 'guarded predecessors stay quiet without failure reports',
    [/held or flagged prior passes/i, /never force a full pass or failure report/i],
    'Held or flagged prior passes never force a full pass or failure report.', [[/never force/i, 'always force']], [/never force a full pass or failure report/i]]),
  ['automations', 'guarded predecessors leave unresolved list', [/guard keeps a prior pass unsettled/i, /drop it from the unresolved list/i, /retain any existing record/i],
    'When a guard keeps a prior pass unsettled, drop it from the unresolved list and retain any existing record.', [[/drop it from/i, 'keep it in']]],
  ['automations', 'guard classification covers retained work', [/a guard includes/i, /hold or flag/i, /owned watch/i, /unsettled descendants/i, /pending receipt/i, /wedged pass or stalled owner/i, /every existing pass.start protection/i],
    'A guard includes every existing pass-start protection, an owned watch, unsettled descendants, a hold or flag, a pending receipt and a wedged pass or stalled owner.', [[/includes/i, 'excludes']]],
  ['automations', 'recovery excludes guarded predecessors', [/only prior passes/i, /no guard keeps unsettled/i, /enter unresolved recovery/i],
    'Only prior passes that no guard keeps unsettled enter unresolved recovery.', [[/no guard keeps unsettled/i, 'a guard keeps unsettled']], [/no guard keeps unsettled/i]],
  ['automations', 'read exact prior identity', [/next pass/i, /t3_thread_read/i, /recorded prior pass threadId/i, /before replacing/i],
    'Before replacing the record, the next pass uses t3_thread_read on the recorded prior pass threadId.', [[/before replacing/i, 'after replacing']]],
  ['automations', 'guarded predecessor repair', [/unsettled/i, /settle it/i, /existing pass.start guards/i, /read back settled: true/i],
    'For an unsettled prior thread, settle it under the existing pass-start guards and read back settled: true.', [[/existing pass.start guards/i, 'without guards'], [/settled: true/i, 'settled: false']]],
  ['automations', 'failed verification has owner and action', [/failed request or next.pass verification/i, /next pass owns/i, /unresolved/i, /hold or report/i, /exact threadId/i, /resume action/i],
    'For a failed request or next-pass verification, the next pass owns unresolved recovery and records a hold or report with the exact threadId and resume action.', [[/next pass owns/i, 'nobody owns'], [/hold or report/i, 'success']]],
  ['automations', 'unresolved prior identities remain durable', [/keep unresolved prior threadIds/i, /same record/i, /until verified settled/i],
    'Until verified settled, keep unresolved prior threadIds in the same record.', [[/keep/i, 'discard'], [/until verified settled/i, 'until turn end']]],
  ...['pr-triage-nightly', 'test-audit-weekly'].map((path) => [path, 'start verifies predecessor before replacing identity',
    [/at pass start/i, /read/i, /prior pass thread/i, /t3_thread_read/i, /before replacing/i, /guarded/i, /hold\/report/i],
    'At pass start, read the prior pass thread using t3_thread_read for guarded verification or hold/report before replacing its identity.', [[/before replacing/i, 'after replacing']]]),
  ['automations', 'identity never guessed', [/never/i, /guess/i, /thread identity/i, /title/i],
    'Never guess thread identity from a title.', [[/never/i, 'always']], [/never/i]],
  ['automations', 'identity write exception', [/sole continuity.write exception/i, /own pass threadId/i, /before duplicate classification/i, /quiet exits/i],
    'The sole continuity-write exception records own pass threadId before duplicate classification and on quiet exits.', [[/own pass threadId/i, 'arbitrary shared state']]],
  ['t3-runtime', 'driver-only title scope', [/D9/i, /driver threads only/i, /unbound pass threads/i, /Needs you:/i, /retain|keep/i],
    'D9 covers driver threads only while flagged unbound pass threads retain Needs you: titles.', [[/driver threads only/i, 'every thread'], [/retain|keep/i, 'discard']]],
];
for (const [path, name, concepts, rewording, inversions, masks = []] of repairRules) {
  test(`pass repair: ${path} ${name}`, () => {
    const check = (text) => sentences(text).some((s) => concepts.every((r) => r.test(s))
      && requires(masks.reduce((v, r) => v.replace(r, ''), s), /^/));
    checkRule(read(path), check, rewording, inversions, concepts);
  });
}
