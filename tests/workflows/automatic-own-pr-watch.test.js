import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, prohibits } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const autopilot = 'axstack/references/autopilot.md';
const runtime = 'axstack-watch/references/watch-runtime.md';
const watch = 'axstack-watch/SKILL.md';
const record = 'axstack/references/run-record.md';
const implement = 'axstack-implement/SKILL.md';
const relay = 'axstack-relay/SKILL.md';

// Prompt contracts catch lost authority/lifetime instructions, not live T3 behavior.
// Removal, whole-instruction inversion, and equivalent real-source substitution
// happen only in memory. Each row owns a distinct regression at its shipped surface.
function rule(name, path, concepts, rewording, direction, inversion, negative) {
  test(`automatic own-PR watch: ${name}`, () => {
    const accepts = negative
      ? (text) => prohibits(text, negative, ...concepts)
      : (text) => requires(text, ...concepts);
    checkRule(read(path), accepts, rewording, [[direction, inversion]], concepts);
  });
}

rule('every publishing phase arms or joins after readback', autopilot,
  [/any|every/i, /Axstack phase/i, /own PR/i, /verified publication readback/i,
    /driver/i, /arm\w* or join\w*/i, /chat-run watch/i, /authorized maintain mode/i],
  'After verified publication readback of an own PR from every Axstack phase, the driver arms or joins its chat-run watch in authorized maintain mode.',
  /arms? or joins?/i, 'does not arm or join');
rule('explicit user publication boundary wins', autopilot,
  [/explicit/i, /user/i, /stop-after-publication/i, /observation-only/i, /request/i, /prevail\w*|win\w*/i],
  'Explicit user stop-after-publication and observation-only requests win.',
  /prevail\w*|win\w*/i, 'do not prevail');
rule('manual invocation is unnecessary', autopilot,
  [/manual/i, /axstack-watch/i, /invocation/i, /require\w*/i],
  'Never require a manual axstack-watch invocation.', /never/i, 'always', /never/i);
rule('driver retains sole ownership and record', autopilot,
  [/driver/i, /single owner/i, /sole run-record writer/i, /remain\w*|stay\w*/i],
  'The driver stays the single owner and sole run-record writer.',
  /remain\w*|stay\w*/i, 'does not remain');
rule('no per-PR session or hand-off', autopilot,
  [/per-PR session/i, /ownership hand-off/i, /creat\w*/i],
  'Never create a per-PR session or an ownership hand-off.', /never/i, 'always', /never/i);
rule('implementation uses shared publication rule', implement,
  [/each|every/i, /own PR publication/i, /verified readback/i, /driver/i, /arms? or joins?/i, /Autopilot/i],
  'After verified readback of each own PR publication, the driver arms or joins the watch under Autopilot.',
  /arms? or joins?/i, 'does not arm or join');
rule('repairs stay with the author', runtime,
  [/driver/i, /route\w*/i, /rebases/i, /review feedback/i, /PR.s author/i, /repair/i],
  "The driver routes review feedback and rebases to the PR's author for repair.",
  /route\w*/i, 'does not route');
rule('adopted repairs start a new author attempt', runtime,
  [/adopted PR/i, /author/i, /run did not launch/i, /new author attempt/i, /adoption rules/i],
  'For an adopted PR with an author this run did not launch, use a new author attempt under the adoption rules.',
  /use/i, 'never use', /run did not launch/i);
rule('watch never writes source', runtime,
  [/watch/i, /writ\w*/i, /candidate source/i],
  'The watch never writes candidate source.', /never/i, 'always', /never/i);
rule('terminal stop waits for workers and release', runtime,
  [/stop/i, /wake/i, /only/i, /every watched PR/i, /merged or closed/i,
    /launched work is settled/i, /release step is settled or not applicable/i, /user cancels/i],
  'Stop the wake only when every watched PR is merged or closed, launched work is settled, and the release step is settled or not applicable, or the user cancels.',
  /stop/i, 'never stop', /not applicable/i);
rule('closed required PR retains decision hold and wake', runtime,
  [/required PR/i, /closed without merging/i, /decision hold/i, /wake remains active/i, /user/i, /resolves scope/i, /cancels/i],
  'A required PR closed without merging records a decision hold and the wake remains active until the user resolves scope or cancels.',
  /records?/i, 'does not record');
rule('open PRs have no expiry or reauthorization', runtime,
  [/chat-run watch/i, /expire/i, /re-authorization/i, /PRs remain open/i],
  'The chat-run watch never expires or waits for re-authorization while PRs remain open.',
  /never/i, 'always', /never/i);
rule('quiet cadence waits seven days and settled work', runtime,
  [/7 days/i, /no event/i, /any watched PR/i, /only/i, /no unsettled launched work/i, /cadence/i, /10 to 60 minutes/i],
  'After 7 days with no event on any watched PR, and only with no unsettled launched work, change the wake cadence from 10 to 60 minutes.',
  /change/i, 'never change', /no event|no unsettled launched work/gi);
rule('next PR event restores ten minutes', runtime,
  [/next event/i, /watched PR/i, /return\w*|restore\w*/i, /cadence/i, /10 minutes/i],
  'On the next event on a watched PR, restore the wake cadence to 10 minutes.',
  /return\w*|restore\w*/i, 'do not restore');
rule('resumed launched work restores ten minutes', runtime,
  [/launched work/i, /unsettled/i, /restore\w*/i, /10.minute/i, /cadence/i],
  'If launched work becomes unsettled, restore the 10-minute cadence.',
  /restore\w*/i, 'do not restore');
rule('native lifetime re-arms at a wake', runtime,
  [/native schedule/i, /lifetime/i, /driver/i, /re-arms?/i, /at a wake/i],
  'If the native schedule has a lifetime, the driver re-arms it at a wake.',
  /re-arms?/i, 'never re-arm');
rule('cadence and renewal update recorded schedule', runtime,
  [/cadence changes/i, /re-arming/i, /update_scheduled_task/i, /recorded schedule ID/i],
  'Use update_scheduled_task on the recorded schedule ID for cadence changes and re-arming.',
  /use/i, 'never use');
rule('second wake prohibited', runtime,
  [/second wake/i, /creat\w*/i],
  'Never create a second wake.', /never/i, 'always', /never/i);
rule('watch lifetime is recorded', record,
  [/record/i, /chat-run watch/i, /cadence/i, /last PR event/i, /schedule lifetime/i, /re-arm receipt/i],
  'Record the chat-run watch cadence, last PR event, native schedule lifetime, and re-arm receipts.',
  /record/i, 'do not record');
rule('cards and hold stay in driver thread', watch,
  [/merge-card replies/i, /`hold`|\bhold\b/i, /driver thread/i, /keep/i],
  'Keep merge-card replies and hold in the driver thread.',
  /keep/i, 'do not keep');
rule('stale PRs never notify', relay,
  [/stale PRs/i, /notif\w*/i],
  'Never notify for stale PRs.', /never/i, 'always', /never/i);
rule('milestones retain shared cap', relay,
  [/two|2/i, /merge-ready/i, /merged/i, /notifications/i, /per run/i, /cap/i],
  'Cap merge-ready and merged notifications together at two per run.',
  /cap/i, 'do not cap');
rule('Close-out follows watch end', watch,
  [/Close-out/i, /after/i, /watch ends/i, /run/i],
  'Run Close-out after the watch ends.', /run/i, 'never run');
