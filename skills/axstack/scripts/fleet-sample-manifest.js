import { record } from './fleet-config.js';
const fail = (reason) => { throw Error(reason); };
const keys = (obj, allowed) => record(obj) && Object.keys(obj).every((k) => allowed.includes(k));
export function validateManifest(manifest, hosts) {
  if (manifest?.schemaVersion !== 1) fail('schema-version: manifest');
  if (!keys(manifest, ['schemaVersion', 'hosts']) || !Array.isArray(manifest.hosts)
    || !manifest.hosts.length || manifest.hosts.length > 64) fail('manifest-schema');
  const ids = new Set(); const destinations = new Set(); let local = false;
  for (const h of manifest.hosts) {
    if (!keys(h, ['hostId', 'environmentId', 'transport', 'destination', 'user'])) fail('manifest-schema');
    if (!hosts.some((c) => c.id === h.hostId && c.environmentId === h.environmentId)) fail('manifest-host');
    if (ids.has(h.hostId)) fail('manifest-duplicate');
    ids.add(h.hostId);
    if (!['local', 'ssh'].includes(h.transport)) fail('manifest-transport');
    if (h.transport === 'local') {
      if (h.destination !== undefined || h.user !== undefined) fail('manifest-schema');
      if (local) fail('manifest-duplicate');
      local = true;
    } else {
      // MagicDNS short names only. SSH aliases, IPs, ports and shell syntax are rejected.
      if (typeof h.destination !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(h.destination)
        || /^\d+$/.test(h.destination)) fail('manifest-destination');
      if (h.user !== undefined && (typeof h.user !== 'string' || !/^[a-z_][a-z0-9_-]{0,31}$/.test(h.user))) fail('manifest-user');
      if (destinations.has(h.destination)) fail('manifest-duplicate');
      destinations.add(h.destination);
    }
  }
  return manifest;
}
export function sampleOptions({ intervalMs = 5000, timeoutMs = 10000 } = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 5000 || intervalMs > 60000) fail('sample-interval');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < intervalMs + 1000 || timeoutMs > 120000) fail('sample-timeout');
  return { intervalMs, timeoutMs };
}
