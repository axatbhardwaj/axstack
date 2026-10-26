import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, prohibits, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const autopilot = 'axstack/references/autopilot.md';
const runtime = 'axstack-watch/references/watch-runtime.md';
const watch = 'axstack-watch/SKILL.md';
const record = 'axstack/references/run-record.md';
const implement = 'axstack-implement/SKILL.md';

const reviewInversions = {
  'explicit user publication boundary wins': 'Explicit user stop-after-publication and observation-only requests are overridden by the watch.',
  'driver retains sole ownership and record': 'The driver hands off its role as single owner and sole run-record writer.',
  'cards and hold stay in driver thread': 'Move merge-card replies and `hold` out of the driver thread.',
  'next PR event re-evaluates cadence': 'On the next event on a watched PR, ignore the fallback conditions and retain the wake cadence.',
  'repairs stay with the author': "The driver takes base updates and review feedback from the PR's author and does the repair itself.",
};

// Declared prompt obligations, not live T3 behavior. Every positive rule binds
// its direction (including synonyms), and flips it to a non-negated opposite.
// Real-source removal, rewording and inversion stay entirely in memory.
function rule(name, path, concepts, rewording, inversion, negative) {
  test(`automatic own-PR watch: ${name}`, () => {
    const required = negative?.source === 'never' ? concepts : [...concepts, inversion[0]];
    const accepts = negative
      ? (text) => prohibits(text, negative, ...required)
      : (text) => requires(text, ...required);
    const source = read(path);
    checkRule(source, accepts, rewording, [inversion], required);
    if (reviewInversions[name]) {
      const targets = sentences(source).filter(accepts);
      const inverted = targets.reduce((text, target) =>
        text.replace(target, reviewInversions[name]), source);
      expect(accepts(inverted)).toBe(false);
    }
  });
}

rule('every publishing phase arms or joins after readback', autopilot,
  [/any|every/i, /Axstack phase/i, /own PR/i, /verified publication readback/i,
    /driver/i, /\b(?:arms?|starts?)\b.*or (?:joins?|reuses?)\b/i, /chat-run watch/i, /authorized maintain mode/i],
  'After verified publication readback of an own PR from every Axstack phase, the driver arms or joins its chat-run watch in authorized maintain mode.',
  [/\b(?:arms?|starts?)\b/i, 'abandons']);
rule('explicit user publication boundary wins', autopilot,
  [/explicit/i, /user/i, /stop-after-publication/i, /observation-only/i, /request/i],
  'Explicit user stop-after-publication and observation-only requests take precedence.',
  [/\b(?:prevail|win|take precedence)\b/i, 'are overridden by the watch']);
rule('manual invocation is unnecessary', autopilot,
  [/manual/i, /axstack-watch/i, /invocation/i],
  'Never require a manual axstack-watch invocation.', [/never/i, 'always'], /never/i);
rule('driver retains sole ownership and record', autopilot,
  [/driver/i, /single owner/i, /sole run-record writer/i,
    /\bdriver (?:remains|stays|is|continues as) (?:the )?single owner\b/i],
  'The driver is the single owner and sole run-record writer.',
  [/\b(?:remains|stays|is|continues as)\b/i, 'hands off its role as']);
rule('no per-PR session or hand-off', autopilot,
  [/per-PR session/i, /ownership hand-off/i],
  'Never create a per-PR session or an ownership hand-off.', [/never/i, 'always'], /never/i);
rule('implementation uses shared publication rule', implement,
  [/each|every/i, /own PR publication/i, /verified readback/i, /driver/i, /\b(?:arms?|starts?)\b.*or (?:joins?|reuses?)\b/i, /Autopilot/i],
  'After verified readback of each own PR publication, the driver starts or joins the watch under Autopilot.',
  [/\b(?:arms?|starts?)\b/i, 'abandons']);
rule('repairs stay with the author', runtime,
  [/driver/i, /base updates/i, /review feedback/i, /repair/i, /\b(?:routes?|sends?|assigns?|passes?)\b/i],
  "The driver sends review feedback and base updates to the PR's author for repair.",
  [/\bto (?:the )?PR.s author\b/i, "away from the PR's author"]);
rule('adopted repairs start a new author attempt', runtime,
  [/adopted PR/i, /author/i, /run did not launch/i, /new author attempt/i, /adoption rules/i],
  'For an adopted PR whose author this run did not launch, repairs follow the adoption rules with a new author attempt.',
  [/\b(?:use|follow)\b/i, 'reject'], /run did not launch/i);
