import { historyCounts } from './driver-history.js';
const routes = [
  ['claudeAgent', 'claude-opus-5-5', 'effort', 'medium'],
  ['codex', 'gpt-6-astra', 'reasoningEffort', 'medium'],
  ['codex', 'gpt-6.1-sol', 'reasoningEffort', 'xhigh'],
];
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const fresh = (date, now, age) => Number.isFinite(Date.parse(date)) && now >= Date.parse(date) && now - Date.parse(date) <= age;
const same = (a, b) => a?.instanceId === b?.instanceId && a?.model === b?.model;

function pool(accounts, driver, now) {
  const members = accounts.filter((a) => a.driver === driver);
  if (!members.length) throw Error(`missing ${driver} accounts`);
  const rows = members.map((a) => {
    const u = a.usageLimits;
    if (u?.unavailable || !fresh(u?.checkedAt, now, 300000) || !Array.isArray(u?.windows)) throw Error(`unknown ${driver} telemetry`);
    const windows = ['session', 'weekly'].map((kind) => {
      const found = u.windows.filter((w) => w.kind === kind && !(driver === 'claudeAgent' && w.id?.startsWith('seven_day_')));
      if (!found.length && driver === 'codex' && kind === 'session'
        && u.notApplicable?.session === 'verified Codex weekly-only response') return null;
      if (found.length !== 1) throw Error(`missing or ambiguous ${driver} ${kind} window`);
      const w = found[0];
      if (!Number.isFinite(w.usedPercent) || w.usedPercent < 0 || w.usedPercent > 100
        || !Number.isFinite(w.windowDurationMins) || w.windowDurationMins <= 0
        || !Number.isFinite(Date.parse(w.resetsAt)) || Date.parse(w.resetsAt) <= now
        || Date.parse(w.resetsAt) - now > w.windowDurationMins * 60000) throw Error(`malformed ${driver} ${kind} window`);
      return { used: w.usedPercent, elapsed: 1 - (Date.parse(w.resetsAt) - now) / (w.windowDurationMins * 60000) };
    });
    const scoped = u.windows.filter((w) => w.id?.startsWith('seven_day_') && /opus/i.test(w.label ?? ''));
    for (const w of scoped) {
      if (!Number.isFinite(w.usedPercent) || w.usedPercent < 0 || w.usedPercent > 100
        || !Number.isFinite(Date.parse(w.resetsAt)) || Date.parse(w.resetsAt) <= now) throw Error('unknown Opus scoped telemetry');
    }
    const viable = windows.every((w) => w === null || w.used < 100) && scoped.every((w) => w.usedPercent < 100);
    // Match T3's pool display: a weekly-blocked account contributes 100% session used.
    if (windows[0] && windows[1].used >= 100) windows[0] = { used: 100, elapsed: null };
    return { windows, viable };
  });
  const applicable = [0, 1].map((i) => rows.flatMap((r) => r.windows[i] ? [r.windows[i]] : []));
  const remaining = applicable.map((ws) => ws.length ? 100 - mean(ws.map((w) => w.used)) : null);
  const pace = applicable.flatMap((ws) => {
    const timed = ws.filter((w) => w.elapsed !== null);
    return timed.length ? [mean(timed.map((w) => w.elapsed * 100 - w.used))] : [];
  });
  return { sessionRemaining: remaining[0], weeklyRemaining: remaining[1],
    sessionStatus: applicable[0].length ? 'applicable' : 'n/a', sessionAccounts: applicable[0].length,
    eligibleAccounts: rows.filter((r) => r.viable).length, score: Math.min(...pace) };
}

function candidates(settings, catalogs, now) {
  return routes.map(([driver, model, option, effort]) => {
    const instances = Object.entries(settings.providerInstances ?? {}).filter(([, p]) => p.enabled === true && p.driver === driver);
    if (instances.length !== 1) throw Error(`missing or ambiguous enabled ${driver} instance`);
    const instanceId = instances[0][0];
    const found = catalogs.filter((c) => c.instanceId === instanceId);
    const c = found[0];
    const m = c?.models?.find((m) => m.slug === model);
    if (found.length !== 1 || c.driver !== driver || c.enabled !== true || c.installed !== true || c.status !== 'ready'
      || !fresh(c.checkedAt, now, 86400000)
      || !m?.capabilities?.optionDescriptors?.some((o) => o.id === option && o.options?.some((v) => v.id === effort))) {
      throw Error(`unverified ${driver} model catalog`);
    }
    return { driver, selection: { instanceId, model, options: [{ id: option, value: effort }] } };
  });
}

