import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/hooks-check.js`;
let root;
afterEach(() => {
  if (root) rmSync(root, { recursive: true });
  root = undefined;
});

function fixture() {
  root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/hooks-check-`);
  const repo = `${root}/checkout`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  for (const scope of ['GLOBAL', 'SYSTEM']) {
    const filename = `${root}/gitconfig-${scope}`;
    writeFileSync(filename, '');
    env[`GIT_CONFIG_${scope}`] = filename;
  }
  // Keep real Git reads isolated even after the helper scrubs inherited GIT_*.
  const bin = `${root}/bin`;
  mkdirSync(bin);
  env.HOOKS_TEST_GIT = Bun.which('git');
  env.HOOKS_TEST_ROOT = root;
  writeFileSync(`${bin}/git`, [
    '#!/bin/sh',
    'GIT_CONFIG_GLOBAL="$HOOKS_TEST_ROOT/gitconfig-GLOBAL" GIT_CONFIG_SYSTEM="$HOOKS_TEST_ROOT/gitconfig-SYSTEM" exec "$HOOKS_TEST_GIT" "$@"',
  ].join('\n'), { mode: 0o700 });
  const git = (...args) => {
    const result = Bun.spawnSync(['git', '-C', repo, ...args], { env });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  };
  const run = (...args) => Bun.spawnSync([process.execPath, '--no-env-file', script, ...args], {
    cwd: root, env: { ...env, PATH: `${bin}:${env.PATH}` },
  });
  mkdirSync(repo);
  git('init', '-q');
  const husky = () => {
    mkdirSync(`${repo}/.husky`);
    writeFileSync(`${repo}/.husky/pre-commit`, '#!/bin/sh\nexit 1\n');
    git('add', '.husky/pre-commit');
  };
  const check = () => {
    const result = run('--repo', repo);
    const terms = Object.fromEntries(JSON.parse(result.stdout.toString()).terms.map((term) => [term.id, term]));
    return { exit: result.exitCode, terms };
  };
  return { repo, git, husky, check, run, env };
}

test('holds when a worktree hook is a dangling symlink', () => {
  const { repo, git, husky, check } = fixture();
  husky();
  git('config', 'core.hooksPath', '.husky/_');
  git('config', 'extensions.worktreeConfig', 'true');
  git('config', '--worktree', 'core.hooksPath', '.dvandva/githooks');
  mkdirSync(`${repo}/.dvandva/githooks`, { recursive: true });
  const missing = `${root}/missing-binary`;
  symlinkSync(missing, `${repo}/.dvandva/githooks/pre-commit`);
  const { exit, terms } = check();
  expect(terms['pre-commit'].status).toBe('fail');
  expect(JSON.stringify(terms['pre-commit'].evidence)).toContain(missing);
  expect(terms['hooks-dir'].evidence.coreHooksPath).toBe('.dvandva/githooks');
  expect(exit).toBe(2);
});

test('holds when Husky is declared and its generated hooks directory is missing', () => {
  const { git, husky, check } = fixture();
  husky();
  git('config', 'core.hooksPath', '.husky/_');
  const { exit, terms } = check();
  expect(terms['hooks-dir'].status).toBe('fail');
  expect(terms.declared.evidence.tools).toEqual([{ tool: 'husky', source: '.husky/pre-commit' }]);
  expect(exit).toBe(2);
});

test('passes with executable hooks without running them and holds if execution is disabled', () => {
  const { repo, git, husky, check } = fixture();
  husky();
  git('config', 'core.hooksPath', '.husky/_');
  mkdirSync(`${repo}/.husky/_`);
  const hook = `${repo}/.husky/_/pre-commit`;
  writeFileSync(hook, '#!/bin/sh\nexit 42\n', { mode: 0o700 });
  const { exit, terms } = check();
  expect(exit).toBe(0);
  expect(Object.values(terms).map((term) => term.status)).toEqual(['pass', 'pass', 'pass']);
  chmodSync(hook, 0o600);
  expect(check().terms['pre-commit'].status).toBe('fail');
});

