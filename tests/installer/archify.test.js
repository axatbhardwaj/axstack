import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, statSync, symlinkSync } from 'node:fs';
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
