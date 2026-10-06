import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, prohibits, checkRule } from './prose-contract.js';

const compact = (path) =>
  readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/\s+/g, ' ');

// Source-contract regression checks for the 2026-09-28 lane stall, not live-runtime proof.
test('duplicate pass still runs read-only discovery into its own note', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/duplicate[^.]*read-only discovery[^.]*own (pass )?note/i);
  expect(text).toMatch(/duplicate[^.]*admits nothing/i);
});

test('dispatching owner confirms its own brief once when a worker asks', () => {
  const text = compact('skills/axstack/references/t3-runtime.md');
  expect(text).toMatch(/dispatching owner[^.]*confirm[^.]*worker's own brief question once/i);
  expect(text).toMatch(/Never answer trust or permission prompts/i);
});

test('an idle PR job holds incomplete and a stalled owner notifies once', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/idle final turn[^.]*valid completion receipt[^.]*incomplete/i);
  expect(text).toMatch(/second brief ask follows the five-minute stop rule/i);
  expect(text).toMatch(/duplicate[^.]*stalled owner[^.]*five minutes[^.]*one deduplicated notification/i);
  expect(text).toMatch(/started coordinator[^.]*waiting on its reviewers[^.]*live reviewer task or running wait[^.]*not idle[^.]*never stopped/i);
});

// The bounded stall actions are deliberate exact-text safety contracts.
for (const sentence of [
  'Steer an idle PR job once with `t3_thread_send`.',
  'A second brief ask follows the five-minute stop rule, never an open-ended hold.',
  'If it is still idle without a valid completion receipt five minutes after the steer, stop the owned job with `t3_thread_interrupt` or `task_cancel` as applicable, reconcile the coordinator and every descendant, and record the event unserved and re-admissible.',
  'Uncertain liveness retains the slot only within that five-minute bound; unverified settlement after the stop holds lane admission.',
]) {
  test(`bounded idle PR job safety: ${sentence}`, () => {
    const accepts = (text) => text.replace(/\s+/g, ' ').includes(sentence);
    const text = compact('skills/axstack/references/automations.md');
    expect(accepts(text)).toBe(true);
    expect(accepts(text.replace(sentence, ''))).toBe(false);
    expect(accepts(text.replace(sentence, sentence.replace(/Steer|stop|only/, 'inverted')))).toBe(false);
  });
}

