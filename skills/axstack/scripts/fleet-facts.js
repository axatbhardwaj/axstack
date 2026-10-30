import { nativeAssignments } from './fleet-inventory.js';
import { canonical, evidence, fail, record, text, time } from './fleet-config.js';

const terminal = new Set(['completed', 'failed', 'cancelled', 'canceled', 'rejected']);
const states = new Set([...terminal, 'pending', 'queued', 'running', 'waiting', 'blocked']);
const qualified = (value) => text(value) && /^.+:.+$/.test(value);

export function assignmentCounts(input, hosts, now) {
  if (input.nativeInventory !== undefined) {
    const normalized = nativeAssignments(input.nativeInventory, hosts, now);
    const counts = assignmentCounts(normalized, hosts);
    return { ...counts, inventoryReasons: normalized.inventoryReasons,
      inventoryEvidence: normalized.inventoryEvidence,
      ...(normalized.inventoryStatus === 'unknown' ? {
        pendingLowerBound: counts.byEnvironment,
        byEnvironment: Object.fromEntries(hosts.map((h) => [h.environmentId, null])),
      } : {}) };
  }
  const byEnvironment = Object.fromEntries(hosts.map((h) => [h.environmentId, 0]));
  const inventory = new Map();
  const clients = new Map();
  const pendingTasks = new Map();
  for (const a of input.assignments) {
    if (!record(a) || !qualified(a.assignmentId) || !text(a.environmentId) || !states.has(a.state)) fail('assignment-schema');
    const previous = inventory.get(a.assignmentId);
    if (previous && (previous.environmentId !== a.environmentId || previous.state !== a.state)) fail('assignment-conflict');
    inventory.set(a.assignmentId, a);
  }
  const count = (environmentId) => {
    if (Object.hasOwn(byEnvironment, environmentId)) byEnvironment[environmentId]++;
  };
  if (input.inventoryStatus === 'known') {
    for (const a of inventory.values()) if (!terminal.has(a.state)) count(a.environmentId);
  }
  for (const p of input.pendingAssignments) {
    if (!record(p) || !text(p.clientRequestId) || !text(p.environmentId)
      || (p.taskId !== undefined && !qualified(p.taskId))) fail('pending-assignment-schema');
    const previous = clients.get(p.clientRequestId);
    if (previous && (previous.environmentId !== p.environmentId || previous.taskId !== p.taskId)) fail('assignment-conflict');
    if (previous) continue;
    clients.set(p.clientRequestId, p);
    if (p.taskId !== undefined) {
      const known = input.inventoryStatus === 'known' ? inventory.get(p.taskId) : null;
      const pendingEnvironment = pendingTasks.get(p.taskId);
      if ((known && known.environmentId !== p.environmentId)
        || (pendingEnvironment && pendingEnvironment !== p.environmentId)) fail('assignment-conflict');
      if (known || pendingEnvironment) continue;
      pendingTasks.set(p.taskId, p.environmentId);
    }
    count(p.environmentId);
  }
  return { byEnvironment, inventoryStatus: input.inventoryStatus,
    inventoryObservedAt: input.inventoryObservedAt ?? null, pendingRecords: clients.size,
    provenance: input.inventoryStatus === 'known' ? 'inventory-plus-pending' : 'pending-only' };
}

// Scale the shortest decimal representation, avoiding binary multiplication overshoot.
function fractionBp(fraction) {
  const [mantissa, exponent = '0'] = String(fraction).split('e');
  const [whole, decimals = ''] = mantissa.split('.');
  const numerator = BigInt(whole + decimals);
  const scale = decimals.length - Number(exponent) - 4;
  if (scale <= 0) return Number(numerator * (10n ** BigInt(-scale)));
  const denominator = 10n ** BigInt(scale);
  return Number((numerator + denominator - 1n) / denominator);
}

