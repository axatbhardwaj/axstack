// Regression coverage at the public CLI seam. Paseo 0.8 accepts an omitted
// model or a string, but rejects null; Axstack's null bundle entry is setup
// data and must never be projected into the host config.
import { expect, test } from 'bun:test';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, representativeHostConfig, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args) => runBunCli(CLI, args);
const EXECUTABLE = {
  id: 'axstack-driver',
  provider: 'example',
  model: 'example-model',
  notes: 'Executable fixture.',
};
const DEFERRED = {
  id: 'axstack-checker',
  provider: 'codex',
  model: null,
  notes: 'Select a model during setup.',
};

function assertPaseo08ModelFields(config) {
  for (const profile of config.daemon.agentProfiles) {
    expect(profile.model === undefined || typeof profile.model === 'string').toBe(true);
  }
}

function fixture(root) {
  return writeFixtureBundle(root, { profiles: [EXECUTABLE, DEFERRED] });
}

test('CLI defers a null-model preset, owns only configured profiles, and stays idempotent', () => {
  const root = makeTempRoot('axstack-deferred-');
  const bundle = fixture(root);
  const skillsDir = join(root, 'skills');
  const profilePath = join(root, 'paseo.json');

  const first = runCli([
    'install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profilePath,
  ]);
  const config = JSON.parse(readFileSync(profilePath, 'utf8'));
  assertPaseo08ModelFields(config);
  expect(config.daemon.agentProfiles.map((profile) => profile.id)).toEqual(['axstack-driver']);
  expect(first.out).toMatch(/axstack-checker/i);
  expect(first.out).toMatch(/defer|setup|select.*model/i);

  const manifestPath = join(skillsDir, '.axstack-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  expect(manifest.profiles.path).toBe(realpathSync(profilePath));
  expect(Object.keys(manifest.profiles.entries)).toEqual(['axstack-driver']);
  expect(
    JSON.parse(readFileSync(join(bundle, 'profiles', 'paseo.json'), 'utf8'))
      .agentProfiles.find((profile) => profile.id === 'axstack-checker').model,
  ).toBeNull();

  const beforeConfig = readFileSync(profilePath, 'utf8');
  const beforeManifest = readFileSync(manifestPath, 'utf8');
  const second = runCli([
    'install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profilePath,
  ]);
  expect(readFileSync(profilePath, 'utf8')).toBe(beforeConfig);
  expect(readFileSync(manifestPath, 'utf8')).toBe(beforeManifest);
  expect(second.out).toMatch(/no changes|idempotent/i);
  expect(second.out).toMatch(/axstack-checker/i);
});

test('CLI preserves a setup-selected checker without acquiring ownership', () => {
  const root = makeTempRoot('axstack-configured-checker-');
  const bundle = fixture(root);
  const skillsDir = join(root, 'skills');
  const profilePath = join(root, 'paseo.json');
  const selected = {
    ...DEFERRED,
    model: 'user-selected-model',
    notes: 'User configured this profile.',
  };
  const host = representativeHostConfig();
  host.daemon.agentProfiles.push(selected);
  writeFileSync(profilePath, JSON.stringify(host, null, 2) + '\n');

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profilePath]);
  const config = JSON.parse(readFileSync(profilePath, 'utf8'));
  assertPaseo08ModelFields(config);
  expect(config.daemon.agentProfiles.find((profile) => profile.id === selected.id)).toEqual(selected);
  const manifest = JSON.parse(
    readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'),
  );
  expect(manifest.profiles.entries['axstack-checker']).toBeUndefined();
});
