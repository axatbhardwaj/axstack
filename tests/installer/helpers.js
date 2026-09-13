// Shared fixture helpers for installer behavioral tests.
// Builds temporary bundles matching the frozen contract:
//   <bundle>/skills/axstack-*/SKILL.md (+ supporting files)
//   <bundle>/profiles/paseo.json ({ version: 1, agentProfiles: [...] axstack-* ids })
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

export const BUN_BIN = Bun.which('bun') ?? 'bun';

export function tempDir() {
  return Bun.env.TMPDIR ?? '/tmp';
}

export function makeTempRoot(prefix = 'axstack-test-') {
  return mkdtempSync(join(tempDir(), prefix));
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

// Representative Paseo HOST config shape (profiles at daemon.agentProfiles).
// Test-only fixture; never read from or written to a live home.
export function representativeHostConfig() {
  return {
    version: 1,
    cliClientId: 'fixture-client-id',
    daemon: {
      schedules: [{ id: 'daily-check', cron: '0 9 * * *' }],
      notifications: { level: 'all' },
      agentProfiles: [
        { id: 'custom-mine', provider: 'custom', model: 'mine', notes: 'user profile' },
      ],
    },
  };
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
        provider: 'example',
        model: 'example-model',
        modeId: 'default',
        thinkingOptionId: 'medium',
        notes: 'Fixture profile.',
      },
    ],
  } = {},
) {
  const bundle = join(root, name);
  const skillDir = join(bundle, 'skills', skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), skillBody);
  for (const [fileName, body] of Object.entries(supportFiles)) {
    writeFileSync(join(skillDir, fileName), body);
  }
  const profilesDir = join(bundle, 'profiles');
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(
    join(profilesDir, 'paseo.json'),
    JSON.stringify({ version: 1, agentProfiles: profiles }, null, 2) + '\n',
  );
  return bundle;
}
