import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../../skills/axstack/sandbox`;
const schema = JSON.parse(readFileSync(`${root}/launcher-contract.schema.json`, 'utf8'));

// Test-only interpreter for the schema's keyword subset; no runtime validator dependency.
function accepts(value, rule = schema) {
  if (rule.$ref) return accepts(value, schema.$defs[rule.$ref.split('/').at(-1)]);
  if ('const' in rule && JSON.stringify(value) !== JSON.stringify(rule.const)) return false;
  if (rule.enum && !rule.enum.includes(value)) return false;
  if (rule.type) {
    const kinds = Array.isArray(rule.type) ? rule.type : [rule.type];
    const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (!kinds.includes(kind) && !(kinds.includes('integer') && Number.isInteger(value))) return false;
  }
  if (typeof value === 'string' && (value.length < (rule.minLength ?? 0) || (rule.pattern && !new RegExp(rule.pattern).test(value)))) return false;
  if (typeof value === 'number' && (value < (rule.minimum ?? -Infinity) || value <= (rule.exclusiveMinimum ?? -Infinity))) return false;
  if (Array.isArray(value)) return value.length >= (rule.minItems ?? 0) && value.every(item => accepts(item, rule.items ?? {}));
  if (value !== null && typeof value === 'object') {
    if ((rule.required ?? []).some(key => !(key in value))) return false;
    return Object.entries(value).every(([key, item]) => rule.properties?.[key]
      ? accepts(item, rule.properties[key]) : rule.additionalProperties !== false);
  }
  return true;
}
const definition = name => ({ $ref: `#/$defs/${name}` });
const digest = `sha256:${'a'.repeat(64)}`;
const caps = { cpus: 1, memoryBytes: 1024, memorySwapBytes: 1024, pids: 8, logMaxBytes: 128, logMaxFiles: 1, logDriver: 'local', restart: 'no' };
const owner = { label: 'axstack.sandbox', runId: 'r1', pid: 42, startTimeTicks: '123', bootId: 'boot-1' };
const hostBinding = { schemaVersion: 1, hostname: 'axat-vps', machineIdSha256: 'b'.repeat(64) };
const hostBudget = { schemaVersion: 1, host: 'axat-vps', inventoryDate: '2026-11-16', maxConcurrent: 2, memoryBudgetBytes: 8192, diskBudgetBytes: 8192, reserveMemoryBytes: 1024, reserveDiskBytes: 1024 };
const policy = { schemaVersion: 1, user: '1000:1000', environment: [{ name: 'HOME', value: '/work' }], workloadCaps: caps, proxyCaps: caps, sidecarCaps: caps, writableBytes: 128, dependencyBytes: 1024, dependencyInodes: 1048576, sourceMaxBytes: 128, captureMaxBytes: 128, receiptMaxBytes: 128, wallTimeSeconds: 60, graceSeconds: 5, maxWallTimeSeconds: 65 };
const term = { id: 'enumeration', status: 'unknown', evidence: ['fixture, not live proof'] };
const step = { id: 'image', phase: 'prepare', executor: 'host', containerId: null, argv: ['truncate', '-s', '1024', '/owned/r1.img'], path: '/owned/r1.img' };
const storage = { imageFile: '/owned/r1.img', volumeName: 'r1-deps', filesystem: 'ext4', bytes: 1024, inodes: 1048576, mountOptions: ['nosuid', 'nodev'], keepFreeLoops: 1, autoclear: false, steps: [step], checks: [{ ...step, phase: 'check' }], cleanup: [{ ...step, phase: 'cleanup' }] };
const container = { id: 'test', role: 'test', image: `example.invalid/image@${digest}`, networkIds: [], argv: ['docker', 'create', '--network', 'none'], caps, tmpfs: [] };
const rule = { id: 'deny-host', family: 'inet', table: 'axstack_sandbox', chain: 'input', interfaces: ['ax-r1-fetch'], expression: ['iifname', 'ax-r1-fetch', 'drop'], installArgv: ['nft', 'add', 'rule'], checkArgv: ['nft', 'list', 'table'], removeArgv: ['nft', 'delete', 'rule'] };
const plan = { schemaVersion: 1, runId: 'r1', owner, request: { repo: '/source', repository: 'https://example.invalid/repo.git', head: 'a'.repeat(40), base: 'b'.repeat(40), pr: null, fetchArgv: ['bun', 'install'], testArgv: ['bun', 'test'], sidecarIds: [] }, hostBinding, hostBudget, policy, sourceExport: { path: '/owned/source', commit: 'a'.repeat(40), maxBytes: 128 }, containers: [container], networks: [], rules: [rule], storage, enumeration: { runId: 'r1', terms: [term], targets: [{ id: 'fixed', kind: 'fixed', address: '169.254.169.254', port: 80, protocol: 'tcp', evidence: ['fixed metadata target'] }] }, probes: [{ id: 'deny', containerId: 'test', position: 'none', targetIds: ['fixed'], argv: ['probe', 'deny'], expected: 'deny' }], caps: { maxConcurrent: 2, perRunMemoryBytes: 3072, perRunDiskBytes: 2048, sourceMaxBytes: 128, captureMaxBytes: 128, receiptMaxBytes: 128, wallTimeSeconds: 60, graceSeconds: 5 }, terms: [term] };

