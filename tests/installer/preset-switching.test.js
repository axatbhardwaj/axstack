import { expect, test } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, options) => runBunCli(CLI, args, options);
const p = (id, provider, model, effort = 'medium') => ({
  id, name: id, provider, model,
  modeId: provider === 'claude' ? 'bypassPermissions' : 'full-access',
  thinkingOptionId: effort,
});
const PRESETS = {
  mixed: [
    p('axstack-author', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-primary', 'codex', 'gpt-5.6-sol'),
    p('axstack-reviewer-secondary', 'claude', 'claude-opus-5'),
    p('axstack-checker', 'antigravity', null, 'low'),
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
    bundle: writeFixtureBundle(root, { presets: PRESETS }),
    skillsDir: join(root, 'skills'),
  };
}

function install(f, preset, options) {
  return runCli([
    'install', '--preset', preset, '--bundle', f.bundle, '--skills-dir', f.skillsDir,
  ], options);
}

const rolePath = (f) => join(f.skillsDir, 'axstack', 'roles.json');
const snapshot = (f) => JSON.parse(readFileSync(rolePath(f), 'utf8'));

test('pristine owned role snapshot follows preset switches and repeat is idempotent', () => {
  const f = fixture();
  install(f, 'claude-only');
  expect(snapshot(f).preset).toBe('claude-only');

  const switched = install(f, 'mixed');
  expect(snapshot(f).preset).toBe('mixed');
  expect(snapshot(f).roles.find((role) => role.id === 'axstack-checker').model).toBeNull();
  expect(switched.out).toMatch(/preset mixed: ready/i);

  const before = readFileSync(rolePath(f), 'utf8');
  const repeated = install(f, 'mixed');
  expect(repeated.out).toMatch(/no changes/i);
  expect(readFileSync(rolePath(f), 'utf8')).toBe(before);
});

test('a user-edited role snapshot survives switching, fails readiness, and survives uninstall', () => {
  const f = fixture();
  install(f, 'mixed');
  const edited = snapshot(f);
  edited.roles.find((role) => role.id === 'axstack-reviewer-secondary').model = 'USER_EDIT';
  writeFileSync(rolePath(f), JSON.stringify(edited, null, 2) + '\n');

  const switched = install(f, 'claude-only', { expectFail: true });
  expect(snapshot(f).roles.find((role) => role.id === 'axstack-reviewer-secondary').model)
    .toBe('USER_EDIT');
  expect(switched.out).toMatch(/preset claude-only: NOT ready/i);

  runCli(['uninstall', '--skills-dir', f.skillsDir]);
  expect(existsSync(rolePath(f))).toBe(true);
  expect(snapshot(f).roles.find((role) => role.id === 'axstack-reviewer-secondary').model)
    .toBe('USER_EDIT');
});

test('an edited role snapshot missing selected bundle roles is preserved and reports every gap', () => {
  const f = fixture();
  install(f, 'mixed');
  const installed = snapshot(f);
  installed.roles = [installed.roles.find((role) => role.id === 'axstack-checker')];
  const editedBytes = JSON.stringify(installed, null, 2) + '\n';
  writeFileSync(rolePath(f), editedBytes);

  const repeated = install(f, 'mixed', { expectFail: true });

  expect(readFileSync(rolePath(f), 'utf8')).toBe(editedBytes);
  expect(repeated.out).toMatch(/preset mixed: NOT ready/i);
  for (const missingId of [
    'axstack-author',
    'axstack-reviewer-primary',
    'axstack-reviewer-secondary',
  ]) {
    expect(repeated.out).toContain(missingId);
  }
});
