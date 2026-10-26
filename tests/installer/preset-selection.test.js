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

  test('installed mixed and Claude-only snapshots adopt pinned Haiku 5.5 high for codebase mapping', () => {
    for (const preset of ['mixed', 'claude-only']) {
      const home = makeTempRoot(`axstack-haiku-${preset}-`);
      const skillsDir = join(home, 'installed');
      runCli([
        'install', '--preset', preset, '--bundle', join(import.meta.dir, '..', '..'),
        '--skills-dir', skillsDir, '--no-claude-settings', '--yes',
      ], { env: { HOME: home } });
      const { roles } = JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8'));
      expect(roles.find((role) => role.id === 'axstack-explore-codebase')).toMatchObject({
        provider: 'claude', model: 'claude-haiku-5-5', modelClass: 'haiku',
        modeId: 'bypassPermissions', thinkingOptionId: 'high',
      });
      for (const id of ['axstack-research-requirements', 'axstack-research-web']) {
        expect(roles.find((role) => role.id === id)).toMatchObject({
          provider: 'claude', modelClass: 'sonnet', thinkingOptionId: 'high',
        });
      }
    }
  });

  test('installed snapshots retain Scout seat bindings for every preset', () => {
    const expected = {
      mixed: [
        ['axstack-explore-codebase-luna', 'codex', 'luna', 'xhigh', 'full-access'],
        ['axstack-explore-codebase-flash', 'antigravity', 'gemini-3.8-flash-medium', 'medium', 'full-access'],
      ],
      'codex-only': [
        ['axstack-explore-codebase-luna', 'codex', 'luna', 'xhigh', 'full-access'],
        ['axstack-explore-codebase-flash', 'codex', null, 'medium', 'full-access'],
      ],
      'claude-only': [
        ['axstack-explore-codebase-luna', 'claude', null, 'xhigh', 'bypassPermissions'],
        ['axstack-explore-codebase-flash', 'claude', null, 'medium', 'bypassPermissions'],
      ],
    };
    for (const [preset, seats] of Object.entries(expected)) {
      const home = makeTempRoot(`axstack-scout-${preset}-`);
      const skillsDir = join(home, 'installed');
      runCli(['install', '--preset', preset, '--bundle', join(import.meta.dir, '..', '..'),
        '--skills-dir', skillsDir, '--no-claude-settings', '--yes'], { env: { HOME: home } });
      const { roles } = JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8'));
      for (const [id, provider, binding, effort, modeId] of seats) {
        const role = roles.find((item) => item.id === id);
        expect(role, `${preset}: ${id}`).toBeDefined();
        expect([role.provider, role.modelClass ?? role.model, role.thinkingOptionId, role.modeId])
          .toEqual([provider, binding, effort, modeId]);
      }
    }
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
