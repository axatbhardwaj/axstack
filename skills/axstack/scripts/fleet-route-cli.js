import { readFileSync } from 'node:fs';
import { sampleMain, sampleHelp } from './fleet-sample-cli.js';
import { recommend, parseFleetConfig } from './fleet-route.js';

const help = `Usage: bun fleet-route.js recommend --input <snapshot.json> --now <epoch-ms> [--json]
  [--task <name>] [--config <fleet-routing.json>] [--config-digest <sha256>]

--input          Saved schema-1 facts; no collection or dispatch
--now            Required nonnegative integer evaluation time; no ambient clock
--task           Override the saved request's task preference
--config         Reviewed account-local config (default: ~/.config/haoshoku/fleet-routing.json)
--config-digest  Run-pinned SHA-256; otherwise required in saved input.configDigest
--json           Emit complete recommendation JSON; errors are JSON on stderr
--help           Show this interface

Reads only the supplied input and config. Writes stdout/stderr only.
No network, authentication, dispatch, config changes or retained state.
Required session capabilities must be proven on the actual destination session;
an origin catalog or transferred credentials cannot establish them.
Exclusions with reasons are supplied in input.exclusions.hosts/routes.
Use sample or sample-recommend for bounded collection.
Exit codes: 0 recommendation/help, 1 input/config error, 2 no executable route.
`;

const fail = (code) => { throw new Error(code); };
function readInput(path) {
  let value;
  try { value = readFileSync(path, 'utf8'); } catch { fail('missing-input'); }
  try { return JSON.parse(value); } catch { fail('input-json'); }
}

function defaultConfigPath() {
  return process.env.HOME ? `${process.env.HOME}/.config/haoshoku/fleet-routing.json` : null;
}

export async function main(argv) {
  try {
    if (argv.length === 1 && argv[0] === '--help') {
      process.stdout.write(help + sampleHelp);
      return 0;
    }
    if (['sample', 'sample-recommend'].includes(argv[0])) return await sampleMain(argv, defaultConfigPath());
    if (argv[0] !== 'recommend') fail('unexpected-command');
    const args = {};
    for (let i = 1; i < argv.length; i++) {
      const flag = argv[i];
      if (!['--input', '--now', '--task', '--config', '--config-digest', '--json'].includes(flag)) fail('unexpected-argument');
      if (Object.hasOwn(args, flag)) fail('duplicate-argument');
      if (flag === '--json') { args[flag] = true; continue; }
      const value = argv[++i];
      if (!value?.trim() || value.startsWith('--')) fail('missing-argument');
      args[flag] = value;
    }
    if (!args['--input'] || !args['--now']) fail('missing-argument');
    if (!/^\d+$/.test(args['--now'])) fail('evaluation-time');
    const now = Number(args['--now']);
    const input = readInput(args['--input']);
    if (!input || typeof input !== 'object' || Array.isArray(input) || input.schemaVersion !== 1) fail('schema-version: input');
    let configText;
    const configPath = args['--config'] ?? defaultConfigPath();
    try {
      if (!configPath) fail('missing-config');
      configText = readFileSync(configPath, 'utf8');
    } catch { fail('missing-config'); }
    const configDigest = args['--config-digest'] ?? input.configDigest;
    parseFleetConfig(configText, configDigest);
    if (input.configDigest !== undefined && input.configDigest !== configDigest) fail('config-digest-mismatch');
    if (input.configText !== undefined && input.configText !== configText) fail('config-snapshot-mismatch');
    const result = recommend({ ...input, configText, configDigest,
      request: args['--task'] ? { ...input.request, task: args['--task'] } : input.request }, now);
    process.stdout.write(args['--json'] ? `${JSON.stringify(result)}\n`
      : `${result.stage}: ${result.selected?.hostId ?? 'no host'} (${result.reason})\n`);
    return result.selected ? 0 : 2;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: { code: error.message.split(':')[0], message: error.message } })}\n`);
    return 1;
  }
}
