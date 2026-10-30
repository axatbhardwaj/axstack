import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { installBundle, uninstallBundle, validateBundle } from '../../src/installer.js';
import { makeTempRoot, writeFixtureBundle } from '../installer/helpers.js';

test('VOA is discovered, installed, byte-checked and retired as an owned skill', async () => {
  const root = makeTempRoot('voa-install-');
  const bundle = writeFixtureBundle(root);
  mkdirSync(`${bundle}/skills/voa/scripts`, { recursive: true });
  writeFileSync(`${bundle}/skills/voa/SKILL.md`, '# VOA\n');
  writeFileSync(`${bundle}/skills/voa/scripts/observe.js`, 'export const readOnly = true;\n');
  mkdirSync(`${bundle}/skills/unrelated`, { recursive: true });
  writeFileSync(`${bundle}/skills/unrelated/SKILL.md`, '# Leave alone\n');
  const files = (await validateBundle(bundle, 'mixed')).files.map((file) => file.rel);
  expect(files).toContain('voa/SKILL.md');
  expect(files).toContain('voa/scripts/observe.js');
  expect(files).not.toContain('unrelated/SKILL.md');
  const skillsDir = `${root}/installed`;
  await installBundle({ bundleDir: bundle, skillsDir, preset: 'mixed', yes: true });
  expect(readFileSync(`${skillsDir}/voa/scripts/observe.js`, 'utf8')).toBe('export const readOnly = true;\n');
  await uninstallBundle({ skillsDir, yes: true });
  expect(existsSync(`${skillsDir}/voa/SKILL.md`)).toBe(false);
});

test('VOA discovery retains symlink and missing skill entry guards', async () => {
  for (const kind of ['symlink', 'missing']) {
    const root = makeTempRoot('voa-unsafe-');
    const bundle = writeFixtureBundle(root);
    if (kind === 'symlink') symlinkSync(root, `${bundle}/skills/voa`);
    else mkdirSync(`${bundle}/skills/voa`);
    await expect(validateBundle(bundle, 'mixed')).rejects.toThrow(/symlink|missing SKILL/);
  }
});