test('plan contract rejects incomplete plans instead of silently dropping containment inputs', () => {
  expect(accepts({ schemaVersion: 1 })).toBe(false);
});

test('complete plan wire format is JSON round-trippable; removing any required top-level field fails', () => {
  expect(accepts(JSON.parse(JSON.stringify(plan)))).toBe(true);
  for (const key of Object.keys(plan)) {
    const invalid = structuredClone(plan);
    delete invalid[key];
    expect(accepts(invalid)).toBe(false);
  }
});

test('container argv, per-rule interface scope, storage steps, probes and caps cannot disappear', () => {
  for (const [path, key] of [['containers', 'argv'], ['containers', 'caps'], ['rules', 'interfaces'], ['rules', 'checkArgv'], ['probes', 'position']]) {
    const invalid = structuredClone(plan);
    delete invalid[path][0][key];
    expect(accepts(invalid)).toBe(false);
  }
  for (const key of ['steps', 'checks', 'cleanup']) {
    const invalid = structuredClone(plan);
    invalid.storage[key] = [];
    expect(accepts(invalid)).toBe(false);
  }
  expect(accepts({ ...rule, interfaces: [] }, definition('rule'))).toBe(false);
  expect(accepts({ ...caps, logDriver: 'json-file' }, definition('containerCaps'))).toBe(false);
});

test('host identity, budget and immutable proxy/sidecar formats fail closed on missing provisioning', () => {
  expect(accepts(hostBinding, definition('hostBinding'))).toBe(true);
  expect(accepts({ ...hostBinding, machineIdSha256: null }, definition('hostBinding'))).toBe(false);
  expect(accepts({ ...hostBinding, hostname: 'another-host' }, definition('hostBinding'))).toBe(false);
  expect(accepts(hostBudget, definition('hostBudget'))).toBe(true);
  expect(accepts({ ...hostBudget, maxConcurrent: 3 }, definition('hostBudget'))).toBe(false);
  const proxy = { schemaVersion: 1, image: `example.invalid/proxy@${digest}`, allowlistFile: 'inventory.json', allowlistPointer: '/registryAllowlist', resolverIpv4: '1.1.1.1', resolverIpv6: '2606:4700:4700::1111', port: 3128 };
  expect(accepts(proxy, definition('proxyConfig'))).toBe(true);
  expect(accepts({ ...proxy, allowlistPointer: '/callerList' }, definition('proxyConfig'))).toBe(false);
  expect(accepts({ ...container, image: 'image:latest' }, definition('container'))).toBe(false);
});

test('run receipt references the host-owned capture v1 bytes, retaining independent probe facts', () => {
  const receipt = { schemaVersion: 1, runId: 'r1', planSha256: 'c'.repeat(64), owner, hostBinding, engineVersion: '29.8.2', imageDigests: [digest], effectivePolicy: policy, probeResults: [term], terms: [term], capture: { schemaVersion: 1, receiptPath: '/evidence/capture.json', receiptSha256: 'd'.repeat(64) } };
  expect(accepts(receipt, definition('receipt'))).toBe(true);
  for (const capture of [null, { ...receipt.capture, schemaVersion: 2 }, { schemaVersion: 1, receiptPath: '/evidence/capture.json' }]) {
    expect(accepts({ ...receipt, capture }, definition('receipt'))).toBe(false);
  }
});

test('B–E module entry points keep the agreed object-input signatures', async () => {
  for (const [module, names] of Object.entries({ launcher: ['plan', 'run', 'reap'], network: ['planNetwork', 'installNetwork', 'cleanupNetwork'], storage: ['planStorage', 'prepareStorage', 'cleanupStorage'], probes: ['enumerateTargets', 'planProbes', 'runProbes'] })) {
    const exports = await import(`${root}/${module}.js`);
    for (const name of names) {
      expect(typeof exports[name]).toBe('function');
      expect(exports[name].length).toBe(1);
    }
  }
});