// Recovery policy checks against real source; no tracked-file mutation or live-runtime claim.
const inactiveHour = /(?:more than|over|longer than) (?:60 minutes|(?:an|one|1) hour)/i;
const nonTerminal = /non-?terminal/i;
const oneSuccessor = /(?:(?:exactly|only) one|a single) successor/i;
const recoveryRules = [
  ['verified wedge for any lane pass', [/wedged/i, /pass/i, /owner/i, /successor/i,
    /duplicate/i, nonTerminal, inactiveHour,
    /(?:verified|confirmed) (?:inactivity|absence of activity)/i, /thread/i, /all.*runs/i, /delegated tasks/i,
    /descendant threads/i, /free of `?user_takeover`?/i],
    'Any lane pass is wedged, whether duplicate, successor or owner, when it has a run that is non-terminal with verified inactivity for over an hour across its thread, all its runs, delegated tasks and descendant threads, and is free of user_takeover.',
    [inactiveHour, 'less than 60 minutes']],
  ['live excludes wedged successors', [/live/i, /pass/i, /run/i, nonTerminal],
    'A pass is live when its run is non-terminal and it is not wedged.',
    [/(?:not wedged|free of (?:a )?wedge)/i, 'already wedged'], /(?:not wedged|free of (?:a )?wedge)/i],
  ['single ordered successor', [oneSuccessor, /recover/i,
    /wedged owner/i, /interrupted takeover/i, /live pass/i,
    /\b(?:earliest(?:-started)?|started first)\b/i,
    /^(?!.*after the wedge).*native/i, /run/i, /start/i, /order/i],
    'Only one successor recovers a wedged owner or resumes an interrupted takeover: the live pass that started first, selected by native ordering of run starts.',
    [/\b(?:earliest(?:-started)?|started first)\b/i, 'latest-started']],
  ['uncertain ordering holds', [/missing|absent/i, /tied|equal/i, /ordering evidence/i,
    /holds?/i, /admission/i, /recovery/i],
    'Missing or equal ordering evidence holds recovery and admission until selection is verifiable.',
    [/holds?/i, 'permits']],
  ['exact-run tree interrupt before takeover', [/successor/i, /interrupt/i, /owner/i,
    /(?:descendant|child) threads?/i, /^(?!.*task_cancel).*t3_thread_interrupt/, /exact.*\brunId\b/i,
    /stable/i, /clientRequestId/, /(?:read.?back|reads? back|confirms?).*terminal/i,
    /whole tree/i, /before.*takeover/i, /continuity/i, /(?:becoming owner|assuming ownership)/i],
    'The successor interrupts the owner and its child threads via t3_thread_interrupt with each exact runId and stable clientRequestIds, then confirms terminal state for the whole tree before documenting takeover in continuity and assuming ownership.',
    [/before/i, 'after']],
  ['resume interrupted takeover', [/successor.*wedg(?:e[sd]?|ing)/i,
    /between.*interrupt.*takeover|after.*interrupt.*before.*takeover/i,
    /next.*(?:elected|selected).*live pass/i, /resum.*recovery/i, /terminal.*read.?back/i,
    /interrupted owner/i, /excluded.*potentially.live.owner hold/i],
    'When a successor wedges between interrupt and takeover, the next selected live pass resumes recovery using terminal readback of the interrupted owner, which is excluded from the potentially-live-owner hold.',
    [/excluded/i, 'protected']],
  ['stop failed successor before recording takeover', [/successor/i,
    /interrupt.*wedged successor/i, /^(?!.*task_cancel).*t3_thread_interrupt/,
    /exact.*\brunId\b/, /tree/i,
    /(?:reads? back|confirms?).*(?:terminal.*tree|tree.*terminal).*before.*takeover/i,
    /before.*takeover/i, /resum.*recovery/i],
    'If a successor wedges between interrupt and takeover, the next elected live pass interrupts the wedged successor and its tree with t3_thread_interrupt at each exact runId, confirms terminal state for that tree before recording any takeover, then resumes recovery from terminal readback of the interrupted owner.',
    [/before/i, 'after']],
  ['user-taken-over descendant prevents wedge and interruption', [/user.taken.over/i,
    /descendant/i, /hold/i, /exclud/i, /pass/i, /wedged/i],
    'A user-taken-over descendant puts recovery on hold and excludes its pass from being wedged, and is never interrupted.',
    [/excludes?/i, 'includes'], /never interrupted/i],
  ['recover wedged non-owners', [/owner-of-record/i, /successor/i, /immediately|right after/i,
    /takeover/i, /wedged.*non.owner|non.owner.*wedged/i, /duplicates/i, /successors/i,
    /interrupt/i, /terminal.*read.?back|read.?back.*terminal/i, /then.*retir/i, /teardown/i],
    'The owner-of-record, including a successor right after takeover, interrupts wedged non-owner passes such as duplicates and failed successors with the same exact-run procedure and terminal readback, then retires them under Finite-session teardown.',
    [/then/i, 'instead first']],
  ['reconcile before admission', [/before (?:any )?admission/i, /successor/i, /reconcil/i,
    /owner/i, /in.flight jobs|unfinished (?:PR )?jobs/i, /GitHub/i, /evidence/i],
    'The successor reconciles the previous owner in-flight jobs against evidence and GitHub before admission.',
    [/before (?:any )?admission/i, 'after admission']],
  ['publication readback serves event', [/only.*verdict/i, /published/i,
    /read back|readback/i, /counts? as served/i],
    'Only a published verdict confirmed by readback counts as served for the recovered event.',
    [/read back|readback/i, 'submission attempt']],
  ['unserved recovery is eligible', [/otherwise/i, /event/i, /unserved/i,
    /INCOMPLETE/, /re-eligible|eligible again/i],
    'Otherwise classify the event as INCOMPLETE and unserved, keeping it eligible again.',
    [/re-eligible|eligible again/i, 'ineligible']],
  ['failed recovery holds and notifies once', [/failed interrupt/i, /unverified terminal state/i,
    /keeps?|retains?/i, /existing hold/i, /(?:one|a single).*deduplicated notification/i],
    'A failed interrupt or unverified terminal state retains the existing hold and sends a single deduplicated notification under the recorded Notification policy.',
    [/keeps?|retains?/i, 'releases']],
  ['other unknown liveness holds', [/outside/i, /wedg.*recover/i,
    /unknown liveness/i, /blocks/i, /admission/i, /shared-record writes/i,
    /takeover/i, /cleanup/i, /recent/i],
    'Outside verified wedged-pass recovery, unknown liveness blocks takeover, cleanup, shared-record writes and admission, including recent activity.',
    [/blocks/i, 'permits']],
  ['inactive whole-tree wait is a wedge', [/wait/i, inactiveHour,
    /verified inactivity/i, /whole.tree/i, /wedge/i],
    'A wait showing verified inactivity for longer than an hour in its whole tree is a wedge, not a running wait.',
    [/not (?:a )?running wait/i, 'still a running wait'], /not (?:a )?running wait/i],
  ['canary interrupts and retires a wedged predecessor', [/canary/i, /reconcil/i,
    /killed/i, /predecessor/i, /wedged.pass recovery/i, oneSuccessor,
    /interrupt/i, /retir/i, /wedged predecessor/i],
    'The canary demonstrates wedged-pass recovery and reconciles a killed predecessor: a single successor must interrupt and retire a wedged predecessor.',
    [/interrupt/i, 'preserve']],
];

for (const [name, concepts, rewording, inversion, prohibition] of recoveryRules) {
  test(`wedged manager recovery: ${name}`, () => {
    const text = compact('skills/axstack/references/automations.md');
    const accepts = (source) => prohibition
      ? prohibits(source, prohibition, ...concepts) : requires(source, ...concepts);
    checkRule(text, accepts, rewording, [inversion], concepts);
  });
}
