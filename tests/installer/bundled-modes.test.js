import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { makeTempRoot, representativeHostConfig, runCli } from './helpers.js';

const bundle = `${import.meta.dir}/../..`;
for (const [preset, configuredCount] of [
  ['mixed', 16],
  ['codex-only', 17],
  ['claude-only', 17],
]) {
  test(`bundled ${preset} install configures ${configuredCount} roles with provider access`, () => {
    const root = makeTempRoot();
    const profile = `${root}/paseo.json`;
    const before = representativeHostConfig();
    writeFileSync(profile, JSON.stringify(before));
    const result = runCli(`${bundle}/bin/axstack.js`, [
      'install', '--preset', preset, '--bundle', bundle,
      '--skills-dir', `${root}/skills`, '--profile', profile,
    ]);
    expect(result.ok).toBe(true);
    const after = JSON.parse(readFileSync(profile, 'utf8'));
    const owned = after.daemon.agentProfiles.filter(p => p.id.startsWith('axstack-'));
    expect(owned.length).toBe(configuredCount);
    for (const role of owned) {
      expect(role.modeId, role.id).toBe(role.provider === 'claude' ? 'bypassPermissions' : 'full-access');
    }
    after.daemon.agentProfiles = after.daemon.agentProfiles.filter(p => !p.id.startsWith('axstack-'));
    expect(after).toEqual(before);
  });
}
