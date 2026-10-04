import { expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { archifyFixture } from './archify-fixture.js';

test('default tools directory uses HOME and needs confirmation', () => {
  const f = archifyFixture();
  const home = join(f.root, 'home');
  mkdirSync(home);
  const args = [f.BUN_BIN, f.cli, 'install', '--preset', 'mixed', '--bundle', f.bundle,
    '--skills-dir', f.skills, '--no-claude-settings'];
  const spawn = (extra) => Bun.spawnSync([...args, ...extra], {
    env: { ...Bun.env, HOME: home, AXSTACK_ARCHIFY_REPO: f.repo }, stdout: 'pipe', stderr: 'pipe',
  });
  const refused = spawn([]);
  expect(refused.exitCode).toBe(1);
  expect(refused.stderr.toString()).toMatch(/tools directory.*home.*--yes/);
  expect(existsSync(f.skills)).toBe(false);
  const accepted = spawn(['--yes']);
  expect(accepted.exitCode).toBe(0);
  expect(JSON.parse(readFileSync(f.record)).path).toBe(join(home, '.axstack', 'tools', `archify-${f.sha}`));
});

test('tools directory canonicalizes dot segments and refuses owners symlinks', () => {
  const f = archifyFixture();
  f.install(['--tools-dir', join(f.tools, 'nested', '..')]);
  expect(JSON.parse(readFileSync(f.record)).path).toBe(f.copy);
  const second = join(f.root, 'second-skills');
  const nextTools = join(f.root, 'next-tools');
  mkdirSync(nextTools);
  const victim = join(f.root, 'sentinel');
  writeFileSync(victim, 'keep\n');
  symlinkSync(victim, join(nextTools, `archify-${f.sha}.owners.json`));
  expect(f.install(['--skills-dir', second, '--tools-dir', nextTools], { expectFail: true }).out).toMatch(/unsafe archify owners/);
  expect(readFileSync(victim, 'utf8')).toBe('keep\n');
  expect(existsSync(second)).toBe(false);
});

test('Git-less install updates skills and preserves an existing tool binding', () => {
  const f = archifyFixture();
  f.install();
  const before = readFileSync(f.record);
  writeFileSync(join(f.bundle, 'skills', 'axstack-demo', 'SKILL.md'), '# Updated offline\n');
  const emptyBin = join(f.root, 'empty-bin');
  mkdirSync(emptyBin);
  expect(f.install([], { env: { PATH: emptyBin } }).out).toContain('archify: unavailable (');
  expect(readFileSync(f.record)).toEqual(before);
  expect(readFileSync(join(f.skills, 'axstack-demo', 'SKILL.md'), 'utf8')).toBe('# Updated offline\n');
});

test('failed pinned checkout removes the temporary clone and still installs skills', () => {
  const f = archifyFixture();
  writeFileSync(f.pinFile, readFileSync(f.pinFile, 'utf8').replace(f.sha, 'a'.repeat(40)));
  expect(f.install().out).toContain('archify: unavailable (');
  expect(readdirSync(f.tools)).toEqual([]);
  expect(existsSync(join(f.skills, 'axstack-demo', 'SKILL.md'))).toBe(true);
});

test('owner write failure after rename rolls back both the new copy and owner file', () => {
  const f = archifyFixture();
  const installer = join(f.pkg, 'src', 'installer.js');
  writeFileSync(installer, readFileSync(installer, 'utf8').replace('await chmod(dest, finalMode);',
    "if (dest.endsWith('.owners.json')) throw new Error('fixture chmod failure');\n    await chmod(dest, finalMode);"));
  expect(f.install([], { expectFail: true }).out).toContain('fixture chmod failure');
  expect(existsSync(f.copy)).toBe(false);
  expect(existsSync(f.owners)).toBe(false);
});

test('an owner restore failure still removes a newly created copy', () => {
  const f = archifyFixture();
  mkdirSync(f.tools);
  const before = JSON.stringify([join(f.root, 'prior-owner')]) + '\n';
  writeFileSync(f.owners, before);
  const installer = join(f.pkg, 'src', 'installer.js');
  writeFileSync(installer, readFileSync(installer, 'utf8').replace('await chmod(dest, finalMode);',
    "if (dest.endsWith('.owners.json')) throw new Error('fixture chmod failure');\n    await chmod(dest, finalMode);"));
  f.install([], { expectFail: true });
  expect(existsSync(f.copy)).toBe(false);
  expect(readFileSync(f.owners, 'utf8')).toBe(before);
});

for (const existing of [false, true]) {
  test(`manifest failure after rename restores ${existing ? 'existing' : 'absent'} ownership state`, () => {
    const f = archifyFixture();
    if (existing) f.install();
    const manifest = join(f.skills, '.axstack-manifest.json');
    const before = existing ? readFileSync(manifest) : null;
    const owners = existing ? readFileSync(f.owners) : null;
    const module = join(f.pkg, 'src', 'manifest.js');
    writeFileSync(module, readFileSync(module, 'utf8').replace('await chmod(dest, existingMode ?? 0o600);',
      "throw new Error('fixture manifest chmod failure');"));
    const nextTools = join(f.root, 'next-tools');
    expect(f.install(['--tools-dir', nextTools], { expectFail: true }).out).toContain('fixture manifest chmod failure');
    expect(existsSync(manifest) ? readFileSync(manifest) : null).toEqual(before);
    expect(existsSync(f.owners) ? readFileSync(f.owners) : null).toEqual(owners);
    expect(existsSync(join(nextTools, `archify-${f.sha}`))).toBe(false);
    expect(existsSync(f.copy)).toBe(existing);
  });
}

test('a post-clone SHA verification mismatch fails and discards the clone', () => {
  const f = archifyFixture();
  const bin = join(f.root, 'lying-git');
  mkdirSync(bin);
  const realGit = Bun.which('git');
  writeFileSync(join(bin, 'git'), `#!/bin/sh\nif [ "$3" = rev-parse ]; then echo ${'b'.repeat(40)}; exit 0; fi\nexec '${realGit}' "$@"\n`);
  chmodSync(join(bin, 'git'), 0o755);
  expect(f.install([], { expectFail: true, env: { PATH: bin } }).out).toContain('archify SHA mismatch');
  expect(existsSync(f.copy)).toBe(false);
  expect(existsSync(f.skills)).toBe(false);
  expect(readdirSync(f.tools)).toEqual([]);
});
