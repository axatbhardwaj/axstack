// Paseo profile merge bookkeeping (no scheduler, model calls, or run state).
//
// Schema distinction (per driver guidance from the host's
// configure_paseo_profiles.js):
// - Bundle file `profiles/paseo.json`: `{ version: 1, agentProfiles: [...] }`
//   with namespaced `axstack-*` profile IDs.
// - Host config file: profiles live at `config.daemon.agentProfiles`.
//   Every other field (top-level keys, other `daemon` keys, custom profiles)
//   must survive the merge byte-for-byte.
//
// Upgrade rule: an owned profile that is still pristine (current hash matches
// the install-time `owned` hash) updates to a newer bundle version WITHOUT
// --force. Only genuine user edits are preserved (or overwritten with
// explicit --force). `force` is never the ordinary upgrade path.
import { hashObject } from './manifest.js';

function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function assertBundleProfiles(bundleProfiles) {
  if (!Array.isArray(bundleProfiles) || bundleProfiles.length === 0) {
    throw new Error('invalid bundle profiles: expected a non-empty agentProfiles array');
  }
  for (const p of bundleProfiles) {
    if (!p || typeof p.id !== 'string' || !p.id.startsWith('axstack-')) {
      throw new Error('invalid bundle profiles: every profile needs a namespaced axstack-* id');
    }
  }
}

function profileEqual(a, b) {
  return hashObject(a) === hashObject(b);
}

// Representative host-shaped config used by tests and docs. Never read from
// or written to a live home; tests copy this fixture into temp dirs.
export function representativeHostConfig() {
  return {
    version: 1,
    cliClientId: 'fixture-client-id',
    daemon: {
      schedules: [{ id: 'daily-check', cron: '0 9 * * *' }],
      notifications: { level: 'all' },
      agentProfiles: [
        { id: 'custom-mine', provider: 'custom', model: 'mine', notes: 'user profile' },
      ],
    },
  };
}

function daemonProfiles(existing) {
  if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
    throw new Error('malformed Paseo config: expected a JSON object');
  }
  if (existing.daemon === undefined) return [];
  if (typeof existing.daemon !== 'object' || existing.daemon === null || Array.isArray(existing.daemon)) {
    throw new Error('malformed Paseo config: daemon must be an object');
  }
  const profiles = existing.daemon.agentProfiles ?? [];
  if (!Array.isArray(profiles)) {
    throw new Error('malformed Paseo config: daemon.agentProfiles must be an array');
  }
  return profiles;
}

function withDaemonProfiles(existing, profiles) {
  const next = clone(existing ?? {});
  if (typeof next.daemon !== 'object' || next.daemon === null || Array.isArray(next.daemon)) {
    next.daemon = {};
  }
  next.daemon = { ...clone(next.daemon), agentProfiles: profiles };
  if (next.version === undefined) next.version = 1;
  return next;
}

export function mergeProfiles(
  existing,
  bundleProfiles,
  { force = false, owned = {}, hash = hashObject } = {},
) {
  assertBundleProfiles(bundleProfiles);
  const report = { created: false, added: [], updated: [], preserved: [] };

  if (existing === null || existing === undefined) {
    report.created = true;
    report.added = bundleProfiles.map((p) => p.id);
    return {
      config: withDaemonProfiles(null, clone(bundleProfiles)),
      report,
    };
  }

  const current = daemonProfiles(existing); // validates shape, throws before mutation
  const next = clone(current);

  for (const wanted of bundleProfiles) {
    const idx = next.findIndex((p) => p && p.id === wanted.id);
    if (idx === -1) {
      next.push(clone(wanted));
      report.added.push(wanted.id);
    } else if (profileEqual(next[idx], wanted)) {
      // already installed and untouched: nothing to do
    } else if (force || (wanted.id in owned && hash(next[idx]) === owned[wanted.id])) {
      // Pristine owned profiles follow bundle upgrades without --force;
      // --force additionally overwrites genuine user edits.
      next[idx] = clone(wanted);
      report.updated.push(wanted.id);
    } else {
      report.preserved.push(wanted.id);
    }
  }
  return { config: withDaemonProfiles(existing, next), report };
}

// Decide which Axstack-owned profiles an uninstall may remove. Only profiles
// whose current bytes still match the install-time hash are removed; user
// edits are preserved and reported.
export function planUninstallProfiles(
  existing,
  manifest,
  { hash = hashObject } = {},
) {
  const current = daemonProfiles(existing); // validates shape, throws before mutation
  const owned = (manifest && manifest.profiles) || {};
  const report = { removed: [], preserved: [] };
  const remaining = [];
  for (const profile of current) {
    const id = profile && profile.id;
    if (typeof id !== 'string' || !(id in owned)) {
      remaining.push(profile);
      continue;
    }
    if (hash(profile) === owned[id]) {
      report.removed.push(id);
    } else {
      remaining.push(profile);
      report.preserved.push(id);
    }
  }
  return { config: withDaemonProfiles(existing, remaining), report };
}
