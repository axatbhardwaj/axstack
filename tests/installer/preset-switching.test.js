import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '..', '..', 'bin', 'axstack.js');
const runCli = (args, options) => runBunCli(CLI, args, options);
const p = (id, provider, model, effort = 'medium') => ({
  id, name: id, provider, model,
  modeId: provider === 'codex' ? 'full-access' : 'bypassPermissions',
  thinkingOptionId: effort,
});
const PRESETS = {
  mixed: [
    p('axstack-author', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-primary', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-secondary', 'claude', 'claude-opus-5'),
    p('axstack-checker', 'codex', null, 'low'),
  ],
  'codex-only': [
    p('axstack-author', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-primary', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-secondary', 'codex', 'gpt-5.6-terra', 'xhigh'),
    p('axstack-checker', 'codex', 'gpt-5.6-luna', 'low'),
  ],
  'claude-only': [
    p('axstack-author', 'claude', 'claude-opus-5'),
    p('axstack-reviewer-primary', 'claude', 'claude-opus-5'),
    p('axstack-reviewer-secondary', 'claude', 'claude-sonnet-5', 'xhigh'),
    p('axstack-checker', 'claude', 'claude-sonnet-5', 'low'),
  ],
};

function fixture() {
  const root = makeTempRoot('axstack-preset-switch-');
  return {
    root,
    bundle: writeFixtureBundle(root, { presets: PRESETS }),
    skillsDir: join(root, 'skills'),
    profilePath: join(root, 'paseo.json'),
  };
}

function install(f, preset, options) {
  return runCli([
    'install', '--preset', preset, '--bundle', f.bundle,
    '--skills-dir', f.skillsDir, '--profile', f.profilePath,
  ], options);
}

function profiles(f) {
  return JSON.parse(readFileSync(f.profilePath, 'utf8')).daemon.agentProfiles;
}

test('pristine owned entries follow preset switches and repeat is idempotent', () => {
  const f = fixture();
  install(f, 'codex-only');
  expect(profiles(f).find((profile) => profile.id === 'axstack-checker').model).toBe('gpt-5.6-luna');

  const switched = install(f, 'mixed');
  expect(profiles(f).some((profile) => profile.id === 'axstack-checker')).toBe(false);
  expect(switched.out).toMatch(/preset mixed: ready/i);
  const manifest = JSON.parse(readFileSync(join(f.skillsDir, '.axstack-manifest.json'), 'utf8'));
  expect(manifest.profiles.preset).toBe('mixed');

  const beforeProfile = readFileSync(f.profilePath, 'utf8');
  const beforeManifest = readFileSync(join(f.skillsDir, '.axstack-manifest.json'), 'utf8');
  const repeated = install(f, 'mixed');
  expect(repeated.out).toMatch(/no changes/i);
  expect(readFileSync(f.profilePath, 'utf8')).toBe(beforeProfile);
  expect(readFileSync(join(f.skillsDir, '.axstack-manifest.json'), 'utf8')).toBe(beforeManifest);
});

test('a user-edited entry survives switching, fails readiness, and survives uninstall', () => {
  const f = fixture();
  install(f, 'mixed');
  const config = JSON.parse(readFileSync(f.profilePath, 'utf8'));
  const edited = config.daemon.agentProfiles.find(
    (profile) => profile.id === 'axstack-reviewer-secondary',
  );
  edited.model = 'USER_EDIT';
  writeFileSync(f.profilePath, JSON.stringify(config, null, 2) + '\n');

  const switched = install(f, 'claude-only', { expectFail: true });
  expect(profiles(f).find((profile) => profile.id === edited.id).model).toBe('USER_EDIT');
  expect(switched.out).toMatch(/preset claude-only: NOT ready.*authored routing gap/i);
  expect(
    JSON.parse(readFileSync(join(f.skillsDir, '.axstack-manifest.json'), 'utf8')).profiles.preset,
  ).toBe('claude-only');

  runCli(['uninstall', '--skills-dir', f.skillsDir, '--profile', f.profilePath]);
  expect(profiles(f).find((profile) => profile.id === edited.id).model).toBe('USER_EDIT');
});
