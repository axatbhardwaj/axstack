import { afterEach, expect, test } from 'bun:test';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { exportSource } from '../../skills/axstack/sandbox/launcher-source.js';
import { fixture } from './sandbox-launcher-fixture.js';

const scratch = [];
afterEach(() => { for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function setup() {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-source-`); chmodSync(root, 0o700); scratch.push(root);
  const repo = `${root}/repo`; mkdirSync(repo);
  const git = (...a) => {
    const r = Bun.spawnSync(['git', '-C', repo, ...a], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: `${root}/gitconfig` } });
    if (r.exitCode) throw Error(r.stderr.toString()); return r.stdout.toString().trim();
  };
  writeFileSync(`${root}/gitconfig`, ''); git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  const p = { ...fixture(), policy: { sourceMaxBytes: 1048576 }, sourceExport: { path: `${root}/export`, maxBytes: 1048576 } };
  p.request = { ...p.request, repo };
  const commit = () => { git('add', '-A'); git('commit', '-qm', 'fixture'); p.request.head = git('rev-parse', 'HEAD'); p.request.base = p.request.head; };
  const execute = async argv => {
    const r = Bun.spawnSync(argv, { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: `${root}/gitconfig` } });
    return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr.toString() };
  };
  // ls-tree text, cat-file binary; production runner uses the same distinction.
  const runner = async (argv, options) => { const r = await execute(argv); if (!options?.binary) r.stdout = r.stdout.toString(); return r; };
  return { root, repo, p, git, commit, runner };
}
test('source export uses requested tracked blobs without ignored files, dependencies or checkout secrets', async () => {
  const h = setup();
  writeFileSync(`${h.repo}/ok`, 'committed'); writeFileSync(`${h.repo}/.gitignore`, '.secret\n');
  mkdirSync(`${h.repo}/node_modules`); writeFileSync(`${h.repo}/node_modules/dep`, 'dependency'); h.commit();
  writeFileSync(`${h.repo}/ok`, 'dirty'); writeFileSync(`${h.repo}/.secret`, 'secret'); writeFileSync(`${h.repo}/untracked`, 'secret');
  await exportSource(h.p, h.runner);
  expect(readdirSync(h.p.sourceExport.path).sort()).toEqual(['.gitignore', 'ok']);
  expect(readFileSync(`${h.p.sourceExport.path}/ok`, 'utf8')).toBe('committed');
  expect(lstatSync(`${h.p.sourceExport.path}/ok`).mode & 0o222).toBe(0);
});
test('escaping links, LFS and source-cap exhaustion hold before writing an export', async () => {
  for (const kind of ['link', 'lfs', 'cap']) {
    const h = setup();
    if (kind === 'link') symlinkSync('../../.ssh/id', `${h.repo}/escape`);
    else writeFileSync(`${h.repo}/file`, kind === 'lfs' ? 'version https://git-lfs.github.com/spec/v1\n' : 'large');
    h.commit(); if (kind === 'cap') h.p.sourceExport.maxBytes = 1;
    await expect(exportSource(h.p, h.runner)).rejects.toMatchObject({ sandboxHold: true });
    expect(() => lstatSync(h.p.sourceExport.path)).toThrow();
  }
});
test('symlink expansion happens before dot-dot traversal, including an in-tree alias to dot', async () => {
  const h = setup();
  symlinkSync('.', `${h.repo}/alias`);
  symlinkSync('alias/../host-secret', `${h.repo}/escape`);
  h.commit();
  await expect(exportSource(h.p, h.runner)).rejects.toMatchObject({ sandboxHold: true });
});

test('absolute symlink targets hold before an export can expose a host file', async () => {
  const h = setup();
  writeFileSync(`${h.root}/host-file`, 'synthetic private fixture');
  symlinkSync(`${h.root}/host-file`, `${h.repo}/absolute`); h.commit();
  await expect(exportSource(h.p, h.runner)).rejects.toMatchObject({ sandboxHold: true });
  expect(() => lstatSync(h.p.sourceExport.path)).toThrow();
});

test('a changed gitlink pin holds instead of silently omitting the new submodule dependency', async () => {
  const h = setup(); writeFileSync(`${h.repo}/ok`, 'fixture'); h.commit();
  const first = h.p.request.head;
  mkdirSync(`${h.repo}/public-submodule`);
  h.git('update-index', '--add', '--cacheinfo', `160000,${first},public-submodule`);
  h.git('commit', '-qm', 'baseline submodule pin'); const base = h.git('rev-parse', 'HEAD');
  h.git('update-index', '--cacheinfo', `160000,${base},public-submodule`);
  h.git('commit', '-qm', 'changed submodule pin');
  h.p.request.base = base; h.p.request.head = h.git('rev-parse', 'HEAD');
  await expect(exportSource(h.p, h.runner)).rejects.toMatchObject({ sandboxHold: true });
  expect(() => lstatSync(h.p.sourceExport.path)).toThrow();
});

test('a symlink cycle reports a hold rather than silently succeeding without an export', async () => {
  const h = setup(); symlinkSync('b', `${h.repo}/a`); symlinkSync('a', `${h.repo}/b`); h.commit();
  await expect(exportSource(h.p, h.runner)).rejects.toMatchObject({ sandboxHold: true });
  expect(() => lstatSync(h.p.sourceExport.path)).toThrow();
});
