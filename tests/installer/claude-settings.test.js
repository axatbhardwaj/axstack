import { expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { installBundle, uninstallBundle } from '../../src/installer.js';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const SETTING = 'CLAUDE_CODE_SUBAGENT_MODEL';
const SIDECAR = '.axstack-settings.json';
const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, options) => runBunCli(CLI, args, options);

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

function canonicalFixturePath(root, path) {
  return join(realpathSync(root), path.slice(root.length + 1));
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
      path: canonicalFixturePath(f.root, f.settingsPath),
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

test('repeat install is idempotent and keeps one canonical owner', async () => {
  const f = fixture();
  const claude = { available: true, settingsPath: f.settingsPath };
  await installBundle(installArgs(f, claude));
  const settingsBefore = readFileSync(f.settingsPath, 'utf8');
  const sidecarPath = join(f.root, 'claude', SIDECAR);
  const sidecarBefore = readFileSync(sidecarPath, 'utf8');

  const summary = await installBundle(installArgs(f, claude));

  expect(summary.claudeSettings.status).toBe('unchanged');
  expect(readFileSync(f.settingsPath, 'utf8')).toBe(settingsBefore);
  expect(readFileSync(sidecarPath, 'utf8')).toBe(sidecarBefore);
  expect(readJson(sidecarPath).keys[`env.${SETTING}`].owners).toEqual([
    canonicalFixturePath(f.root, f.skillsDir),
  ]);
});

test('a second skills root joins ownership without rewriting settings', async () => {
  const f = fixture();
  const secondRoot = join(f.root, 'skills-two');
  const claude = { available: true, settingsPath: f.settingsPath };
  await installBundle(installArgs(f, claude));
  const before = readFileSync(f.settingsPath, 'utf8');

  const summary = await installBundle({ ...installArgs(f, claude), skillsDir: secondRoot });

  expect(summary.claudeSettings.status).toBe('unchanged');
  expect(readFileSync(f.settingsPath, 'utf8')).toBe(before);
  expect(readJson(join(f.root, 'claude', SIDECAR)).keys[`env.${SETTING}`].owners).toEqual([
    canonicalFixturePath(f.root, f.skillsDir),
    canonicalFixturePath(f.root, secondRoot),
  ]);
});

test('sidecar binds ownership to one canonical settings file in its directory', async () => {
  const f = fixture();
  const settingsTwo = join(f.root, 'claude', 'other-settings.json');
  const secondRoot = join(f.root, 'skills-two');
  await installBundle(installArgs(f, { available: true, settingsPath: f.settingsPath }));
  writeFileSync(settingsTwo, JSON.stringify({ env: { [SETTING]: 'opus' } }, null, 2) + '\n');
  const beforeSettings = readFileSync(settingsTwo, 'utf8');
  const sidecarPath = join(f.root, 'claude', SIDECAR);
  const beforeSidecar = readFileSync(sidecarPath, 'utf8');

  await expect(installBundle({
    ...installArgs(f, { available: true, settingsPath: settingsTwo }),
    skillsDir: secondRoot,
  })).rejects.toThrow(/bound.*settings|settings.*bound/i);

  expect(readFileSync(settingsTwo, 'utf8')).toBe(beforeSettings);
  expect(readFileSync(sidecarPath, 'utf8')).toBe(beforeSidecar);
  expect(existsSync(join(secondRoot, 'axstack-demo', 'SKILL.md'))).toBe(false);
});

test('skills manifest binds reinstall to the original canonical settings path', async () => {
  const f = fixture();
  const settingsTwo = join(f.root, 'other-claude', 'settings.json');
  await installBundle(installArgs(f, { available: true, settingsPath: f.settingsPath }));
  const manifestPath = join(f.skillsDir, '.axstack-manifest.json');
  const manifestBefore = readFileSync(manifestPath, 'utf8');
  expect(readJson(manifestPath).claudeSettings).toEqual({
    path: canonicalFixturePath(f.root, f.settingsPath),
  });

  await expect(installBundle(installArgs(f, {
    available: true,
    settingsPath: settingsTwo,
  }))).rejects.toThrow(/bound.*settings|settings.*bound/i);

  expect(existsSync(settingsTwo)).toBe(false);
  expect(readFileSync(manifestPath, 'utf8')).toBe(manifestBefore);
});

test('uninstall keeps the key until the last skills-root owner leaves', async () => {
  const f = fixture();
  const secondRoot = join(f.root, 'skills-two');
  const claude = { available: true, settingsPath: f.settingsPath };
  await installBundle(installArgs(f, claude));
  await installBundle({ ...installArgs(f, claude), skillsDir: secondRoot });

  const first = await uninstallBundle({ skillsDir: f.skillsDir, claude });
  expect(first.claudeSettings.status).toBe('retained');
  expect(readJson(f.settingsPath).env[SETTING]).toBe('opus');
  expect(readJson(join(f.root, 'claude', SIDECAR)).keys[`env.${SETTING}`].owners).toEqual([
    canonicalFixturePath(f.root, secondRoot),
  ]);

  const last = await uninstallBundle({ skillsDir: secondRoot, claude });
  expect(last.claudeSettings.status).toBe('removed');
  expect(readJson(f.settingsPath).env).not.toHaveProperty(SETTING);
  expect(existsSync(join(f.root, 'claude', SIDECAR))).toBe(false);
});

test('uninstall uses saved ownership after the Claude CLI becomes unavailable', async () => {
  const f = fixture();
  await installBundle(installArgs(f, { available: true, settingsPath: f.settingsPath }));

  const summary = await uninstallBundle({
    skillsDir: f.skillsDir,
    claude: { available: false, settingsPath: null },
  });

  expect(summary.claudeSettings.status).toBe('removed');
  expect(readJson(f.settingsPath).env).not.toHaveProperty(SETTING);
  expect(existsSync(join(f.root, 'claude', SIDECAR))).toBe(false);
});

test('missing bound settings release saved ownership without requiring Claude', async () => {
  const f = fixture();
  await installBundle(installArgs(f, { available: true, settingsPath: f.settingsPath }));
  rmSync(f.settingsPath);

  const summary = await uninstallBundle({
    skillsDir: f.skillsDir,
    claude: { available: false, settingsPath: null },
  });

  expect(summary.claudeSettings.status).toBe('released');
  expect(existsSync(join(f.root, 'claude', SIDECAR))).toBe(false);
});

test('a user-edited value survives last-owner uninstall and ownership is dropped', async () => {
  const f = fixture();
  const claude = { available: true, settingsPath: f.settingsPath };
  await installBundle(installArgs(f, claude));
  const edited = readJson(f.settingsPath);
  edited.env[SETTING] = 'sonnet';
  writeFileSync(f.settingsPath, JSON.stringify(edited, null, 2) + '\n');

  const summary = await uninstallBundle({ skillsDir: f.skillsDir, claude });

  expect(summary.claudeSettings).toMatchObject({ status: 'preserved', value: 'sonnet' });
  expect(readJson(f.settingsPath).env[SETTING]).toBe('sonnet');
  expect(existsSync(join(f.root, 'claude', SIDECAR))).toBe(false);
});

test('malformed ownership sidecar fails before skill mutation', async () => {
  const f = fixture();
  mkdirSync(join(f.root, 'claude'), { recursive: true });
  writeFileSync(join(f.root, 'claude', SIDECAR), '{broken\n');

  await expect(
    installBundle(installArgs(f, { available: true, settingsPath: f.settingsPath })),
  ).rejects.toThrow(/malformed Claude settings ownership sidecar/);
  expect(existsSync(join(f.skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(false);
  expect(readFileSync(join(f.root, 'claude', SIDECAR), 'utf8')).toBe('{broken\n');
});

test('symlinked settings file and sidecar are refused before skill mutation', async () => {
  for (const target of ['settings', 'sidecar']) {
    const f = fixture();
    mkdirSync(join(f.root, 'claude'), { recursive: true });
    const outside = join(f.root, `${target}-outside.json`);
    writeFileSync(outside, '{}\n');
    const unsafe = target === 'settings'
      ? f.settingsPath
      : join(f.root, 'claude', SIDECAR);
    symlinkSync(outside, unsafe);

    await expect(
      installBundle(installArgs(f, { available: true, settingsPath: f.settingsPath })),
    ).rejects.toThrow(/symlink|unsafe|refusing/);
    expect(readFileSync(outside, 'utf8')).toBe('{}\n');
    expect(existsSync(join(f.skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(false);
  }
});

test('a later manifest failure restores settings bytes and existing mode', async () => {
  const f = fixture();
  mkdirSync(join(f.root, 'claude'), { recursive: true });
  const before = '{\n  "env": {\n    "KEEP": "yes"\n  },\n  "theme": "dark"\n}\n';
  writeFileSync(f.settingsPath, before);
  chmodSync(f.settingsPath, 0o640);
  mkdirSync(f.skillsDir, { recursive: true });
  mkdirSync(join(f.skillsDir, '.axstack-manifest.json.tmp'));

  await expect(
    installBundle(installArgs(f, { available: true, settingsPath: f.settingsPath })),
  ).rejects.toThrow(/temporary|manifest|exists/);
  expect(readFileSync(f.settingsPath, 'utf8')).toBe(before);
  expect(statSync(f.settingsPath).mode & 0o777).toBe(0o640);
  expect(existsSync(join(f.root, 'claude', SIDECAR))).toBe(false);
  expect(existsSync(join(f.skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(false);
});

test('CLI reports missing Claude and does not create default settings', () => {
  const f = fixture();
  const home = join(f.root, 'home');
  mkdirSync(home, { recursive: true });
  const result = runCli(
    ['install', '--preset', 'mixed', '--bundle', f.bundleDir, '--skills-dir', f.skillsDir],
    { env: { HOME: home, PATH: join(f.root, 'empty-bin') } },
  );

  expect(result.out).toContain('claude settings: skipped — Claude Code is not available');
  expect(existsSync(join(home, '.claude', 'settings.json'))).toBe(false);
});

test('CLI default inside HOME skips without --yes and installs with confirmation', () => {
  const f = fixture();
  const home = join(f.root, 'home');
  mkdirSync(home, { recursive: true });
  const bin = join(f.root, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'claude'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'claude'), 0o755);
  const args = ['install', '--preset', 'mixed', '--bundle', f.bundleDir, '--skills-dir', f.skillsDir];
  const env = { HOME: home, PATH: bin };

  const skipped = runCli(args, { env });
  expect(skipped.out).toMatch(/claude settings: skipped.*--yes/i);
  expect(existsSync(join(home, '.claude', 'settings.json'))).toBe(false);

  const installed = runCli([...args, '--yes'], { env });
  expect(installed.out).toContain(
    `claude settings: set env.${SETTING}=opus in ${canonicalFixturePath(f.root, join(home, '.claude', 'settings.json'))}`,
  );
  expect(readJson(join(home, '.claude', 'settings.json')).env[SETTING]).toBe('opus');
});

test('CLI honors CLAUDE_CONFIG_DIR for the Codex-only preset', () => {
  const root = makeTempRoot('axstack-claude-config-dir-');
  const profile = {
    id: 'axstack-driver',
    name: 'Driver',
    provider: 'codex',
    model: 'example-model',
  };
  const bundle = writeFixtureBundle(root, { presets: { 'codex-only': [profile] } });
  const skillsDir = join(root, 'skills');
  const home = join(root, 'home');
  const configDir = join(root, 'claude-config');
  const bin = join(root, 'bin');
  mkdirSync(home, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'claude'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'claude'), 0o755);

  const result = runCli([
    'install', '--preset', 'codex-only', '--bundle', bundle, '--skills-dir', skillsDir,
  ], { env: { HOME: home, PATH: bin, CLAUDE_CONFIG_DIR: configDir } });

  const settingsPath = join(configDir, 'settings.json');
  expect(result.out).toContain(
    `claude settings: set env.${SETTING}=opus in ${canonicalFixturePath(root, settingsPath)}`,
  );
  expect(readJson(settingsPath).env[SETTING]).toBe('opus');
});

test('CLI explicit settings flag forces injection and no-settings flag skips', () => {
  const f = fixture();
  const explicit = join(f.root, 'explicit', 'settings.json');
  const forced = runCli([
    'install', '--preset', 'mixed', '--bundle', f.bundleDir,
    '--skills-dir', f.skillsDir, '--claude-settings', explicit,
  ], { env: { PATH: join(f.root, 'empty-bin') } });
  expect(forced.out).toContain(
    `claude settings: set env.${SETTING}=opus in ${canonicalFixturePath(f.root, explicit)}`,
  );
  expect(readJson(explicit).env[SETTING]).toBe('opus');

  const other = fixture();
  const disabledPath = join(other.root, 'explicit', 'settings.json');
  const skipped = runCli([
    'install', '--preset', 'mixed', '--bundle', other.bundleDir,
    '--skills-dir', other.skillsDir, '--no-claude-settings',
  ], { env: { CLAUDE_CONFIG_DIR: join(other.root, 'explicit') } });
  expect(skipped.out).toMatch(/claude settings: skipped.*disabled/i);
  expect(existsSync(disabledPath)).toBe(false);
});

test('CLI uninstall uses the manifest binding when Claude is absent', () => {
  const f = fixture();
  const explicit = join(f.root, 'explicit', 'settings.json');
  runCli([
    'install', '--preset', 'mixed', '--bundle', f.bundleDir,
    '--skills-dir', f.skillsDir, '--claude-settings', explicit,
  ], { env: { PATH: join(f.root, 'empty-bin') } });

  const removed = runCli(['uninstall', '--skills-dir', f.skillsDir], {
    env: { PATH: join(f.root, 'empty-bin') },
  });
  expect(removed.out).toContain(
    `claude settings: removed env.${SETTING} from ${canonicalFixturePath(f.root, explicit)}`,
  );
  expect(readJson(explicit).env).not.toHaveProperty(SETTING);
});
