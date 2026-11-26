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
    const run = server.start(workflow, 'axstack-watchdog-packed-load');
    expect((await server.waitFor(run.runId, 'completed')).result).toEqual({
      workflow: 'axstack-load-probe@1', binding: 'pass',
    });
    const observe = (...args) => JSON.parse(cli('workflow', 'observe', '--base-dir', server.base, '--conformance', receipt, ...args));
    const observed = observe();
    expect(observed).toMatchObject({
      t3: { serverVersion: server.version, cliVersion: server.version },
      journal: { complete: true, triggers: [], runs: [expect.objectContaining({
        runId: run.runId, probeWorkflow: workflow + '@1', binding: 'pass',
      })] },
      activeRuns: { running: [], waiting: [], paused: [] },
    });
    expect(observed.registry).toBeNull();
    const issued = Bun.spawnSync([t3, 'auth', 'session', 'issue', '--base-dir', server.base, '--scope',
      'orchestration:read', '--ttl', '5m', '--token-only'], { env: server.env, cwd: scratch });
    expect(issued.exitCode).toBe(0);
    const registryToken = join(server.root, 'readonly-session');
    writeFileSync(registryToken, issued.stdout, { mode: 0o600 });
    expect(observe('--registry-token-file', registryToken).registry).toMatchObject({
      workflows: [expect.objectContaining({ name: workflow, version: 1 })],
      definition: { problem: null },
    });
    writeFileSync(binding, '{"drifted":true}');
    const drift = server.start(workflow, 'packed-drift');
    const paused = await server.waitFor(drift.runId, 'paused');
    expect(paused.detail).toContain('binding');
    const observation = {
      at: new Date().toISOString(),
      hosts: [{
        host: 'fixture-node',
        ...observe(),
        policies: { 'axstack-load-probe@1': { kind: 'on-demand' } },
      }],
    };
    const health = Bun.spawnSync([BUN_BIN, join(packageRoot, 'bin/axstack.js'), 'workflow', 'health', '--input', '-'], {
      env: server.env, cwd: scratch, stdin: Buffer.from(JSON.stringify(observation)),
    });
    expect(health.exitCode).toBe(2); // Native workflow list omits loader diagnostics.
    expect(JSON.parse(health.stdout.toString()).hosts[0]).toMatchObject({
      checks: { conformance: { status: 'pass' }, inventory: { status: 'pass' }, loader: { status: 'unknown' } },
      workflows: [{
        name: workflow, version: 1, checks: {
          definitionLoaded: { status: 'pass', evidence: { runId: drift.runId } },
          pausedRuns: { status: 'fail', evidence: [{ runId: drift.runId }] },
          invokedProgress: { status: 'fail' },
        },
      }],
    });
    expect(server.command('workflow', 'show', drift.runId, '--json').run).toEqual(paused);
    expect(() => cli('workflow', 'remove', '--name', workflow, '--version', '1', '--yes')).toThrow(/paused/);
    server.command('workflow', 'cancel', drift.runId, '--json');
    await server.waitFor(drift.runId, 'cancelled');
    expect(cli('workflow', 'remove', '--name', workflow, '--version', '1', '--yes')).toContain('removed');
    expect(readdirSync(server.workflows)).toEqual([]);
  });
}, 120_000);
