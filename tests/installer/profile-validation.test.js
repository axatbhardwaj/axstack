import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);
const VALID = {
  id: 'axstack-driver',
  name: 'Axstack driver',
  provider: 'example',
  model: 'example-model',
  icon: 'sparkles',
  color: 'blue',
  modeId: 'default',
  thinkingOptionId: 'medium',
  featureValues: { sandbox: true },
  notes: 'Valid native profile fixture.',
};

const invalidProfiles = [
  ['missing model', ({ model: _model, ...profile }) => profile],
  ['empty model', (profile) => ({ ...profile, model: '' })],
  ['number model', (profile) => ({ ...profile, model: 7 })],
  ['missing name', ({ name: _name, ...profile }) => profile],
  ['number name', (profile) => ({ ...profile, name: 7 })],
  ['missing provider', ({ provider: _provider, ...profile }) => profile],
  ['number provider', (profile) => ({ ...profile, provider: 7 })],
  ['number icon', (profile) => ({ ...profile, icon: 7 })],
  ['number color', (profile) => ({ ...profile, color: 7 })],
  ['number modeId', (profile) => ({ ...profile, modeId: 7 })],
  ['number thinkingOptionId', (profile) => ({ ...profile, thinkingOptionId: 7 })],
  ['array featureValues', (profile) => ({ ...profile, featureValues: [] })],
  ['number notes', (profile) => ({ ...profile, notes: 7 })],
];

test('CLI rejects malformed outgoing native profiles before target writes', () => {
  for (const [label, mutate] of invalidProfiles) {
    const root = makeTempRoot('axstack-profile-validation-');
    const bundle = writeFixtureBundle(root, {
      profiles: [mutate({ ...VALID })],
    });
    const skillsDir = join(root, 'skills-target');
    const profilePath = join(root, 'paseo.json');
    const result = runCli(
      ['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profilePath],
      { expectFail: true },
    );

    expect(result.out, label).toMatch(/invalid bundle profiles/i);
    expect(existsSync(skillsDir), label).toBe(false);
    expect(existsSync(profilePath), label).toBe(false);
  }
});
