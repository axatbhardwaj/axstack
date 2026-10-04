import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { archifyFixture, git } from './archify-fixture.js';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

test('install pins a sparse copy, owns its record, and converges without writes', () => {
  const f = archifyFixture();
  f.install();
  expect(json(f.record)).toEqual({ path: f.copy, sha: f.sha });
  expect(git(f.copy, 'rev-parse', 'HEAD')).toBe(f.sha);
  expect(existsSync(join(f.copy, 'outside'))).toBe(false);
  expect(existsSync(join(f.copy, 'archify', 'LICENSE'))).toBe(true);
  expect(existsSync(join(f.copy, 'archify', 'THIRD_PARTY_NOTICES.md'))).toBe(true);
  expect(json(f.owners)).toEqual([f.skills]);
  expect(json(join(f.skills, '.axstack-manifest.json')).files['axstack-diagram/archify.json']).toBeDefined();
  const before = [f.record, f.owners].map((path) => statSync(path).mtimeMs);
  expect(f.install().out).toContain('no changes');
  expect([f.record, f.owners].map((path) => statSync(path).mtimeMs)).toEqual(before);
});

test('unreachable upstream installs skills and reports unavailable with exit zero', () => {
  const f = archifyFixture();
  const result = f.install([], { env: { AXSTACK_ARCHIFY_REPO: join(f.root, 'absent') } });
  expect(result.out).toContain('archify: unavailable (');
  expect(existsSync(join(f.skills, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(existsSync(f.record)).toBe(false);
  expect(existsSync(f.copy)).toBe(false);
});

test('tools paths cannot overlap skills or pass through a symlink', () => {
  const f = archifyFixture();
  for (const path of [f.skills, join(f.skills, 'tools'), f.root]) {
    const result = f.install(['--tools-dir', path], { expectFail: true });
    expect(result.out).toMatch(/overlap/i);
    expect(existsSync(f.record)).toBe(false);
  }
  mkdirSync(f.tools);
  const alias = join(f.root, 'alias');
  symlinkSync(f.tools, alias);
  expect(f.install(['--tools-dir', join(alias, 'nested')], { expectFail: true }).out).toMatch(/symlink/i);
});

test('shared owners retain the copy until the last skills root leaves', () => {
  const f = archifyFixture();
  f.install();
  const second = join(f.root, 'second-skills');
  f.install(['--skills-dir', second]);
  expect(json(f.owners)).toEqual([second, f.skills].sort());
  f.run(['uninstall', '--skills-dir', f.skills, '--no-claude-settings']);
  expect(json(f.owners)).toEqual([second]);
  expect(existsSync(f.copy)).toBe(true);
  const result = f.run(['uninstall', '--skills-dir', second, '--no-claude-settings']);
  expect(result.out).toContain('archify: removed');
  expect(existsSync(f.copy)).toBe(false);
  expect(existsSync(f.owners)).toBe(false);
});

for (const change of ['tracked', 'untracked', 'ignored', 'head']) {
  test(`last uninstall keeps a copy with ${change} changes`, () => {
    const f = archifyFixture();
    f.install();
    if (change === 'head') {
      git(f.copy, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'different HEAD');
    } else {
      const file = change === 'tracked' ? 'LICENSE' : change === 'ignored' ? 'ignored.txt' : 'user.txt';
      writeFileSync(join(f.copy, 'archify', file), 'user bytes\n');
    }
    expect(f.run(['uninstall', '--skills-dir', f.skills, '--no-claude-settings', '--force']).out).toContain('archify: kept');
    expect(existsSync(f.copy)).toBe(true);
    expect(json(f.owners)).toEqual([]);
  });
}

test('changing tools directory and bumping the pin releases each old clean copy', () => {
  const f = archifyFixture();
  f.install();
  const nextTools = join(f.root, 'next-tools');
  f.install(['--tools-dir', nextTools]);
  expect(existsSync(f.copy)).toBe(false);
  const secondCopy = json(f.record).path;
  writeFileSync(join(f.repo, 'archify', 'LICENSE'), 'new licence\n');
  git(f.repo, 'add', '.');
  git(f.repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'new pin');
  const nextSha = git(f.repo, 'rev-parse', 'HEAD');
  writeFileSync(f.pinFile, readFileSync(f.pinFile, 'utf8').replace(f.sha, nextSha));
  f.install(['--tools-dir', nextTools]);
  expect(existsSync(secondCopy)).toBe(false);
  expect(json(f.record)).toEqual({ path: join(nextTools, `archify-${nextSha}`), sha: nextSha });
});

test('mismatched existing HEAD fails without changing the skills or owners', () => {
  const f = archifyFixture();
  f.install();
  const before = readFileSync(f.owners);
  git(f.copy, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'different HEAD');
  expect(f.install([], { expectFail: true }).out).toContain('archify SHA mismatch');
  expect(readFileSync(f.owners)).toEqual(before);
});

for (const failure of ['owners', 'manifest']) {
  test(`${failure} write failure removes only this install's new copy and restores owners`, () => {
    const f = archifyFixture();
    if (failure === 'owners') {
      mkdirSync(f.tools);
      writeFileSync(f.owners, JSON.stringify([join(f.root, 'previous-owner')]) + '\n');
      // A separate CLI gives an exact PID only at runtime. Block its temp
      // creation with a fixture prelude in the disposable entry point.
      writeFileSync(f.cli, readFileSync(f.cli, 'utf8').replace("await main();",
        `await Bun.write(${JSON.stringify(f.owners)} + '.tmp-' + process.pid, 'sentinel');\nawait main();`));
    } else {
      mkdirSync(f.skills);
      writeFileSync(join(f.skills, '.axstack-manifest.json.tmp'), 'sentinel');
    }
    const before = existsSync(f.owners) ? readFileSync(f.owners) : null;
    expect(f.install([], { expectFail: true }).out).toMatch(/temporary file already exists/);
    expect(existsSync(f.copy)).toBe(false);
    expect(existsSync(join(f.skills, 'axstack-demo', 'SKILL.md'))).toBe(false);
    expect(existsSync(f.owners) ? readFileSync(f.owners) : null).toEqual(before);
    expect(readdirSync(f.tools).filter((name) => name.startsWith('.archify-'))).toEqual([]);
  });
}
