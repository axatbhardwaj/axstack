import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const watch = sentences(readFileSync(`${import.meta.dir}/../../skills/axstack-watch/SKILL.md`, 'utf8')
  .split('## 1.')[1].split('\n## 2.')[0].replace(/[`*]/g, '')).join('. ');

// Declared adoption instructions, not live agent compliance. Each row mutates
// real source for removal/inversion red and equivalent-rewording green.
const rules = [
  [[/driver/i, /stale or external PR/i, /before (?:any )?push/i, /MODERNIZE/i, /REWORK/i, /CLOSE/i],
    'For a stale or external PR, the driver chooses MODERNIZE, REWORK or CLOSE before pushing.',
    [/before (?:any )?push/i, 'after push']],
  [[/inspect|review/i, /base commits/i, /since divergence/i, /merged and open PRs/i, /same fix/i],
    'Review base commits since divergence and merged and open PRs for the same fix.',
    [/inspect|review/i, 'skip']],
  [[/MODERNIZE/i, /useful goal/i, /right shape/i, /rebase/i, /freshly fetched (?:actual )?base/i],
    'MODERNIZE: for a useful goal in the right shape, rebase onto the freshly fetched actual base.',
    [/freshly fetched (?:actual )?base/i, 'stale local base']],
  [[/record/i, /git range-diff/i, /pre-rebase/i, /post-rebase/i, /focused.check evidence/i],
    'Record pre-rebase and post-rebase git range-diff and focused-check evidence.',
    [/focused.check evidence/i, 'optional check evidence']],
  [[/confirm/i, /expected-old remote SHA/i, /head SHA observed before (?:the )?rebase/i],
    'Confirm the expected-old remote SHA matches the head SHA observed before the rebase.',
    [/before (?:the )?rebase/i, 'after rebase']],
  [[/push/i, /--force-with-lease=refs\/heads\//i, /observed-head-sha/i, /narrowly justified history rewrite/i],
    'Push this narrowly justified history rewrite with --force-with-lease=refs/heads/<branch>:<observed-head-sha>.',
    [/--force-with-lease=refs\/heads\//i, '--force=refs/heads/']],
  [[/lease mismatch/i, /holds publication/i, /fetch/i, /reassess/i],
    'A lease mismatch holds publication: fetch and reassess.',
    [/holds publication/i, 'allows overwrite']],
  [[/REWORK/i, /useful goal/i, /wrong shape/i, /smallest credible rewrite/i, /stop unless the user authorized/i],
    'REWORK: with a useful goal in the wrong shape, describe the smallest credible rewrite and stop unless the user authorized rework.',
    [/stop unless the user authorized/i, 'proceed without authorization for']],
  [[/CLOSE/i, /superseded or obsolete/i, /concrete evidence/i, /ask (?:the user )?before closing/i],
    'CLOSE: when superseded or obsolete, cite concrete evidence and ask the user before closing.',
    [/ask (?:the user )?before closing/i, 'close immediately']],
  [[/route/i, /MODERNIZE/i, /authorized REWORK/i, /Repair and publication/i,
    /single repair author/i, /owned worktree/i, /independent authored review/i,
    /exact (?:rebased or reworked|rewritten) head and base/i, /before driver publication/i],
    'Route MODERNIZE and authorized REWORK through Repair and publication: the single repair author uses its owned worktree, then independent authored review covers the exact rewritten head and base before driver publication.',
    [/before driver publication/i, 'after driver publication']],
  [[/driver/i, /tracked files/i], 'The driver never writes tracked files.',
    [/never writes tracked files/i, 'writes tracked files'], /never writes tracked files/i],
  [[/peer/i, /observation-only/i, /read-only/i],
    'Peer and observation-only adoption stays read-only.', [/read-only/i, 'may push']],
  [[/routine force push/i, /ordinary PRs/i], 'Routine force push for ordinary PRs is forbidden.',
    [/forbidden/i, 'permitted'], /forbidden/i],
];

for (const [concepts, rewording, inversion, prohibition] of rules) {
  test(`adoption disposition: ${concepts[0]} rejects removal/inversion and survives rewording`, () => {
    const accepts = (text) => prohibition
      ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    checkRule(watch, accepts, rewording, [inversion], concepts);
  });
}
