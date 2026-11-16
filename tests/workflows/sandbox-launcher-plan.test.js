import { expect, test } from 'bun:test';
import { createLauncher } from '../../skills/axstack/sandbox/launcher.js';
import { fixture, planners } from './sandbox-launcher-fixture.js';

const make = input => createLauncher(planners()).plan(input);
test('plan has exact fixed-policy argv and caps for every workload, proxy and sidecar', () => {
  const input = fixture();
  const p = make(input);
  expect(p.containers.map(c => c.role)).toEqual(['fetch', 'test', 'proxy', 'sidecar']);
  for (const c of p.containers) {
    const a = c.argv;
    expect(a.slice(0, 2)).toEqual(['docker', 'create']);
    for (const [key, value] of [['--user', '1000:1000'], ['--cap-drop', 'ALL'], ['--security-opt', 'no-new-privileges=true'], ['--memory', '1024'], ['--memory-swap', '1024'], ['--pids-limit', '16'], ['--cpus', '1'], ['--log-driver', 'local'], ['--restart', 'no']]) expect(a[a.indexOf(key) + 1]).toBe(value);
    for (const value of ['max-size=128', 'max-file=1']) expect(a).toContain(value);
    expect(a).toContain('--read-only');
    expect(a).not.toContain('--privileged');
    expect(a).not.toContain('--publish');
    for (const t of c.tmpfs) expect(a).toContain(`${t.path}:rw,nosuid,nodev,${t.noexec ? 'noexec' : 'exec'},size=${t.bytes},uid=${t.uid},gid=${t.gid},mode=${t.mode}`);
    expect(a.filter(v => v === '--env').length).toBeGreaterThan(0);
  }
  const db = p.containers.find(c => c.role === 'sidecar');
  expect(db.argv).toContain('/data:rw,nosuid,nodev,noexec,size=256,uid=1000,gid=1000,mode=0700');
  expect(p.rules).toEqual(planners().planNetwork({ runId: 'r1' }).rules);
  expect(p.sourceExport).toEqual({ path: '/var/lib/axstack/sandbox/r1/source', commit: input.request.head, maxBytes: 128 });
});

test('budget includes every container, tmpfs, source, dependency image, logs, capture and receipts', () => {
  const input = fixture(), p = make(input);
  const memory = p.containers.reduce((sum, c) => sum + c.caps.memoryBytes + c.tmpfs.reduce((s, t) => s + t.bytes, 0), 0);
  const disk = 1024 + 128 + 128 + 65536 + p.containers.reduce((s, c) => s + c.caps.logMaxBytes, 0);
  expect(p.caps.perRunMemoryBytes).toBe(memory);
  expect(p.caps.perRunDiskBytes).toBe(disk);
  expect(memory * 2 + input.assets.hostBudget.reserveMemoryBytes).toBeLessThanOrEqual(input.assets.hostBudget.memoryBudgetBytes);
  expect(disk * 2 + input.assets.hostBudget.reserveDiskBytes).toBeLessThanOrEqual(input.assets.hostBudget.diskBudgetBytes);
  input.assets.hostBudget.diskBudgetBytes = disk * 2;
  expect(make(input).terms.find(t => t.id === 'host-budget').status).toBe('fail');
});

test('plan stays available on other hosts; unknown facts and low free capacity cannot pass execution', () => {
  const input = fixture();
  input.host.hostname = 'io'; input.host.freeMemoryBytes = 1;
  input.enumeration.terms = [{ id: 'enumeration', status: 'unknown', evidence: ['unavailable'] }];
  const p = make(input);
  expect(p.terms.find(t => t.id === 'host-identity').status).toBe('fail');
  expect(p.terms.find(t => t.id === 'free-capacity').status).toBe('fail');
  expect(p.enumeration.terms[0].status).toBe('unknown');
});

test('caller fields, unpinned images, unsafe sidecar paths and policy swaps are rejected', () => {
  for (const edit of [i => { i.request.env = ['SECRET']; }, i => { i.request.publishedPorts = [8080]; }, i => { i.assets.workloadImage = 'tool:latest'; }, i => { i.assets.policy.workloadCaps.memorySwapBytes++; }, i => { i.assets.sidecars.images[0].declaredVolumes[0].path = '/source'; }]) {
    const input = fixture(); edit(input);
    expect(() => make(input)).toThrow();
  }
});
test('only fetch receives the fixed proxy endpoint; proxy has the same internal alias each run', () => {
  const p = make(fixture());
  expect(p.containers.find(c => c.role === 'fetch').argv).toContain('HTTPS_PROXY=http://axstack-proxy:3128');
  expect(p.containers.find(c => c.role === 'test').argv.some(a => a.startsWith('HTTPS_PROXY='))).toBe(false);
  const a = p.containers.find(c => c.role === 'proxy').argv;
  expect(a[a.indexOf('--network-alias') + 1]).toBe('axstack-proxy');
});
