import { readFileSync, writeFileSync } from 'node:fs';

const flags = ['--role', '--roles', '--capabilities', '--picker', '--kind', '--verify', '--out'];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const help = `Usage: bun dispatch-plan.js --role <id> --roles <roles.json>
  --capabilities <saved.json> --picker <picker.json> --kind task|launch
  [--verify <configuration.json>] [--out <report.json>]
Example: bun dispatch-plan.js --role axstack-author --roles roles.json --capabilities capabilities.json --picker picker.json --kind launch

--role          Role ID from the supplied snapshot
--roles         Installed-style roles.json (version 1, roles array)
--capabilities  Saved orchestrator_capabilities JSON; reuse the run's saved snapshot
--picker        Saved picker JSON; uses chosenInstanceId
--kind          task emits target; launch emits modelSelection
--verify        Compare t3_thread_configuration JSON; print MATCH or each mismatch
--out           Write full JSON here and print input/path/omitted-count summary
--help          Show all flags and exit codes

Read-only inputs: reads supplied JSON, spawns adjacent resolve-models.js, writes stdout/stderr.
Writes only the caller's --out path when supplied; no retained state.
Results name input paths. Plan output over 4096 bytes requires --out.
Large verification retains its exit code, prints mismatches and advises --out on stderr.
Never dispatches or changes snapshots. Reuse recorded exact model pins as given.
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
  for (const flag of flags.filter((flag) => !['--verify', '--out'].includes(flag))) {
    if (!options[flag]) throw new Error(`expected ${flag}; pass ${flag} <value>`);
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

function verify(configuration, instanceId, provider, model, options) {
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
  compare('instanceId', instanceId, selection?.instanceId);
  compare('model', model, selection?.model);
  compare('options', options, selection?.options,
    normalizedOptions(options) === normalizedOptions(selection?.options));
  compare('runtimeMode', 'full-access', configuration?.runtimeMode);
  return mismatches;
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
      ? `${JSON.stringify({ inputs })}\n${result.mismatches.join('\n') || 'MATCH'}\n` : `${JSON.stringify(full)}\n`;
    if (!args['--out']) {
      if (new TextEncoder().encode(inline).length > 4096) {
        if (!result.mismatches) throw new Error('large output; pass --out <report.json> to save full JSON');
        io.stderr('Large verification output; pass --out <path>.json for the full list\n');
      }
      io.stdout(inline);
      return;
    }
    try { writeFileSync(args['--out'], `${JSON.stringify(full, null, 2)}\n`); }
    catch (error) { throw new Error(`${error.message}; pass --out <writable report.json path>`); }
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
  const picker = readJSON(args['--picker']);
  if (!nonempty(picker?.chosenInstanceId)) hold('picker chosen instance unavailable');
  const modelArgs = typeof role.model === 'string' ? ['--model', role.model]
    : role.modelClass ? ['--class', role.modelClass] : ['--model', String(role.model)];
  const resolved = Bun.spawnSync([process.execPath, `${import.meta.dir}/resolve-models.js`,
    '--provider', role.provider, '--capabilities', args['--capabilities'],
    '--effort', role.thinkingOptionId, ...modelArgs], { stdout: 'pipe', stderr: 'pipe' });
  if (resolved.stderr.length) io.stderr(resolved.stderr.toString());
  if (resolved.exitCode !== 0) return resolved.exitCode === 1 ? 2 : 1;
  const { model, effortOption, providerInstanceId } = JSON.parse(resolved.stdout.toString());
  const chosen = readJSON(args['--capabilities']).providers
    .filter((provider) => provider.providerInstanceId === picker.chosenInstanceId);
  if (chosen.length !== 1 || chosen[0].driverKind !== providerInstanceId
    || (['grok', 'antigravity'].includes(role.provider) && picker.chosenInstanceId !== providerInstanceId)) {
    hold(`picker instance ${picker.chosenInstanceId} does not bind provider ${role.provider}`);
  }
  const selectedModel = chosen[0].models?.find((entry) => entry.id === model);
  if (!selectedModel) hold(`model ${model} unavailable on instance ${picker.chosenInstanceId}`);
  if (effortOption && !selectedModel.options?.some((option) => option.id === effortOption.id
    && option.options?.some((value) => value.id === effortOption.value))) {
    hold(`effort ${effortOption.value} unavailable on instance ${picker.chosenInstanceId}`);
  }
  const options = effortOption ? [effortOption] : [];
  if (args['--verify']) {
    const mismatches = verify(readJSON(args['--verify']), picker.chosenInstanceId, providerInstanceId, model, options);
    emit({ mismatches });
    return mismatches.length ? 2 : 0;
  }
  const selection = { [args['--kind'] === 'launch' ? 'instanceId' : 'providerInstanceId']: picker.chosenInstanceId,
    model, options };
  emit({ [args['--kind'] === 'launch' ? 'modelSelection' : 'target']: selection, runtimeMode: 'full-access' });
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
