import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '..', '..', 'bin', 'axstack.js');
const runCli = (args, options) => runBunCli(CLI, args, options);

describe('explicit preset selection', () => {
  for (const preset of [null, 'automatic']) {
    test(`${preset ?? 'omitted'} preset fails before any mutation`, () => {
      const root = makeTempRoot('axstack-preset-required-');
      const bundle = writeFixtureBundle(root);
      const skillsDir = join(root, 'installed');
      const presetArgs = preset === null ? [] : ['--preset', preset];

      const result = runCli(
        [
          'install', '--bundle', bundle, '--skills-dir', skillsDir, ...presetArgs,
        ],
        { expectFail: true },
      );

      expect(result.out).toContain('--preset');
      expect(result.out).toContain('mixed');
      expect(result.out).toContain('codex-only');
      expect(result.out).toContain('claude-only');
      expect(existsSync(skillsDir)).toBe(false);
    });
  }

  test('preset remains required for a skills-only install', () => {
    const root = makeTempRoot('axstack-preset-skills-only-');
    const bundle = writeFixtureBundle(root);
    const skillsDir = join(root, 'installed');

    const result = runCli(
      ['install', '--bundle', bundle, '--skills-dir', skillsDir],
      { expectFail: true },
    );

    expect(result.out).toContain('--preset');
    expect(existsSync(skillsDir)).toBe(false);
  });

  test('installed role snapshot records the canonical selected preset', () => {
    const root = makeTempRoot('axstack-manifest-preset-');
    const bundle = writeFixtureBundle(root);
    const skillsDir = join(root, 'installed');

    runCli([
      'install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir,
    ]);

    const snapshot = JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8'));
    expect(snapshot.preset).toBe('mixed');
  });

  for (const [alias, canonical] of [['codex', 'codex-only'], ['claude', 'claude-only']]) {
    test(`${alias} alias records ${canonical}`, () => {
      const root = makeTempRoot(`axstack-${alias}-alias-`);
      const profiles = [{
        id: 'axstack-driver', name: 'Driver', provider: alias,
        model: `${alias}-model`,
      }];
      const bundle = writeFixtureBundle(root, { presets: { [canonical]: profiles } });
      const skillsDir = join(root, 'installed');

      runCli([
        'install', '--preset', alias, '--bundle', bundle, '--skills-dir', skillsDir,
      ]);

      const snapshot = JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8'));
      expect(snapshot.preset).toBe(canonical);
    });
  }
});