test('preserves the filesystem traversal Git uses to find hooks', () => {
  const { repo, git, husky, check } = fixture();
  husky();
  chmodSync(`${repo}/.husky/pre-commit`, 0o700);
  git('config', 'core.hooksPath', 'missing/../.husky');
  expect(check().terms['hooks-dir'].status).toBe('fail');
});

test('reports only tool and source for manifest, Lefthook and pre-commit declarations', () => {
  const { repo, check } = fixture();
  writeFileSync(`${repo}/package.json`, JSON.stringify({ packageManager: 'npm@11', husky: { hooks: { 'pre-commit': 'lint' } } }));
  writeFileSync(`${repo}/.lefthook.yaml`, '');
  writeFileSync(`${repo}/.pre-commit-config.yml`, '');
  expect(check().terms.declared.evidence.tools).toEqual([
    { tool: 'husky', source: 'package.json' },
    { tool: 'lefthook', source: '.lefthook.yaml' },
    { tool: 'pre-commit', source: '.pre-commit-config.yml' },
  ]);
});

test('holds for a configured dangling hook without a declared tool', () => {
  const { repo, git, check } = fixture();
  git('config', 'core.hooksPath', '.custom/hooks');
  mkdirSync(`${repo}/.custom/hooks`, { recursive: true });
  const missing = `${root}/missing-hook`;
  symlinkSync(missing, `${repo}/.custom/hooks/pre-commit`);
  const { exit, terms } = check();
  expect(exit).toBe(2);
  expect(terms.declared.status).toBe('n/a');
  expect(terms['hooks-dir'].status).toBe('pass');
  expect(terms['pre-commit'].status).toBe('fail');
  expect(terms['pre-commit'].evidence.target).toBe(missing);
});

test('checks a configured hooks directory even without a declared tool', () => {
  const { repo, git, check } = fixture();
  git('config', 'core.hooksPath', 'project-hooks');
  const missing = check();
  expect(missing.exit).toBe(2);
  expect(missing.terms['hooks-dir'].status).toBe('fail');
  mkdirSync(`${repo}/project-hooks`);
  const path = `${repo}/project-hooks/pre-commit`;
  writeFileSync(path, '#!/bin/sh\nexit 1\n', { mode: 0o600 });
  const nonExecutable = check();
  expect(nonExecutable.exit).toBe(2);
  expect(nonExecutable.terms['pre-commit'].status).toBe('fail');
  chmodSync(path, 0o700);
  expect(check().exit).toBe(0);
});

test('holds when core.hooksPath is explicitly empty', () => {
  const { git, check } = fixture();
  git('config', 'core.hooksPath', '');
  const { exit, terms } = check();
  expect(exit).toBe(2);
  expect(terms['hooks-dir']).toMatchObject({ status: 'unknown', evidence: { coreHooksPath: '' } });
});

test('ignores GIT_DIR pointing at another checkout', () => {
  const { git, check, husky, env } = fixture();
  husky();
  git('config', 'core.hooksPath', 'missing');
  const other = `${root}/elsewhere`;
  git('init', '-q', other);
  git('-C', other, 'config', 'core.hooksPath', `${other}/hooks`);
  mkdirSync(`${other}/hooks`);
  writeFileSync(`${other}/hooks/pre-commit`, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  const expected = check();
  expect(expected.exit).toBe(2);
  env.GIT_DIR = `${other}/.git`;
  expect(check()).toEqual(expected);
});

test('reports all criteria n/a with no declared tool and no configured hooks path', () => {
  const { check } = fixture();
  const { exit, terms } = check();
  expect(exit).toBe(0);
  expect(Object.values(terms).map((term) => term.status)).toEqual(['n/a', 'n/a', 'n/a']);
});

test('documents --repo and rejects a path outside Git', () => {
  const { run } = fixture();
  const help = run('--help');
  expect(help.exitCode).toBe(0);
  expect(help.stdout.toString()).toContain('--repo');
  const failure = run('--repo', root);
  expect(failure.exitCode).toBe(1);
  expect(failure.stdout.toString()).toContain('unknown');
  expect(JSON.parse(failure.stdout.toString()).inputs.repo).toBe(root);
});
