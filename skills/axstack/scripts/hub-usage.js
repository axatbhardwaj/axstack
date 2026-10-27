import { managementKey } from './hub-secret.js';
// Read-only subset of T3 0.1.3 makeCliproxyApi. Never fetch token files or reset credits.
async function management(config, path, body) {
  const base = new URL(config.url.endsWith('/') ? config.url : `${config.url}/`);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) {
    throw Error('hub requires HTTPS or loopback HTTP');
  }
  if (base.username || base.password || !config.managementKey) throw Error('invalid hub configuration');
  const response = await fetch(new URL(`v0/management/${path}`, base), {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${config.managementKey}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw Error('hub management request refused');
  return response.json();
}

async function accountUsage(config, account, now) {
  const checkedAt = new Date(now).toISOString();
  const driver = account.provider === 'claude' ? 'claudeAgent' : 'codex';
  const base = { id: account.id, driver,
    ...(account.email ? { email: account.email } : {}),
    ...(account.id_token?.chatgpt_account_id ? { workspaceId: account.id_token.chatgpt_account_id } : {}) };
  try {
    if (typeof account.auth_index !== 'string' || !account.auth_index) throw Error('invalid auth index');
    const header = driver === 'codex' ? { Authorization: 'Bearer $TOKEN$', 'Content-Type': 'application/json',
      'OpenAI-Beta': 'codex-1', Originator: 'Codex Desktop',
      ...(base.workspaceId ? { 'Chatgpt-Account-Id': base.workspaceId } : {}) }
      : { Authorization: 'Bearer $TOKEN$', 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'claude-code/2.1.273' };
    const response = await management(config, 'api-call', { auth_index: account.auth_index, method: 'GET',
      url: driver === 'codex' ? 'https://chatgpt.com/backend-api/wham/usage' : 'https://api.anthropic.com/api/oauth/usage', header });
    if (!Number.isInteger(response.status_code) || response.status_code < 200 || response.status_code >= 300 || typeof response.body !== 'string') throw Error('provider refused');
    const usage = JSON.parse(response.body);
    if (!usage || typeof usage !== 'object' || usage.error || usage.errors) throw Error('provider payload error');
    const windows = [];
    if (driver === 'codex') {
      for (const key of ['primary_window', 'secondary_window']) {
        const w = usage.rate_limit?.[key];
        if (w?.reset_at != null && (typeof w.reset_at !== 'number' || !Number.isFinite(w.reset_at))) throw Error('invalid Codex reset');
        const minutes = w?.limit_window_seconds / 60;
        const kind = minutes >= 43200 ? 'monthly' : minutes >= 10080 ? 'weekly' : 'session';
        if (w) windows.push({ id: key === 'primary_window' ? 'primary' : 'secondary', kind, label: kind, usedPercent: w.used_percent,
          ...(typeof w.reset_at === 'number' ? { resetsAt: new Date(w.reset_at * 1000).toISOString() } : {}),
          windowDurationMins: w.limit_window_seconds / 60 });
      }
    } else {
      for (const [key, kind, duration] of [['five_hour', 'session', 300], ['seven_day', 'weekly', 10080]]) {
        const w = usage[key];
        if (w) windows.push({ id: key, kind, label: key, usedPercent: w.utilization,
          ...(w.resets_at == null ? {} : { resetsAt: w.resets_at }), windowDurationMins: duration });
      }
      for (const w of usage.limits ?? []) {
        if (w.kind === 'weekly_scoped') windows.push({ id: `seven_day_${String(w.scope?.model?.display_name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, kind: 'weekly',
          label: `Weekly · ${w.scope?.model?.display_name ?? ''}`, usedPercent: w.percent, ...(w.resets_at == null ? {} : { resetsAt: w.resets_at }), windowDurationMins: 10080 });
      }
    }
    const weeklyOnly = driver === 'codex' && usage.rate_limit?.primary_window?.limit_window_seconds === 604800
      && usage.rate_limit.secondary_window == null && windows.length === 1 && windows[0].kind === 'weekly';
    return { ...base, usageLimits: { checkedAt, windows,
      ...(weeklyOnly ? { notApplicable: { session: 'verified Codex weekly-only response' } } : {}) } };
  } catch {
    return { ...base, usageLimits: { checkedAt, windows: [], unavailable: { reason: 'probeFailed' } } };
  }
}

export async function readHub(settings, now = Date.now(), settingsPath) {
  const sources = Object.entries(settings.usageLimitSources ?? {}).filter(([, s]) => s.enabled === true && s.kind === 'cliproxy');
  if (sources.length !== 1) throw Error('expected exactly one enabled cliproxy usage source');
  const snapshots = [];
  for (const [id, source] of sources) {
    let config;
    try { config = { ...source, managementKey: managementKey(source.managementKey, id, settingsPath) }; }
    catch {
      snapshots.push({ id, kind: 'cliproxy', checkedAt: new Date(now).toISOString(), accounts: [], error: 'hub management key missing or unsafe' });
      continue;
    }
    try {
      const raw = await management(config, 'auth-files');
      if (!Array.isArray(raw.files)) throw Error('invalid account list');
      const files = raw.files.filter((a) => !a.disabled && ['claude', 'codex'].includes(a.provider));
      // Bound work and duration; a large hub needs a separately accepted batching policy.
      if (files.length > 32) throw Error('hub account limit exceeded');
      const accounts = [];
      for (let i = 0; i < files.length; i += 4) {
        accounts.push(...await Promise.all(files.slice(i, i + 4).map((a) => accountUsage(config, a, now))));
      }
      snapshots.push({ id, kind: 'cliproxy', checkedAt: new Date(now).toISOString(), accounts });
    } catch {
      snapshots.push({ id, kind: 'cliproxy', checkedAt: new Date(now).toISOString(), accounts: [], error: 'hub usage unavailable' });
    }
  }
  return snapshots;
}
