import { expect, test } from 'bun:test';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hashContent } from '../../src/manifest.js';
import { archifyFixture } from './archify-fixture.js';

function legacy() {
  const f = archifyFixture();
  mkdirSync(f.tools);
  cpSync(f.repo, f.copy, { recursive: true });
  mkdirSync(`${f.skills}/axstack-diagram`, { recursive: true });
  const record = JSON.stringify({ path: f.copy, sha: f.sha }) + '\n';
  writeFileSync(f.record, record);
  writeFileSync(f.owners, JSON.stringify([f.skills]) + '\n');
  writeFileSync(`${f.skills}/axstack-diagram/SKILL.md`, '# Old diagram\n');
  writeFileSync(`${f.skills}/.axstack-manifest.json`, JSON.stringify({ version: 1,
    files: { 'axstack-diagram/archify.json': hashContent(Buffer.from(record)),
      'axstack-diagram/SKILL.md': hashContent(Buffer.from('# Old diagram\n')) },
    archify: { path: f.copy, sha: f.sha }, profiles: { path: null, entries: {} } }));
  return f;
}

test('fresh install writes no tool record, manifest field or tools directory', () => {
  const f = archifyFixture();
  f.install();
  expect(existsSync(f.record)).toBe(false);
  expect(JSON.parse(readFileSync(`${f.skills}/.axstack-manifest.json`))).not.toHaveProperty('archify');
  expect(existsSync(f.tools)).toBe(false);
});

test('same-path upgrade releases legacy ownership and removes stale diagram files', () => {
  const f = legacy();
  expect(f.install().out).toContain('archify: removed');
  expect(existsSync(f.copy)).toBe(false);
  expect(existsSync(f.record)).toBe(false);
  expect(existsSync(`${f.skills}/axstack-diagram/SKILL.md`)).toBe(false);
  expect(JSON.parse(readFileSync(`${f.skills}/.axstack-manifest.json`))).not.toHaveProperty('archify');
  expect(f.install().out).toContain('no changes');
});

for (const record of ['edited', 'unowned']) {
  test(`upgrade preserves ${record} legacy record with its path`, () => {
    const f = legacy();
    const manifest = `${f.skills}/.axstack-manifest.json`;
    if (record === 'edited') writeFileSync(f.record, 'user record\n');
    else {
      const data = JSON.parse(readFileSync(manifest));
      delete data.files['axstack-diagram/archify.json'];
      writeFileSync(manifest, JSON.stringify(data));
    }
    const before = readFileSync(f.record);
    expect(f.install().out).toContain('axstack-diagram/archify.json');
    expect(readFileSync(f.record)).toEqual(before);
    expect(existsSync(f.copy)).toBe(true);
  });
}

test('obsolete tools-dir fails explicitly before any write', () => {
  const f = archifyFixture();
  expect(f.install(['--tools-dir', f.tools], { expectFail: true }).out).toMatch(/--tools-dir is obsolete/);
  expect(existsSync(f.skills)).toBe(false);
});

test('check has no retired tool row', () => {
  const f = archifyFixture();
  mkdirSync(`${f.root}/empty-bin`);
  const result = f.run(['check', '--skills-dir', f.skills], { expectFail: true, env: { PATH: `${f.root}/empty-bin` } });
  expect(result.out).not.toMatch(/archify|Chrome/);
});

test('manifest failure rolls back legacy owners and stale files', () => {
  const f = legacy();
  const owners = readFileSync(f.owners), manifest = readFileSync(`${f.skills}/.axstack-manifest.json`);
  const module = `${f.pkg}/src/manifest.js`;
  writeFileSync(module, readFileSync(module, 'utf8').replace('await chmod(dest, existingMode ?? 0o600);',
    "throw new Error('fixture manifest failure');"));
  expect(f.install([], { expectFail: true }).out).toContain('fixture manifest failure');
  expect(readFileSync(f.owners)).toEqual(owners);
  expect(readFileSync(`${f.skills}/.axstack-manifest.json`)).toEqual(manifest);
  expect(existsSync(f.record)).toBe(true);
  expect(existsSync(f.copy)).toBe(true);
});

test('direct uninstall of an old manifest releases its recorded copy', () => {
  const f = legacy();
  expect(f.run(['uninstall', '--skills-dir', f.skills, '--no-claude-settings']).out).toContain('archify: removed');
  expect(existsSync(f.copy)).toBe(false);
});

test('uninstall reports an edited legacy record and preserves its retry binding', () => {
  const f = legacy();
  writeFileSync(f.record, 'user-edited legacy record\n');
  const result = f.run(['uninstall', '--skills-dir', f.skills, '--no-claude-settings']);
  expect(result.out).toContain(`archify: kept ${f.copy} (preserved record ${f.record})`);
  const manifest = JSON.parse(readFileSync(`${f.skills}/.axstack-manifest.json`));
  expect(manifest.archify).toEqual({ path: f.copy, sha: f.sha });
  expect(readFileSync(f.record, 'utf8')).toBe('user-edited legacy record\n');
  expect(JSON.parse(readFileSync(f.owners))).toEqual([f.skills]);
});

test('forced retry after preserved legacy record releases ownership and copy', () => {
  const f = legacy();
  writeFileSync(f.record, 'user-edited legacy record\n');
  f.run(['uninstall', '--skills-dir', f.skills, '--no-claude-settings']);
  const result = f.run(['uninstall', '--skills-dir', f.skills, '--no-claude-settings', '--force']);
  expect(result.out).toContain('archify: removed');
  expect(existsSync(f.copy)).toBe(false);
  expect(existsSync(f.owners)).toBe(false);
  expect(existsSync(f.record)).toBe(false);
  expect(existsSync(`${f.skills}/.axstack-manifest.json`)).toBe(false);
});

test('help keeps the install target free of obsolete tools-root constraints', () => {
  const f = archifyFixture();
  const result = f.run(['--help']);
  expect(result.out).toContain('--skills-dir <dir>');
  expect(result.out).not.toContain('Must be outside skills roots and contain no symlink path.');
});
