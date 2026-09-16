// Shared fixture helpers for installer behavioral tests.
// Builds temporary bundles matching the frozen contract:
//   <bundle>/skills/axstack-*/SKILL.md (+ supporting files)
//   <bundle>/profiles/presets/<preset>.json
//     ({ version: 1, roles: [...] axstack-* ids })
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

// Absolute path of the CURRENT executing Bun binary. Never PATH-resolved:
// a matrix job must test the runtime it actually runs, not whichever bun
// the environment resolves (process.execPath is Bun-implemented and needs
// no Node.js runtime).
export const BUN_BIN = process.execPath;

export function tempDir() {
  return Bun.env.TMPDIR ?? '/tmp';
}

export function makeTempRoot(prefix = 'axstack-test-') {
  return realpathSync(mkdtempSync(join(tempDir(), prefix)));
}

// Run the real CLI under Bun and assert on exit codes (Bun.spawnSync
// reports nonzero via exitCode instead of throwing).
export function runCli(
  cli,
  args,
  { expectFail = false, cwd, env, unset = [], timeout = 60000 } = {},
) {
  const fullEnv = { ...Bun.env, ...(env ?? {}) };
  for (const key of unset) delete fullEnv[key];
  const result = Bun.spawnSync([BUN_BIN, cli, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    ...(cwd ? { cwd } : {}),
    env: fullEnv,
    timeout,
  });
  const out = result.stdout.toString() + result.stderr.toString();
  if (expectFail) {
    if (result.exitCode === 0) {
      throw new Error(`expected CLI failure but succeeded: ${out}`);
    }
    return { ok: false, out };
  }
  if (result.exitCode !== 0) {
    throw new Error(`CLI failed unexpectedly (exit ${result.exitCode}): ${out}`);
  }
  return { ok: true, out };
}

export function writeFixtureBundle(
  root,
  {
    name = 'bundle',
    skillName = 'axstack-demo',
    skillBody = '# Axstack Demo\n\nFixture skill for installer tests.\n',
    supportFiles = { 'helper.md': '# Helper\n\nSupporting fixture.\n' },
    profiles = [
      {
        id: 'axstack-driver',
        name: 'Axstack driver',
        provider: 'codex',
        model: 'example-model',
        modeId: 'default',
        thinkingOptionId: 'medium',
        notes: 'Fixture profile.',
      },
    ],
    presets,
  } = {},
) {
  const bundle = join(root, name);
  const skillDir = join(bundle, 'skills', skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), skillBody);
  for (const [fileName, body] of Object.entries(supportFiles)) {
    writeFileSync(join(skillDir, fileName), body);
  }
  const selectedPresets = presets === undefined ? { mixed: profiles } : presets;
  if (selectedPresets !== null) {
    const profilesDir = join(bundle, 'profiles', 'presets');
    mkdirSync(profilesDir, { recursive: true });
    for (const [preset, roles] of Object.entries(selectedPresets)) {
      writeFileSync(
        join(profilesDir, `${preset}.json`),
        JSON.stringify({ version: 1, roles }, null, 2) + '\n',
      );
    }
  }
  return bundle;
}
