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
const relay = 'axstack-relay/SKILL.md';

const reviewInversions = {
  'explicit user publication boundary wins': 'Explicit user stop-after-publication and observation-only requests are overridden by the watch.',
  'driver retains sole ownership and record': 'The driver hands off its role as single owner and sole run-record writer.',
  'cards and hold stay in driver thread': 'Move merge-card replies and `hold` out of the driver thread.',
  'next PR event restores five minutes': 'On the next event on a watched PR, keep the wake cadence at 60 minutes instead of 5 minutes.',
  'resumed launched work restores five minutes': 'If launched work becomes unsettled, drop the 5-minute cadence.',
  'repairs stay with the author': "The driver takes rebases and review feedback from the PR's author and does the repair itself.",
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
  [/driver/i, /rebases/i, /review feedback/i, /repair/i, /\b(?:routes?|sends?|assigns?|passes?)\b/i],
  "The driver sends review feedback and rebases to the PR's author for repair.",
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
rule('closed required PR retains decision hold and wake', runtime,
  [/required PR/i, /closed without merging/i, /decision hold/i,
    /wake.*\bactive\b|\bactive\b.*wake/i, /user/i, /resolves scope/i, /cancels/i],
  'A required PR closed without merging has a decision hold and an active wake until the user resolves scope or cancels.',
  [/\bactive\b/i, 'inactive']);
rule('open PRs have no expiry or reauthorization', runtime,
  [/chat-run watch/i, /expire/i, /re-authorization/i, /PRs remain open/i],
  'The chat-run watch never expires or waits for re-authorization while PRs remain open.',
  [/never/i, 'always'], /never/i);
for (const path of [runtime, 'axstack/references/t3-runtime.md']) {
  rule(`human-only wait slows at once (${path})`, path,
    [/only/i, /user decision/i, /human-only step/i, /user merge/i,
      /no unsettled (?:launched work|worker)/i, /no PR needing watch events/i,
      /cadence/i, /at once|immediately/i],
    'When the run waits only on a user decision or a human-only step, including a user merge, with no unsettled worker and no PR needing watch events, immediately change the run watch cadence to 60 minutes.',
    [/\b60 minutes\b/i, '5 minutes'], /no unsettled (?:launched work|worker)|no PR needing watch events/gi);
  rule(`work restart restores normal cadence (${path})`, path,
    [/work restarts|work resumes/i, /cadence/i],
    'When work resumes, restore the normal 5-minute cadence.',
    [/\b(?:normal 5-minute|5-minute normal)\b/i, 'slow 60-minute']);
  rule(`native PR watches stay (${path})`, path, [/native PR watches/i],
    'Retain native PR watches.', [/\b(?:keep|retain)\b/i, 'remove']);
}
rule('next PR event restores five minutes', runtime,
  [/next event/i, /watched PR/i, /cadence/i,
    /\b(?:restore|return|reset)\b[^.]*\b5 minutes\b|\bcadence (?:becomes|returns to|is reset to) 5 minutes\b/i],
  'On the next event on a watched PR, the wake cadence becomes 5 minutes.',
  [/5 minutes/i, '60 minutes']);
rule('resumed launched work restores five minutes', runtime,
  [/launched work/i, /unsettled/i, /cadence/i,
    /\b(?:restore|resume|return)\b[^.]*\b5-minute cadence\b|\b5-minute cadence (?:applies|resumes|returns)\b/i],
  'While launched work is unsettled, the 5-minute cadence applies.',
  [/5-minute/i, '60-minute']);
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
rule('stale PRs never notify', relay,
  [/stale PRs/i, /notif\w*/i],
  'Never notify for stale PRs.', [/never/i, 'always'], /never/i);
rule('milestones retain shared cap', relay,
  [/two|2/i, /merge-ready/i, /merged/i, /notifications/i, /per run/i],
  'Limit merge-ready and merged notifications to at most two per run.',
  [/\b(?:cap|limit)\b/i, 'expand']);
rule('Close-out follows watch end', watch,
  [/Close-out/i, /watch ends|end of the watch/i],
  'Close-out follows the end of the watch.',
  [/\b(?:after|follows)\b/i, (word) => word.toLowerCase() === 'after' ? 'before' : 'precedes']);