export function telemetry(sample, now) {
  const provenance = Object.fromEntries(['source', 'scope', 'durationMs', 'intervalMs', 'windowStartedAt',
    'windowEndedAt', 'windowKind', 'receivedAt', 'timeoutMs'].filter((key) => sample?.[key] !== undefined)
    .map((key) => [key, sample[key]]));
  const ageMs = time(sample?.receivedAt) ? now - sample.receivedAt : null;
  const unknown = (reason) => ({ ...provenance, status: 'unknown', reason, ageMs });
  if (!sample) return unknown('missing');
  if (sample.timedOut === true) return unknown('timeout');
  if (sample.status !== 'ok') return unknown(text(sample.status) ? sample.status : 'failed');
  if (!time(sample.receivedAt)) return unknown('invalid-received-time');
  if (ageMs < 0) return unknown('future');
  if (ageMs > 15000) return unknown('stale');
  if (!Number.isSafeInteger(sample.durationMs) || sample.durationMs < 5000
    || sample.scope !== 'whole-host' || !text(sample.source)) return unknown('unusable-provenance');
  if (sample.windowStartedAt !== undefined && (!time(sample.windowStartedAt)
    || sample.receivedAt - sample.windowStartedAt < sample.durationMs)) return unknown('inconsistent-window');
  if ((sample.intervalMs !== undefined && (!Number.isSafeInteger(sample.intervalMs)
    || sample.intervalMs < 5000 || sample.intervalMs > 60000 || sample.intervalMs > sample.durationMs))
    || (sample.windowEndedAt !== undefined && (!time(sample.windowEndedAt)
      || !time(sample.windowStartedAt) || sample.windowEndedAt > sample.receivedAt
      || sample.windowEndedAt - sample.windowStartedAt < sample.durationMs))) return unknown('inconsistent-window');
  const toBp = (name) => {
    const points = sample[`${name}Bp`];
    const fraction = sample[`${name}Fraction`];
    // Exactly one representation: conflicting fields must not silently win.
    if (points !== undefined && fraction !== undefined) return null;
    if (fraction !== undefined) return typeof fraction === 'number' && Number.isFinite(fraction)
      && fraction >= 0 && fraction <= 1 ? fractionBp(fraction) : null;
    return Number.isInteger(points) && points >= 0 && points <= 10000 ? points : null;
  };
  const cpuBp = toBp('cpu'); const ramBp = toBp('ram');
  if (cpuBp === null || ramBp === null) return unknown('malformed');
  // If the collector supplies latest RAM as well as an average, retain spikes.
  const latest = sample.ramLatestBp;
  if (latest !== undefined && (!Number.isInteger(latest) || latest < 0 || latest > 10000)) return unknown('malformed');
  return { status: 'measured', ageMs, cpuBp, ramBp, ramLatestBp: latest ?? null,
    loadBp: Math.max(cpuBp, ramBp, latest ?? 0), receivedAt: sample.receivedAt,
    source: sample.source, scope: sample.scope, durationMs: sample.durationMs,
    windowStartedAt: sample.windowStartedAt ?? null, windowEndedAt: sample.windowEndedAt ?? null,
    intervalMs: sample.intervalMs ?? null, windowKind: sample.windowKind ?? null,
    timeoutMs: sample.timeoutMs ?? null };
}

const versionsMatch = (a, b) => record(a) && record(b) && text(a.t3) && text(a.axstack)
  && a.t3 === b.t3 && a.axstack === b.axstack;

export function routeReasons(route, host, destination, facts, input, now) {
  const reasons = [];
  const add = (code) => { if (!reasons.includes(code)) reasons.push(code); };
  const remote = route.environmentId !== input.origin.environmentId;
  const r = input.request;
  if (Object.hasOwn(input.exclusions.hosts, host.id)) add('excluded-host');
  if (Object.hasOwn(input.exclusions.routes, route.id)) add('excluded-route');
  if (!route.enabled) add('route-disabled');
  if (route.kind === 'remote-author-coordinator' && r.role !== 'author') add('route-role-mismatch');
  if (!evidence(route.evidence, host.environmentId, now)) add('evidence-unproven');
  if (!facts) add('route-unproven');
  else {
    if (facts.reachable !== true) add(facts.reachable === false ? 'offline' : 'route-unproven');
    if (facts.authorized !== true) add(facts.authorized === false ? 'unauthorized' : 'route-unproven');
    if (remote && (!time(facts.expiresAt) || facts.expiresAt <= now)) add('link-expired');
    if (!evidence(facts.evidence, host.environmentId, now)) add('evidence-unproven');
  }
  if (destination?.status !== 'known') add('destination-unproven');
  else {
    if (!time(destination.observedAt) || destination.observedAt > now
      || !evidence(destination.evidence, host.environmentId, now)) add('evidence-unproven');
    if (!text(destination.snapshotId) || facts?.destinationSnapshotId !== destination.snapshotId) add('target-snapshot-mismatch');
    if (!record(destination.project) || !text(destination.project.id)) add('project-missing');
    else if (destination.project.repositoryId !== r.repositoryId) add('project-mismatch');
    const e = destination.execution;
    if (!record(e) || e.available !== true) add('execution-unproven');
    else if (e.providerInstanceId !== r.providerInstanceId || e.model !== r.model
      || e.runtimeMode !== r.runtimeMode || canonical(e.options) !== canonical(r.options)) add('execution-mismatch');
  }
  const required = [...r.requiredCapabilities, ...(r.role === 'author' ? ['worktree-isolation'] : [])];
  for (const name of required) {
    for (const capabilities of [host.capabilities, destination?.capabilities]) {
      const fact = capabilities?.[name];
      if (fact?.value !== true || !evidence(fact.evidence, host.environmentId, now)) add('capability-unproven');
    }
  }
  if (r.role === 'author' && remote) {
    if (route.kind !== 'remote-author-coordinator') add('remote-author-unsupported');
    else {
      const proof = route.authorProof;
      if (proof?.gatesPassed !== true || proof.originEnvironmentId !== input.origin.environmentId
        || proof.environmentId !== host.environmentId || !evidence(proof.evidence, host.environmentId, now)
        || !versionsMatch(proof.originVersions, input.origin.versions)
        || !versionsMatch(proof.destinationVersions, destination?.versions)) add('remote-author-unproven');
    }
  }
  return reasons;
}
