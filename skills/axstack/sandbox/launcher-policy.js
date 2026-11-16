import { readFileSync } from 'node:fs';

const definitions = JSON.parse(readFileSync(new URL('./launcher-contract.schema.json', import.meta.url), 'utf8')).$defs;
export const fact = (id, status, evidence) => ({ id, status, evidence: [String(evidence)] });
/** @returns {never} */
export function hold(message) { throw Object.assign(Error(message), { sandboxHold: true }); }
export function requirePass(terms, context) {
  if (!Array.isArray(terms) || !terms.length || terms.some(t => t.status !== 'pass' && t.status !== 'n/a')) hold(`${context}: failed/unknown facts`);
}
export function matches(value, rule) {
  if (rule.$ref) return matches(value, definitions[rule.$ref.split('/').at(-1)]);
  if ('const' in rule && JSON.stringify(value) !== JSON.stringify(rule.const)) return false;
  if (rule.enum && !rule.enum.includes(value)) return false;
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (rule.type) {
    const types = Array.isArray(rule.type) ? rule.type : [rule.type];
    if (!types.includes(type) && !(types.includes('integer') && Number.isSafeInteger(value))) return false;
  }
  if (typeof value === 'number' && (!Number.isFinite(value) || value < (rule.minimum ?? -Infinity) || value <= (rule.exclusiveMinimum ?? -Infinity))) return false;
  if (typeof value === 'string' && (value.includes('\0') || value.length < (rule.minLength ?? 0) || (rule.pattern && !new RegExp(rule.pattern).test(value)))) return false;
  if (Array.isArray(value)) return value.length >= (rule.minItems ?? 0) && value.every(v => matches(v, rule.items ?? {}));
  if (type === 'object') {
    if ((rule.required ?? []).some(k => !Object.hasOwn(value, k))) return false;
    return Object.entries(value).every(([key, v]) => rule.properties?.[key] ? matches(v, rule.properties[key]) : rule.additionalProperties !== false);
  }
  return true;
}
export function validate(name, value) {
  if (!matches(value, definitions[name])) throw Error(`invalid ${name}`);
}
export function safePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path === '/' || /[\0\n\r,:]/.test(path) || path.split('/').some(s => s === '.' || s === '..' || s === '.git')) throw Error(`unsafe absolute path: ${path}`);
  return path;
}
export function checkAssets(a) {
  if (!a) hold('missing packaged assets');
  for (const [key, def] of [['hostBinding', 'hostBinding'], ['hostBudget', 'hostBudget'], ['policy', 'launchPolicy'], ['proxy', 'proxyConfig'], ['sidecars', 'sidecars'], ['workloadImage', 'image']]) {
    if (a[key] == null) hold(`unprovisioned ${key}`);
    validate(def, a[key]);
  }
  safePath(a.ownedDir);
  if (!Array.isArray(a.registryAllowlist) || !a.registryAllowlist.length || a.registryAllowlist.some(s => typeof s !== 'string' || !/^[a-z0-9][a-z0-9.-]*$/.test(s))) hold('missing/invalid inventory registry allowlist');
  const p = a.policy;
  if (p.wallTimeSeconds + p.graceSeconds > p.maxWallTimeSeconds || p.maxWallTimeSeconds > 910) throw Error('wall-time plus grace exceeds fixed maximum 910');
  for (const c of [p.workloadCaps, p.proxyCaps, p.sidecarCaps]) if (c.memorySwapBytes !== c.memoryBytes) throw Error('memory swap must equal memory');
  const names = p.environment.map(e => e.name);
  if (new Set(names).size !== names.length || names.some(n => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n))) throw Error('invalid literal environment');
  const ids = a.sidecars.images.map(s => s.id);
  if (new Set(ids).size !== ids.length) throw Error('duplicate sidecar IDs');
  for (const s of a.sidecars.images) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) throw Error('invalid sidecar ID');
    for (const t of s.declaredVolumes) {
      safePath(t.path);
      if (['/work', '/tmp', '/source', '/dependencies', '/proc', '/sys', '/dev', '/etc'].some(r => t.path === r || t.path.startsWith(`${r}/`) || r.startsWith(`${t.path}/`))) throw Error('unsafe image VOLUME path');
      if (!/^0[0-7]{3}$/.test(t.mode) || t.noexec !== true) throw Error('unsafe image VOLUME permissions');
    }
  }
}
export const sameHost = (binding, host) => binding?.hostname === 'axat-vps' && host?.hostname === binding.hostname && /^[a-f0-9]{64}$/.test(binding.machineIdSha256) && binding.machineIdSha256 === host.machineIdSha256;

