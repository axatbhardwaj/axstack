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

function isConfiguredProfile(profile) {
  return typeof profile?.model === 'string' && profile.model.length > 0;
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
  const report = {
    created: existing === null || existing === undefined,
    added: [],
    updated: [],
    preserved: [],
    deferred: [],
    removed: [],
    released: [],
  };
  const configured = bundleProfiles.filter((profile) => {
    if (isConfiguredProfile(profile)) return true;
    report.deferred.push(profile.id);
    return false;
  });
  const current = report.created
    ? []
    : daemonProfiles(existing); // validates shape, throws before mutation
  const next = clone(current);

  // A setup-only bundle entry is never written to Paseo. Upgrade cleanup is
  // narrower: remove only an unconfigured live entry whose current bytes
  // still match Axstack's bound ownership hash. User-edited or unknown entries
  // survive even with --force; a missing entry merely releases stale ownership.
  for (const id of report.deferred) {
    const idx = next.findIndex((profile) => profile?.id === id);
    if (idx === -1) {
      if (id in owned) report.released.push(id);
    } else if (
      !isConfiguredProfile(next[idx]) &&
      id in owned &&
      hash(next[idx]) === owned[id]
    ) {
      next.splice(idx, 1);
      report.removed.push(id);
    } else {
      report.preserved.push(id);
    }
  }

  for (const wanted of configured) {
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
