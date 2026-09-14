// Paseo profile merge bookkeeping (no scheduler, model calls, or run state).
//
// Schema distinction (per driver guidance from the host's
// configure_paseo_profiles.js):
// - Bundle preset file `profiles/presets/<preset>.json`:
//   `{ version: 1, preset, agentProfiles: [...] }`
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

export const LEGACY_REVIEWER_IDS = Object.freeze([
  'axstack-reviewer-opus',
  'axstack-reviewer-sol',
]);

const PROVIDER_BOUNDS = Object.freeze({
  mixed: new Set(['codex', 'claude']),
  'codex-only': new Set(['codex']),
  'claude-only': new Set(['claude']),
});

const AUTHORED_ROUTES = Object.freeze({
  mixed: {
    'codex/gpt-5.6-sol': ['axstack-reviewer-secondary', 'claude/claude-opus-5', 'medium'],
    'claude/claude-opus-5': ['axstack-reviewer-primary', 'codex/gpt-5.6-sol', 'medium'],
  },
  'codex-only': {
    'codex/gpt-5.6-sol': ['axstack-reviewer-secondary', 'codex/gpt-5.6-terra', 'xhigh'],
  },
  'claude-only': {
    'claude/claude-opus-5': ['axstack-reviewer-secondary', 'claude/claude-sonnet-5', 'xhigh'],
  },
});

export function assessProfileReadiness(existing, presetProfiles, preset) {
  assertBundleProfiles(presetProfiles);
  const bounds = PROVIDER_BOUNDS[preset];
  if (!bounds) throw new Error(`cannot assess readiness for unknown preset: ${preset}`);
  const current = daemonProfiles(existing);
  const byId = new Map(current.filter((profile) => profile?.id).map((profile) => [profile.id, profile]));
  const expectedById = new Map(presetProfiles.map((profile) => [profile.id, profile]));
  const gaps = [];
  const gapIds = new Set();
  const addGap = (message, ...ids) => {
    gaps.push(message);
    for (const id of ids) gapIds.add(id);
  };
  const isDeferred = (profile) =>
    preset === 'mixed' && profile.id === 'axstack-checker' && profile.model === null;

  for (const wanted of presetProfiles) {
    if (isDeferred(wanted)) continue;
    const live = byId.get(wanted.id);
    if (!live) {
      addGap(`${wanted.id} is missing`, wanted.id);
      continue;
    }
    if (!bounds.has(live.provider)) {
      addGap(
        `${wanted.id} provider ${JSON.stringify(live.provider)} is outside ${preset} bounds (${[...bounds].join('|')})`,
        wanted.id,
      );
    }
    if (typeof live.model !== 'string' || live.model.trim() === '') {
      addGap(`${wanted.id} requires a configured model`, wanted.id);
    }
  }

  for (const id of LEGACY_REVIEWER_IDS) {
    if (byId.has(id)) addGap(`legacy reviewer remains: ${id}`, id);
  }

  const primary = byId.get('axstack-reviewer-primary');
  const secondary = byId.get('axstack-reviewer-secondary');
  if (primary && secondary) {
    if (
      typeof primary.model === 'string' &&
      typeof secondary.model === 'string' &&
      primary.model === secondary.model
    ) {
      addGap(
        'reviewer pair must use two distinct models',
        'axstack-reviewer-primary',
        'axstack-reviewer-secondary',
      );
    }
    if (preset === 'mixed' && primary.provider === secondary.provider) {
      addGap(
        'mixed reviewer pair must use different providers',
        'axstack-reviewer-primary',
        'axstack-reviewer-secondary',
      );
    }
  }

  const author = byId.get('axstack-author');
  if (author && expectedById.has('axstack-author')) {
    const authorRoute = `${author.provider}/${author.model}`;
    const route = AUTHORED_ROUTES[preset]?.[authorRoute];
    if (!route) {
      addGap(`authored routing gap: unsupported axstack-author route ${authorRoute}`, 'axstack-author');
    } else {
      const [reviewerId, reviewerRoute, effort] = route;
      const reviewer = byId.get(reviewerId);
      if (
        !reviewer ||
        `${reviewer.provider}/${reviewer.model}` !== reviewerRoute ||
        reviewer.thinkingOptionId !== effort
      ) {
        addGap(
          `authored routing gap: ${reviewerId} must be ${reviewerRoute}/${effort} for author ${authorRoute}`,
          'axstack-author',
          reviewerId,
        );
      }
    }
  }

  const deviations = [];
  const comparableFields = [
    'name', 'notes', 'icon', 'color', 'provider', 'model', 'thinkingOptionId', 'modeId',
  ];
  for (const wanted of presetProfiles) {
    if (isDeferred(wanted) || gapIds.has(wanted.id)) continue;
    const live = byId.get(wanted.id);
    if (!live) continue;
    const fields = comparableFields.filter((field) => live[field] !== wanted[field]);
    if (fields.length > 0) deviations.push(`${wanted.id} differs in ${fields.join(', ')}`);
  }

  return { ready: gaps.length === 0, gaps, deviations };
}