export function decide(settings, snapshots, catalogs, now, history = null) {
  const result = { action: 'held', selection: settings.defaultModelSelection,
    projectOverrides: Object.entries(settings.projectSettingsOverrides ?? {})
      .filter(([, p]) => p?.defaultModelSelection !== undefined).map(([id]) => id),
    projectOverrideCoverage: settings.projectSettingsFolded === true ? 'saved settings overrides'
      : 'saved settings overrides only; legacy project records not inspected',
    fairness: 'history unavailable; six-hour UTC tie rotation (not equal chat counts)' };
  try {
    if (!Number.isFinite(now) || !Array.isArray(snapshots) || !snapshots.length || !Array.isArray(catalogs)) throw Error('missing input');
    const all = [];
    const seen = new Set();
    for (const s of snapshots) {
      if (s.error === 'hub management key missing or unsafe') throw Error('hub management key missing or unsafe');
      if (s.kind !== 'cliproxy' || s.error || !fresh(s.checkedAt, now, 300000) || !Array.isArray(s.accounts)) throw Error('unknown source telemetry');
      for (const a of s.accounts) {
        if (!['codex', 'claudeAgent'].includes(a.driver)) continue;
        // Multiple sources may expose one account. Hold rather than double-count capacity.
        const key = `${a.driver}:${a.workspaceId ?? a.email ?? a.id}`;
        if (!a.id || seen.has(key)) throw Error('ambiguous duplicate account');
        seen.add(key); all.push(a);
      }
    }
    const choices = candidates(settings, catalogs, now);
    result.pools = Object.fromEntries(['claudeAgent', 'codex'].map((d) => [d, pool(all, d, now)]));
    const eligible = choices.filter((c) => result.pools[c.driver].eligibleAccounts > 0
      && (c.selection.model !== 'gpt-6-astra'
        || Math.min(...[result.pools.codex.sessionRemaining, result.pools.codex.weeklyRemaining].filter((v) => v !== null)) >= 25));
    if (!eligible.length) throw Error('both pools exhausted; no account has both windows available');
    const best = Math.max(...eligible.map((c) => result.pools[c.driver].score));
    const tied = eligible.filter((c) => best - result.pools[c.driver].score <= 5);
    const current = eligible.find((c) => same(c.selection, result.selection));
    result.history = historyCounts(history, choices, now);
    const counts = result.history.status === 'available' ? result.history.counts : null;
    let chosen;
    if (counts) {
      result.fairness = 'seven-day manual driver starts';
      const count = (c) => counts[c.selection.model];
      const least = Math.min(...tied.map(count));
      // A difference of one is normal; avoid shifting on every timer tick.
      if (!current || best - result.pools[current.driver].score >= 10 || count(current) - least >= 2) {
        chosen = tied.find((c) => count(c) === least);
      }
    }
    if (!chosen && current && best - result.pools[current.driver].score < 10) {
      // Fixed UTC slots prevent starvation without persistent timer state or per-tick rotation.
      const rotation = Math.floor(now / (6 * 3600000)) % choices.length;
      const target = [...choices.slice(rotation), ...choices.slice(0, rotation)].find((c) => tied.includes(c));
      chosen = !counts && tied.includes(current) ? target : current;
    }
    if (!chosen) {
      const index = choices.findIndex((c) => same(c.selection, result.selection));
      chosen = [...choices.slice(index + 1), ...choices.slice(0, index + 1)].find((c) => tied.includes(c));
    }
    const equal = JSON.stringify(chosen.selection) === JSON.stringify(result.selection);
    return { ...result, action: equal ? 'unchanged' : 'update', reason: equal ? 'stable default' : 'capacity or fair tie-break', selection: chosen.selection };
  } catch (error) {
    return { ...result, reason: error.message };
  }
}
