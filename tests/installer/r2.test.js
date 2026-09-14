import { expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { readManifest } from '../../src/manifest.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

test('manifest symlink is rejected before mutations', async () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  runCli(['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir]);
  const manifest = join(skillsDir, '.axstack-manifest.json');
  const elsewhere = join(root, 'elsewhere.json');
  writeFileSync(elsewhere, '{}\n');
  rmSync(manifest);
  symlinkSync(elsewhere, manifest);
  expect(runCli(['uninstall', '--skills-dir', skillsDir], { expectFail: true }).out)
    .toMatch(/symlink|unsafe|refus/i);
  await expect(readManifest(skillsDir)).rejects.toThrow(/symlink|unsafe|refus/i);
});

test('malformed manifests are rejected with shape errors', async () => {
  const mk = (obj) => {
    const dir = makeTempRoot();
    writeFileSync(join(dir, '.axstack-manifest.json'), JSON.stringify(obj));
    return dir;
  };
  await expect(readManifest(mk({ version: 2, files: {}, profiles: {} }))).rejects.toThrow(/version/i);
  await expect(readManifest(mk({ version: 1, files: [], profiles: {} }))).rejects.toThrow(/files/i);
  await expect(readManifest(mk({ version: 1, files: { '../evil': 'abc' } }))).rejects.toThrow(/unsafe|path/i);
});

test('manifest-write failure keeps pre-run state and reports the failure', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  runCli(['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir]);
  const before = readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8');
  mkdirSync(join(skillsDir, '.axstack-manifest.json.tmp'));
  const result = runCli([
    'install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir,
  ], { expectFail: true });
  expect(result.out).toMatch(/manifest|temporary/i);
  expect(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8')).toBe(before);
});

test('gh-stack probe requires the real gh stack command', () => {
  const root = makeTempRoot();
  const fakeBin = join(root, 'bin');
  mkdirSync(fakeBin, { recursive: true });
  const gh = join(fakeBin, 'gh');
  writeFileSync(gh, '#!/bin/sh\n[ "$1" = "--version" ] && exit 0\nexit 1\n');
  chmodSync(gh, 0o755);
  const result = runCli(['check'], { expectFail: true, env: { PATH: fakeBin } });
  expect(result.out).toMatch(/MISSING.*gh stack extension/);
});

test('option values beginning with -- fail before mutation', () => {
  const root = makeTempRoot();
  const result = runCli([
    'install', '--preset', 'mixed', '--bundle', '--skills-dir', join(root, 'skills'),
  ], { expectFail: true, cwd: root });
  expect(result.out).toMatch(/requires a value/i);
  expect(existsSync(join(root, 'skills'))).toBe(false);
});
