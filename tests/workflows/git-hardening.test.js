import { afterAll, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/git-hardening-`);
chmodSync(root, 0o700);
afterAll(() => rmSync(root, { recursive: true }));
function git(repo, ...args) {
  const result = Bun.spawnSync(['git', '-C', repo, ...args]);
  if (result.exitCode) throw Error(result.stderr.toString());
  return result.stdout.toString().trim();
}
function fixture() {
  const repo = mkdtempSync(`${root}/peer-`);
  git(repo, 'init', '-qb', 'main');
  writeFileSync(`${repo}/a`, 'base\n');
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=f@x', 'commit', '-qm', 'base');
  git(repo, 'remote', 'add', 'origin', 'fixture:peer');
  return repo;
}

test('every Git argv has an explicit repository or clone working directory', () => {
  const implicit = readdirSync(scripts).filter((p) => p.endsWith('.js') && p !== 'git-argv.js')
    .flatMap((p) => [...readFileSync(`${scripts}/${p}`, 'utf8').matchAll(/gitArgv\(([^\n]*)/g)]
      .filter((m) => !m[1].includes("'-C',")).map(() => p));
  expect(implicit).toEqual([]);
});

test('capture Git ignores injected config filters and repository redirects', () => {
  const repo = fixture();
  const marker = `${root}/filter-ran`;
  writeFileSync(`${repo}/.gitattributes`, '* filter=attack\n');
  writeFileSync(`${repo}/a`, 'edit\n');
  const injected = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'filter.attack.clean',
    GIT_CONFIG_VALUE_0: `touch '${marker}'; cat` };
  // Negative control: Git status really executes this environment-provided filter.
  const old = Bun.spawnSync(gitArgv('-C', repo, 'status', '--porcelain'), { env: injected });
  expect(old.exitCode, old.stderr.toString()).toBe(0);
  expect(existsSync(marker)).toBe(true);
  rmSync(marker);
  const code = `import { sourceIdentity } from ${JSON.stringify(`${scripts}/capture-identity.js`)};
console.log(JSON.stringify(sourceIdentity({repo:process.argv[1],head:'HEAD',base:'HEAD'})));`;
  for (const env of [injected, { ...injected, GIT_DIR: `${root}/missing`, GIT_WORK_TREE: root,
    GIT_INDEX_FILE: `${root}/missing-index`, GIT_OBJECT_DIRECTORY: `${root}/missing-objects` }]) {
    const result = Bun.spawnSync([process.execPath, '--no-env-file', '-e', code, repo], { cwd: root, env });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(JSON.parse(result.stdout.toString()).repository).toBe('fixture:peer');
    expect(existsSync(marker)).toBe(false);
  }
});

test.each(['pr-shape', 'run-init'])('%s inspects an explicit repo from a trusted cwd', (helper) => {
  const repo = fixture();
  const args = helper === 'pr-shape' ? ['--proof', '--repo', repo, '--base', 'HEAD', '--head', 'HEAD']
    : ['--repo', repo, '--slug', 'explicit', '--date', '20261008'];
  const result = Bun.spawnSync([process.execPath, '--no-env-file', `${scripts}/${helper}.js`, ...args],
    { cwd: root, env: { ...process.env, TMPDIR: root } });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const data = JSON.parse(result.stdout.toString());
  if (helper === 'pr-shape') expect(data.terms.every(t => t.status === 'pass')).toBe(true);
  else expect(data.inputs.gitCommonDir).toBe(`${repo}/.git`);
});

test('staged-file inspection selects its repository explicitly and refuses an implicit target', () => {
  const repo = fixture();
  const helper = `${scripts}/check-staged-file-tokens.js`;
  const implicit = Bun.spawnSync([process.execPath, helper], { cwd: repo });
  expect(implicit.exitCode).toBe(1);
  expect(implicit.stderr.toString()).toContain('--repo');
  const explicit = Bun.spawnSync([process.execPath, '--no-env-file', helper, '--repo', repo], { cwd: root });
  expect(explicit.exitCode, explicit.stderr.toString()).toBe(0);
  expect(explicit.stdout.toString()).toBe('Staged-file token check passed.\n');
});
