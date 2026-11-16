import { buildPlan, checkAssets, fact, hold, requirePass, sameHost, validate } from './launcher-policy.js';
import { sha256 } from '../scripts/capture-identity.js';

function checkHost(a, host) {
  if (!sameHost(a.hostBinding, host)) hold('wrong host: require axat-vps and packaged SHA-256(trimmed /etc/machine-id); no sandbox state changed');
}
function networkPlan(p) {
  const proxy = p.containers.find(c => c.role === 'proxy');
  const environment = [];
  for (let i = 0; i < proxy.argv.indexOf(proxy.image); i++) if (proxy.argv[i] === '--env') {
    const value = proxy.argv[++i], equals = value.indexOf('=');
    environment.push({ name: value.slice(0, equals), value: value.slice(equals + 1) });
  }
  return { networks: p.networks, rules: p.rules, proxy: { image: proxy.image, networkIds: proxy.networkIds, environment } };
}
async function cleanup(p, deps) {
  const terms = [];
  // rm --force also stops signal-ignoring workloads. Absence readback is authoritative.
  for (const c of p.containers) {
    try { await deps.removeContainer(p.owner, c); }
    catch { /* Re-check absence: another reaper may have removed it. */ }
  }
  if (!await deps.containersGone(p)) hold(`containers remain for ${p.runId}; rules retained`);
  terms.push(fact('containers-gone', 'pass', p.containers.map(c => c.id).join(', ')));
  const network = networkPlan(p);
  // Containers are independently gone; storage cleanup is safe even when a
  // network readback is uncertain. Retain the owner plan until both succeed.
  let networkError;
  try {
    const n = await deps.cleanupNetwork({ owner: p.owner, plan: network });
    requirePass(n, 'network cleanup'); terms.push(...n);
  } catch (error) { networkError = error; }
  const s = await deps.cleanupStorage({ owner: p.owner, plan: p.storage });
  requirePass(s, 'storage cleanup'); terms.push(...s);
  if (networkError) throw networkError;
  await deps.removeRecord(p);
  return terms;
}
async function reapInside(a, deps) {
  const terms = [], live = [];
  for (const p of await deps.records(a)) {
    validate('plan', p);
    if (p.hostBinding.machineIdSha256 !== a.hostBinding.machineIdSha256) hold(`foreign host record ${p.runId}`);
    const state = await deps.liveness(p.owner);
    if (state === 'unknown') hold(`unreadable liveness ${p.runId}; owning driver must clear PID/start/boot uncertainty`);
    if (state === 'live') { live.push(p); continue; }
    if (state !== 'dead') hold(`unknown liveness ${p.runId}`);
    terms.push(...await cleanup(p, deps));
  }
  return { terms, live };
}
export async function reapRuns({ assets: _suppliedAssets, host: _suppliedHost }, deps) {
  // Caller observations never authorize writers; refresh even when HostFacts were supplied.
  const assets = await deps.loadAssets();
  const host = await deps.observeHost(assets);
  checkHost(assets, host); checkAssets(assets);
  requirePass(host.terms, 'host process visibility');
  return deps.withAdmission(async () => {
    const fresh = await deps.observeHost(assets);
    checkHost(assets, fresh); requirePass(fresh.terms, 'fresh host process visibility');
    return (await reapInside(assets, deps)).terms;
  });
}
function checkVolumes(p, imageVolumes) {
  for (const c of p.containers) {
    const observed = imageVolumes[c.image];
    if (!Array.isArray(observed)) hold(`image VOLUME configuration unavailable: ${c.image}`);
    for (const path of observed) if (!c.tmpfs.some(t => t.path === path)) hold(`uncovered image VOLUME: ${c.id} ${path}`);
    const declared = c.tmpfs.filter(t => !['/work', '/tmp'].includes(t.path));
    if (declared.some(t => !observed.includes(t.path))) hold(`image VOLUME expectations changed: ${c.id}`);
  }
}
export async function runPlan({ plan: supplied, evidenceDir }, deps) {
  const assets = await deps.loadAssets();
  const host = await deps.observeHost(assets);
  checkHost(assets, host); checkAssets(assets); validate('plan', supplied);
  const owner = await deps.currentOwner(supplied.runId);
  let p = buildPlan({ runId: supplied.runId, owner, request: supplied.request, assets, host, enumeration: supplied.enumeration }, deps);
  requirePass(p.terms, 'host admission');
  let admitted = false, cancelled = null, planBytes;
  const cancel = signal => {
    cancelled = signal;
    // Deadline/signal stops containers immediately; ordered resource cleanup waits
    // for in-flight create/start calls to settle, so their late objects cannot leak.
    if (admitted) for (const c of p.containers) void deps.removeContainer(p.owner, c).catch(() => {});
  };
  const detachSignals = deps.onSignal(cancel);
  const clearDeadline = deps.setDeadline(p.policy.wallTimeSeconds * 1000, p.policy.graceSeconds * 1000, cancel);
  const active = () => { if (cancelled) hold(`run cancelled: ${cancelled}`); };
  let receipt;
  try {
    await deps.withAdmission(async () => {
      active();
      const freshHost = await deps.observeHost(assets); checkHost(assets, freshHost);
      p = buildPlan({ runId: p.runId, owner, request: p.request, assets, host: freshHost, enumeration: p.enumeration }, deps);
      requirePass(p.terms, 'fresh host admission');
      const { live } = await reapInside(assets, deps);
    if (live.some(r => r.runId === p.runId)) hold(`run ID already live: ${p.runId}`);
      if (live.length >= 2) hold('concurrency limit 2 reached');
      active();
      // Persist PID/start/boot identity BEFORE the attach-before-volume crash window.
      planBytes = await deps.savePlan(p, evidenceDir);
      admitted = true;
      const prepared = await deps.prepareStorage({ owner, plan: p.storage, policy: p.policy });
      requirePass(prepared.terms, 'storage attachment');
      if (!/^\/dev\/loop\d+$/.test(prepared.loopDevice)) hold('unobserved loop device');
      p.terms.push(...prepared.terms, fact('loop-device', 'pass', `${prepared.loopDevice} backing ${p.storage.imageFile}`));
    });
    active();
    await deps.exportSource(p);
    checkVolumes(p, await deps.inspectImages(p));
    const network = networkPlan(p);
    requirePass(await deps.installNetwork({ owner, plan: network }), 'network installation'); active();
    // No untrusted command is part of create/start. Workloads idle for fresh probes.
    for (const c of p.containers) {
      const result = await deps.execute(c.argv); if (result.exitCode !== 0) hold(`container create failed: ${c.id}`);
      for (const id of c.networkIds.slice(1)) {
        const n = p.networks.find(n => n.id === id);
        const r = await deps.execute(['docker', 'network', 'connect', n.name, c.id]);
        if (r.exitCode !== 0) hold(`network attachment failed: ${c.id}`);
      }
      const start = await deps.execute(['docker', 'start', c.id]);
      if (start.exitCode !== 0) hold(`container start failed: ${c.id}`);
      active();
    }
    requirePass(await deps.inspectMounts(p), 'effective mounts');
    const enumeration = await deps.enumerateTargets({ runId: p.runId, networks: p.networks });
    validate('enumeration', enumeration); requirePass(enumeration.terms, 'fresh target enumeration');
    if (enumeration.runId !== p.runId) hold('stale target enumeration');
    p.enumeration = enumeration;
    p.probes = deps.planProbes({ runId: p.runId, containers: p.containers, networks: p.networks, enumeration, storage: p.storage });
    validate('plan', p);
    planBytes = await deps.savePlan(p, evidenceDir);
    const probeResults = await deps.runProbes({ plan: p, onPlan: async candidate => {
      active(); validate('plan', candidate);
      planBytes = await deps.savePlan(candidate, evidenceDir);
    } });
    requirePass(probeResults, 'per-run containment probes');
    if (p.probes.some(probe => !probeResults.some(t => t.id === probe.id && t.status === 'pass'))) hold('missing per-run probe result');
    active();
    const engineVersion = await deps.engineVersion();
    const capture = await deps.recordCapture(p, evidenceDir, active);
    active();
    receipt = { schemaVersion: 1, runId: p.runId, planSha256: sha256(planBytes), owner, hostBinding: assets.hostBinding, engineVersion,
      imageDigests: [...new Set(p.containers.map(c => c.image.slice(c.image.indexOf('@') + 1)))], effectivePolicy: p.policy, probeResults,
      terms: p.terms, capture };
    validate('receipt', receipt);
  } finally {
    try {
      if (admitted) { const terms = await cleanup(p, deps); if (receipt) receipt.terms.push(...terms); }
    } finally { clearDeadline(); detachSignals(); }
  }
  await deps.saveReceipt(receipt, evidenceDir, p);
  return receipt;
}
