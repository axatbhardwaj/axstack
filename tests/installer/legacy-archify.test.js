import { expect, test } from 'bun:test';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { planArchifyRelease } from '../../src/archify-legacy.js';
import { writeAtomic } from '../../src/installer.js';
import { archifyFixture, git } from './archify-fixture.js';

// Characterization of the existing owner-release transaction, not provisioning.
function seeded() {
  const f = archifyFixture();
  mkdirSync(f.tools);
  cpSync(f.repo, f.copy, { recursive: true });
  writeFileSync(f.owners, JSON.stringify([f.skills]) + '\n');
  const logs = [];
  const release = () => planArchifyRelease({ record: { path: f.copy, sha: f.sha },
    skillsRoot: f.skills, writeAtomic, log: (line) => logs.push(line) });
  return { ...f, logs, release };
}

test('legacy release commits only this root and deletes an unchanged unshared copy', async () => {
  const f = seeded();
  const tx = await f.release();
  expect(JSON.parse(readFileSync(f.owners))).toEqual([]);
  expect(existsSync(f.copy)).toBe(true); // destructive work waits for the manifest
  await tx.finish();
  expect(existsSync(f.copy)).toBe(false);
  expect(existsSync(f.owners)).toBe(false);
  await (await f.release()).finish();
  expect(f.logs.at(-1)).toContain('owner is absent');
});

test('legacy owner rollback restores the exact previous bytes', async () => {
  const f = seeded();
  const before = readFileSync(f.owners);
  const tx = await f.release();
  await tx.rollback();
  expect(readFileSync(f.owners)).toEqual(before);
  expect(existsSync(f.copy)).toBe(true);
});

test('legacy shared copy keeps other roots and reports why it is retained', async () => {
  const f = seeded();
  const other = `${f.root}/other`;
  writeFileSync(f.owners, JSON.stringify([f.skills, other]));
  await (await f.release()).finish();
  expect(JSON.parse(readFileSync(f.owners))).toEqual([other]);
  expect(existsSync(f.copy)).toBe(true);
  expect(f.logs.at(-1)).toContain('other skills roots');
});

for (const change of ['tracked', 'untracked', 'ignored', 'head']) {
  test(`legacy release retains ${change} changes`, async () => {
    const f = seeded();
    if (change === 'head') git(f.copy, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      'commit', '--allow-empty', '-qm', 'changed');
    else writeFileSync(`${f.copy}/archify/${change === 'tracked' ? 'LICENSE' : change === 'ignored' ? 'ignored.txt' : 'extra'}`, 'edited');
    await (await f.release()).finish();
    expect(existsSync(f.copy)).toBe(true);
    expect(JSON.parse(readFileSync(f.owners))).toEqual([]);
    expect(f.logs.at(-1)).toContain('kept');
  });
}

for (const gap of ['copy', 'owners', 'git']) {
  test(`legacy release reports missing ${gap} safely`, async () => {
    const f = seeded();
    if (gap === 'copy') rmSync(f.copy, { recursive: true });
    if (gap === 'owners') rmSync(f.owners);
    const before = Bun.env.PATH;
    try {
      if (gap === 'git') { mkdirSync(`${f.root}/empty`); Bun.env.PATH = `${f.root}/empty`; }
      await (await f.release()).finish();
    } finally { Bun.env.PATH = before; }
    expect(f.logs.at(-1)).toContain('kept');
    if (gap !== 'copy') expect(existsSync(f.copy)).toBe(true);
  });
}

for (const invalid of ['json', 'owner', 'symlink']) {
  test(`legacy release refuses ${invalid} metadata before mutation`, async () => {
    const f = seeded();
    if (invalid === 'symlink') {
      rmSync(f.owners);
      writeFileSync(`${f.root}/sentinel`, 'keep');
      symlinkSync(`${f.root}/sentinel`, f.owners);
    } else writeFileSync(f.owners, invalid === 'json' ? '{' : '["relative"]');
    const before = readFileSync(f.owners);
    await expect(f.release()).rejects.toThrow();
    expect(readFileSync(f.owners)).toEqual(before);
    expect(existsSync(f.copy)).toBe(true);
  });
}