function container({ id, role, image, networkIds, caps, declaredVolumes = [], environment, policy, owner, source, storage, networks, command }) {
  const [uid, gid] = policy.user.split(':').map(Number);
  const tmpfs = [{ path: '/tmp', bytes: Math.min(policy.writableBytes, 16777216), uid, gid, mode: '0700', noexec: true }, ...declaredVolumes];
  if (role === 'fetch' || role === 'test') tmpfs.push({ path: '/work', bytes: policy.writableBytes, uid, gid, mode: '0700', noexec: false });
  const argv = ['docker', 'create', '--pull', 'never', '--name', id,
    '--user', policy.user, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges=true',
    '--cpus', String(caps.cpus), '--memory', String(caps.memoryBytes), '--memory-swap', String(caps.memorySwapBytes), '--pids-limit', String(caps.pids),
    '--log-driver', 'local', '--log-opt', `max-size=${caps.logMaxBytes}`, '--log-opt', 'max-file=1', '--log-opt', 'compress=false', '--restart', 'no'];
  for (const [key, value] of Object.entries(owner)) argv.push('--label', `axstack.sandbox.${key}=${value}`);
  argv.push('--label', 'axstack.sandbox=true');
  // Docker defaults retain the daemon's seccomp profile and private PID namespace.
  argv.push('--network', networkIds.length ? networks.find(n => n.id === networkIds[0]).name : 'none');
  if (role === 'proxy') argv.push('--network-alias', 'axstack-proxy');
  for (const e of environment) argv.push('--env', `${e.name}=${e.value}`);
  for (const t of tmpfs) argv.push('--tmpfs', `${t.path}:rw,nosuid,nodev,${t.noexec ? 'noexec' : 'exec'},size=${t.bytes},uid=${t.uid},gid=${t.gid},mode=${t.mode}`);
  if (role === 'fetch' || role === 'test') {
    argv.push('--mount', `type=bind,src=${source},dst=/source,readonly,bind-recursive=disabled`, '--mount', `type=volume,src=${storage.volumeName},dst=/dependencies,volume-nocopy${role === 'test' ? ',readonly' : ''}`);
    argv.push('--workdir', '/work');
  }
  if (command) argv.push(image, ...command);
  else argv.push('--entrypoint', '/bin/sh', image, '-c', 'while :; do sleep 3600; done');
  return { id, role, image, networkIds, argv, caps: structuredClone(caps), tmpfs };
}

