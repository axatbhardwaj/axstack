import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { plan, createLauncher } from '../../skills/axstack/sandbox/launcher.js';
import { loadAssets, records, savePlan, withAdmission } from '../../skills/axstack/sandbox/launcher-host.js';
import * as network from '../../skills/axstack/sandbox/network.js';
import * as storage from '../../skills/axstack/sandbox/storage.js';
import { storageLabels, containerList } from '../../skills/axstack/sandbox/storage-plan.js';
import { fixture, pass } from './sandbox-launcher-fixture.js';

async function input() {
  const value = fixture();
  value.assets = await loadAssets();
  value.assets.workloadImage = `axstack-sandbox@sha256:${'a'.repeat(64)}`;
  value.request.sidecarIds = [];
  value.host = { ...value.host, ...value.assets.hostBinding, freeMemoryBytes: 64 * 1024 ** 3, freeDiskBytes: 200 * 1024 ** 3, addresses: ['127.0.0.1', '100.64.0.1'] };
  return value;
}
// Isolate the B/C/D planning seam while E's independent storage-binding red remains open.
const partial = () => createLauncher({ ...network, ...storage, planProbes: ({ containers }) => [{ id: 'caps', containerId: containers[0].id, position: 'fetch', expected: 'non-root-empty-caps', targetIds: [], argv: ['probe'] }] });
const labels = argv => Object.fromEntries(argv.flatMap((arg, i) => arg === '--label' ? [argv[i + 1].split(/=(.*)/s).slice(0, 2)] : []));
const environment = argv => Object.fromEntries(argv.flatMap((arg, i) => arg === '--env' ? [argv[i + 1].split(/=(.*)/s).slice(0, 2)] : []));

test('B starts the bundled C proxy command and routes fetch through its exact container name', async () => {
  const p = partial().plan(await input());
  const proxy = p.containers.find(c => c.role === 'proxy');
  expect(proxy.argv.slice(proxy.argv.indexOf(proxy.image) + 1)).toEqual(network.proxyArgv());
  const env = environment(p.containers.find(c => c.role === 'fetch').argv);
  for (const name of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']) expect(env[name]).toBe(`http://${proxy.id}:3128`);
  expect(env.NO_PROXY).toBe('');
  expect(env.no_proxy).toBe('');
  for (const c of p.containers.filter(c => c.role !== 'fetch')) expect(environment(c.argv).HTTPS_PROXY).toBeUndefined();
});

test('B containers, C networks and D volume queries agree on owner labels', async () => {
  const p = partial().plan(await input());
  const expected = { 'axstack.sandbox': 'true', 'axstack.sandbox.runId': p.runId, 'axstack.sandbox.pid': String(p.owner.pid), 'axstack.sandbox.startTimeTicks': p.owner.startTimeTicks, 'axstack.sandbox.bootId': p.owner.bootId, 'axstack.sandbox.label': p.owner.label };
  expect(storageLabels(p.owner)).toEqual(expected);
  for (const c of p.containers) expect(labels(c.argv)).toEqual(expected);
  for (const n of p.networks) expect(labels(n.createArgv)['axstack.sandbox.runId']).toBe(p.runId);
  expect(containerList(p.runId)).toContain(`label=axstack.sandbox.runId=${p.runId}`);
});

test('the real B–E plan has D filesystem probes for every dependency-volume mounting container', async () => {
  const p = plan(await input());
  for (const c of p.containers.filter(c => ['fetch', 'test'].includes(c.role))) {
    const checks = p.probes.filter(probe => probe.containerId === c.id && probe.expected === 'capped-filesystem');
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every(check => check.argv[0] === process.execPath || check.argv[0] === 'docker')).toBe(true);
  }
  expect(p.storage.checks.every(step => step.containerId === null)).toBe(true); // D's immutable templates survive composition.
});

