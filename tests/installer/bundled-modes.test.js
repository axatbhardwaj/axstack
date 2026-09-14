import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { makeTempRoot, representativeHostConfig, runCli } from './helpers.js';

const bundle = `${import.meta.dir}/../..`;
test('bundled install gives every configured role full provider access and preserves host settings', () => {
  const root = makeTempRoot();
  const profile = `${root}/paseo.json`;
  const before = representativeHostConfig();
  writeFileSync(profile, JSON.stringify(before));
  const result = runCli(`${bundle}/bin/axstack.js`, [
    'install', '--bundle', bundle, '--skills-dir', `${root}/skills`, '--profile', profile,
  ]);
  expect(result.ok).toBe(true);
  const after = JSON.parse(readFileSync(profile, 'utf8'));
  const owned = after.daemon.agentProfiles.filter(p => p.id.startsWith('axstack-'));
  expect(owned.length).toBe(16);
  for (const role of owned) {
    expect(role.modeId, role.id).toBe(role.provider === 'claude' ? 'bypassPermissions' : 'full-access');
  }
  after.daemon.agentProfiles = after.daemon.agentProfiles.filter(p => !p.id.startsWith('axstack-'));
  expect(after).toEqual(before);
});
