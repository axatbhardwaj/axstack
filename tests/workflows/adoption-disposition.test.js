import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

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
  [[/MODERNIZE/i, /git range-diff/i, /pre-rebase/i, /post-rebase/i, /focused checks/i],
    'For MODERNIZE compare pre-rebase and post-rebase series using git range-diff and run focused checks.',
    [/focused checks/i, 'optional checks']],
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
];

for (const [concepts, rewording, inversion] of rules) {
  test(`adoption disposition: ${concepts[0]} rejects removal/inversion and survives rewording`, () => {
    checkRule(watch, (text) => requires(text, ...concepts), rewording, [inversion], concepts);
  });
}
