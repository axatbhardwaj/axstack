import { afterEach, describe, expect, test } from 'bun:test';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { installBundle } from '../../src/installer.js';
import { renderInstructionBlock } from '../../src/instructions.js';
import { hashContent, readManifest } from '../../src/manifest.js';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, writeFixtureBundle } from './helpers.js';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = makeTempRoot('ax-instructions-');
  roots.push(root);
  return { root, bundle: writeFixtureBundle(root), skills: join(root, 'skills') };
}

function installOptions(bundle, skills, instructionsPath, extra = {}) {
  return { bundleDir: bundle, skillsDir: skills, preset: 'mixed', instructionsPath, ...extra };
}

describe('installer-owned instruction file', () => {
  test('creates a missing file and binds its canonical path and block hash', async () => {
    const { root, bundle, skills } = fixture();
    const instructions = join(root, 'config', 'AGENTS.md');
    const summary = await installBundle(installOptions(bundle, skills, instructions));
    const block = renderInstructionBlock(skills);
    expect(readFileSync(instructions, 'utf8')).toBe(block);
    expect(summary.instructions).toMatchObject({ status: 'created', path: instructions });
    expect((await readManifest(skills)).instructions).toEqual({
      path: instructions,
      hash: hashContent(block),
      separation: '',
    });
  });

  test('appends to an unmarked file once while preserving outside bytes and mode', async () => {
    const { root, bundle, skills } = fixture();
    const instructions = join(root, 'AGENTS.md');
    writeFileSync(instructions, 'personal bytes');
    chmodSync(instructions, 0o600);
    const first = await installBundle(installOptions(bundle, skills, instructions));
    expect(readFileSync(instructions, 'utf8')).toBe(`personal bytes\n\n${renderInstructionBlock(skills)}`);
    expect(lstatSync(instructions).mode & 0o777).toBe(0o600);
    expect(first.instructions.status).toBe('updated');
    const second = await installBundle(installOptions(bundle, skills, instructions));
    expect(second.instructions.status).toBe('unchanged');
  });

  test('upgrades pristine owned blocks and preserves edited owned blocks as conflicts', async () => {
    const { root, bundle, skills } = fixture();
    const instructions = join(root, 'AGENTS.md');
    const old = renderInstructionBlock('/old/skills');
    writeFileSync(instructions, old);
    mkdirSync(skills, { recursive: true });
    writeFileSync(join(skills, '.axstack-manifest.json'), JSON.stringify({
      version: 1,
      files: {},
      profiles: { path: null, entries: {} },
      instructions: { path: instructions, hash: hashContent(old), separation: '' },
    }));
    const upgraded = await installBundle(installOptions(bundle, skills, instructions));
    expect(upgraded.instructions.status).toBe('updated');
    expect(readFileSync(instructions, 'utf8')).toBe(renderInstructionBlock(skills));

    writeFileSync(instructions, readFileSync(instructions, 'utf8').replace('engineering work', 'all work'));
    const edited = readFileSync(instructions, 'utf8');
    const conflict = await installBundle(installOptions(bundle, skills, instructions));
    expect(conflict.instructions.status).toBe('conflict');
    expect(readFileSync(instructions, 'utf8')).toBe(edited);
  });

  test('never adopts an existing unowned block, including with force', async () => {
    const { root, bundle, skills } = fixture();
    const instructions = join(root, 'AGENTS.md');
    const existing = renderInstructionBlock('/someone/else');
    writeFileSync(instructions, existing);
    const summary = await installBundle(installOptions(bundle, skills, instructions, { force: true }));
    expect(summary.instructions.status).toBe('conflict');
    expect(readFileSync(instructions, 'utf8')).toBe(existing);
    expect((await readManifest(skills)).instructions).toEqual({ path: null, hash: null });
  });

  test('refuses malformed markers and symlinked instruction paths before any write', async () => {
    for (const unsafe of ['duplicate', 'nested', 'incomplete', 'symlink']) {
      const { root, bundle, skills } = fixture();
      const instructions = join(root, 'config', 'AGENTS.md');
      mkdirSync(join(root, 'config'), { recursive: true });
      const block = renderInstructionBlock(skills);
      if (unsafe === 'duplicate') writeFileSync(instructions, `${block}\n${block}`);
      if (unsafe === 'nested') writeFileSync(instructions, `<!-- axstack:begin v1 -->\n${block}\n<!-- axstack:end -->`);
      if (unsafe === 'incomplete') writeFileSync(instructions, '<!-- axstack:begin v1 -->\nno end');
      if (unsafe === 'symlink') {
        const real = join(root, 'real');
        mkdirSync(real);
        rmSync(join(root, 'config'), { recursive: true });
        symlinkSync(real, join(root, 'config'));
      }
      await expect(installBundle(installOptions(bundle, skills, instructions))).rejects.toThrow(/marker|symlink/i);
      expect(lstatSync(skills, { throwIfNoEntry: false })).toBeUndefined();
    }
  });

  test('old manifests normalize without changing legacy file/profile hashes', async () => {
    const { skills } = fixture();
    mkdirSync(skills, { recursive: true });
    writeFileSync(join(skills, '.axstack-manifest.json'), JSON.stringify({
      version: 1,
      files: { 'axstack-demo/SKILL.md': 'file-hash' },
      profiles: { 'axstack-driver': 'profile-hash' },
    }));
    expect(await readManifest(skills)).toEqual({
      version: 1,
      files: { 'axstack-demo/SKILL.md': 'file-hash' },
      profiles: { path: null, preset: null, entries: { 'axstack-driver': 'profile-hash' } },
      claudeSettings: { path: null },
      instructions: { path: null, hash: null },
    });
  });
});
