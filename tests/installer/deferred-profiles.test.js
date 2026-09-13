// Regression coverage at the public CLI seam. Paseo 0.8 accepts an omitted
// model or a string, but rejects null; Axstack's null bundle entry is setup
// data and must never be projected into the host config.
import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { hashObject } from '../../src/manifest.js';
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

function writePreviouslyOwnedPlaceholder(skillsDir, profilePath, currentProfiles) {
  mkdirSync(skillsDir, { recursive: true });
  const host = representativeHostConfig();
  host.daemon.agentProfiles.push(...currentProfiles);
  writeFileSync(profilePath, JSON.stringify(host, null, 2) + '\n');
  writeFileSync(
    join(skillsDir, '.axstack-manifest.json'),
    JSON.stringify({
      version: 1,
      files: {},
      profiles: {
        path: realpathSync(profilePath),
        entries: { 'axstack-checker': hashObject(DEFERRED) },
      },
    }, null, 2) + '\n',
  );
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

test('CLI preserves a setup-selected checker without acquiring ownership even with force', () => {
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

  runCli([
    'install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profilePath, '--force',
  ]);
  const config = JSON.parse(readFileSync(profilePath, 'utf8'));
  assertPaseo08ModelFields(config);
  expect(config.daemon.agentProfiles.find((profile) => profile.id === selected.id)).toEqual(selected);
  const manifest = JSON.parse(
    readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'),
  );
  expect(manifest.profiles.entries['axstack-checker']).toBeUndefined();
});

test('CLI removes only an exact previously-owned null placeholder during upgrade', () => {
  const root = makeTempRoot('axstack-owned-placeholder-');
  const bundle = fixture(root);
  const skillsDir = join(root, 'skills');
  const profilePath = join(root, 'paseo.json');
  writePreviouslyOwnedPlaceholder(skillsDir, profilePath, [DEFERRED]);

  const result = runCli([
    'install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profilePath,
  ]);
  const config = JSON.parse(readFileSync(profilePath, 'utf8'));
  assertPaseo08ModelFields(config);
  expect(config.daemon.agentProfiles.some((profile) => profile.id === DEFERRED.id)).toBe(false);
  const manifest = JSON.parse(
    readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'),
  );
  expect(manifest.profiles.entries['axstack-checker']).toBeUndefined();
  expect(result.out).toMatch(/axstack-checker/i);
  expect(result.out).toMatch(/removed|retired|obsolete/i);
});

test('CLI releases stale placeholder ownership when the live entry is already missing', () => {
  const root = makeTempRoot('axstack-missing-placeholder-');
  const bundle = fixture(root);
  const skillsDir = join(root, 'skills');
  const profilePath = join(root, 'paseo.json');
  writePreviouslyOwnedPlaceholder(skillsDir, profilePath, []);

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profilePath]);
  const config = JSON.parse(readFileSync(profilePath, 'utf8'));
  assertPaseo08ModelFields(config);
  expect(config.daemon.agentProfiles.some((profile) => profile.id === DEFERRED.id)).toBe(false);
  const manifest = JSON.parse(
    readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'),
  );
  expect(manifest.profiles.entries['axstack-checker']).toBeUndefined();
});

test('CLI keeps a user-edited previously-owned checker because its hash changed', () => {
  const root = makeTempRoot('axstack-edited-placeholder-');
  const bundle = fixture(root);
  const skillsDir = join(root, 'skills');
  const profilePath = join(root, 'paseo.json');
  const selected = { ...DEFERRED, model: 'user-selected-model' };
  writePreviouslyOwnedPlaceholder(skillsDir, profilePath, [selected]);

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profilePath]);
  const config = JSON.parse(readFileSync(profilePath, 'utf8'));
  expect(config.daemon.agentProfiles.find((profile) => profile.id === DEFERRED.id)).toEqual(selected);
  const manifest = JSON.parse(
    readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'),
  );
  expect(manifest.profiles.entries['axstack-checker']).toBe(hashObject(DEFERRED));
});
