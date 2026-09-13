// Profile merge bookkeeping against the REAL host schema:
// profiles live at config.daemon.agentProfiles (bundle file keeps top-level
// agentProfiles). Preserve custom profiles, unrelated daemon fields and
// top-level keys; handle absent config; reject malformed config without
// mutation; retain user edits; pristine owned profiles upgrade without
// --force; uninstall removes only unchanged owned profiles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeProfiles,
  planUninstallProfiles,
} from '../../src/profiles.js';
import { hashObject } from '../../src/manifest.js';
import { makeTempRoot, representativeHostConfig, writeFixtureBundle } from './helpers.js';

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

function hostWith(profiles) {
  const host = representativeHostConfig();
  host.daemon.agentProfiles = profiles;
  return host;
}

test('merge preserves custom profiles, daemon fields and top-level keys', () => {
  const existing = representativeHostConfig();
  const { config, report } = mergeProfiles(existing, BUNDLE_PROFILES, {});
  const ids = config.daemon.agentProfiles.map((p) => p.id).sort();
  assert.deepEqual(ids, ['axstack-driver', 'custom-mine']);
  assert.deepEqual(config.daemon.schedules, [{ id: 'daily-check', cron: '0 9 * * *' }]);
  assert.deepEqual(config.daemon.notifications, { level: 'all' });
  assert.equal(config.cliClientId, 'fixture-client-id');
  assert.ok(report.added.includes('axstack-driver'));
  // inputs are never mutated
  assert.deepEqual(existing.daemon.agentProfiles.map((p) => p.id), ['custom-mine']);
});

test('merge handles absent config by creating host-shaped config', () => {
  const { config, report } = mergeProfiles(null, BUNDLE_PROFILES, {});
  assert.ok(Array.isArray(config.daemon.agentProfiles));
  assert.ok(config.daemon.agentProfiles.some((p) => p.id === 'axstack-driver'));
  assert.ok(report.created);
});

test('merge rejects malformed daemon config without mutation', () => {
  const badShapes = [
    { daemon: { agentProfiles: 'nope' } },
    { daemon: 'nope' },
    { daemon: { agentProfiles: [{ id: 'custom-mine' }] }, version: 1 },
  ];
  assert.throws(
    () => mergeProfiles(badShapes[0], BUNDLE_PROFILES, {}),
    /malformed|invalid/i,
  );
  assert.throws(
    () => mergeProfiles(badShapes[1], BUNDLE_PROFILES, {}),
    /malformed|invalid/i,
  );
  // well-formed host config merges fine and keeps the custom profile
  const { config } = mergeProfiles(badShapes[2], BUNDLE_PROFILES, {});
  assert.ok(config.daemon.agentProfiles.some((p) => p.id === 'custom-mine'));
  assert.deepEqual(badShapes[0], { daemon: { agentProfiles: 'nope' } });
});

test('merge retains user edits to an owned profile instead of replacing', () => {
  const existing = hostWith([{ ...BUNDLE_PROFILES[0], model: 'user-choice' }]);
  const { config, report } = mergeProfiles(existing, BUNDLE_PROFILES, {});
  assert.equal(
    config.daemon.agentProfiles.find((p) => p.id === 'axstack-driver').model,
    'user-choice',
  );
  assert.ok(report.preserved.includes('axstack-driver'));
});

test('pristine owned profile upgrades to newer bundle version without force', () => {
  const installed = { ...BUNDLE_PROFILES[0], model: 'v1-model' };
  const existing = hostWith([installed]);
  const newer = [{ ...BUNDLE_PROFILES[0], model: 'v2-model' }];
  const owned = { 'axstack-driver': hashObject(installed) };
  const { config, report } = mergeProfiles(existing, newer, { owned });
  assert.equal(
    config.daemon.agentProfiles.find((p) => p.id === 'axstack-driver').model,
    'v2-model',
  );
  assert.deepEqual(report.updated, ['axstack-driver']);
});

test('user-edited owned profile is preserved without force, replaced with force', () => {
  const pristine = { ...BUNDLE_PROFILES[0], model: 'v1-model' };
  const edited = { ...BUNDLE_PROFILES[0], model: 'user-choice' };
  const newer = [{ ...BUNDLE_PROFILES[0], model: 'v2-model' }];
  const owned = { 'axstack-driver': hashObject(pristine) };

  const kept = mergeProfiles(hostWith([edited]), newer, { owned });
  assert.equal(
    kept.config.daemon.agentProfiles.find((p) => p.id === 'axstack-driver').model,
    'user-choice',
  );
  assert.deepEqual(kept.report.preserved, ['axstack-driver']);

  const forced = mergeProfiles(hostWith([edited]), newer, { owned, force: true });
  assert.equal(
    forced.config.daemon.agentProfiles.find((p) => p.id === 'axstack-driver').model,
    'v2-model',
  );
  assert.deepEqual(forced.report.updated, ['axstack-driver']);
});

test('uninstall plan removes only unchanged owned profiles', () => {
  const existing = hostWith([
    { ...BUNDLE_PROFILES[0] },
    { id: 'axstack-edited', provider: 'x' },
    { id: 'custom-mine', provider: 'x' },
  ]);
  const manifest = {
    profiles: {
      'axstack-driver': 'hash-of-pristine',
      'axstack-edited': 'hash-of-pristine',
    },
  };
  const { config, report } = planUninstallProfiles(existing, manifest, {
    hash: (p) =>
      p.id === 'axstack-driver' ? 'hash-of-pristine' : 'hash-of-something-else',
  });
  const ids = config.daemon.agentProfiles.map((p) => p.id).sort();
  assert.deepEqual(ids, ['axstack-edited', 'custom-mine']);
  assert.deepEqual(report.removed, ['axstack-driver']);
  assert.deepEqual(report.preserved, ['axstack-edited']);
});

test('CLI profile install preserves custom profiles and daemon fields end to end', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');
  writeFileSync(profile, JSON.stringify(representativeHostConfig()));
  execFileSync(process.execPath, [CLI, 'install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile], { encoding: 'utf8' });
  const after = JSON.parse(readFileSync(profile, 'utf8'));
  const ids = after.daemon.agentProfiles.map((p) => p.id).sort();
  assert.deepEqual(ids, ['axstack-driver', 'custom-mine']);
  assert.deepEqual(after.daemon.schedules, [{ id: 'daily-check', cron: '0 9 * * *' }]);
  assert.equal(after.cliClientId, 'fixture-client-id');
});
