import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { installBundle } from '../../src/installer.js';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, writeFixtureBundle } from './helpers.js';

const SETTING = 'CLAUDE_CODE_SUBAGENT_MODEL';
const SIDECAR = '.axstack-settings.json';

function fixture() {
  const root = makeTempRoot('axstack-claude-settings-');
  return {
    root,
    bundleDir: writeFixtureBundle(root),
    skillsDir: join(root, 'skills'),
    settingsPath: join(root, 'claude', 'settings.json'),
  };
}

function installArgs(f, claude) {
  return {
    bundleDir: f.bundleDir,
    skillsDir: f.skillsDir,
    preset: 'mixed',
    claude,
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('unavailable Claude is a reported skip and creates no settings', async () => {
  const f = fixture();
  const summary = await installBundle(installArgs(f, {
    available: false,
    settingsPath: f.settingsPath,
  }));

  expect(summary.claudeSettings).toEqual({
    status: 'skipped',
    reason: 'Claude Code is not available',
  });
  expect(existsSync(f.settingsPath)).toBe(false);
  expect(existsSync(join(f.root, 'claude', SIDECAR))).toBe(false);
});

test('absent settings are created with only the Opus default and mode 0600', async () => {
  const f = fixture();
  const summary = await installBundle(installArgs(f, {
    available: true,
    settingsPath: f.settingsPath,
  }));

  expect(summary.claudeSettings.status).toBe('set');
  expect(readJson(f.settingsPath)).toEqual({ env: { [SETTING]: 'opus' } });
  expect(statSync(f.settingsPath).mode & 0o777).toBe(0o600);
  expect(statSync(join(f.root, 'claude', SIDECAR)).mode & 0o777).toBe(0o600);
});

test('setting merge preserves unrelated config and env values', async () => {
  const f = fixture();
  mkdirSync(join(f.root, 'claude'), { recursive: true });
  writeFileSync(
    f.settingsPath,
    JSON.stringify({ permissions: { allow: ['Read'] }, env: { EXISTING: 'yes' } }, null, 2) + '\n',
  );

  await installBundle(installArgs(f, { available: true, settingsPath: f.settingsPath }));

  expect(readJson(f.settingsPath)).toEqual({
    permissions: { allow: ['Read'] },
    env: { EXISTING: 'yes', [SETTING]: 'opus' },
  });
});

for (const value of ['opus', 'sonnet']) {
  test(`pre-existing ${value} value is preserved and never adopted`, async () => {
    const f = fixture();
    mkdirSync(join(f.root, 'claude'), { recursive: true });
    writeFileSync(f.settingsPath, JSON.stringify({ env: { [SETTING]: value } }, null, 2) + '\n');
    const before = readFileSync(f.settingsPath);

    const summary = await installBundle(installArgs(f, {
      available: true,
      settingsPath: f.settingsPath,
    }));

    expect(summary.claudeSettings).toEqual({
      status: 'preserved',
      value,
      path: f.settingsPath,
    });
    expect(readFileSync(f.settingsPath).equals(before)).toBe(true);
    expect(existsSync(join(f.root, 'claude', SIDECAR))).toBe(false);
  });
}

test('malformed settings fail before any skill or manifest write', async () => {
  const f = fixture();
  mkdirSync(join(f.root, 'claude'), { recursive: true });
  writeFileSync(f.settingsPath, '{not json\n');

  await expect(
    installBundle(installArgs(f, { available: true, settingsPath: f.settingsPath })),
  ).rejects.toThrow(/malformed Claude settings/);
  expect(readFileSync(f.settingsPath, 'utf8')).toBe('{not json\n');
  expect(existsSync(join(f.skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(false);
  expect(existsSync(join(f.skillsDir, '.axstack-manifest.json'))).toBe(false);
});
