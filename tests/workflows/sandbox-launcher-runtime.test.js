import { expect, test } from 'bun:test';
import { createLauncher } from '../../skills/axstack/sandbox/launcher.js';
import { dbImage, fixture, pass, planners } from './sandbox-launcher-fixture.js';

function harness() {
  const input = fixture(), events = [], records = [];
  let host = input.host;
  const deps = { ...planners(), loadAssets: async () => input.assets, observeHost: async () => host,
    currentOwner: async () => input.owner, records: async () => records,
    liveness: async () => 'dead', withAdmission: async fn => { events.push('lock'); try { return await fn(); } finally { events.push('unlock'); } },
    prepareStorage: async () => { events.push('attach'); return { loopDevice: '/dev/loop7', terms: [pass('storage')] }; },
    cleanupStorage: async () => { events.push('storage-clean'); return [pass('storage-clean')]; },
    installNetwork: async () => { events.push('network'); return [pass('network')]; },
    cleanupNetwork: async () => { events.push('network-clean'); return [pass('network-clean')]; },
    enumerateTargets: async () => input.enumeration,
    runProbes: async ({ plan }) => { events.push('probes'); return plan.probes.map(p => pass(p.id)); },
    inspectImages: async () => ({ [input.assets.workloadImage]: [], [dbImage]: ['/data'] }), engineVersion: async () => '29.8.2',
    exportSource: async () => { events.push('export'); }, savePlan: async p => { events.push('save'); return JSON.stringify(p); },
    removeRecord: async () => { events.push('record-clean'); },
    execute: async argv => { events.push(argv); return { exitCode: 0, stdout: '', stderr: '' }; },
    removeContainer: async (_owner, c) => { events.push(['docker', 'rm', '--force', c.id]); },
    settleSidecars: async () => {}, inspectMounts: async () => [pass('mounts')], containersGone: async () => true,
    recordCapture: async () => { events.push(['docker', 'exec', 'r1-test', 'bun', 'test']); return { schemaVersion: 1, receiptPath: '/evidence/capture.json', receiptSha256: 'c'.repeat(64) }; },
    saveReceipt: async () => {}, onSignal: () => () => {}, setDeadline: () => () => {},
  };
  return { input, deps, events, records, host: value => { host = value; }, launcher: () => createLauncher(deps) };
}

test('wrong host holds before any lock, container, rule, storage or receipt mutation', async () => {
  const h = harness(), p = h.launcher().plan(h.input);
  h.host({ ...h.input.host, machineIdSha256: '0'.repeat(64) });
  await expect(h.launcher().run({ plan: p, evidenceDir: '/evidence' })).rejects.toMatchObject({ sandboxHold: true });
  await expect(h.launcher().reap({ assets: h.input.assets, host: h.input.host })).rejects.toMatchObject({ sandboxHold: true });
  expect(h.events).toEqual([]);
});

test('admission lock spans stale reaping, count and attachment; probes precede every PR command', async () => {
  const h = harness();
  await h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' });
  expect(h.events.indexOf('lock')).toBeLessThan(h.events.indexOf('attach'));
  expect(h.events.indexOf('attach')).toBeLessThan(h.events.indexOf('unlock'));
  const exec = h.events.findIndex(e => Array.isArray(e) && e[1] === 'exec' && e.includes('bun'));
  expect(exec).toBeGreaterThan(h.events.indexOf('probes'));
  expect(h.events.indexOf('network-clean')).toBeGreaterThan(h.events.findIndex(e => Array.isArray(e) && e[1] === 'rm'));
  expect(h.events.indexOf('storage-clean')).toBeGreaterThan(h.events.indexOf('network-clean'));
});

