import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');

for (const [preset, provider] of [
  ['mixed', 'codex'],
  ['codex-only', 'codex'],
  ['claude-only', 'claude'],
]) {
  test(`fixture ${preset} installs a selected role snapshot`, () => {
    const root = makeTempRoot();
    const role = { id: 'axstack-driver', name: 'Driver', provider, model: `${provider}-model` };
    const bundle = writeFixtureBundle(root, { presets: { [preset]: [role] } });
    const skillsDir = join(root, 'skills');
    runCli(CLI, [
      'install', '--preset', preset, '--bundle', bundle, '--skills-dir', skillsDir,
    ]);
    expect(JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8'))).toEqual({
      version: 1,
      preset,
      roles: [role],
    });
  });
}
