import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli, writeFixtureBundle } from './helpers.js';
import { prohibits, requires } from '../workflows/prose-contract.js';

const CLI = join(import.meta.dir, '..', '..', 'bin', 'axstack.js');
// Exercise the installed instruction boundary, including real manifest bytes.
// This proves the declared route is usable, not a live agent routing decision.
for (const legacy of [null, 'claude-only']) {
  test(`F3: installed preset remains the routing source with legacy preset ${legacy}`, () => {
    const home = makeTempRoot('axstack-installed-routing-');
    const routing = readFileSync(join(import.meta.dir, '../../skills/axstack/references/routing.md'), 'utf8');
    const bundle = writeFixtureBundle(home, { supportFiles: { 'routing.md': routing } });
    const skillsDir = join(home, 'installed');
    runCli(CLI, ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir, '--yes'],
      { env: { HOME: home } });
    const manifestPath = join(skillsDir, '.axstack-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.profiles.preset).toBeNull();
    if (legacy !== null) {
      manifest.profiles.preset = legacy;
      writeFileSync(manifestPath, JSON.stringify(manifest));
    }
    const snapshot = JSON.parse(readFileSync(join(skillsDir, 'axstack/roles.json'), 'utf8'));
    expect(snapshot.preset).toBe('mixed');
    const instruction = readFileSync(join(skillsDir, 'axstack-demo/routing.md'), 'utf8');
    expect(requires(instruction, /new runs/i, /preset/i, /skills\/axstack\/roles\.json/i)).toBe(true);
    expect(requires(instruction, /legacy manifest/i, /profiles\.preset/i, /inert/i, /ignored/i, /stale/i)).toBe(true);
    expect(prohibits(instruction, /does not create/i, /stale.*manifest/i, /contradiction/i)).toBe(true);
  });
}