test('third concurrent request and unreadable liveness hold before attachment', async () => {
  for (const state of ['live', 'unknown']) {
    const h = harness();
    h.records.push(...['r2', 'r3'].map(runId => ({ ...h.launcher().plan(h.input), runId, owner: { ...h.input.owner, runId } })));
    h.deps.liveness = async () => state;
    await expect(h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' })).rejects.toMatchObject({ sandboxHold: true });
    expect(h.events).not.toContain('attach');
    expect(h.events).not.toContain('network-clean');
  }
});

test('reap leaves live or hung launchers alone and cleans stale runs containers-first', async () => {
  const h = harness(), p = h.launcher().plan(h.input);
  h.records.push(p);
  h.deps.liveness = async () => 'live';
  await h.launcher().reap({ assets: h.input.assets, host: h.input.host });
  expect(h.events).toEqual(['lock', 'unlock']);
  h.deps.liveness = async () => 'dead'; h.events.length = 0;
  await h.launcher().reap({ assets: h.input.assets, host: h.input.host });
  expect(h.events.findIndex(e => Array.isArray(e) && e[1] === 'rm')).toBeLessThan(h.events.indexOf('network-clean'));
});

test('failed probes, missing image VOLUME observations and unexpected volume mounts hold PR commands', async () => {
  for (const change of [h => { h.deps.runProbes = async () => [{ ...pass('probe'), status: 'unknown' }]; }, h => { h.deps.inspectImages = async () => ({ [h.input.assets.workloadImage]: ['/unexpected'] }); }, h => { h.deps.inspectMounts = async () => [{ ...pass('mount'), status: 'fail' }]; }]) {
    const h = harness(); change(h);
    await expect(h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' })).rejects.toMatchObject({ sandboxHold: true });
    expect(h.events.some(e => Array.isArray(e) && e[1] === 'exec' && e.includes('bun'))).toBe(false);
  }
});
test('SIGINT, SIGHUP, SIGTERM and host wall-time stop every container before rules are removed', async () => {
  for (const signal of ['SIGINT', 'SIGHUP', 'SIGTERM', 'wall-time']) {
    const h = harness(); let cancel;
    h.deps.onSignal = fn => { cancel = fn; return () => {}; };
    h.deps.setDeadline = (wall, grace, fn) => { expect(wall).toBe(60000); expect(grace).toBe(5000); if (signal === 'wall-time') cancel = fn; return () => {}; };
    h.deps.runProbes = async ({ plan }) => { cancel(signal); return plan.probes.map(p => pass(p.id)); };
    await expect(h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' })).rejects.toMatchObject({ sandboxHold: true });
    expect(h.events.filter(e => Array.isArray(e) && e[1] === 'rm').length).toBeGreaterThanOrEqual(4);
    expect(h.events.some(e => Array.isArray(e) && e[1] === 'exec' && e.includes('bun'))).toBe(false);
    expect(h.events.indexOf('network-clean')).toBeGreaterThan(h.events.findIndex(e => Array.isArray(e) && e[1] === 'rm'));
  }
});
test('effective plan byte hash and exact host capture reference are retained in the envelope', async () => {
  const h = harness(); const raw = '{"wire":"exact bytes with newline"}\n';
  h.deps.savePlan = async () => raw;
  const receipt = await h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' });
  expect(receipt.planSha256).toBe(new Bun.CryptoHasher('sha256').update(raw).digest('hex'));
  expect(receipt.capture).toEqual({ schemaVersion: 1, receiptPath: '/evidence/capture.json', receiptSha256: 'c'.repeat(64) });
});
test('reap caller assets cannot replace the packaged host binding', async () => {
  const h = harness();
  h.input.assets.hostBinding.machineIdSha256 = '0'.repeat(64);
  const callerAssets = { ...h.input.assets, hostBinding: { hostname: h.input.host.hostname, machineIdSha256: h.input.host.machineIdSha256, schemaVersion: 1 } };
  await expect(h.launcher().reap({ assets: callerAssets, host: h.input.host })).rejects.toMatchObject({ sandboxHold: true });
  expect(h.events).toEqual([]);
});

test('recorded two-run memory budget failure holds before admission or attachment', async () => {
  const h = harness(), p = h.launcher().plan(h.input);
  h.input.assets.hostBudget.memoryBudgetBytes = p.caps.perRunMemoryBytes * 2 + h.input.assets.hostBudget.reserveMemoryBytes - 1;
  await expect(h.launcher().run({ plan: p, evidenceDir: '/evidence' })).rejects.toMatchObject({ sandboxHold: true });
  expect(h.events).toEqual([]);
});

test('low free disk holds before admission even with sufficient memory and recorded budget', async () => {
  const h = harness(), p = h.launcher().plan(h.input);
  h.host({ ...h.input.host, freeDiskBytes: p.caps.perRunDiskBytes + h.input.assets.hostBudget.reserveDiskBytes - 1 });
  await expect(h.launcher().run({ plan: p, evidenceDir: '/evidence' })).rejects.toMatchObject({ sandboxHold: true });
  expect(h.events).toEqual([]);
});

test('unknown free capacity holds before admission rather than becoming a passing fact', async () => {
  const h = harness(), p = h.launcher().plan(h.input);
  h.host({ ...h.input.host, freeDiskBytes: NaN });
  await expect(h.launcher().run({ plan: p, evidenceDir: '/evidence' })).rejects.toMatchObject({ sandboxHold: true });
  expect(h.events).toEqual([]);
});

test('network cleanup uncertainty still cleans bounded storage and retains the owner record', async () => {
  const h = harness();
  h.deps.cleanupNetwork = async () => { h.events.push('network-clean'); throw Object.assign(Error('network readback uncertain'), { sandboxHold: true }); };
  await expect(h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' })).rejects.toThrow('network readback uncertain');
  expect(h.events).toContain('storage-clean');
  expect(h.events).not.toContain('record-clean');
});

test('launcher saves the final fresh probe plan before allowing its probes to continue', async () => {
  const h = harness();
  let saved;
  h.deps.savePlan = async p => { saved = JSON.stringify(p); return saved; };
  h.deps.runProbes = async ({ plan, onPlan }) => {
    expect(typeof onPlan).toBe('function');
    plan.enumeration.targets.push({ id: 'new-listener', kind: 'host-listener', address: '100.64.0.1', port: 9001, protocol: 'tcp', evidence: ['ss'] });
    await onPlan(plan);
    expect(JSON.parse(saved).enumeration.targets.at(-1).id).toBe('new-listener');
    return plan.probes.map(p => pass(p.id));
  };
  await h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' });
});

test('fixed capped sidecar data tmpfs is allowed when the image has no VOLUME instruction', async () => {
  const h = harness();
  h.deps.inspectImages = async () => ({ [h.input.assets.workloadImage]: [], [dbImage]: [] });
  const receipt = await h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' });
  expect(receipt.capture.schemaVersion).toBe(1);
  expect(h.events).toContain('probes');
});

test('a held enumeration retains the exact unknown observer term after ordered cleanup', async () => {
  const h = harness(), term = { id: 'docker-containers', status: 'unknown', evidence: ['sidecar has no reachable listener'] };
  h.deps.enumerateTargets = async () => ({ ...h.input.enumeration, terms: [term] });
  await expect(h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' })).rejects.toMatchObject({ sandboxHold: true, terms: [term] });
  expect(h.events).toContain('storage-clean');
});


test('trusted sidecars receive their fixed startup grace before listener enumeration and PR capture', async () => {
  const h = harness();
  h.deps.settleSidecars = async () => { h.events.push('settle-sidecars'); };
  h.deps.enumerateTargets = async () => { h.events.push('enumerate'); return h.input.enumeration; };
  await h.launcher().run({ plan: h.launcher().plan(h.input), evidenceDir: '/evidence' });
  expect(h.events).toContain('settle-sidecars');
  expect(h.events.indexOf('settle-sidecars')).toBeLessThan(h.events.indexOf('enumerate'));
  expect(h.events.indexOf('settle-sidecars')).toBeGreaterThan(h.events.findIndex(e => Array.isArray(e) && e[1] === 'start'));
});
