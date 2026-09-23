import { afterEach, expect, test } from 'bun:test';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
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

async function runParallel(f, paths) {
  const processes = paths.map((path) => Bun.spawn(['bun', script, '--path', path, '--repo-list-file', f.repos, '--worktree-list-file', f.worktrees], {
    env: { ...process.env, HOME: f.home }, stdout: 'pipe', stderr: 'pipe',
  }));
  return Promise.all(processes.map(async (process) => ({ code: await process.exited, stderr: await new Response(process.stderr).text() })));
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

test('parallel preflights preserve every path and concurrent sibling keys', async () => {
  const f = fixture();
  const paths = Array.from({ length: 12 }, (_, i) => join(f.root, `worktree-${i}`));
  writeFileSync(f.worktrees, JSON.stringify({ ok: true, result: { worktrees: paths.map((path) => ({ repoId: 'repo-1', path, hostId: 'local' })) } }));
  writeFileSync(f.config, JSON.stringify({ theme: 'dark', projects: { existing: { note: 'preserve' } } }));
  const results = await runParallel(f, paths);
  for (const result of results) expect(result.code, result.stderr).toBe(0);
  const config = JSON.parse(readFileSync(f.config, 'utf8'));
  expect(config.theme).toBe('dark');
  expect(config.projects.existing).toEqual({ note: 'preserve' });
  for (const path of paths) expect(config.projects[path]?.hasTrustDialogAccepted).toBe(true);
});

test('preserves a separate config key written while preflights wait', async () => {
  const f = fixture();
  const lock = `${f.config}.axstack-lock`;
  writeFileSync(lock, 'test', { flag: 'wx' });
  const paths = [f.repo, f.worktree];
  const processes = paths.map((path) => Bun.spawn(['bun', script, '--path', path, '--repo-list-file', f.repos, '--worktree-list-file', f.worktrees], {
    env: { ...process.env, HOME: f.home }, stdout: 'pipe', stderr: 'pipe',
  }));
  writeFileSync(f.config, JSON.stringify({ sessionState: { active: true } }));
  unlinkSync(lock);
  for (const process of processes) expect(await process.exited).toBe(0);
  const config = JSON.parse(readFileSync(f.config, 'utf8'));
  expect(config.sessionState).toEqual({ active: true });
  for (const path of paths) expect(config.projects[path].hasTrustDialogAccepted).toBe(true);
});

test('refuses folder repos, remote worktrees, malformed config, and truncated inventory', () => {
  const f = fixture();
  writeFileSync(f.config, '{}');
  writeFileSync(f.repos, JSON.stringify({ ok: true, result: { repos: [{ id: 'repo-1', kind: 'folder', path: f.repo }] } }));
  expect(run(f, f.repo).exitCode).not.toBe(0);
  writeFileSync(f.repos, JSON.stringify({ ok: true, result: { repos: [{ id: 'repo-1', kind: 'git', path: f.repo }] } }));
  writeFileSync(f.worktrees, JSON.stringify({ ok: true, result: { worktrees: [{ repoId: 'repo-1', path: f.worktree, hostId: 'remote' }] } }));
  expect(run(f, f.worktree).exitCode).not.toBe(0);
  writeFileSync(f.worktrees, JSON.stringify({ ok: true, result: { worktrees: [], truncated: true } }));
  expect(run(f, f.repo).exitCode).not.toBe(0);
  writeFileSync(f.worktrees, JSON.stringify({ ok: true, result: { worktrees: [] } }));
  writeFileSync(f.config, '{broken');
  expect(run(f, f.repo).exitCode).not.toBe(0);
  expect(readFileSync(f.config, 'utf8')).toBe('{broken');
});

test('launch contract preflights the exact Claude checkout and holds on any remaining prompt', () => {
  const runtime = readFileSync(resolve(import.meta.dir, '../../skills/axstack/references/orca-runtime.md'), 'utf8');
  const automations = readFileSync(resolve(import.meta.dir, '../../skills/axstack/references/automations.md'), 'utf8');
  expect(runtime).toMatch(/from the installed `axstack` skill directory[\s\S]*bun scripts\/trust-path\.js --path <exact checkout path>/i);
  expect(runtime).toMatch(/trust dialog[\s\S]*hold/i);
  expect(automations).toMatch(/\.claude\.json[\s\S]*trust-path\.js[\s\S]*registered/i);
});
