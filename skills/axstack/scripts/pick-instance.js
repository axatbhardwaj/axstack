import { readFileSync } from 'node:fs';

const weights = { default_claude_max_20x: 4, default_claude_max_5x: 1, pro: 4, prolite: 1 };
const drivers = { claude: 'claudeAgent', codex: 'codex' };
const home = process.env.HOME;
const expandHome = (path) => path === '~' ? home : path.startsWith('~/') ? `${home}/${path.slice(2)}` : path;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

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
  const credentials = readJson(`${dir}/${provider === 'claude' ? '.credentials.json' : 'auth.json'}`);
  const headers = provider === 'claude'
    ? { authorization: `Bearer ${credentials.claudeAiOauth.accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20', 'user-agent': 'claude-cli/2.1.0 (external, cli)' }
    : { authorization: `Bearer ${credentials.tokens.access_token}`,
      'chatgpt-account-id': credentials.tokens.account_id };
  const url = provider === 'claude'
    ? process.env.AXSTACK_CLAUDE_USAGE_URL || 'https://api.anthropic.com/api/oauth/usage'
    : process.env.AXSTACK_CODEX_USAGE_URL || 'https://chatgpt.com/backend-api/wham/usage';
  const usage = await (await fetch(url, { headers })).json();
  const tier = provider === 'claude' ? credentials.claudeAiOauth.rateLimitTier : usage.plan_type;
  const windows = provider === 'claude'
    ? [usage.five_hour?.utilization, usage.seven_day?.utilization]
    : [usage.rate_limit?.primary_window?.used_percent, usage.rate_limit?.secondary_window?.used_percent];
  const utilization = Math.max(0, ...windows.filter((value) => typeof value === 'number'));
  return { instanceId: instance.id, score: (100 - utilization) * (weights[tier] ?? 1), state: 'fresh' };
}

try {
  const options = argumentsFrom(process.argv.slice(2));
  const settings = readJson(expandHome(options.settings || `${home}/.t3/userdata/settings.json`));
  const instances = [];
  for (const instance of settings.providerInstances.filter((instance) =>
    instance.enabled && instance.driver === drivers[options.provider])) {
    instances.push(await account(instance, options.provider));
  }
  const chosen = [...instances].sort((a, b) => b.score - a.score)[0];
  if (!chosen) throw new Error('no eligible provider instances');
  console.log(options.json ? JSON.stringify({ chosenInstanceId: chosen.instanceId, instances }) : chosen.instanceId);
} catch {
  console.error('account selection failed: no eligible provider instances or invalid input');
  process.exitCode = 1;
}
