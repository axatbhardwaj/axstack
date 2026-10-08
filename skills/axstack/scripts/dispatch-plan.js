import { readFileSync } from 'node:fs';

const flags = ['--role', '--roles', '--capabilities', '--picker', '--kind', '--verify'];

function argumentsFrom(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!flags.includes(flag)) throw new Error(`unexpected argument ${flag}`);
    const value = args[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`expected value after ${flag}`);
    if (flag in options) throw new Error(`duplicate argument ${flag}`);
    options[flag] = value;
  }
  for (const flag of flags.filter((flag) => flag !== '--verify')) {
    if (!options[flag]) throw new Error(`expected ${flag}`);
  }
  if (!['task', 'launch'].includes(options['--kind'])) throw new Error('expected --kind task|launch');
  return options;
}

const readJSON = (path) => JSON.parse(readFileSync(path, 'utf8'));

function main() {
  const args = argumentsFrom(process.argv.slice(2));
  const role = readJSON(args['--roles']).roles.find((role) => role.id === args['--role']);
  const picker = readJSON(args['--picker']);
  const modelArgs = typeof role.model === 'string' ? ['--model', role.model]
    : role.modelClass ? ['--class', role.modelClass] : ['--model', String(role.model)];
  const resolved = Bun.spawnSync([process.execPath, `${import.meta.dir}/resolve-models.js`,
    '--provider', role.provider, '--capabilities', args['--capabilities'],
    '--effort', role.thinkingOptionId, ...modelArgs], { stdout: 'pipe', stderr: 'pipe' });
  if (resolved.stderr.length) process.stderr.write(resolved.stderr);
  if (resolved.exitCode !== 0) return resolved.exitCode === 1 ? 2 : 1;
  const { model, effortOption } = JSON.parse(resolved.stdout.toString());
  const selection = { [args['--kind'] === 'launch' ? 'instanceId' : 'providerInstanceId']: picker.chosenInstanceId,
    model, options: effortOption ? [effortOption] : [] };
  console.log(JSON.stringify({ [args['--kind'] === 'launch' ? 'modelSelection' : 'target']: selection,
    runtimeMode: 'full-access' }));
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`dispatch-plan error: ${error.message}`);
  process.exitCode = 1;
}
