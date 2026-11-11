import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { gitArgv } from '../../skills/axstack/scripts/git-argv.js';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const scripts = `${import.meta.dir}/../../skills/axstack/scripts`;
const hygiene = () => sentences(readFileSync(`${scripts}/../references/workspace-hygiene.md`, 'utf8').replace(/`/g, '')).join('. ');

test('Git argv construction stays at one hardened boundary', () => {
  expect(gitArgv('-C', '/fixture', 'status')).toEqual([
    'git', '--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
    '-C', '/fixture', 'status',
  ]);
  // Security architecture contract: new helpers must reuse the protected prefix.
  const direct = readdirSync(scripts).filter((path) => path.endsWith('.js') && path !== 'git-argv.js')
    .filter((path) => /\[\s*['"]git['"]\s*[,\]]/.test(readFileSync(`${scripts}/${path}`, 'utf8')));
  expect(direct).toEqual([]);
});

test('workers cannot write shared Git metadata and use command-local configuration', () => {
  const concepts = [/workers/i, /writ\w*/i, /shared.*git metadata/i, /\.git\/config/, /\.git\/hooks/,
    /\.git\/info/, /worktree git files/i];
  checkRule(hygiene(), (text) => prohibits(text, /never/i, ...concepts),
    "Workers never write shared repository Git metadata including .git/config, .git/hooks, .git/info and worktree git files.",
    [[/never/i, 'always']], concepts);
  checkRule(hygiene(), (text) => requires(text, /per.command/i, /-c/, /instead/i),
    'Use per-command -c overrides instead.', [[/use/i, 'avoid']], [/per.command/i, /-c/, /instead/i]);
});

test('driver Git commands disable hooks and fsmonitor in worker-written worktrees', () => {
  const concepts = [/driver/i, /git commands/i, /worktree/i, /worker.*writ/i, /pass|include/i,
    /-c core\.hooksPath=\/dev\/null/, /-c core\.fsmonitor=false/];
  checkRule(hygiene(), (text) => requires(text, ...concepts),
    'For a worktree a worker has written, driver Git commands shall include -c core.hooksPath=/dev/null and -c core.fsmonitor=false.',
    [[/core\.hooksPath=\/dev\/null/, 'core.hooksPath=.git/hooks'], [/core\.fsmonitor=false/, 'core.fsmonitor=true'],
      [/include|pass/i, 'omit']], concepts);
});