rule('watch never writes source', runtime,
  [/watch/i, /writ\w*/i, /candidate source/i],
  'The watch never writes candidate source.', [/never/i, 'always'], /never/i);
rule('terminal stop waits for workers and release', runtime,
  [/wake/i, /only/i, /every watched PR/i, /merged or closed/i,
    /launched work is settled/i, /release step is settled or not applicable/i, /user cancels/i],
  'The wake ends only when every watched PR is merged or closed, launched work is settled, and the release step is settled or not applicable, or the user cancels.',
  [/\b(?:stop|ends?)\b/i, (word) => word.toLowerCase() === 'stop' ? 'Continue' : 'continues'], /not applicable/i);
rule('closed required PR retains decision hold', runtime,
  [/required PR/i, /closed without merging/i, /decision hold/i,
    /records|has/i, /user/i, /resolves scope/i, /cancels/i],
  'A required PR closed without merging has a decision hold until the user resolves scope or cancels.',
  [/records|has/i, 'ignores']);
rule('open PRs have no expiry or reauthorization', runtime,
  [/chat-run watch/i, /expire/i, /re-authorization/i, /PRs remain open/i],
  'The chat-run watch never expires or waits for re-authorization while PRs remain open.',
  [/never/i, 'always'], /never/i);
for (const path of [runtime, 'axstack/references/t3-runtime.md']) {
  rule(`forge-resolved wait slows at once (${path})`, path,
    [/forge-resolved human waits/i, /user merge/i, /npm stage approval/i, /human review/i,
      /no unsettled worker/i, /no PR needing watch events/i,
      /cadence/i, /at once|immediately/i],
    'For forge-resolved human waits, including user merge, npm stage approval and human review, with no unsettled worker and no PR needing watch events, immediately set the run watch cadence to 60 minutes.',
    [/\b60 minutes\b/i, '5 minutes'], /no unsettled worker|no PR needing watch events/gi);
  rule(`work restart rechecks recovery conditions (${path})`, path,
    [/work restarts|work resumes/i, /cadence/i, /recovery conditions/i],
    'When work resumes, reassess cadence against the recovery conditions.',
    [/re-evaluate|reassess/i, 'ignore']);
  rule(`native PR watches stay (${path})`, path, [/native PR watches/i, /forge-resolved waits/i],
    'Retain native PR watches for forge-resolved waits.', [/\b(?:keep|retain)\b/i, 'remove']);
}
rule('next PR event re-evaluates cadence', runtime,
  [/next event/i, /watched PR/i, /cadence/i, /fallback conditions/i, /same turn/i],
  'On the next event on a watched PR, re-evaluate the wake cadence against the fallback conditions in the same turn.',
  [/re-evaluate|reassess/i, 'ignore']);
rule('unsettled writer or follow-up without native completion uses recovery', runtime,
  [/writer or follow-up|follow-up or writer/i, /unsettled|unfinished/i, /(?:without|lacking) a native completion path/i, /5-minute cadence/i, /everyMs:300000/i],
  'A follow-up or writer that is unfinished and lacking a native completion path uses the 5-minute cadence (everyMs:300000).',
  [/5-minute/i, '60-minute']);
rule('healthy native completion paths use hourly backstop during release too', runtime,
  [/native completion paths/i, /all unsettled work|every unsettled task/i, /armed native PR watches|native PR watches armed/i,
    /60-minute backstop/i, /everyMs:3600000/i, /release is pending/i],
  'With native PR watches armed and native completion paths for every unsettled task, use the 60-minute backstop (everyMs:3600000), including while release is pending.',
  [/60-minute/i, '5-minute']);
rule('cadence defaults to hourly outside recovery', runtime,
  [/otherwise/i, /use/i, /60-minute backstop/i],
  'Otherwise, use the 60-minute backstop.', [/60-minute/i, '5-minute']);
const stopRecoveryBan = /\b(?:never (?:triggers?|activates?)|(?:do|does|must) not (?:(?:switch|change) to|trigger|activate))\b/i;
for (const path of [runtime, 'axstack/references/t3-runtime.md']) {
  rule(`user Stop does not activate watch recovery (${path})`, path,
    [/open PR/i, /unwatched/i, /user Stop/i, /5-minute recovery cadence/i],
    'When a user Stop leaves an open PR unwatched, do not switch to the 5-minute recovery cadence.',
    [stopRecoveryBan, 'always triggers'], stopRecoveryBan);
}

