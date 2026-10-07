import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, prohibits } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const relay = 'axstack-relay/SKILL.md';
const lifecycle = 'axstack/references/lifecycle.md';
const runtime = 'axstack/references/t3-runtime.md';
const publication = 'axstack/references/candidate-publication.md';
const hygiene = 'axstack/references/workspace-hygiene.md';

// Independent prompt contracts: current coverage misses these AC8 ordering and
// recovery rules. Mutations use real source in memory; no live runtime is proved.
function rule(name, path, concepts, rewording, inversions, negative) {
  test(`autonomy runtime: ${name}`, () => {
    const required = [...concepts, ...inversions.map(([direction]) => direction)];
    const accepts = negative
      ? (text) => prohibits(text, negative, ...required)
      : (text) => requires(text, ...required);
    checkRule(read(path), accepts, rewording, inversions, required);
  });
}

rule('reply route is verified before a reply-dependent send', relay,
  [/before/i, /reply-dependent send/i, /reply route/i, /gateway forwarding/i,
    /axstack-reply/i, /bound inbox path/i, /driver.*read access/i],
  'Before a reply-dependent send, check the reply route for gateway forwarding to axstack-reply, the bound inbox path, and the driver’s read access.',
  [[/\b(?:verify|check)\b/i, 'ignore'], [/\bbefore\b/i, 'after']]);
rule('unready reply route names the T3 action route', relay,
  [/reply-route readiness fails/i, /T3 driver thread/i, /action route/i, /message/i],
  'When reply-route readiness fails, identify the T3 driver thread as the action route in the message.',
  [[/\b(?:name|identify)\b/i, 'omit'], [/\bT3 driver thread\b/i, 'Telegram reply']]);
rule('fallback send requires the thread action route', relay,
  [/action uses that thread/i, /Telegram reply/i],
  'Only when the action uses that thread instead of a Telegram reply, deliver it.',
  [[/\b(?:send|deliver) it\b/i, 'Ignore it'], [/\bonly when\b/i, 'even unless'],
    [/\binstead of\b/i, 'together with']]);

rule('a fork starts as an observer', lifecycle, [/forked thread/i, /starts? as/i],
  'A forked thread starts as a read-only observer.',
  [[/\b(?:read-only )?observer\b/i, 'writer']]);
rule('a fork reconciles live owners before inherited work', lifecycle,
  [/forked thread/i, /before/i, /resum\w*/i, /inherited work/i,
    /live original driver/i, /writers/i],
  'Before resuming inherited work, a forked thread checks the live original driver and writers.',
  [[/\b(?:reconciles?|checks?)\b/i, 'ignores'], [/\bbefore\b/i, 'after'],
    [/\blive original driver\b/i, 'copied driver record']]);
rule('fork dispatch and writes follow ownership rules', lifecycle,
  [/ownership rules below/i, /dispatch or write/i],
  'Use the ownership rules below before any dispatch or write.',
  [[/\b(?:apply|use)\b/i, 'ignore'], [/\bbefore any\b/i, 'after every'],
    [/\bdispatch or write\b/i, 'dispatch and write']]);

rule('completion is processed in the same turn with existing safeguards', runtime,
  [/completion arrives/i, /same driver turn/i, /after/i, /required terminal checks/i,
    /delegated/i, /hasPendingChildRuns:false/i, /writer candidate checks/i],
  'When a completion arrives, handle it in the same driver turn after the required terminal checks, delegated hasPendingChildRuns:false, and writer candidate checks.',
  [[/\b(?:process|handle)\b/i, 'ignore'], [/\bsame driver turn\b/i, 'next wake'],
    [/\bafter\b/i, 'before'], [/hasPendingChildRuns:false/i, 'hasPendingChildRuns:true']]);
rule('pinned base is fetched before a writer launch', runtime,
  [/pinned base commit/i, /launch repository/i, /before/i, /writer launch/i],
  'Retrieve the pinned base commit into the launch repository before a writer launch.',
  [[/\b(?:fetch|retrieve)\b/i, 'skip'], [/\bbefore\b/i, 'after']]);
rule('pinned base is verified locally before a writer launch', runtime,
  [/before/i, /writer launch/i, /locally/i, /pinned base SHA/i,
    /resolves? to/i, /commit/i, /exact SHA/i],
  'Before a writer launch, check locally that the pinned base SHA resolves to a commit with that exact SHA.',
  [[/\b(?:verify|check)\b/i, 'ignore'], [/\bbefore\b/i, 'after'],
    [/\blocally\b/i, 'remotely'], [/\bexact SHA\b/i, 'branch tip']]);
rule('failed fetch or verification holds the launch', runtime,
  [/fetch or verification/i, /that launch/i],
  'When fetch or verification fails, block that launch.',
  [[/\b(?:hold|block)\b/i, 'continue'], [/\bfails\b/i, 'succeeds'],
    [/\bfetch or verification\b/i, 'fetch and verification']]);

rule('PR body counts and base are refreshed before review', publication,
  [/before/i, /reviewer dispatch/i, /PR body/i, /counts/i, /base/i,
    /confirmed candidate SHA/i, /current base/i, /PR shape/i],
  'Before reviewer dispatch, update the PR body counts and base from the confirmed candidate SHA and current base under PR shape.',
  [[/\b(?:refresh|update)\b/i, 'retain stale'], [/\bbefore\b/i, 'after'],
    [/\bcurrent base\b/i, 'previous base']]);

rule('cleanup runs as a single command', hygiene, [/each cleanup/i],
  'Execute each cleanup as one command.',
  [[/\b(?:run|execute)\b/i, 'skip'], [/\b(?:single|one) command\b/i, 'command chain']]);
rule('force deletion is prohibited', hygiene, [/rm -f/i],
  'Never apply rm -f during cleanup.', [[/never/i, 'always']], /never/i);
rule('chained cleanup is prohibited', hygiene, [/chain cleanup commands/i],
  'Never chain cleanup commands.', [[/never/i, 'always']], /never/i);
