import { afterEach, describe, expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { installBundle, uninstallBundle } from '../../src/installer.js';
import { readManifest } from '../../src/manifest.js';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, writeFixtureBundle } from './helpers.js';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = makeTempRoot('ax-instruction-txn-');
  roots.push(root);
  return {
    root,
    bundle: writeFixtureBundle(root),
    skills: join(root, 'skills'),
    instructions: join(root, 'AGENTS.md'),
  };
}

describe('instruction transactions', () => {
  test('detects an instruction edit after planning and performs no partial write', async () => {
    const { bundle, skills, instructions } = fixture();
    writeFileSync(instructions, 'planned bytes');
    await expect(installBundle({
      bundleDir: bundle,
      skillsDir: skills,
      preset: 'mixed',
      instructionsPath: instructions,
      log(message) {
        if (message === 'plan complete') writeFileSync(instructions, 'concurrent bytes');
      },
    })).rejects.toThrow(/changed since planning/i);
    expect(readFileSync(instructions, 'utf8')).toBe('concurrent bytes');
    expect(existsSync(skills)).toBe(false);
  });

  test('manifest failure rolls an appended instruction file back byte-for-byte', async () => {
    const { bundle, skills, instructions } = fixture();
    writeFileSync(instructions, 'personal bytes');
    chmodSync(instructions, 0o600);
    mkdirSync(skills);
    writeFileSync(join(skills, '.axstack-manifest.json.tmp'), 'planted');
    await expect(installBundle({ bundleDir: bundle, skillsDir: skills, preset: 'mixed', instructionsPath: instructions })).rejects.toThrow(/temporary file already exists/i);
    expect(readFileSync(instructions, 'utf8')).toBe('personal bytes');
    expect(lstatSync(instructions).mode & 0o777).toBe(0o600);
    expect(existsSync(join(skills, 'axstack-demo', 'SKILL.md'))).toBe(false);
  });

  test('uninstall restores original bytes exactly and leaves the instruction file', async () => {
    for (const original of ['', 'no trailing newline', 'one trailing newline\n']) {
      const { bundle, skills, instructions } = fixture();
      writeFileSync(instructions, original);
      chmodSync(instructions, 0o600);
      await installBundle({ bundleDir: bundle, skillsDir: skills, preset: 'mixed', instructionsPath: instructions });
      const summary = await uninstallBundle({ skillsDir: skills, instructionsPath: instructions });
      expect(summary.instructions.status).toBe('removed');
      expect(readFileSync(instructions, 'utf8')).toBe(original);
      expect(lstatSync(instructions).mode & 0o777).toBe(0o600);
    }
  });

  test('uninstall preserves an edited owned block and keeps its binding', async () => {
    const { bundle, skills, instructions } = fixture();
    await installBundle({ bundleDir: bundle, skillsDir: skills, preset: 'mixed', instructionsPath: instructions });
    const edited = readFileSync(instructions, 'utf8').replace('engineering work', 'all work');
    writeFileSync(instructions, edited);
    const summary = await uninstallBundle({ skillsDir: skills, instructionsPath: instructions });
    expect(summary.instructions.status).toBe('conflict');
    expect(readFileSync(instructions, 'utf8')).toBe(edited);
    expect((await readManifest(skills)).instructions.path).toBe(instructions);
  });

  test('uninstall manifest failure restores every prior byte and file mode', async () => {
    const { bundle, skills, instructions } = fixture();
    writeFileSync(instructions, 'personal bytes');
    await installBundle({ bundleDir: bundle, skillsDir: skills, preset: 'mixed', instructionsPath: instructions });

    const skill = join(skills, 'axstack-demo', 'SKILL.md');
    const roles = join(skills, 'axstack', 'roles.json');
    const manifest = join(skills, '.axstack-manifest.json');
    chmodSync(skill, 0o700);
    writeFileSync(roles, `${readFileSync(roles, 'utf8')}\nuser edit`);
    const before = {
      instruction: readFileSync(instructions),
      skill: readFileSync(skill),
      roles: readFileSync(roles),
      manifest: readFileSync(manifest),
      skillMode: lstatSync(skill).mode & 0o777,
    };
    writeFileSync(join(skills, '.axstack-manifest.json.tmp'), 'planted');

    await expect(uninstallBundle({ skillsDir: skills, instructionsPath: instructions }))
      .rejects.toThrow(/temporary file already exists/i);
    expect(readFileSync(instructions)).toEqual(before.instruction);
    expect(readFileSync(skill)).toEqual(before.skill);
    expect(readFileSync(roles)).toEqual(before.roles);
    expect(readFileSync(manifest)).toEqual(before.manifest);
    expect(lstatSync(skill).mode & 0o777).toBe(before.skillMode);
  });
});
