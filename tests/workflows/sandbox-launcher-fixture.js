export const pass = (id) => ({ id, status: 'pass', evidence: ['fixture observation'] });
export const digest = `sha256:${'a'.repeat(64)}`;
export const image = `example.invalid/tool@${digest}`;
export function fixture() {
  const cap = { cpus: 1, memoryBytes: 1024, memorySwapBytes: 1024, pids: 16, logMaxBytes: 128, logMaxFiles: 1, logDriver: 'local', restart: 'no' };
  const policy = { schemaVersion: 1, user: '1000:1000', environment: [{ name: 'HOME', value: '/work' }], workloadCaps: cap, proxyCaps: cap, sidecarCaps: cap, writableBytes: 128, dependencyBytes: 1024, dependencyInodes: 1048576, sourceMaxBytes: 128, captureMaxBytes: 128, receiptMaxBytes: 65536, wallTimeSeconds: 60, graceSeconds: 5, maxWallTimeSeconds: 65 };
  const hostBinding = { schemaVersion: 1, hostname: 'axat-vps', machineIdSha256: 'b'.repeat(64) };
  const hostBudget = { schemaVersion: 1, host: 'axat-vps', inventoryDate: '2026-11-16', maxConcurrent: 2, memoryBudgetBytes: 100000000, diskBudgetBytes: 100000000, reserveMemoryBytes: 1024, reserveDiskBytes: 1024 };
  const assets = { hostBinding, hostBudget, policy, proxy: { schemaVersion: 1, image, allowlistFile: 'inventory.json', allowlistPointer: '/registryAllowlist', resolverIpv4: '1.1.1.1', resolverIpv6: '2606:4700:4700::1111', port: 3128 }, sidecars: { schemaVersion: 1, images: [{ id: 'db', image, argv: ['database'], declaredVolumes: [{ path: '/data', bytes: 256, uid: 1000, gid: 1000, mode: '0700', noexec: true }] }] }, workloadImage: image, registryAllowlist: ['registry.npmjs.org'], ownedDir: '/var/lib/axstack/sandbox' };
  const owner = { label: 'axstack.sandbox', runId: 'r1', pid: 42, startTimeTicks: '123', bootId: 'boot-1' };
  return { runId: 'r1', owner, request: { repo: '/source', repository: 'https://example.invalid/repo.git', head: 'a'.repeat(40), base: 'b'.repeat(40), pr: null, fetchArgv: ['bun', 'install'], testArgv: ['bun', 'test'], sidecarIds: ['db'] }, assets, host: { ...hostBinding, freeMemoryBytes: 100000000, freeDiskBytes: 100000000, addresses: ['127.0.0.1'], terms: [pass('host-facts')] }, enumeration: { runId: 'r1', terms: [pass('enumeration')], targets: [{ id: 'metadata', kind: 'fixed', address: '169.254.169.254', port: 80, protocol: 'tcp', evidence: ['fixed'] }] } };
}
export function planners() {
  return {
    planNetwork: ({ runId }) => ({ networks: ['fetch', 'service', 'egress'].map(profile => ({ id: `${runId}-${profile}`, name: `${runId}-${profile}`, interface: `ax-${runId}-${profile}`, profile, internal: profile !== 'egress', subnets: ['172.30.0.0/24'], createArgv: ['docker', 'network', 'create', `${runId}-${profile}`], removeArgv: ['docker', 'network', 'rm', `${runId}-${profile}`] })), rules: [{ id: 'deny-host', family: 'inet', table: 'axstack_sandbox', chain: 'input', interfaces: [`ax-${runId}-fetch`], expression: ['iifname', `ax-${runId}-fetch`, 'drop'], installArgv: ['nft', 'add', 'rule'], checkArgv: ['nft', 'list', 'table'], removeArgv: ['nft', 'delete', 'rule'] }], proxy: { image, networkIds: [`${runId}-fetch`, `${runId}-egress`], environment: [{ name: 'PROXY_PORT', value: '3128' }] } }),
    planStorage: ({ runId, ownedDir, policy }) => {
      const step = { id: 'image', phase: 'prepare', executor: 'host', containerId: null, argv: ['fallocate', '-l', `${policy.dependencyBytes}`, `${ownedDir}/${runId}.img`], path: `${ownedDir}/${runId}.img` };
      return { imageFile: step.path, volumeName: `${runId}-deps`, filesystem: 'ext4', bytes: policy.dependencyBytes, inodes: policy.dependencyInodes, mountOptions: ['nosuid', 'nodev'], keepFreeLoops: 1, autoclear: false, steps: [step], checks: [{ ...step, phase: 'check' }], cleanup: [{ ...step, phase: 'cleanup' }] };
    },
    planProbes: ({ containers }) => containers.map(c => ({ id: `caps-${c.id}`, containerId: c.id, position: c.role === 'test' ? 'service' : c.role === 'proxy' ? 'proxy-bypassed' : c.role === 'sidecar' ? 'service' : 'fetch', targetIds: ['metadata'], argv: ['docker', 'exec', c.id, 'probe'], expected: 'non-root-empty-caps' })),
  };
}
