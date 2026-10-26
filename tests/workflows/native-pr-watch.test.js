import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, prohibits } from './prose-contract.js';

const routing = 'axstack/references/routing.md';
const watch = 'axstack-watch/SKILL.md';
const runtime = 'axstack/references/t3-runtime.md';

// Declared routing and native-tool obligations, not live T3 execution proof.
// Each rule uses real-source removal, concept removal, inversion and rewording
// in memory. Existing watch tests cover schedules and the merge predicate.
function rule(name, path, concepts, rewording, inversions, negative) {
  test(`native PR watch: ${name}`, () => {
    const source = readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
    const required = [...concepts, ...inversions.map(([direction]) => direction)];
    const accepts = negative ? (text) => prohibits(text, negative, ...required)
      : (text) => requires(text, ...required);
    for (const equivalent of [rewording].flat()) {
      checkRule(source, accepts, equivalent, inversions, required);
    }
  });
}

// Freshness is a driver instruction contract, not live reload/compliance proof.
rule('driver checks and records installed version at every entry', runtime,
  [/driver/i, /every run start/i, /resume/i, /run-watch wake/i,
    /axstack --version/i, /installed Axstack version/i, /check time/i, /run record/i],
  'At every run start, resume and run-watch wake, the driver shall execute axstack --version and save the installed Axstack version and check time in the run record.',
  [[/must|shall/i, 'may'], [/\b(?:run|execute) `?axstack/i, 'skip axstack'],
    [/\b(?:record|save) the installed/i, 'discard the installed'],
    [/every run start/i, 'selected run starts']]);
rule('missing or changed read reloads all used installed guidance before acting', runtime,
  [/this run lacks a reference read/i, /or the installed version differs/i,
    /version recorded at the last reference read/i, /driver/i,
    /re-read|reload/i, /installed phase SKILL\.md/i, /every shared reference it will use/i,
    /before any dispatch/i, /receipt consumption/i, /settlement/i, /merge/i],
  'When this run lacks a reference read or the installed version differs from the version recorded at the last reference read, the driver shall reload the installed phase SKILL.md and every shared reference it will use before any dispatch, receipt consumption, settlement or merge.',
  [[/must|shall/i, 'may'], [/\blacks\b/i, 'has'], [/\bdiffers\b/i, 'matches'],
    [/\bor the installed/i, 'and the installed'], [/re-read|reload/i, 'skip'],
    [/every shared reference it will use/i, 'selected shared references'],
    [/before any dispatch/i, 'after all dispatch']]);
rule('reference reread records version and read time', runtime,
  [/after re-reading|after reloading/i, /driver/i, /installed version/i,
    /reference read time/i, /run record/i],
  'After reloading, the driver shall save the installed version and reference read time in the run record.',
  [[/must|shall/i, 'may'], [/\b(?:record|save) the installed/i, 'discard the installed'],
    [/after re-reading|after reloading/i, 'before reloading']]);
rule('driver rejects context copies from earlier runs or older versions', runtime,
  [/driver/i, /in-context copy/i, /earlier run/i, /older installed version/i],
  'The driver shall never trust an in-context copy from an earlier run or an older installed version.',
  [[/must|shall/i, 'may'], [/never/i, 'always'],
    [/rely on|trust/i, 'discard'], [/earlier run/i, 'current run'],
    [/older installed version/i, 'current installed version']], /never (?:rely on|trust)/i);
rule('run record keeps installed version and last reference read time',
  'axstack/references/run-record.md',
  [/installed Axstack SHA/i, /installed Axstack version/i, /last reference read time/i],
  'Save installed Axstack SHA, installed Axstack version and last reference read time in the run record.',
  [[/\b(?:record|save) (?:driver|installed)/i, 'discard installed']]);

rule('own-PR watch requests grant maintenance by default', routing,
  [/user request/i, /watch/i, /babysit/i, /keep watching/i, /maintain/i,
    /own PRs/i, /authenticated/i, /gh api user/i, /login/i, /user.s agents/i, /authorized maintenance/i],
  "When a user requests to watch, babysit, keep watching, or maintain own PRs by the authenticated gh api user login or the user's agents, that grants authorized maintenance by default.",
  [[/grants?/i, 'denies'], [/by default/i, 'only after additional approval']]);
rule('observation-only has explicit, status and peer boundaries', routing,
  [/observation-only/i, /explicit observe-only/i, /status questions/i, /without a watch request/i, /peers. PRs/i],
  "Observation-only is limited to explicit observe-only requests, status questions without a watch request, or peers' PRs.",
  [[/applies only|is limited to/i, 'applies generally'], [/without a watch request/i, 'including a watch request']]);
rule('imported or unknown authors get a configured repair author', watch,
  [/run did not launch/i, /original author/i, /historical provenance/i, /unknown or mixed/i,
    /new configured/i, /axstack-author/i, /attempt/i, /Shared routing/i],
  'If this run did not launch the original author, or historical provenance is unknown or mixed, start a new configured axstack-author attempt under Shared routing.',
  [[/\b(?:launch|start) a new\b/i, 'reject a new']], /did not launch/i);
rule('reviewer pairing uses repair provenance', watch,
  [/adopted own PR/i, /authored reviewer/i, /repair author/i, /actual provenance/i],
  "Use the repair author's recorded actual provenance to pair the authored reviewer for an adopted own PR.",
  [[/\bpair\b/i, 'exclude'], [/repair author/i, 'historical author']]);
rule('link published and adopted own PRs including every stack layer', runtime,
  [/verified publication readback/i, /adoption/i, /own PR/i, /driver/i,
    /link_pull_request/i, /full PR URL/i, /every layer/i, /gh stack/i],
  'For every layer of a gh stack, after verified publication readback or adoption of an own PR, the driver invokes link_pull_request with the full PR URL.',
  [[/\b(?:calls?|invokes?)\b/i, 'bypasses']]);
rule('reconcile missing run links before watch end or Close-out', runtime,
  [/before finishing PR work/i, /watch end/i, /Close-out/i, /driver/i,
    /list_thread_pull_requests/i, /every missing run PR/i],
  'At watch end or Close-out, before finishing PR work, the driver invokes list_thread_pull_requests and links every missing run PR.',
  [[/\b(?:calls?|invokes?)\b/i, 'bypasses'], [/\blinks?\b/i, 'unlinks']]);
rule('unrelated PRs stay outside thread links', runtime, [/link/i, /unrelated PRs/i],
  'Never link unrelated PRs.', [[/never/i, 'always']], /never/i);
rule('native watch arms event wakes and ends the turn', runtime,
  [/every watched own PR/i, /chat-run/i, /standalone adopted maintenance/i, /when available/i,
    /driver/i, /watch_pull_request/i, /T3 wakes/i, /check completion/i,
    /new comments from others/i, /branch conflicts/i],
  'When available, for every watched own PR in chat-run or standalone adopted maintenance, the driver invokes watch_pull_request and ends the turn so T3 wakes on check completion, new comments from others, or branch conflicts.',
  [[/\b(?:calls?|invokes?)\b/i, 'bypasses'], [/ends? the turn/i, 'keeps the turn running']]);
rule('non-user stop notice is a wake with same-turn PR recheck', runtime,
  [/T3/i, /stopped watching/i, /notice/i, /itself a driver wake/i,
    /same turn/i, /PR/i, /non-user/i],
  'A non-user T3 stopped watching notice is itself a driver wake: during that same turn, re-check the PR.',
  [[/same turn/i, 'next wake'], [/re-checks?/i, 'ignores'],
    [/non-user/i, 'user'], [/itself a driver wake/i, 'only data for a later wake']]);
rule('open PR must rearm in the same turn after a non-user stop', runtime,
  [/non-user stop/i, /PR (?:stays|remains) open/i, /driver must/i, /re-arm/i,
    /same turn/i, /when GraphQL quota permits|with available GraphQL quota/i],
  'When a PR remains open after a non-user stop, the driver must re-arm during that same turn with available GraphQL quota.',
  [[/driver must/i, 'driver may'], [/re-arm/i, 'skip recovery'],
    [/same turn/i, 'later turn'], [/PR (?:stays|remains) open/i, 'PR is closed']]);
rule('host guide follows canonical recovery with unsettle before rearm', '../docs/host-operations.md',
  [/non-user stop/i, /PR (?:stays|remains) open/i, /same turn/i,
    /follow/i, /Native PR links and watches/i, /unsettle.*before.*re-arm/i],
  'For a non-user stop while the PR remains open, follow Native PR links and watches in that same turn: unsettle before native re-arm.',
  [[/non-user stop/i, 'user Stop'], [/same turn/i, 'later turn'],
    [/follow/i, 'bypass'], [/unsettle.*before.*re-arm/i, 're-arm before unsettle']]);
rule('only the PR-owning driver watches', runtime,
  [/only the PR-owning driver/i, /calls|invokes/i, /watch_pull_request/i],
  'Only the PR-owning driver invokes watch_pull_request.',
  [[/only the PR-owning driver/i, 'any driver or child']]);
rule('delegated children never watch', runtime,
  [/delegated children/i, /watch_pull_request/i],
  'Delegated children never invoke watch_pull_request.',
  [[/never/i, 'always']], /never (?:call|invoke)/i);
rule('existing checks and comments are handled before arming', runtime,
  [/before arming/i, /handle|process/i, /existing checks and comments/i, /only later comments wake/i],
  'Before arming, process existing checks and comments since only later comments wake the thread.',
  [[/before arming/i, 'after arming'], [/handle|process/i, 'ignore'],
    [/only later comments wake/i, 'all historical comments wake']]);
rule('native watch stop conditions match T3', runtime,
  [/native watch/i, /ends|stops/i, /after 8 failed reads/i, /settle/i, /archive/i, /user Stop/i, /PR merge\/close/i],
  'Native watch stops after 8 failed reads, or on settle, archive, user Stop, or PR merge/close.',
  [[/ends|stops/i, 'continues'], [/after 8 failed reads/i, 'after 15 minutes']]);
rule('rearm excludes user stops', runtime, [/re-arm/i],
  ['Re-arm only after a stop the user did not cause.',
    'Re-arm solely after a stop that was not caused by the user.'],
  [[/not caused by the user|the user did not cause/i, 'caused by the user']],
  /(?:only|solely) after a stop (?:that was )?(?:not caused by the user|the user did not cause)/i);
rule('rearm first unsettles the driver thread', runtime,
  [/before re-arming/i, /first unsettle/i, /driver thread/i, /t3_thread_organize/i,
    /action: unsettle/i, /then (?:call|invoke)/i, /watch_pull_request/i, /again/i],
  'Before re-arming, first unsettle the driver thread with t3_thread_organize action: unsettle, then invoke watch_pull_request again.',
  [[/first unsettle/i, 'leave settled'], [/action: unsettle/i, 'action: settle'],
    [/then (?:call|invoke)/i, 'previously invoke']]);
rule('read failure uses diagnostic GraphQL rate-limit check', runtime,
  [/could not read/i, /gh api rate_limit --jq .resources.graphql/i, /diagnostic only/i],
  'For a could not read stop, execute gh api rate_limit --jq .resources.graphql as a diagnostic only.',
  [[/run|execute/i, 'skip'], [/diagnostic only/i, 'authoritative stop reason']], /could not read/i);
rule('near-zero quota defers rearm through the five-minute schedule', runtime,
  [/GraphQL remaining/i, /near 0/i, /(?:defer|postpone) re-arming until (?:the )?reset/i, /bound schedule/i,
    /5 minutes/i, /re-arm on the next wake after reset|resume watch on the next wake after reset/i],
  'If GraphQL remaining is near 0, postpone re-arming until the reset: set the bound schedule to 5 minutes and resume watch on the next wake after reset.',
  [[/(?:defer|postpone) re-arming until (?:the )?reset/i, 're-arm immediately'], [/5 minutes/i, '60 minutes'],
    [/re-arm on the next wake after reset|resume watch on the next wake after reset/i, 're-arm before reset']]);
rule('GraphQL reset never blocks a turn', runtime, [/GraphQL reset/i, /inside a turn/i],
  'Never wait for a GraphQL reset inside a turn.', [[/never/i, 'always']], /never wait/i);
rule('one merge rearms remaining members after native driver settlement', runtime,
  [/multi-PR driver|driver monitoring multiple PRs/i, /\bT3\b/i, /auto-settl\w*|automatically settl\w*/i, /one PR merges?/i, /re-arms|rearm/i,
    /remaining open members|other open PRs/i, /recovery steps|recovery procedure/i, /before ending the turn|before the turn ends/i],
  ['After one PR merge makes T3 auto-settle a multi-PR driver, it must rearm other open PRs through the recovery procedure before the turn ends.',
    'After one PR merges, T3 automatically settles a driver monitoring multiple PRs, so rearm other open PRs through the recovery procedure before the turn ends.'],
  [[/re-arms|rearm/i, 'abandons'], [/remaining open members|other open PRs/i, 'merged members'],
    [/before ending the turn|before the turn ends/i, 'at some later turn']]);
rule('T3 stop reason is recorded', runtime,
  [/record|save/i, /stop reason/i, /T3 gives/i],
  'Save the stop reason T3 gives.', [[/record|save/i, 'discard']]);
rule('rearm never loops', runtime, [/re-arm/i, /in a loop/i],
  'Never perform re-arming in a loop.', [[/never/i, 'always']], /never/i);
rule('conflict-free base movement routes through the existing update rule',
  'axstack-watch/references/watch-runtime.md',
  [/base movement without conflict/i, /schedule-wake digest/i, /existing base-update rule/i],
  'Use the existing base-update rule to route base movement without conflict found by the schedule-wake digest.',
  [[/route/i, 'ignore'], [/existing base-update rule/i, 'new readiness term']]);
rule('native watch reports conflicts rather than conflict-free base movement',
  'axstack-watch/references/watch-runtime.md', [/base movement/i, /native watch/i, /reports/i, /only/i, /conflicts/i],
  'Regarding base movement, native watch only reports conflicts.',
  [[/only/i, 'also other movement and'], [/conflicts/i, 'all changes']]);
rule('missing native watch falls back to schedule and digest without a hold', runtime,
  [/watch_pull_request/i, /unavailable/i, /bound 5-minute schedule/i, /scripts\/pr-digest\.js/i],
  'Without a hold, fall back to scripts/pr-digest.js and the bound 5-minute schedule whenever watch_pull_request is unavailable.',
  [[/fall back/i, 'refuse fallback'], [/without a hold/i, 'with a hold']]);
rule('native events retain wake routing and readiness gates', runtime,
  [/native PR wake events/i, /watch §4/i, /unchanged §5 readiness predicate/i],
  'Through watch §4 and the unchanged §5 readiness predicate, route native PR wake events.',
  [[/\broute\b/i, 'discard'], [/through/i, 'around']]);
rule('merge, close and teardown unwatch while retaining links', runtime,
  [/PR merges or closes/i, /watch is torn down/i, /unwatch_pull_request/i],
  'Keep its link and call unwatch_pull_request when a PR merges or closes or its watch is torn down.',
  [[/\bcall\b/i, 'bypass'], [/keep its link/i, 'remove its link']]);

rule('published stack layers link to the author thread with readback', runtime,
  [/after verified publication readback/i, /own PR/i, /every layer/i, /gh stack/i,
    /driver/i, /t3_thread_update/i, /action: link_pull_request/i,
    /threadId`? set to the author thread/i, /list_thread_pull_requests/i, /same author thread/i],
  'For every layer of a gh stack, after verified publication readback of an own PR, the driver invokes t3_thread_update with action: link_pull_request and threadId set to the author thread, then verifies the PR link via list_thread_pull_requests for that same author thread.',
  [[/\b(?:calls?|invokes?)\b/i, 'bypasses'], [/then (?:reads? back|verifies?)/i, 'then skips']]);
rule('failed author-link readback holds only its PR and retries the link', runtime,
  [/missing or failed/i, /author-link readback/i, /only that PR.s merge-ready/i,
    /retrying the link/i, /author repair/i],
  "A missing or failed author-link readback never triggers author repair: it holds only that PR's merge-ready and requires retrying the link.",
  [[/never triggers/i, 'always triggers'], [/\bholds?\b/i, 'releases'],
    [/requires retrying/i, 'forbids retrying']], /never triggers/i);
rule('forge merge or close reads author settlement first in the same turn', runtime,
  [/forge confirms/i, /run PR merged or closed/i, /same driver turn/i, /author thread/i, /t3_thread_read/i],
  'When the forge confirms a run PR merged or closed, in the same driver turn first read its author thread with t3_thread_read.',
  [[/first reads?|first read/i, 'eventually read']]);
rule('already settled author records native settlement', runtime,
  [/already/i, /settled.*true/i, /record/i, /settle: native/i],
  'Record settle: native if the readback already shows settled: true.',
  [[/settled.*true/i, 'settled: false'], [/settle: native/i, 'settle: manual']]);
rule('otherwise settle manually and read back before recording', runtime,
  [/otherwise/i, /t3_thread_organize/i, /action: settle/i, /t3_thread_read/i, /settled.*true/i, /settle: manual/i],
  'Otherwise settle with t3_thread_organize using action: settle, then read back settled: true with t3_thread_read before recording settle: manual.',
  [[/then read back/i, 'skip readback'], [/before recording/i, 'after recording'], [/settle: manual/i, 'settle: native']]);
rule('missing settlement readback holds watch end and Close-out only for its thread', runtime,
  [/missing or failed/i, /settle readback/i, /watch end/i, /Close-out/i,
    /only.*that author thread/i, /until resolved/i],
  'Until resolved, a missing or failed settle readback holds watch end and Close-out only for that author thread.',
  [[/\bholds?\b/i, 'releases'], [/only for that author thread/i, 'for every run thread'],
    [/until resolved/i, 'even after resolution']]);

const stopRecoveryBan = /\b(?:never (?:triggers?|activates?)|(?:do|does|must) not (?:(?:switch|change) to|trigger|activate))\b/i;
rule('host guide excludes user Stop from recovery', '../docs/host-operations.md',
  [/user Stop/i, /this recovery|watch recovery|5-minute recovery cadence/i],
  ['A user Stop does not activate watch recovery.',
    'When a user Stop leaves an open PR unwatched, do not switch to the 5-minute recovery cadence.'],
  [[stopRecoveryBan, 'always activates']], stopRecoveryBan);
rule('host guide forbids waiting inside a turn for quota reset', '../docs/host-operations.md',
  [/GraphQL reset/i, /inside a turn|during a turn/i],
  'Do not wait for a GraphQL reset during a turn.',
  [[/never wait|do not wait/i, 'always wait']], /never wait|do not wait/i);
rule('host guide rearms remaining watches after one merge', '../docs/host-operations.md',
  [/one PR merges?/i, /auto-settl\w*|automatically settl\w*/i, /multi-PR driver|driver monitoring multiple PRs/i,
    /re-arm|rearm/i, /remaining watches|other watches/i, /that procedure|recovery procedure/i],
  'After one PR merge makes T3 auto-settle a multi-PR driver, rearm other watches through the recovery procedure.',
  [[/re-arm|rearm/i, 'abandon'], [/remaining watches|other watches/i, 'merged watch']]);
rule('host guide limits the digest to schedule wakes', '../docs/host-operations.md',
  [/digest/i, /only on schedule wakes|on scheduled wakes only/i],
  'Execute the digest on scheduled wakes only.',
  [[/only on schedule wakes|on scheduled wakes only/i, 'on every driver wake'], [/runs|execute/i, 'skip']]);