/** @returns {import('./launcher-contracts.js').Plan} */
export function buildPlan(input, deps) {
  const { runId, owner, request, assets: a, host, enumeration } = input;
  checkAssets(a); validate('owner', owner); validate('request', request); validate('enumeration', enumeration);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(runId) || owner.runId !== runId || enumeration.runId !== runId) throw Error('run identity mismatch');
  safePath(request.repo);
  if (![request.head, request.base].every(s => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(s))) throw Error('head/base must be exact commits');
  if (!request.testArgv.length || new Set(request.sidecarIds).size !== request.sidecarIds.length) throw Error('invalid requested commands/sidecars');
  const selected = request.sidecarIds.map(id => {
    const item = a.sidecars.images.find(s => s.id === id);
    if (!item) throw Error(`unknown sidecar: ${id}`);
    return item;
  });
  const network = deps.planNetwork({ runId, host, proxy: a.proxy, registryAllowlist: a.registryAllowlist, sidecarIds: request.sidecarIds });
  const storage = deps.planStorage({ runId, ownedDir: a.ownedDir, policy: a.policy });
  validate('storage', storage);
  const sourceExport = { path: `${a.ownedDir}/${runId}/source`, commit: request.head, maxBytes: a.policy.sourceMaxBytes };
  const findNetwork = profile => {
    const n = network.networks.find(n => n.profile === profile);
    if (!n) throw Error(`missing ${profile} network`);
    return n.id;
  };
  const common = { policy: a.policy, owner, source: sourceExport.path, storage, networks: network.networks };
  const definitions = [
    { id: `${runId}-fetch`, role: 'fetch', image: a.workloadImage, networkIds: [findNetwork('fetch')], caps: a.policy.workloadCaps, environment: [...a.policy.environment, ...['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'].map(name => ({ name, value: `http://axstack-proxy:${a.proxy.port}` }))] },
    { id: `${runId}-test`, role: 'test', image: a.workloadImage, networkIds: selected.length ? [findNetwork('service')] : [], caps: a.policy.workloadCaps, environment: a.policy.environment },
    { id: `${runId}-proxy`, role: 'proxy', image: network.proxy.image, networkIds: network.proxy.networkIds, caps: a.policy.proxyCaps, environment: [...a.policy.environment, ...network.proxy.environment], command: undefined },
    ...selected.map(s => ({ id: `${runId}-${s.id}`, role: 'sidecar', image: s.image, networkIds: [findNetwork('service')], caps: a.policy.sidecarCaps, declaredVolumes: s.declaredVolumes, environment: a.policy.environment, command: s.argv })),
  ];
  // Proxy image supplies a trusted ENTRYPOINT; no PR-supplied command is started yet.
  const containers = definitions.map(d => container({ ...common, ...d, command: d.role === 'proxy' ? [] : d.command }));
  /** @type {import('./launcher-contracts.js').Caps} */
  const caps = { maxConcurrent: 2,
    // Conservative accounting also reserves tmpfs in addition to cgroup memory.
    perRunMemoryBytes: containers.reduce((s, c) => s + c.caps.memoryBytes + c.tmpfs.reduce((n, t) => n + t.bytes, 0), 0),
    perRunDiskBytes: a.policy.dependencyBytes + a.policy.sourceMaxBytes + a.policy.captureMaxBytes + a.policy.receiptMaxBytes + containers.reduce((s, c) => s + c.caps.logMaxBytes, 0),
    sourceMaxBytes: a.policy.sourceMaxBytes, captureMaxBytes: a.policy.captureMaxBytes, receiptMaxBytes: a.policy.receiptMaxBytes, wallTimeSeconds: a.policy.wallTimeSeconds, graceSeconds: a.policy.graceSeconds };
  const b = a.hostBudget;
  const budgetFits = caps.perRunMemoryBytes * 2 + b.reserveMemoryBytes <= b.memoryBudgetBytes && caps.perRunDiskBytes * 2 + b.reserveDiskBytes <= b.diskBudgetBytes;
  const freeKnown = Number.isFinite(host?.freeMemoryBytes) && Number.isFinite(host?.freeDiskBytes);
  const terms = [fact('host-identity', sameHost(a.hostBinding, host) ? 'pass' : 'fail', 'hostname and SHA-256(trimmed /etc/machine-id)'),
    fact('host-budget', budgetFits ? 'pass' : 'fail', `two complete runs plus reserves; inventory ${b.inventoryDate}`),
    fact('free-capacity', !freeKnown ? 'unknown' : host.freeMemoryBytes >= caps.perRunMemoryBytes + b.reserveMemoryBytes && host.freeDiskBytes >= caps.perRunDiskBytes + b.reserveDiskBytes ? 'pass' : 'fail', 'free memory/disk must cover one run plus host reserves'),
    ...(host?.terms?.length ? host.terms : [fact('host-facts', 'unknown', 'host observations absent')])];
  const probes = deps.planProbes({ runId, containers, networks: network.networks, enumeration, storage });
  /** @type {import('./launcher-contracts.js').Plan} */
  const result = { schemaVersion: 1, runId, owner, request, hostBinding: a.hostBinding, hostBudget: b, policy: a.policy, sourceExport, containers, networks: network.networks, rules: network.rules, storage, enumeration, probes, caps, terms };
  validate('plan', result);
  return structuredClone(result);
}
