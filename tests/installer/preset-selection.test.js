import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
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
      const profilePath = join(root, 'paseo.json');
      const presetArgs = preset === null ? [] : ['--preset', preset];

      const result = runCli(
        [
          'install', '--bundle', bundle, '--skills-dir', skillsDir,
          '--profile', profilePath, ...presetArgs,
        ],
        { expectFail: true },
      );

      expect(result.out).toContain('--preset');
      expect(result.out).toContain('mixed');
      expect(result.out).toContain('codex-only');
      expect(result.out).toContain('claude-only');
      expect(existsSync(skillsDir)).toBe(false);
      expect(existsSync(profilePath)).toBe(false);
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
});
