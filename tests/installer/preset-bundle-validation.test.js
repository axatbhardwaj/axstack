import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { validateBundle } from '../../src/installer.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '..', '..', 'bin', 'axstack.js');
const runCli = (args, options) => runBunCli(CLI, args, options);
const profile = (id, provider = 'codex') => ({
  id,
  name: id,
  provider,
  model: `${provider}-model`,
});

describe('preset bundle validation', () => {
  test('loads every valid preset and selects the requested profile payload', async () => {
    const root = makeTempRoot('axstack-preset-bundle-');
    const mixed = [profile('axstack-driver')];
    const codex = [profile('axstack-driver'), profile('axstack-author')];
    const bundle = writeFixtureBundle(root, {
      presets: { mixed, 'codex-only': codex },
    });

    // Different ID sets are rejected before selection can hide the mismatch.
    await expect(validateBundle(bundle, 'mixed')).rejects.toThrow(/identical.*id/i);

    writeFileSync(
      join(bundle, 'profiles', 'presets', 'codex-only.json'),
      JSON.stringify({ version: 1, preset: 'codex-only', agentProfiles: mixed }),
    );
    const validated = await validateBundle(bundle, 'codex-only');
    expect(validated.selectedPreset).toBe('codex-only');
    expect(validated.bundleProfiles).toEqual(mixed);
    expect(Object.keys(validated.presets).sort()).toEqual(['codex-only', 'mixed']);
  });

  test('rejects malformed, misnamed, empty, and non-file preset payloads', async () => {
    const cases = [
      ['malformed JSON', (path) => writeFileSync(path, '{ nope'), /valid JSON/i],
      [
        'preset/name mismatch',
        (path) => writeFileSync(path, JSON.stringify({ version: 1, preset: 'claude-only', agentProfiles: [profile('axstack-driver')] })),
        /filename|stem|preset/i,
      ],
      [
        'empty profiles',
        (path) => writeFileSync(path, JSON.stringify({ version: 1, preset: 'mixed', agentProfiles: [] })),
        /non-empty|bundle profiles/i,
      ],
      [
        'unsupported version',
        (path) => writeFileSync(path, JSON.stringify({ version: 2, preset: 'mixed', agentProfiles: [profile('axstack-driver')] })),
        /version.*1/i,
      ],
      [
        'duplicate role IDs',
        (path) => writeFileSync(path, JSON.stringify({ version: 1, preset: 'mixed', agentProfiles: [profile('axstack-driver'), profile('axstack-driver')] })),
        /duplicate.*axstack-driver/i,
      ],
      [
        'directory named json',
        (path) => { rmSync(path); mkdirSync(path); },
        /real file/i,
      ],
      [
        'symlink named json',
        (path, root) => { rmSync(path); const target = join(root, 'target.json'); writeFileSync(target, '{}'); symlinkSync(target, path); },
        /real file|symlink/i,
      ],
    ];

    for (const [label, mutate, message] of cases) {
      const root = makeTempRoot('axstack-invalid-preset-');
      const bundle = writeFixtureBundle(root);
      const path = join(bundle, 'profiles', 'presets', 'mixed.json');
      mutate(path, root);
      await expect(validateBundle(bundle), label).rejects.toThrow(message);
    }
  });

  test('rejects a symlinked profiles parent before reading presets', async () => {
    const root = makeTempRoot('axstack-symlinked-profiles-');
    const bundle = writeFixtureBundle(root, { presets: null });
    const outside = join(root, 'outside-profiles');
    mkdirSync(join(outside, 'presets'), { recursive: true });
    writeFileSync(
      join(outside, 'presets', 'mixed.json'),
      JSON.stringify({ version: 1, preset: 'mixed', agentProfiles: [profile('axstack-driver')] }),
    );
    symlinkSync(outside, join(bundle, 'profiles'));

    await expect(validateBundle(bundle, 'mixed')).rejects.toThrow(/profiles.*real directory|symlink/i);
  });

  test('selected preset must exist when the bundle ships presets, before mutation', () => {
    const root = makeTempRoot('axstack-missing-selected-preset-');
    const bundle = writeFixtureBundle(root);
    const skillsDir = join(root, 'installed');

    const result = runCli(
      ['install', '--preset', 'codex-only', '--bundle', bundle, '--skills-dir', skillsDir],
      { expectFail: true },
    );

    expect(result.out).toMatch(/codex-only.*not found|not found.*codex-only/i);
    expect(existsSync(skillsDir)).toBe(false);
  });

  test('a fixture bundle may omit profiles/presets', async () => {
    const root = makeTempRoot('axstack-no-presets-');
    const bundle = writeFixtureBundle(root, { presets: null });
    const validated = await validateBundle(bundle, 'mixed');
    expect(validated.bundleProfiles).toBeNull();
    expect(validated.presets).toEqual({});
  });

  test('install merges only the selected preset', () => {
    const root = makeTempRoot('axstack-select-preset-');
    const mixed = [profile('axstack-driver', 'codex')];
    const claude = [profile('axstack-driver', 'claude')];
    const bundle = writeFixtureBundle(root, {
      presets: { mixed, 'claude-only': claude },
    });
    const profilePath = join(root, 'paseo.json');

    runCli([
      'install', '--preset', 'claude', '--bundle', bundle,
      '--skills-dir', join(root, 'skills'), '--profile', profilePath,
    ]);

    const installed = JSON.parse(readFileSync(profilePath, 'utf8'));
    expect(installed.daemon.agentProfiles).toEqual(claude);
  });
});
