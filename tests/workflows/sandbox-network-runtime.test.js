import { expect, test } from 'bun:test';
import inventory from '../../skills/axstack/sandbox/inventory.json';
import proxy from '../../skills/axstack/sandbox/proxy-config.json';
import { planNetwork } from '../../skills/axstack/sandbox/network.js';
import { createNetworkRuntime } from '../../skills/axstack/sandbox/network-runtime.js';
import { createFirewall } from '../../skills/axstack/sandbox/network-firewall.js';
import { fakeNetworkHost } from './sandbox-network-fixture.js';

const owner = { label: 'axstack.sandbox', runId: 'runtime-ci', pid: 42, startTimeTicks: '123', bootId: 'boot-1' };
const plan = planNetwork({ runId: owner.runId, host: { addresses: ['127.0.0.1'] }, proxy, registryAllowlist: inventory.registryAllowlist, sidecarIds: [] });

test('cleanup independently checks even stopped owned containers before deleting any rule', async () => {
  const commands = [];
  const runtime = createNetworkRuntime({ runner: async argv => {
    commands.push(argv);
    return { exitCode: 0, stdout: 'container-still-present\n', stderr: '' };
  } });
  let error;
  try { await runtime.cleanupNetwork({ owner, plan }); } catch (e) { error = e; }
  expect(error?.sandboxHold).toBe(true);
  expect(commands[0].slice(0, 4)).toEqual(['docker', 'ps', '-a', '--quiet']);
  expect(commands[0]).toContain(`label=axstack.sandbox.runId=${owner.runId}`);
  expect(commands.some(a => a.includes('delete') || a.includes('rm'))).toBe(false);
});

test('install and two concurrent cleanups preserve a live concurrent run without host policy commands', async () => {
  const concurrentOwner = { ...owner, runId: 'other-live-run' };
  const concurrent = planNetwork({ runId: concurrentOwner.runId, host: { addresses: ['127.0.0.1'] }, proxy, registryAllowlist: inventory.registryAllowlist, sidecarIds: ['redis'] });
  const host = fakeNetworkHost([plan, concurrent]);
  const runtime = createNetworkRuntime(host);
  const installed = await runtime.installNetwork({ owner, plan });
  expect(installed.length).toBe(plan.networks.length + plan.rules.length);
  await runtime.installNetwork({ owner: concurrentOwner, plan: concurrent });
  await Promise.all([runtime.cleanupNetwork({ owner, plan }), runtime.cleanupNetwork({ owner, plan })]);
  await runtime.cleanupNetwork({ owner, plan });
  expect([...host.networks.keys()].sort()).toEqual(concurrent.networks.map(n => n.name).sort());
  expect([...host.rules.values()].map(r => r.comment).sort()).toEqual(concurrent.rules.map(r => r.id).sort());
  expect(host.commands.some(a => a.includes('flush') || a.includes('policy'))).toBe(false);
});

test('a lost rule holds before cleanup deletes anything', async () => {
  const host = fakeNetworkHost([plan]);
  const runtime = createNetworkRuntime(host);
  await runtime.installNetwork({ owner, plan });
  host.rules.delete([...host.rules.keys()][0]);
  host.commands.length = 0;
  await expect(runtime.cleanupNetwork({ owner, plan })).rejects.toThrow('Missing/changed rule');
  expect(host.commands.some(a => a.includes('delete') || a.includes('rm'))).toBe(false);
});

test('changing the sandbox hook priority holds cleanup without rewriting the chain policy', async () => {
  const host = fakeNetworkHost([plan]);
  const runtime = createNetworkRuntime(host);
  await runtime.installNetwork({ owner, plan });
  host.chains[0].prio = 10;
  host.commands.length = 0;
  await expect(runtime.cleanupNetwork({ owner, plan })).rejects.toThrow('base chain');
  expect(host.commands.some(a => a.includes('delete') || a.includes('rm') || a.includes('add'))).toBe(false);
});

test('a reaper finishing after another read the network list is still successful', async () => {
  const host = fakeNetworkHost([plan]);
  const first = createNetworkRuntime(host);
  await first.installNetwork({ owner, plan });
  let reaped = false;
  const second = createNetworkRuntime({ runner: async argv => {
    if (!reaped && argv[0] === 'nft' && argv[1] === '-j') {
      reaped = true;
      await first.cleanupNetwork({ owner, plan });
    }
    return host.runner(argv);
  } });
  expect((await second.cleanupNetwork({ owner, plan })).every(t => t.status === 'pass')).toBe(true);
  expect(host.networks.size).toBe(0);
  expect(host.rules.size).toBe(0);
});

test('rule readback compares the actual expressions, not just a surviving ownership comment', async () => {
  const wanted = { chain: 'input', comment: 'axstack:fixture:1', expr: [{ match: { op: '==', left: { meta: { key: 'iifname' } }, right: 'axfixturef' } }, { drop: null }] };
  let actual = { ...wanted, handle: 17, expr: [...wanted.expr.slice(0, 1), { accept: null }] };
  const firewall = createFirewall({ runner: async () => ({ exitCode: 0, stdout: JSON.stringify({ nftables: [{ rule: actual }] }), stderr: '' }) });
  expect(await firewall.check(wanted)).toBe(false);
  actual = { ...actual, expr: wanted.expr };
  expect(await firewall.check(wanted)).toBe(true);
  actual = { ...actual, expr: wanted.expr.slice(1) };
  expect(await firewall.check(wanted)).toBe(false);
});

test('altered network argv are rejected before any command, including during cleanup', async () => {
  const commands = [];
  const runtime = createNetworkRuntime({ runner: async argv => { commands.push(argv); return { exitCode: 0, stdout: '', stderr: '' }; } });
  for (const key of ['createArgv', 'removeArgv']) {
    const changed = structuredClone(plan);
    changed.networks[0][key] = ['nft', 'flush', 'ruleset', `axstack.sandbox.runId=${owner.runId}`];
    await expect(runtime.cleanupNetwork({ owner, plan: changed })).rejects.toThrow();
    expect(commands).toEqual([]);
  }
});

test('cleanup before network preparation confirms absent table without creating firewall state', async () => {
  const host = fakeNetworkHost([plan]);
  const terms = await createNetworkRuntime(host).cleanupNetwork({ owner, plan });
  expect(terms.every(t => t.status === 'pass')).toBe(true);
  expect(host.commands.some(a => a.includes('add') || a.includes('delete') || a.includes('rm'))).toBe(false);
});
