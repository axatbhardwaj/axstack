import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
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
    const health = (observation) => Bun.spawnSync([BUN_BIN, join(packageRoot, 'bin/axstack.js'), 'workflow', 'health', '--input', '-'], {
      env: server.env, cwd: scratch, stdin: Buffer.from(JSON.stringify(observation)),
    });
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
    const watchBackstops = 'axstack-watch-backstops';
    const backstopBinding = join(server.root, 'backstop.json');
    writeFileSync(backstopBinding, JSON.stringify({ registryTokenFile: registryToken }), { mode: 0o600 });
    expect(cli('workflow', 'opt-in', '--name', watchBackstops, '--binding', backstopBinding, '--conformance', receipt, '--yes'))
      .toContain(watchBackstops + '@1 registered');
    const backstopRegistration = observe('--registry-token-file', registryToken);
    expect(backstopRegistration.registry.workflows).toContainEqual(expect.objectContaining({ name: watchBackstops, version: 1 }));
    expect(backstopRegistration.journal.triggers.some(({ triggerId }) => triggerId.startsWith(watchBackstops))).toBe(false);
    expect(backstopRegistration.journal.runs.some(({ workflow }) => workflow === watchBackstops)).toBe(false);
    const backstop = server.start(watchBackstops, 'packed-owner', { ownerId: crypto.randomUUID(), shadow: true });
    expect((await server.waitFor(backstop.runId, 'paused')).detail).toContain('private binding');
    expect(server.command('workflow', 'show', backstop.runId, '--json').steps.map(({ name }) => name)).toEqual(['owner-lease']);
    server.command('workflow', 'cancel', backstop.runId, '--json');
    await server.waitFor(backstop.runId, 'cancelled');
    expect(cli('workflow', 'remove', '--name', watchBackstops, '--version', '1', '--yes')).toContain('removed');
    const triage = 'axstack-pr-triage';
    const triageBinding = join(server.root, 'triage.json');
    writeFileSync(triageBinding, JSON.stringify({ registryTokenFile: registryToken }), { mode: 0o600 });
    const activate = (name) => cli('workflow', 'opt-in', '--name', name, '--binding', triageBinding,
      '--conformance', receipt, '--yes');
    expect(() => activate('not-in-the-catalog')).toThrow(/outside the shipped catalog/);
    expect(activate(triage)).toContain('axstack-pr-triage@1 registered');
    expect(activate(triage)).toContain('unchanged');
    const scheduled = observe('--registry-token-file', registryToken);
    expect(scheduled.registry.workflows).toContainEqual(expect.objectContaining({ name: triage, version: 1 }));
    expect(scheduled.journal.triggers).toContainEqual(expect.objectContaining({ triggerId: `${triage}/daily:02:00:all` }));
    const triageRuns = () => server.command('workflow', 'list', '--json').filter(({ workflow }) => workflow === triage);
    expect(triageRuns()).toEqual([]);
    // Replay a due slot through the exact bundle and real scheduler in the isolated base.
    await server.stop();
    const due = new Date(Date.now() - 5000).toISOString();
    const db = new Database(join(server.base, 'userdata/statev2.sqlite'));
    try {
      expect(db.query('UPDATE workflow_triggers SET next_at = ? WHERE trigger_id = ?')
        .run(due, `${triage}/daily:02:00:all`).changes).toBe(1);
    } finally {
      db.close();
    }
    await server.restart();
    const deadline = Date.now() + 10_000;
    let runs = triageRuns();
    while (!runs.length && Date.now() < deadline) {
      await Bun.sleep(100);
      runs = triageRuns();
    }
    expect(runs).toHaveLength(1);
    let held = runs[0];
    while (held.status === 'running' && Date.now() < deadline) {
      await Bun.sleep(100);
      held = server.command('workflow', 'show', held.runId, '--json').run;
    }
    const heldObservation = {
      at: new Date().toISOString(), hosts: [{
        host: 'fixture-node', ...observe('--registry-token-file', registryToken),
        policies: { [triage + '@1']: { kind: 'scheduled', intervalMs: 86400000, firstDueAt: due, triggerId: `${triage}/daily:02:00:all` } },
      }],
    };
    const heldHealth = health(heldObservation);
    expect(JSON.parse(heldHealth.stdout.toString()).hosts[0].workflows.find(({ name }) => name === triage).checks).toMatchObject({
      dueSlot: { status: 'pass' }, pausedRuns: { status: 'fail', evidence: [{ runId: held.runId }] },
    });
    expect(heldHealth.exitCode).toBe(2);
    expect(held.status).toBe('paused');
    expect(held.detail).toContain('private binding is missing, invalid, or changed');
    expect(server.command('workflow', 'show', held.runId, '--json').steps.map((step) => step.name))
      .toEqual(['claim-slot', 'collect-facts']);
    server.command('workflow', 'cancel', held.runId, '--json');
    await server.waitFor(held.runId, 'cancelled');
    expect(cli('workflow', 'remove', '--name', triage, '--version', '1', '--yes')).toContain('removed');
    const unloaded = observe('--registry-token-file', registryToken);
    expect(unloaded.registry.workflows.some(({ name }) => name === triage)).toBe(false);
    expect(unloaded.activeRuns).toEqual({ running: [], waiting: [], paused: [] });
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
    const probeHealth = health(observation);
    expect(probeHealth.exitCode).toBe(2); // Native workflow list omits loader diagnostics.
    expect(JSON.parse(probeHealth.stdout.toString()).hosts[0]).toMatchObject({
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
