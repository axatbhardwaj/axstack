// Profile merge bookkeeping against the REAL host schema:
// profiles live at config.daemon.agentProfiles (bundle file keeps top-level
// agentProfiles). Preserve custom profiles, unrelated daemon fields and
// top-level keys; handle absent config; reject malformed config without
// mutation; retain user edits; pristine owned profiles upgrade without
// --force; uninstall removes only unchanged owned profiles.
import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import {
  mergeProfiles,
  planUninstallProfiles,
} from '../../src/profiles.js';
import { hashObject } from '../../src/manifest.js';
import { makeTempRoot, representativeHostConfig, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

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
  expect(ids).toEqual(['axstack-driver', 'custom-mine']);
  expect(config.daemon.schedules).toEqual([{ id: 'daily-check', cron: '0 9 * * *' }]);
  expect(config.daemon.notifications).toEqual({ level: 'all' });
  expect(config.cliClientId).toBe('fixture-client-id');
  expect(report.added.includes('axstack-driver')).toBe(true);
  // inputs are never mutated
  expect(existing.daemon.agentProfiles.map((p) => p.id)).toEqual(['custom-mine']);
});

test('merge handles absent config by creating host-shaped config', () => {
  const { config, report } = mergeProfiles(null, BUNDLE_PROFILES, {});
  expect(Array.isArray(config.daemon.agentProfiles)).toBe(true);
  expect(config.daemon.agentProfiles.some((p) => p.id === 'axstack-driver')).toBe(true);
  expect(report.created).toBe(true);
});

test('merge rejects malformed daemon config without mutation', () => {
  const badShapes = [
    { daemon: { agentProfiles: 'nope' } },
    { daemon: 'nope' },
    { daemon: { agentProfiles: [{ id: 'custom-mine' }] }, version: 1 },
  ];
  expect(() => mergeProfiles(badShapes[0], BUNDLE_PROFILES, {})).toThrow(/malformed|invalid/i);
  expect(() => mergeProfiles(badShapes[1], BUNDLE_PROFILES, {})).toThrow(/malformed|invalid/i);
  // well-formed host config merges fine and keeps the custom profile
  const { config } = mergeProfiles(badShapes[2], BUNDLE_PROFILES, {});
  expect(config.daemon.agentProfiles.some((p) => p.id === 'custom-mine')).toBe(true);
  expect(badShapes[0]).toEqual({ daemon: { agentProfiles: 'nope' } });
});

test('merge retains user edits to an owned profile instead of replacing', () => {
  const existing = hostWith([{ ...BUNDLE_PROFILES[0], model: 'user-choice' }]);
  const { config, report } = mergeProfiles(existing, BUNDLE_PROFILES, {});
  expect(
    config.daemon.agentProfiles.find((p) => p.id === 'axstack-driver').model,
  ).toBe('user-choice');
  expect(report.preserved.includes('axstack-driver')).toBe(true);
});

test('pristine owned profile upgrades to newer bundle version without force', () => {
  const installed = { ...BUNDLE_PROFILES[0], model: 'v1-model' };
  const existing = hostWith([installed]);
  const newer = [{ ...BUNDLE_PROFILES[0], model: 'v2-model' }];
  const owned = { 'axstack-driver': hashObject(installed) };
  const { config, report } = mergeProfiles(existing, newer, { owned });
  expect(
    config.daemon.agentProfiles.find((p) => p.id === 'axstack-driver').model,
  ).toBe('v2-model');
  expect(report.updated).toEqual(['axstack-driver']);
});

test('user-edited owned profile is preserved without force, replaced with force', () => {
  const pristine = { ...BUNDLE_PROFILES[0], model: 'v1-model' };
  const edited = { ...BUNDLE_PROFILES[0], model: 'user-choice' };
  const newer = [{ ...BUNDLE_PROFILES[0], model: 'v2-model' }];
  const owned = { 'axstack-driver': hashObject(pristine) };

  const kept = mergeProfiles(hostWith([edited]), newer, { owned });
  expect(
    kept.config.daemon.agentProfiles.find((p) => p.id === 'axstack-driver').model,
  ).toBe('user-choice');
  expect(kept.report.preserved).toEqual(['axstack-driver']);

  const forced = mergeProfiles(hostWith([edited]), newer, { owned, force: true });
  expect(
    forced.config.daemon.agentProfiles.find((p) => p.id === 'axstack-driver').model,
  ).toBe('v2-model');
  expect(forced.report.updated).toEqual(['axstack-driver']);
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
  expect(ids).toEqual(['axstack-edited', 'custom-mine']);
  expect(report.removed).toEqual(['axstack-driver']);
  expect(report.preserved).toEqual(['axstack-edited']);
});

test('CLI profile install preserves custom profiles and daemon fields end to end', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');
  writeFileSync(profile, JSON.stringify(representativeHostConfig()));
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  const after = JSON.parse(readFileSync(profile, 'utf8'));
  const ids = after.daemon.agentProfiles.map((p) => p.id).sort();
  expect(ids).toEqual(['axstack-driver', 'custom-mine']);
  expect(after.daemon.schedules).toEqual([{ id: 'daily-check', cron: '0 9 * * *' }]);
  expect(after.cliClientId).toBe('fixture-client-id');
});
