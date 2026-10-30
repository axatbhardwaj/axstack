import { readFileSync, writeFileSync } from 'node:fs';
import { bindFleet } from './fleet-dispatch.js';

const fleetFlags = ['--recommendation', '--fleet-input', '--now', '--config-digest'];
const flags = ['--role', '--roles', '--capabilities', '--kind', '--verify', '--out', ...fleetFlags];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const help = `Usage: bun dispatch-plan.js --role <id> --roles <roles.json>
  --capabilities <saved.json> --kind task|launch
  [--verify <configuration.json>] [--out <report.json>]
Example: bun dispatch-plan.js --role axstack-author --roles roles.json --capabilities capabilities.json --kind task

--role          Role ID from the supplied snapshot
--roles         Installed-style roles.json (version 1, roles array)
--capabilities  Saved orchestrator_capabilities JSON; reuse the run's saved snapshot
--kind          task emits target and, for axstack-author, isolation:"worktree"; launch emits modelSelection
--verify        Compare t3_thread_configuration JSON; print evidence then MATCH or each mismatch
--out           Save the payload as full JSON here; stdout is an input/path/omitted-count summary
--recommendation Saved fleet-route recommendation; requires all following fleet flags
--fleet-input   Saved complete selector input, including exact reviewed config bytes
--now           Injected nonnegative epoch-ms evaluation time matching the recommendation
--config-digest Run-pinned config SHA-256; must match facts and recommendation
--help          Show all flags and exit codes

Read-only inputs: reads supplied JSON, spawns adjacent resolve-models.js, writes stdout/stderr.
Writes only the caller's --out path when supplied; no retained state.
Results name input paths. Plan output over 4096 bytes requires --out.
Large verification retains its exit code, prints mismatches and advises --out on stderr.
An unwritable --out still prints verification mismatches and retains exit 2.
An omitted provider label is unknown; exact instance/model/options/mode checks still apply.
Never dispatches or changes snapshots. Reuse recorded exact model pins as given.
Fleet --capabilities is the selected destination's raw saved catalog, digest-bound
by its destination facts. It is never the origin catalog by default.
Fleet verification requires environmentId/projectId and fleetBinding alongside
the effective T3 configuration. C3 collects that host-qualified evidence envelope.
Coordinator routes remain unsupported here. A plan grants no launch authority.
Exit codes: 0 ok, 1 error, 2 hold (including incomplete read-back).
`;

function hold(message) {
  throw Object.assign(new Error(message), { exitCode: 2 });
}

function argumentsFrom(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!flags.includes(flag)) throw new Error(`unexpected argument ${flag}; use --help`);
    const value = args[i + 1];
    if (!nonempty(value) || value.startsWith('--')) throw new Error(`expected value after ${flag}; pass ${flag} <value>`);
    if (flag in options) throw new Error(`duplicate argument ${flag}; pass it once`);
    options[flag] = value;
  }
  for (const flag of ['--role', '--roles', '--capabilities', '--kind']) {
    if (!options[flag]) throw new Error(`expected ${flag}; pass ${flag} <value>`);
  }
  if (fleetFlags.some((flag) => options[flag])) {
    for (const flag of fleetFlags) if (!options[flag]) throw new Error(`expected ${flag} for fleet binding`);
  }
  if (!['task', 'launch'].includes(options['--kind'])) throw new Error('expected --kind task|launch; pass --kind task or --kind launch');
  return options;
}

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { throw new Error(`${error.message}; pass a readable, valid JSON file: ${path}`); }
}

