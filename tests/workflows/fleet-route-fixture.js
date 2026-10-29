// Synthetic host identities only. Evidence is supplied data, never authority.
export const NOW = 100000;
export function fixture(loads = [2000, 3500, 4000, 2000, 2000]) {
  const ids = ['worker-a', 'worker-b', 'worker-c', 'personal-a', 'personal-b'];
  const proof = (environmentId) => ({ environmentId, pointer: 'fixture://proof', observedAt: NOW });
  const capabilities = (id) => Object.fromEntries(['worktree-isolation', 'browser:headed', 'session:sign-in']
    .map((key) => [key, { value: true, evidence: proof(id) }]));
  const versions = { t3: '0.1.5', axstack: '0.54.0' };
  const config = {
    schemaVersion: 1, pool: ids.slice(0, 3), defaultOrder: ids,
    taskOrders: { playwright: [ids[2], ...ids.slice(0, 2), ...ids.slice(3)] },
    balanceLimitBp: 5000,
    hosts: ids.map((id, i) => ({ id, environmentId: id, fallbackLimitBp: i === 0 ? 7500 : 8500,
      capabilities: capabilities(id) })),
    routes: ids.map((id) => ({ id: `route-${id}`, originEnvironmentId: 'personal-a', environmentId: id,
      kind: id === 'personal-a' ? 'local' : 'remote', enabled: true, evidence: proof(id) })),
  };
  const request = { task: 'backend', role: 'reader', requiredCapabilities: [],
    repositoryId: 'synthetic/project', providerInstanceId: 'codex-fixture', model: 'fixture-model',
    options: { effort: 'high' }, runtimeMode: 'full-access' };
  const input = {
    schemaVersion: 1, configText: '', configDigest: '', origin: { environmentId: 'personal-a', versions }, request,
    destinations: ids.map((id) => ({ snapshotId: `snapshot-${id}`, environmentId: id, status: 'known',
      observedAt: NOW, evidence: proof(id), versions,
      project: { id: `project-${id}`, repositoryId: request.repositoryId },
      execution: { available: true, providerInstanceId: request.providerInstanceId, model: request.model,
        options: request.options, runtimeMode: request.runtimeMode }, capabilities: capabilities(id) })),
    routeFacts: ids.map((id) => ({ routeId: `route-${id}`, reachable: true, authorized: true,
      expiresAt: NOW + 60000, destinationSnapshotId: `snapshot-${id}`, evidence: proof(id) })),
    telemetry: ids.map((id, i) => ({ environmentId: id, status: 'ok', receivedAt: NOW,
      durationMs: 5000, source: 'proc-stat', scope: 'whole-host', cpuBp: loads[i], ramBp: 1000 })),
    inventoryStatus: 'known', inventoryObservedAt: NOW, assignments: [], pendingAssignments: [], exclusions: { hosts: {}, routes: {} },
  };
  return { config, input, bind() {
    input.configText = JSON.stringify(config);
    input.configDigest = new Bun.CryptoHasher('sha256').update(input.configText).digest('hex');
    return input;
  } };
}
