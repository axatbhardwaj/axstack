import { afterEach, expect, test } from 'bun:test';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from '../../src/posixpath.js';

const script = resolve(import.meta.dir, '../../skills/axstack/scripts/trust-path.js');
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(process.env.AXSTACK_TEST_TMPDIR ?? process.env.TMPDIR ?? '/tmp', 'trust-path-'));
  roots.push(root);
  const home = join(root, 'home');
  mkdirSync(home);
  const repo = join(root, 'repo');
  const worktree = join(root, 'worktree');
  const unrelated = join(root, 'unrelated');
  const repos = join(root, 'repos.json');
  const worktrees = join(root, 'worktrees.json');
  writeFileSync(repos, JSON.stringify({ ok: true, result: { repos: [{ id: 'repo-1', kind: 'git', path: repo }] } }));
  writeFileSync(worktrees, JSON.stringify({ ok: true, result: { worktrees: [{ repoId: 'repo-1', path: worktree, hostId: 'local' }] } }));
  return { root, home, repo, worktree, unrelated, repos, worktrees, config: join(home, '.claude.json') };
}

function run(f, path) {
  return Bun.spawnSync(['bun', script, '--path', path, '--repo-list-file', f.repos, '--worktree-list-file', f.worktrees], {
    env: { ...process.env, HOME: f.home }, stdout: 'pipe', stderr: 'pipe',
  });
}

test('trusts an exact registered root and worktree while preserving unrelated settings and mode', () => {
  const f = fixture();
  const original = { theme: 'dark', projects: { other: { allowedTools: ['Read'] }, [f.repo]: { note: 'keep' } } };
  writeFileSync(f.config, JSON.stringify(original));
  chmodSync(f.config, 0o640);
  for (const path of [f.repo, f.worktree]) {
    const result = run(f, path);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  }
  const actual = JSON.parse(readFileSync(f.config, 'utf8'));
  expect(actual.theme).toBe('dark');
  expect(actual.projects.other).toEqual(original.projects.other);
  expect(actual.projects[f.repo]).toEqual({ note: 'keep', hasTrustDialogAccepted: true });
  expect(actual.projects[f.worktree].hasTrustDialogAccepted).toBe(true);
  expect(lstatSync(f.config).mode & 0o777).toBe(0o640);
});

test('already trusted is a byte-for-byte no-op', () => {
  const f = fixture();
  const bytes = JSON.stringify({ projects: { [f.repo]: { hasTrustDialogAccepted: true } } });
  writeFileSync(f.config, bytes);
  const before = lstatSync(f.config);
  expect(run(f, f.repo).exitCode).toBe(0);
  expect(readFileSync(f.config, 'utf8')).toBe(bytes);
  expect(lstatSync(f.config).ino).toBe(before.ino);
});

test('creates a missing config privately and refuses failed inventory', () => {
  const f = fixture();
  expect(run(f, f.repo).exitCode).toBe(0);
  expect(lstatSync(f.config).mode & 0o777).toBe(0o600);
  rmSync(f.config);
  writeFileSync(f.repos, JSON.stringify({ ok: false, result: { repos: [] } }));
  expect(run(f, f.repo).exitCode).not.toBe(0);
  expect(() => lstatSync(f.config)).toThrow();
});

test('refuses unregistered, relative, and symlinked config paths', () => {
  const f = fixture();
  writeFileSync(f.config, '{}');
  for (const path of [f.unrelated, 'relative']) {
    expect(run(f, path).exitCode).not.toBe(0);
    expect(readFileSync(f.config, 'utf8')).toBe('{}');
  }
  rmSync(f.config);
  const target = join(f.root, 'target.json');
  writeFileSync(target, '{}');
  symlinkSync(target, f.config);
  expect(run(f, f.repo).exitCode).not.toBe(0);
  expect(readFileSync(target, 'utf8')).toBe('{}');
});

test('launch contract preflights the exact Claude checkout and holds on any remaining prompt', () => {
  const runtime = readFileSync(resolve(import.meta.dir, '../../skills/axstack/references/orca-runtime.md'), 'utf8');
  const automations = readFileSync(resolve(import.meta.dir, '../../skills/axstack/references/automations.md'), 'utf8');
  expect(runtime).toMatch(/before launching a Claude worker[\s\S]*trust-path\.js[\s\S]*exact checkout path/i);
  expect(runtime).toMatch(/trust dialog[\s\S]*hold/i);
  expect(automations).toMatch(/\.claude\.json[\s\S]*trust-path\.js[\s\S]*registered/i);
});