// Cadence eligibility and recovery are owned here; native-pr-watch covers the
// dropped-watch wake's immediate recheck/rearm ordering at the tool boundary.
for (const [name, concepts, rewording, inversions] of [
  ['unavailable, unarmed or failed native rearm restores five minutes',
    [/native `?watch_pull_request`?/i, /unavailable/i, /unarmed for any open member/i,
      /re-arming fails/i, /bound chat-run schedule/i, /5 minutes/i, /everyMs:300000/i, /restore|reset/i],
    'If native watch_pull_request is unavailable or unarmed for any open member, or re-arming fails, reset the bound chat-run schedule to 5 minutes (everyMs:300000).',
    [[/unavailable/i, 'available'], [/unarmed for any open member/i, 'armed for every open member'],
      [/re-arming fails/i, 're-arming succeeds'], [/5 minutes/i, '60 minutes'],
      [/everyMs:300000/i, 'everyMs:3600000'], [/restore|reset/i, 'retain']]],
]) {
  test(`automatic own-PR watch: ${name}`, () => {
    const accepts = (text) => sentences(text).some((unit) =>
      requires(unit, ...concepts) && !/\bunless\b|\bexcept\b/i.test(unit));
    checkRule(read(runtime), accepts, rewording, inversions, concepts);
  });
}
rule('healthy unchanged complete passes stay quiet', runtime,
  [/healthy/i, /unchanged/i, /complete pass/i, /notification/i],
  'A healthy unchanged complete pass emits no notification.',
  [/\bno\b/i, 'a'], /\bno\b/i);
rule('native lifetime re-arms at a wake', runtime,
  [/native schedule/i, /lifetime/i, /driver/i, /at a wake/i],
  'If the native schedule has a lifetime, the driver re-arms it at a wake.',
  [/\b(?:re-arms?|renews?)\b/i, 'retires']);
rule('cadence and renewal update recorded schedule', runtime,
  [/cadence changes/i, /re-arming/i, /recorded schedule ID/i,
    /\b(?:use|call|invoke|apply) `?update_scheduled_task`?\b/i],
  'For cadence changes and re-arming, call update_scheduled_task against the recorded schedule ID.',
  [/\b(?:use|call|invoke|apply)\b/i, 'bypass']);
rule('second wake prohibited', runtime,
  [/second (?:wake|watch)/i],
  'Never start a second watch.', [/never/i, 'always'], /never/i);
rule('watch lifetime is recorded', record,
  [/chat-run watch/i, /cadence/i, /last PR event/i, /schedule lifetime/i, /re-arm receipt/i],
  'The chat-run watch cadence, last PR event, native schedule lifetime, and re-arm receipts belong in the run record.',
  [/\b(?:record|document|save|capture) the chat-run watch\b|\b(?:belong|are kept|are saved|are recorded) in the run record\b/i,
    (words) => /chat-run watch/i.test(words) ? 'Omit the chat-run watch' : 'are omitted from the run record']);
rule('cards and hold stay in driver thread', watch,
  [/merge-card replies/i, /`hold`|\bhold\b/i, /driver thread/i],
  'Merge-card replies and `hold` go in the driver thread.',
  [/\b(?:in|within) (?:the )?driver thread\b/i, 'outside the driver thread']);
rule('Close-out follows watch end', watch,
  [/Close-out/i, /watch ends|end of the watch/i],
  'Close-out follows the end of the watch.',
  [/\b(?:after|follows)\b/i, (word) => word.toLowerCase() === 'after' ? 'before' : 'precedes']);

rule('work restart names the linked recovery contract', 'axstack/references/t3-runtime.md',
  [/work restarts|work resumes/i, /recovery conditions/i, /Chat-run watch runtime/i],
  'When work resumes, reassess cadence against the recovery conditions in Chat-run watch runtime.',
  [/re-evaluate|reassess/i, 'ignore']);
rule('native completion paths identify their wake sources', runtime,
  [/delegated tasks/i, /native PR watches/i, /native completion paths/i, /deliver their own wakes|supply their own notifications/i],
  'Delegated tasks and native PR watches provide native completion paths because they supply their own notifications.',
  [/provide|have/i, 'lack']);
rule('launched writers and marker resumes lack native completion paths', runtime,
  [/launched writers/i, /resumed marker questions/i, /native completion paths/i],
  'Launched writers and resumed marker questions do not have native completion paths.',
  [/lack|do not have/i, 'have'], /lack|do not have/i);
