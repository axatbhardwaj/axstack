import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const home = process.env.HOME;
export const expandHome = (path) => path === '~' ? home : path.startsWith('~/') ? `${home}/${path.slice(2)}` : path;
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const cacheDir = `${process.env.XDG_CACHE_HOME || `${home}/.cache`}/axstack`;
const cachePath = `${cacheDir}/usage.json`;
let cache;

// Keep absolute reset clocks in the shared cache; remaining seconds must age between runs.
function usageWindows(provider, usage, now) {
  if (provider === 'claude') return [
    [usage.five_hour, 18000], [usage.seven_day, 604800],
  ].map(([window, seconds]) => ({ used: window?.utilization, seconds,
    resetAt: typeof window?.resets_at === 'string' ? Date.parse(window.resets_at) : null }));
  return [usage.rate_limit?.primary_window, usage.rate_limit?.secondary_window].map((window) =>
    window ? { used: window.used_percent, seconds: window.limit_window_seconds,
      resetAt: Number.isFinite(window.reset_at) ? window.reset_at * 1000
        : Number.isFinite(window.reset_after_seconds) ? now + window.reset_after_seconds * 1000 : null } : null);
}

export async function accountUsage(instanceId, instance, provider) {
  if (!cache) {
    try { cache = readJson(cachePath); } catch { cache = {}; }
    if (!cache || typeof cache !== 'object' || Array.isArray(cache)) cache = {};
  }
  const config = instance.config ?? {};
  const dir = expandHome((provider === 'claude' ? config.homePath : config.shadowHomePath || config.homePath)
    || `${home}/.${provider}`);
  let credentials;
  try {
    credentials = readJson(`${dir}/${provider === 'claude' ? '.credentials.json' : 'auth.json'}`);
    const valid = provider === 'claude' ? credentials.claudeAiOauth?.accessToken
      : credentials.tokens?.access_token && credentials.tokens?.account_id;
    if (!valid) throw new Error();
  } catch {
    return { instanceId, state: 'skipped', reason: 'missing credentials' };
  }
  const headers = provider === 'claude'
    ? { authorization: `Bearer ${credentials.claudeAiOauth.accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20', 'user-agent': 'claude-cli/2.1.0 (external, cli)' }
    : { authorization: `Bearer ${credentials.tokens.access_token}`,
      'chatgpt-account-id': credentials.tokens.account_id };
  const url = provider === 'claude'
    ? process.env.AXSTACK_CLAUDE_USAGE_URL || 'https://api.anthropic.com/api/oauth/usage'
    : process.env.AXSTACK_CODEX_USAGE_URL || 'https://chatgpt.com/backend-api/wham/usage';
  const key = JSON.stringify([provider, dir]);
  let value = cache[key];
  if (!Number.isFinite(value?.updatedAt) || !(value.utilization === null || Number.isFinite(value.utilization))
    || typeof value.limitReached !== 'boolean') value = undefined;
  let state = 'cached';
  let unauthorized = false;
  if (!value || Date.now() - value.updatedAt >= 5 * 60 * 1000) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      if (!response.ok) { unauthorized = response.status === 401 || response.status === 403; throw new Error(); }
      const usage = await response.json();
      const windows = provider === 'claude'
        ? [usage.five_hour?.utilization, usage.seven_day?.utilization]
        : [usage.rate_limit?.primary_window?.used_percent, usage.rate_limit?.secondary_window?.used_percent];
      const known = windows.filter((value) => typeof value === 'number' && Number.isFinite(value));
      value = { updatedAt: Date.now(),
        tier: provider === 'claude' ? credentials.claudeAiOauth.rateLimitTier : usage.plan_type,
        utilization: known.length ? Math.max(...known) : null, limitReached: usage.rate_limit?.limit_reached === true,
        windows: usageWindows(provider, usage, Date.now()) };
      cache[key] = value;
      state = 'fresh';
      try {
        mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
        writeFileSync(cachePath, JSON.stringify(cache), { mode: 0o600 });
      } catch { /* Cache availability must not prevent account selection. */ }
    } catch {
      state = value ? 'stale' : 'unknown';
      value ??= { tier: credentials.claudeAiOauth?.rateLimitTier, utilization: null };
    }
  }
  return { instanceId, ...value, state, unauthorized };
}
