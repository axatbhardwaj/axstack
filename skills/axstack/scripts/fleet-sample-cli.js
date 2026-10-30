import { readFileSync } from 'node:fs';
import { parseFleetConfig, recommend } from './fleet-route.js';
import { sampleFleet } from './fleet-sample.js';
import { sampleOptions, validateManifest } from './fleet-sample-manifest.js';
export const sampleHelp = `
Usage: bun fleet-route.js sample --fleet <manifest.json> --config-digest <sha256> [--config <path>] [--json]
       bun fleet-route.js sample-recommend --fleet <manifest.json> --input <snapshot.json>
         --config-digest <sha256> [--config <path>] [--json]
--fleet        Schema-1 manifest; exact host/environment joins; local or SSH transport
--interval-ms  Integer 5000..60000; default 5000; minimum gap between two reads
--timeout-ms   Per-host whole-collection deadline; default 10000; interval+1000..120000
--config       Same reviewed config/default path as recommend; explicit digest required
--input        sample-recommend only: C1 access/project/capability/assignment facts
--json         Full sample report or {input,evaluatedAt,recommendation} replay envelope

Sample commands read Linux /proc/stat and /proc/meminfo locally or through bounded,
noninteractive SSH argv to validated MagicDNS short names with existing identities.
They use collector receipt time, collect hosts concurrently, and write stdout/stderr only.
Window duration brackets transport plus reads and interval; it is not native history.
Unknown telemetry never grants a route. No dispatch, config mutation or retained state.
Exit codes: 0 sample/recommendation, 1 input/config error, 2 no executable route.
`;
const fail = (code) => { throw Error(code); };
function read(path, name, json = true) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { fail(`missing-${name}`); }
  if (!json) return text;
  try { return JSON.parse(text); } catch { fail(`${name}-json`); }
}
export async function sampleMain(argv) {
  const command = argv[0]; const args = {};
  const flags = ['--fleet', '--config', '--config-digest', '--interval-ms', '--timeout-ms', '--json',
    ...(command === 'sample-recommend' ? ['--input', '--task'] : [])];
  for (let i = 1; i < argv.length; i++) {
    const flag = argv[i];
    if (!flags.includes(flag)) fail('unexpected-argument');
    if (Object.hasOwn(args, flag)) fail('duplicate-argument');
    if (flag === '--json') { args[flag] = true; continue; }
    const value = argv[++i];
    if (!value?.trim() || value.startsWith('--')) fail('missing-argument');
    args[flag] = value;
  }
  if (!args['--fleet'] || (command === 'sample-recommend' && !args['--input'])) fail('missing-argument');
  const numeric = (name, fallback, reason) => {
    if (args[name] === undefined) return fallback;
    if (!/^\d+$/.test(args[name])) fail(reason);
    return Number(args[name]);
  };
  const options = sampleOptions({ intervalMs: numeric('--interval-ms', 5000, 'sample-interval'),
    timeoutMs: numeric('--timeout-ms', 10000, 'sample-timeout') });
  const configPath = args['--config'] ?? (process.env.HOME
    ? `${process.env.HOME}/.config/haoshoku/fleet-routing.json` : null);
  const configText = read(configPath, 'config', false);
  const configDigest = args['--config-digest'];
  const config = parseFleetConfig(configText, configDigest);
  const manifest = validateManifest(read(args['--fleet'], 'manifest'), config.hosts);
  let input;
  if (command === 'sample-recommend') {
    input = read(args['--input'], 'input');
    if (input?.configDigest !== undefined && input.configDigest !== configDigest) fail('config-digest-mismatch');
    if (input?.configText !== undefined && input.configText !== configText) fail('config-snapshot-mismatch');
    input = { ...input, configText, configDigest, request: args['--task']
      ? { ...input.request, task: args['--task'] } : input?.request };
    recommend(input, Date.now()); // Validate supplied security facts before any network read.
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  let samples;
  try { samples = await sampleFleet(manifest, config.hosts, options, { signal: controller.signal }); }
  finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
  const evaluatedAt = Date.now();
  if (command === 'sample') {
    process.stdout.write(`${JSON.stringify({ ...samples, telemetry: samples.telemetry.map((s) => ({ ...s, ageMs: evaluatedAt - s.receivedAt })),
      configDigest, collectedAt: evaluatedAt })}\n`);
    return 0;
  }
  input = { ...input, telemetry: samples.telemetry };
  const recommendation = recommend(input, evaluatedAt);
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, input, evaluatedAt, recommendation })}\n`);
  return recommendation.selected ? 0 : 2;
}