function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

export function assertBundleProfiles(bundleProfiles) {
  if (!Array.isArray(bundleProfiles) || bundleProfiles.length === 0) {
    throw new Error('invalid bundle profiles: expected a non-empty agentProfiles array');
  }
  const ids = new Set();
  for (const p of bundleProfiles) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      throw new Error('invalid bundle profiles: every profile must be an object');
    }
    for (const field of ['id', 'name', 'provider']) {
      if (typeof p[field] !== 'string' || p[field].trim() === '') {
        throw new Error(`invalid bundle profiles: every profile needs a non-empty ${field} string`);
      }
    }
    if (!p.id.startsWith('axstack-')) {
      throw new Error('invalid bundle profiles: every profile needs a namespaced axstack-* id');
    }
    if (ids.has(p.id)) {
      throw new Error(`invalid bundle profiles: duplicate profile ID ${p.id}`);
    }
    ids.add(p.id);
    if (!Object.hasOwn(p, 'model')) {
      throw new Error('invalid bundle profiles: model must be a non-empty string or explicit null');
    }
    if (p.model !== null && (typeof p.model !== 'string' || p.model.trim() === '')) {
      throw new Error('invalid bundle profiles: model must be a non-empty string or explicit null');
    }
    for (const field of ['icon', 'color', 'modeId', 'thinkingOptionId', 'notes']) {
      if (p[field] !== undefined && typeof p[field] !== 'string') {
        throw new Error(`invalid bundle profiles: ${field} must be a string when present`);
      }
    }
    if (
      p.featureValues !== undefined &&
      (typeof p.featureValues !== 'object' || p.featureValues === null || Array.isArray(p.featureValues))
    ) {
      throw new Error('invalid bundle profiles: featureValues must be an object when present');
    }
  }
}

function profileEqual(a, b) {
  return hashObject(a) === hashObject(b);
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
  if (bundleProfiles.some((profile) => profile.model === null)) {
    throw new Error('invalid profile merge: explicit-null profiles must be deferred before merge');
  }
  const report = {
    created: existing === null || existing === undefined,
    added: [],
    updated: [],
    preserved: [],
    unchanged: [],
  };
  const current = report.created
    ? []
    : daemonProfiles(existing); // validates shape, throws before mutation
  const next = clone(current);

  for (const wanted of bundleProfiles) {
    const idx = next.findIndex((p) => p && p.id === wanted.id);
    if (idx === -1) {
      next.push(clone(wanted));
      report.added.push(wanted.id);
    } else if (profileEqual(next[idx], wanted)) {
      // Byte equality never grants ownership. Surface unowned matches so an
      // operator can distinguish them from profiles this installer owns.
      if (!(wanted.id in owned)) report.unchanged.push(wanted.id);
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

// Reconcile explicit-null setup templates before merge. Deferred IDs never
// remain owned. An exact hash-owned entry may be removed (including a pristine
// configured entry from another preset); every unowned or edited entry is
// preserved.
export function reconcileDeferredProfiles(
  existing,
  deferredProfiles,
  { owned = {}, hash = hashObject } = {},
) {
  assertBundleProfiles(deferredProfiles);
  if (deferredProfiles.some((profile) => profile.model !== null)) {
    throw new Error('invalid deferred profiles: expected explicit null model');
  }
  const created = existing === null || existing === undefined;
  const next = clone(created ? [] : daemonProfiles(existing));
  const report = { deferred: [], removed: [], released: [], preserved: [] };

  for (const wanted of deferredProfiles) {
    const id = wanted.id;
    report.deferred.push(id);
    const idx = next.findIndex((profile) => profile?.id === id);
    if (
      idx !== -1 &&
      id in owned &&
      hash(next[idx]) === owned[id]
    ) {
      next.splice(idx, 1);
      report.removed.push(id);
      continue;
    }
    if (idx !== -1) report.preserved.push(id);
    if (id in owned) report.released.push(id);
  }

  return { config: withDaemonProfiles(existing, next), report, created };
}

// Retire only legacy reviewer entries whose exact current bytes are owned by
// this installation. Unknown and edited entries are preserved as visible
// setup gaps; byte equality with any shipped profile never grants ownership.
export function reconcileLegacyProfiles(
  existing,
  { owned = {}, hash = hashObject } = {},
) {
  const created = existing === null || existing === undefined;
  const next = clone(created ? [] : daemonProfiles(existing));
  const report = { migrated: [], legacyGaps: [] };

  for (const id of LEGACY_REVIEWER_IDS) {
    const idx = next.findIndex((profile) => profile?.id === id);
    if (idx === -1) continue;
    if (id in owned && hash(next[idx]) === owned[id]) {
      next.splice(idx, 1);
      report.migrated.push(id);
    } else {
      report.legacyGaps.push(id);
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
