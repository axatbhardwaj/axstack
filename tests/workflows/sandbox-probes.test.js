import { expect, test } from 'bun:test';
import { enumerateTargets, planProbes } from '../../skills/axstack/sandbox/probes.js';

const network = (id, profile) => ({ id, name: id, interface: `br-${id}`, profile, internal: profile !== 'egress', subnets: ['172.30.0.0/24'] });
const networks = [network('r-fetch', 'fetch'), network('r-service', 'service'), network('r-egress', 'egress')];
const enumeration = { runId: 'r', terms: [{ id: 'listeners', status: 'pass', evidence: ['ss'] }], targets: [
  { id: 'host:22', kind: 'host-listener', address: '100.64.0.1', port: 22, protocol: 'tcp', evidence: ['ss'] },
] };
const storage = { checks: [{ containerId: 'fetch', argv: ['docker', 'exec', 'fetch', 'stat', '-f', '/dependencies'] }] };
const containers = [
  { id: 'fetch', role: 'fetch', networkIds: ['r-fetch'] },
  { id: 'test', role: 'test', networkIds: [] },
  { id: 'service', role: 'test', networkIds: ['r-service'] },
  { id: 'proxy', role: 'proxy', networkIds: ['r-fetch', 'r-egress'] },
  { id: 'db', role: 'sidecar', networkIds: ['r-service'] },
];

test('planning rejects an enumeration from a different run', () => {
  expect(() => planProbes({ runId: 'other', networks, containers, enumeration, storage })).toThrow(/stale|run identity/i);
});

test('every used container position gets denial and live identity checks', () => {
  const probes = planProbes({ runId: 'r', networks, containers, enumeration, storage });
  expect(new Set(probes.map((p) => p.position))).toEqual(new Set(['fetch', 'none', 'service', 'proxy-bypassed']));
  for (const container of containers) {
    expect(probes.some((p) => p.containerId === container.id && p.expected === 'non-root-empty-caps')).toBe(true);
    expect(probes.some((p) => p.containerId === container.id && p.expected === 'deny' && p.targetIds.includes('host:22'))).toBe(true);
  }
  expect(probes.some((p) => p.containerId === 'fetch' && p.expected === 'capped-filesystem')).toBe(true);
});

test('enumeration returns completeness terms even if a host observer is unavailable', async () => {
  const observed = await enumerateTargets({ runId: 'probe-unit-observation', networks: [] });
  expect(observed.runId).toBe('probe-unit-observation');
  expect(observed.terms.length).toBeGreaterThanOrEqual(5);
  expect(observed.targets.some((t) => t.kind === 'fixed' && t.address === '169.254.169.254')).toBe(true);
});