function normalizedOptions(options) {
  const entries = Array.isArray(options) ? options.map((option) => [option?.id, option?.value])
    : options && typeof options === 'object' ? Object.entries(options) : null;
  if (!entries || entries.some(([id, value]) => typeof id !== 'string' || !id.trim()
    || !['string', 'boolean'].includes(typeof value))
    || new Set(entries.map(([id]) => id)).size !== entries.length) return null;
  return JSON.stringify(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function verify(configuration, provider, model, options, fleet) {
  const mismatches = [];
  const selection = configuration?.modelSelection;
  const compare = (field, expected, observed, equal = expected === observed) => {
    if (!equal) mismatches.push(`${field}: ${observed == null ? 'unknown' : 'fail'}; `
      + `expected ${JSON.stringify(expected)}; observed ${JSON.stringify(observed) ?? 'missing'}`);
  };
  // T3 may omit the legacy provider field: the exact instance ID is its binding.
  if (selection?.provider != null) {
    compare('provider', provider, selection.provider,
      (selection.provider === 'claude' ? 'claudeAgent' : selection.provider) === provider);
  }
  compare('instanceId', provider, selection?.instanceId);
  compare('model', model, selection?.model);
  compare('options', options, selection?.options,
    normalizedOptions(options) === normalizedOptions(selection?.options));
  compare('runtimeMode', 'full-access', configuration?.runtimeMode);
  if (fleet) {
    for (const [field, expected] of Object.entries(fleet.destination)) compare(field, expected, configuration?.[field]);
    for (const [field, expected] of Object.entries(fleet.fleetBinding)) compare(field, expected, configuration?.fleetBinding?.[field]);
  }
  return { mismatches, ...(selection?.provider == null ? {
    providerEvidence: `provider: unknown; expected ${JSON.stringify(provider)}; observed missing; `
      + 'provider binding checked via instanceId and saved capabilities',
  } : {}) };
}

function plan(argv, io) {
  if (argv.includes('--help')) {
    io.stdout(help);
    return 0;
  }
  const args = argumentsFrom(argv);
  const inputs = Object.fromEntries(Object.entries(args).filter(([flag]) => flag !== '--out').map(([flag, value]) => [flag.slice(2), value]));
  const emit = (result) => {
    const full = { inputs, ...result };
    const inline = result.mismatches
      ? `${[JSON.stringify({ inputs }), result.providerEvidence, result.mismatches.join('\n') || 'MATCH'].filter(Boolean).join('\n')}\n`
      : `${JSON.stringify(full)}\n`;
    if (!args['--out']) {
      if (new TextEncoder().encode(inline).length > 4096) {
        if (!result.mismatches) throw new Error('large output; pass --out <report.json> to save full JSON');
        io.stderr('Large verification output; pass --out <path>.json for a saved JSON copy\n');
      }
      io.stdout(inline);
      return;
    }
    try { writeFileSync(args['--out'], `${JSON.stringify(full, null, 2)}\n`); }
    catch (error) {
      const message = `${error.message}; pass --out <writable report.json path>`;
      if (!result.mismatches?.length) throw new Error(message);
      io.stderr(`dispatch-plan hold: ${message}\n`);
      io.stdout(inline);
      return;
    }
    io.stdout(`${JSON.stringify({ inputs, reportPath: args['--out'],
      omittedPayloadFields: Object.keys(result).length, omittedMismatches: result.mismatches?.length ?? 0 })}\n`);
  };
  const snapshot = readJSON(args['--roles']);
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.roles)) {
    throw new Error('roles snapshot must have version 1 and a roles array; pass --roles <valid roles.json>');
  }
  const roles = snapshot.roles.filter((role) => role?.id === args['--role']);
  if (roles.length !== 1) hold(`role ${args['--role']} unavailable or ambiguous`);
  const role = roles[0];
  if (!nonempty(role.provider)) hold(`provider unavailable for role ${role.id}`);
  if (role.modeId !== 'full-access' && !(role.provider === 'claude' && role.modeId === 'bypassPermissions')) {
    hold(`mode ${role.modeId ?? 'missing'} unavailable for role ${role.id}`);
  }
  if (!nonempty(role.thinkingOptionId)) hold(`effort unavailable for role ${role.id}`);
  if (!nonempty(role.model) && !nonempty(role.modelClass) && role.model !== null) {
    hold(`model unavailable for role ${role.id}`);
  }
  const modelArgs = typeof role.model === 'string' ? ['--model', role.model]
    : role.modelClass ? ['--class', role.modelClass] : ['--model', String(role.model)];
  const resolved = Bun.spawnSync([process.execPath, `${import.meta.dir}/resolve-models.js`,
    '--provider', role.provider, '--capabilities', args['--capabilities'],
    '--effort', role.thinkingOptionId, ...modelArgs], { stdout: 'pipe', stderr: 'pipe' });
  if (resolved.stderr.length) io.stderr(resolved.stderr.toString());
  if (resolved.exitCode !== 0) return resolved.exitCode === 1 ? 2 : 1;
  const resolution = JSON.parse(resolved.stdout.toString());
  const { model, effortOption, providerInstanceId } = resolution;
  let fleet;
  if (args['--recommendation']) {
    if (!/^\d+$/.test(args['--now'])) throw new Error('evaluation-time');
    fleet = bindFleet(readJSON(args['--fleet-input']), readJSON(args['--recommendation']),
      args['--config-digest'], Number(args['--now']), readFileSync(args['--capabilities'], 'utf8'),
      resolution, role.id === 'axstack-author');
  }
  const options = fleet?.options ?? (effortOption ? [effortOption] : []);
  if (args['--verify']) {
    const verification = verify(readJSON(args['--verify']), providerInstanceId, model, options, fleet);
    emit(verification);
    return verification.mismatches.length ? 2 : 0;
  }
  const selection = { [args['--kind'] === 'launch' ? 'instanceId' : 'providerInstanceId']: providerInstanceId,
    model, options, ...(args['--kind'] === 'task' ? fleet?.destination : {}) };
  emit({ [args['--kind'] === 'launch' ? 'modelSelection' : 'target']: selection, runtimeMode: 'full-access',
    ...(fleet ? { fleetBinding: fleet.fleetBinding, ...(args['--kind'] === 'launch' ? fleet.destination : {}) } : {}),
    ...(args['--kind'] === 'task' && role.id === 'axstack-author' ? { isolation: 'worktree' } : {}) });
  return 0;
}

export function main(argv, io = { stdout: (text) => process.stdout.write(text), stderr: (text) => process.stderr.write(text) }) {
  try { return plan(argv, io); }
  catch (error) {
    io.stderr(`dispatch-plan ${error.exitCode === 2 ? 'hold' : 'error'}: ${error.message}\n`);
    return error.exitCode ?? 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
