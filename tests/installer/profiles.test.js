// Profile merge bookkeeping: preserve custom profiles and unrelated daemon
// fields, handle absent config, reject malformed config without mutation,
// retain user edits, remove only unchanged owned profiles on uninstall.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeProfiles, planUninstallProfiles } from '../../src/profiles.js';
import { makeTempRoot, writeFixtureBundle } from './helpers.js';

const CLI = fileURLToPath(new URL('../../bin/axstack.js', import.meta.url));

const BUNDLE_PROFILES = [
  {
    id: 'axstack-driver',
    provider: 'example',
    model: 'example-model',
    modeId: 'default',
    thinkingOptionId: 'medium',
    notes: 'Fixture profile.',
  },
];

test('merge preserves custom profiles and unrelated daemon fields', () => {
  const existing = {
    version: 1,
    daemon: { schedules: ['a'] },
    agentProfiles: [{ id: 'custom-mine', provider: 'x', model: 'y' }],
  };
  const { config, report } = mergeProfiles(existing, BUNDLE_PROFILES, {});
  const ids = config.agentProfiles.map((p) => p.id).sort();
  assert.deepEqual(ids, ['axstack-driver', 'custom-mine']);
  assert.deepEqual(config.daemon, { schedules: ['a'] });
  assert.ok(report.added.includes('axstack-driver'));
});

test('merge handles absent config by creating it', () => {
  const { config, report } = mergeProfiles(null, BUNDLE_PROFILES, {});
  assert.equal(config.version, 1);
  assert.ok(config.agentProfiles.some((p) => p.id === 'axstack-driver'));
  assert.ok(report.created);
});

test('merge rejects malformed config without mutation', () => {
  const malformed = { version: 1, agentProfiles: 'nope' };
  assert.throws(() => mergeProfiles(malformed, BUNDLE_PROFILES, {}), /malformed|invalid/i);
  assert.deepEqual(malformed, { version: 1, agentProfiles: 'nope' });
});

test('merge retains user edits to an owned profile instead of replacing', () => {
  const existing = {
    version: 1,
    agentProfiles: [{ ...BUNDLE_PROFILES[0], model: 'user-choice' }],
  };
  const { config, report } = mergeProfiles(existing, BUNDLE_PROFILES, {});
  assert.equal(
    config.agentProfiles.find((p) => p.id === 'axstack-driver').model,
    'user-choice',
  );
  assert.ok(report.preserved.includes('axstack-driver'));
});

test('uninstall plan removes only unchanged owned profiles', () => {
  const existing = {
    version: 1,
    agentProfiles: [
      { ...BUNDLE_PROFILES[0] },
      { id: 'axstack-edited', provider: 'x' },
      { id: 'custom-mine', provider: 'x' },
    ],
  };
  const manifest = {
    profiles: {
      'axstack-driver': 'hash-of-pristine',
      'axstack-edited': 'hash-of-pristine',
    },
    // hashes recorded at install time; edited profile no longer matches
    pristine: { 'axstack-driver': { ...BUNDLE_PROFILES[0] } },
  };
  const { config, report } = planUninstallProfiles(existing, manifest, {
    hash: (p) =>
      p.id === 'axstack-driver' ? 'hash-of-pristine' : 'hash-of-something-else',
  });
  const ids = config.agentProfiles.map((p) => p.id).sort();
  assert.deepEqual(ids, ['axstack-edited', 'custom-mine']);
  assert.deepEqual(report.removed, ['axstack-driver']);
  assert.deepEqual(report.preserved, ['axstack-edited']);
});

test('CLI profile install preserves custom profiles end to end', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');
  writeFileSync(
    profile,
    JSON.stringify({ version: 1, agentProfiles: [{ id: 'custom-mine' }], extra: 1 }),
  );
  execFileSync(process.execPath, [CLI, 'install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile], { encoding: 'utf8' });
  const after = JSON.parse(readFileSync(profile, 'utf8'));
  const ids = after.agentProfiles.map((p) => p.id).sort();
  assert.deepEqual(ids, ['axstack-driver', 'custom-mine']);
  assert.equal(after.extra, 1);
});
