import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const weights = { default_claude_max_20x: 4, default_claude_max_5x: 1, pro: 4, prolite: 1 };
const drivers = { claude: 'claudeAgent', codex: 'codex' };
const home = process.env.HOME;
const expandHome = (path) => path === '~' ? home : path.startsWith('~/') ? `${home}/${path.slice(2)}` : path;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const cacheDir = `${process.env.XDG_CACHE_HOME || `${home}/.cache`}/axstack`;
const cachePath = `${cacheDir}/usage.json`;
let cache;
try { cache = readJson(cachePath); } catch { cache = {}; }

function argumentsFrom(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--json' && !options.json) { options.json = true; continue; }
    if (!['--provider', '--settings'].includes(flag) || flag.slice(2) in options) {
      throw new Error('expected --provider claude|codex [--settings path] [--json]');
    }
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error('missing argument value');
    options[flag.slice(2)] = value;
  }
  if (!Object.hasOwn(drivers, options.provider)) throw new Error('expected --provider claude|codex');
  return options;
}

async function account(instance, provider) {
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
    return { instanceId: instance.id, score: null, state: 'skipped', reason: 'missing credentials' };
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
  let state = 'cached';
  if (!value || Date.now() - value.updatedAt >= 5 * 60 * 1000) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error();
      const usage = await response.json();
      const windows = provider === 'claude'
        ? [usage.five_hour?.utilization, usage.seven_day?.utilization]
        : [usage.rate_limit?.primary_window?.used_percent, usage.rate_limit?.secondary_window?.used_percent];
      const known = windows.filter((value) => typeof value === 'number' && Number.isFinite(value));
      value = { updatedAt: Date.now(),
        tier: provider === 'claude' ? credentials.claudeAiOauth.rateLimitTier : usage.plan_type,
        utilization: known.length ? Math.max(...known) : null, limitReached: usage.rate_limit?.limit_reached === true };
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
  const stale = state === 'stale';
  if (value.utilization >= 95 || value.limitReached) {
    return { instanceId: instance.id, score: null, state: 'excluded', stale, reason: 'usage limit' };
  }
  const weight = Object.hasOwn(weights, value.tier) ? weights[value.tier] : 1;
  return { instanceId: instance.id, score: value.utilization === null ? weight : (100 - value.utilization) * weight,
    state: value.utilization === null ? 'unknown' : state, stale };
}

try {
  const options = argumentsFrom(process.argv.slice(2));
  const settings = readJson(expandHome(options.settings || `${home}/.t3/userdata/settings.json`));
  const instances = [];
  for (const instance of settings.providerInstances.filter((instance) =>
    instance.enabled && instance.driver === drivers[options.provider])) {
    instances.push(await account(instance, options.provider));
  }
  const chosen = instances.filter((instance) => instance.score !== null).sort((a, b) => b.score - a.score)[0];
  if (!chosen) throw new Error('no eligible provider instances');
  console.log(options.json ? JSON.stringify({ chosenInstanceId: chosen.instanceId, instances }) : chosen.instanceId);
} catch {
  console.error('account selection failed: no eligible provider instances or invalid input');
  process.exitCode = 1;
}
