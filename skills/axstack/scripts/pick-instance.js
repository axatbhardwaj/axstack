import { accountUsage, expandHome, readJson } from './account-usage.js';

const weights = {
  claude: { default_claude_max_20x: 4, default_claude_max_5x: 1 }, codex: { pro: 4, prolite: 1 },
};
const drivers = { claude: 'claudeAgent', codex: 'codex' };
const home = process.env.HOME;

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

async function account(instanceId, instance, provider) {
  const value = await accountUsage(instanceId, instance, provider);
  if (value.state === 'skipped') return { instanceId, score: null, state: value.state, reason: value.reason };
  const stale = value.state === 'stale';
  if (value.utilization >= 95 || value.limitReached) {
    return { instanceId, score: null, state: 'excluded', stale, reason: 'usage limit' };
  }
  const weight = Object.hasOwn(weights[provider], value.tier) ? weights[provider][value.tier] : 1;
  return { instanceId, score: value.utilization === null ? weight : (100 - value.utilization) * weight,
    state: value.utilization === null ? 'unknown' : value.state, stale };
}

try {
  const options = argumentsFrom(process.argv.slice(2));
  const settings = readJson(expandHome(options.settings || `${home}/.t3/userdata/settings.json`));
  if (!settings?.providerInstances || typeof settings.providerInstances !== 'object'
    || Array.isArray(settings.providerInstances)) throw new Error();
  const instances = [];
  for (const [instanceId, instance] of Object.entries(settings.providerInstances).filter(([, instance]) =>
    instance.enabled && instance.driver === drivers[options.provider])) {
    instances.push(await account(instanceId, instance, options.provider));
  }
  const chosen = instances.filter((instance) => instance.score !== null).sort((a, b) => b.score - a.score)[0];
  if (!chosen) {
    console.error('account selection hold: no eligible provider instances');
    process.exitCode = 2;
  } else {
    console.log(options.json ? JSON.stringify({ chosenInstanceId: chosen.instanceId, instances }) : chosen.instanceId);
  }
} catch {
  console.error('account selection failed: invalid input/settings or unexpected error');
  process.exitCode = 1;
}
