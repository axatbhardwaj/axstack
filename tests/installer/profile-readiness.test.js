import { describe, expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { assessProfileReadiness } from '../../src/profiles.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '..', '..', 'bin', 'axstack.js');
const runCli = (args, options) => runBunCli(CLI, args, options);
const p = (id, provider, model, thinkingOptionId = 'medium', extra = {}) => ({
  id, name: id, provider, model, modeId: provider === 'codex' ? 'full-access' : 'bypassPermissions',
  thinkingOptionId, ...extra,
});

const PRESETS = {
  mixed: [
    p('axstack-author', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-primary', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-secondary', 'claude', 'claude-opus-5'),
    p('axstack-worker', 'claude', 'claude-sonnet-5', 'low'),
    p('axstack-checker', 'codex', null, 'low'),
  ],
  'codex-only': [
    p('axstack-author', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-primary', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-secondary', 'codex', 'gpt-5.6-terra', 'xhigh'),
    p('axstack-worker', 'codex', 'gpt-5.6-terra', 'low'),
    p('axstack-checker', 'codex', 'gpt-5.6-luna', 'low'),
  ],
  'claude-only': [
    p('axstack-author', 'claude', 'claude-opus-5'),
    p('axstack-reviewer-primary', 'claude', 'claude-opus-5'),
    p('axstack-reviewer-secondary', 'claude', 'claude-sonnet-5', 'xhigh'),
    p('axstack-worker', 'claude', 'claude-sonnet-5', 'low'),
    p('axstack-checker', 'claude', 'claude-sonnet-5', 'low'),
  ],
};

const host = (profiles) => ({ version: 1, daemon: { agentProfiles: profiles } });

describe('profile readiness', () => {
  for (const preset of Object.keys(PRESETS)) {
    test(`${preset} accepted authored route is ready`, () => {
      const installed = PRESETS[preset].filter((profile) => profile.model !== null);
      const report = assessProfileReadiness(host(installed), PRESETS[preset], preset);
      expect(report).toEqual({ ready: true, gaps: [], deviations: [] });
    });
  }

  test('mixed supports the accepted Opus-author to primary-Sol route', () => {
    const installed = PRESETS.mixed.filter((profile) => profile.model !== null).map((profile) => ({ ...profile }));
    const author = installed.find((profile) => profile.id === 'axstack-author');
    author.provider = 'claude';
    author.model = 'claude-opus-5';
    const report = assessProfileReadiness(host(installed), PRESETS.mixed, 'mixed');
    expect(report.ready).toBe(true);
    expect(report.gaps).toEqual([]);
    expect(report.deviations.join('\n')).toMatch(/axstack-author.*provider.*model/i);
  });

  test('reports every readiness gap class and exempts the deferred mixed checker', () => {
    const live = PRESETS.mixed
      .filter((profile) => !['axstack-worker', 'axstack-checker'].includes(profile.id))
      .map((profile) => ({ ...profile }));
    live.find((profile) => profile.id === 'axstack-author').model = 'unsupported-author';
    live.find((profile) => profile.id === 'axstack-reviewer-secondary').model = 'gpt-5.6-sol';
    live.push(p('axstack-extra', 'openai', null));
    live.push(p('axstack-reviewer-opus', 'claude', 'claude-opus-5'));

    const report = assessProfileReadiness(host(live), PRESETS.mixed, 'mixed');

    expect(report.ready).toBe(false);
    expect(report.gaps.join('\n')).toMatch(/axstack-worker.*missing/i);
    expect(report.gaps.join('\n')).not.toMatch(/axstack-checker.*missing/i);
    expect(report.gaps.join('\n')).toMatch(/legacy.*axstack-reviewer-opus/i);
    expect(report.gaps.join('\n')).toMatch(/reviewer.*distinct/i);
    expect(report.gaps.join('\n')).toMatch(/authored routing gap/i);
  });

  test('provider and required-model violations are gaps', () => {
    const live = PRESETS['codex-only'].map((profile) => ({ ...profile }));
    live[0].provider = 'claude';
    live[1].model = null;
    const report = assessProfileReadiness(host(live), PRESETS['codex-only'], 'codex-only');
    expect(report.ready).toBe(false);
    expect(report.gaps.join('\n')).toMatch(/axstack-author.*provider/i);
    expect(report.gaps.join('\n')).toMatch(/axstack-reviewer-primary.*model/i);
  });

  test('harmless metadata and in-bounds non-routing changes are deviations only', () => {
    const live = PRESETS.mixed.filter((profile) => profile.model !== null).map((profile) => ({ ...profile }));
    const worker = live.find((profile) => profile.id === 'axstack-worker');
    worker.name = 'Custom worker';
    worker.model = 'claude-opus-5';
    worker.modeId = 'custom-mode';
    const report = assessProfileReadiness(host(live), PRESETS.mixed, 'mixed');
    expect(report.ready).toBe(true);
    expect(report.gaps).toEqual([]);
    expect(report.deviations.join('\n')).toMatch(/axstack-worker.*name.*model.*modeId/i);
  });

  test('CLI prints ready, deviations, and NOT ready after valid mutations', () => {
    const root = makeTempRoot('axstack-readiness-cli-');
    const bundle = writeFixtureBundle(root, { presets: PRESETS });
    const skillsDir = join(root, 'skills');
    const profilePath = join(root, 'paseo.json');
    const ready = runCli([
      'install', '--preset', 'mixed', '--bundle', bundle,
      '--skills-dir', skillsDir, '--profile', profilePath,
    ]);
    expect(ready.out).toContain('preset mixed: ready');

    const config = JSON.parse(readFileSync(profilePath, 'utf8'));
    config.daemon.agentProfiles.find((profile) => profile.id === 'axstack-worker').provider = 'other';
    writeFileSync(profilePath, JSON.stringify(config, null, 2) + '\n');
    const notReady = runCli([
      'install', '--preset', 'mixed', '--bundle', bundle,
      '--skills-dir', skillsDir, '--profile', profilePath,
    ], { expectFail: true });
    expect(notReady.out).toMatch(/preset mixed: NOT ready.*axstack-worker.*provider/i);
    expect(readFileSync(profilePath, 'utf8')).toContain('"provider": "other"');
  });

  test('skills-only install reports readiness as unverified', () => {
    const root = makeTempRoot('axstack-readiness-unverified-');
    const bundle = writeFixtureBundle(root, { profiles: PRESETS.mixed });
    const result = runCli([
      'install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', join(root, 'skills'),
    ]);
    expect(result.out).toMatch(/profiles.*not installed.*readiness.*unverified/i);
    expect(result.out).not.toMatch(/preset mixed: ready/i);
  });
});
