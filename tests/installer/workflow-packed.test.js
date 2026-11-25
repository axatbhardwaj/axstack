import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { BUN_BIN, makeTempRoot } from './helpers.js';

const root = join(import.meta.dir, '../..');
const t3 = Bun.which('t3');
if (!t3) console.log('Packed workflow loader check skipped: no t3 binary on PATH.');

test.skipIf(!t3)('packed axstack stays dormant until opt-in and the real T3 loader rejects binding drift', async () => {
  const check = (args, options = {}) => {
    const result = Bun.spawnSync(args, { ...options, timeout: 40_000 });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString() || result.stdout.toString());
    return result.stdout.toString();
  };
  const scratch = makeTempRoot('axstack-workflow-packed-');
  check([BUN_BIN, 'pm', 'pack', '--destination', scratch], { cwd: root });
  const tar = readdirSync(scratch).find((file) => file.endsWith('.tgz'));
  check(['tar', '-xzf', join(scratch, tar)], { cwd: scratch });
  const packageRoot = join(scratch, 'package');
  const runtime = join(packageRoot, 'skills/axstack/workflows/conformance/isolated.mjs');
  expect(existsSync(runtime)).toBe(true);
  const { usingIsolatedT3 } = await import(runtime);
  await usingIsolatedT3({ t3, defaultLocation: true }, async (server) => {
    const cli = (...args) => check([BUN_BIN, join(packageRoot, 'bin/axstack.js'), ...args], {
      env: server.env, cwd: scratch,
    });
    const skillDir = join(server.home, 'skills');
    const install = ['install', '--preset', 'mixed', '--skills-dir', skillDir, '--no-claude-settings', '--yes'];
    const settings = join(server.base, 'userdata/settings.json');
    const originalSettings = readFileSync(settings, 'utf8');
    cli(...install);
    expect(cli(...install)).toContain('idempotent');
    expect(readdirSync(server.workflows)).toEqual([]);
    expect(readFileSync(settings, 'utf8')).toBe(originalSettings);
    const binding = join(server.root, 'private.json');
    const receipt = join(server.root, 'receipt.json');
    writeFileSync(binding, '{}', { mode: 0o600 });
    writeFileSync(receipt, JSON.stringify({
      version: server.version, suite: 1, status: 'pass',
      environment: readFileSync(join(server.base, 'userdata/environment-id'), 'utf8').trim(),
    }), { mode: 0o600 });
    const workflow = 'axstack-load-probe';
    expect(cli('workflow', 'opt-in', '--name', workflow, '--binding', binding, '--conformance', receipt, '--yes'))
      .toContain('axstack-load-probe@1');
    expect(readdirSync(server.workflows)).toEqual(['axstack-load-probe-v1.mjs']);
    const run = server.start(workflow, 'packed-load');
    expect((await server.waitFor(run.runId, 'completed')).result).toEqual({
      workflow: 'axstack-load-probe@1', binding: 'pass',
    });
    writeFileSync(binding, '{"drifted":true}');
    const drift = server.start(workflow, 'packed-drift');
    expect((await server.waitFor(drift.runId, 'paused')).detail).toContain('binding');
    expect(() => cli('workflow', 'remove', '--name', workflow, '--version', '1', '--yes')).toThrow(/paused/);
    server.command('workflow', 'cancel', drift.runId, '--json');
    await server.waitFor(drift.runId, 'cancelled');
    expect(cli('workflow', 'remove', '--name', workflow, '--version', '1', '--yes')).toContain('removed');
    expect(readdirSync(server.workflows)).toEqual([]);
  });
}, 120_000);
