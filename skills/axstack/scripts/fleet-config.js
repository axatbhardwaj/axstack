// Configuration is reviewed data. This module does not read account-local files.
export function fail(code) { throw new Error(code); }
export const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const text = (value) => typeof value === 'string' && value.trim().length > 0;
export const time = (value) => Number.isSafeInteger(value) && value >= 0;
const bp = (value) => Number.isInteger(value) && value >= 0 && value <= 10000;

// Canonical comparison for JSON settings, independent of property insertion order.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function evidence(value, environmentId, now) {
  return record(value) && value.environmentId === environmentId && text(value.pointer)
    && time(value.observedAt) && value.observedAt <= now;
}

export function parseFleetConfig(configText, expectedDigest) {
  if (!text(configText)) fail('missing-config');
  if (typeof expectedDigest !== 'string' || !/^[a-f0-9]{64}$/.test(expectedDigest)) fail('config-digest');
  const digest = new Bun.CryptoHasher('sha256').update(configText).digest('hex');
  if (digest !== expectedDigest) fail('config-digest-mismatch');
  let config;
  try { config = JSON.parse(configText); } catch { fail('config-json'); }
  if (!record(config) || config.schemaVersion !== 1) fail('schema-version: config');
  if (!Array.isArray(config.hosts) || config.hosts.length === 0) fail('config-host');
  const ids = new Set();
  const environments = new Set();
  for (const host of config.hosts) {
    if (!record(host) || !text(host.id) || !text(host.environmentId) || ids.has(host.id)
      || environments.has(host.environmentId) || !record(host.capabilities)) fail('config-host');
    ids.add(host.id); environments.add(host.environmentId);
    if (!bp(host.fallbackLimitBp)) fail('config-threshold');
  }
  if (!bp(config.balanceLimitBp)) fail('config-threshold');
  const order = (value, complete) => Array.isArray(value) && value.every((id) => ids.has(id))
    && new Set(value).size === value.length && (!complete || value.length === ids.size);
  if (!order(config.defaultOrder, true) || !order(config.pool, false) || !record(config.taskOrders)
    || Object.values(config.taskOrders).some((o) => !order(o, true))) fail('config-order');
  if (!Array.isArray(config.routes)) fail('config-route');
  const routeIds = new Set();
  for (const route of config.routes) {
    if (!record(route) || !text(route.id) || routeIds.has(route.id) || !text(route.originEnvironmentId)
      || !environments.has(route.environmentId) || typeof route.enabled !== 'boolean'
      || !['local', 'remote', 'remote-author-coordinator'].includes(route.kind)
      || (route.kind === 'local') !== (route.originEnvironmentId === route.environmentId)) fail('config-route');
    routeIds.add(route.id);
  }
  return config;
}

export function validateInput(input, now) {
  if (!time(now)) fail('evaluation-time');
  if (!record(input) || input.schemaVersion !== 1) fail('schema-version: input');
  if (!record(input.origin) || !text(input.origin.environmentId) || !record(input.origin.versions)) fail('origin-schema');
  const r = input.request;
  if (!record(r) || !text(r.task) || !['reader', 'author'].includes(r.role)
    || !Array.isArray(r.requiredCapabilities) || !r.requiredCapabilities.every(text)
    || !text(r.repositoryId) || !text(r.providerInstanceId) || !text(r.model)
    || !record(r.options) || !text(r.runtimeMode)) fail('request-schema');
  for (const key of ['destinations', 'routeFacts', 'telemetry', 'assignments', 'pendingAssignments']) {
    if (!Array.isArray(input[key])) fail(`${key}-schema`);
  }
  if (!['known', 'unknown'].includes(input.inventoryStatus)
    || (input.inventoryStatus === 'known' && (!time(input.inventoryObservedAt) || input.inventoryObservedAt > now))) fail('inventory-schema');
  if (!record(input.exclusions) || !record(input.exclusions.hosts) || !record(input.exclusions.routes)
    || !Object.values(input.exclusions.hosts).every(text) || !Object.values(input.exclusions.routes).every(text)) fail('exclusions-schema');
  // Reject ambiguous joins, rather than choosing whichever duplicate arrived first.
  for (const [key, id] of [['destinations', 'environmentId'], ['routeFacts', 'routeId'], ['telemetry', 'environmentId']]) {
    const seen = new Set();
    for (const value of input[key]) {
      if (!record(value) || !text(value[id]) || seen.has(value[id])) fail(`${key}-schema`);
      seen.add(value[id]);
    }
  }
}
