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
    checkRule(source, accepts, rewording, inversions, required);
  });
}

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
rule('stopped native watches are rechecked and rearmed at the next wake', runtime,
  [/T3/i, /stopped watching/i, /next wake/i, /PR/i, /watch_pull_request/i, /again/i],
  'At the next wake after T3 reports it stopped watching a PR, the driver re-checks the PR and invokes watch_pull_request again.',
  [[/re-checks?/i, 'ignores'], [/\b(?:calls?|invokes?)\b/i, 'bypasses']]);
rule('missing native watch falls back to schedule and digest without a hold', runtime,
  [/watch_pull_request/i, /unavailable/i, /bound 10-minute schedule/i, /scripts\/pr-digest\.js/i],
  'Without a hold, fall back to scripts/pr-digest.js and the bound 10-minute schedule whenever watch_pull_request is unavailable.',
  [[/fall back/i, 'refuse fallback'], [/without a hold/i, 'with a hold']]);
rule('native events retain wake routing and readiness gates', runtime,
  [/native PR wake events/i, /watch §4/i, /unchanged §5 readiness predicate/i],
  'Through watch §4 and the unchanged §5 readiness predicate, route native PR wake events.',
  [[/\broute\b/i, 'discard'], [/through/i, 'around']]);
rule('merge, close and teardown unwatch while retaining links', runtime,
  [/PR merges or closes/i, /watch is torn down/i, /unwatch_pull_request/i],
  'Keep its link and call unwatch_pull_request when a PR merges or closes or its watch is torn down.',
  [[/\bcall\b/i, 'bypass'], [/keep its link/i, 'remove its link']]);