test('persisted B owner plans admit D lock and owner-record files during reaping', async () => {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/sandbox-int-records-`);
  try {
    const a = await input();
    const owned = `${root}/owned`, evidence = `${root}/evidence`, repo = `${root}/repo`;
    for (const dir of [owned, evidence, repo]) mkdirSync(dir, { mode: 0o700 });
    a.assets.ownedDir = owned; a.request.repo = repo;
    const p = partial().plan(a), events = [];
    const deps = { ...network, ...storage, planProbes: () => p.probes, loadAssets: async () => a.assets, observeHost: async () => a.host,
      currentOwner: async () => a.owner, records: async () => [], withAdmission: fn => withAdmission(fn, owned),
      savePlan: async (candidate, dir) => { events.push('persist'); return savePlan(candidate, dir, owned); },
      prepareStorage: async () => {
        events.push('prepare');
        expect(JSON.parse(readFileSync(`${owned}/${p.runId}/plan.json`, 'utf8')).owner).toEqual(p.owner);
        writeFileSync(`${owned}/.axstack-storage.lock`, '', { mode: 0o600 });
        writeFileSync(`${p.storage.imageFile}.owner.json`, JSON.stringify({ owner: p.owner, imageFile: p.storage.imageFile, volumeName: p.storage.volumeName, bytes: p.storage.bytes, inodes: p.storage.inodes }), { mode: 0o600 });
        throw Object.assign(Error('synthetic stop after ownership reservation'), { sandboxHold: true });
      },
      removeContainer: async () => {}, containersGone: async () => true,
      cleanupNetwork: async () => [pass('network')], cleanupStorage: async () => [pass('storage')], removeRecord: async () => {},
      onSignal: () => () => {}, setDeadline: () => () => {},
    };
    await expect(createLauncher(deps).run({ plan: p, evidenceDir: evidence })).rejects.toThrow('synthetic stop');
    expect(events).toEqual(['persist', 'prepare']);
    const found = await records(a.assets, async () => ({ exitCode: 0, stdout: '', stderr: '' }));
    expect(found.map(run => run.owner)).toEqual([p.owner]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('launcher literal PATH exposes the provisioned Node and JVM tools without host environment', async () => {
  const a = await input();
  const env = Object.fromEntries(a.assets.policy.environment.map(e => [e.name, e.value]));
  expect(env.PATH.split(':')).toContain('/opt/node-24/bin');
  expect(env.PATH.split(':')).toContain('/opt/go/bin');
  expect(env.JAVA_HOME).toBe('/opt/jdk-25');
});

test('a full fleet listener inventory fits the fixed receipt budget without losing plan fields', async () => {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/sandbox-int-plan-size-`);
  try {
    const a = await input(), owned = `${root}/owned`, evidence = `${root}/evidence`, repo = `${root}/repo`;
    for (const dir of [owned, evidence, repo]) mkdirSync(dir, { mode: 0o700 });
    a.assets.ownedDir = owned; a.request.repo = repo;
    a.runId = 't21-integration-synthetic'; a.owner.runId = a.runId; a.enumeration.runId = a.runId;
    a.enumeration.targets = Array.from({ length: 1400 }, (_, i) => ({ id: `host-listener:100.64.0.1:${i + 1}:tcp`, kind: 'host-listener', address: '100.64.0.1', port: i + 1, protocol: 'tcp', evidence: [`tcp LISTEN 0 128 0.0.0.0:${i + 1} 0.0.0.0:*`] }));
    const p = plan(a);
    const bytes = await savePlan(p, evidence, owned);
    expect(JSON.parse(bytes)).toEqual(p);
    expect(new TextEncoder().encode(bytes).length * 2).toBeLessThanOrEqual(p.policy.receiptMaxBytes);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the proxy embedded DNS forwards only to the fixed public resolvers, never the host tailnet resolver', async () => {
  const a = await input(), p = plan(a), proxy = p.containers.find(c => c.role === 'proxy');
  expect(proxy.argv.flatMap((v, i) => v === '--dns' ? [proxy.argv[i + 1]] : [])).toEqual([a.assets.proxy.resolverIpv4, a.assets.proxy.resolverIpv6]);
});

test('explicit owned evidence under run metadata is allowed while source paths still reject Git internals', async () => {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/sandbox-int-evidence-`);
  try {
    const a = await input(), owned = `${root}/owned`, evidence = `${root}/.git/evidence`, repo = `${root}/repo`;
    for (const dir of [owned, `${root}/.git`, evidence, repo]) mkdirSync(dir, { mode: 0o700 });
    a.assets.ownedDir = owned; a.request.repo = repo;
    const p = plan(a);
    expect(JSON.parse(await savePlan(p, evidence, owned))).toEqual(p);
    a.request.repo = `${root}/.git/repo`;
    expect(() => plan(a)).toThrow('unsafe absolute path');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
