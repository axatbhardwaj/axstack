import { accessSync, constants, lstatSync, readFileSync, readlinkSync, statSync } from 'node:fs';
import { gitHookReadArgv } from './git-argv.js';

const help = `Usage: bun hooks-check.js --repo <checkout>
  --repo <checkout>  Required Git checkout to inspect.
  --help             Show this help.
Read-only. Reads Git config and file metadata. Executes and installs no hooks.
Exit: 0 pass or n/a, 2 hold (fail or unknown), 1 usage, input or Git repository error.`;
const [flag, checkout, ...extra] = process.argv.slice(2);
if (flag === '--help' && checkout === undefined) {
  console.log(help);
  process.exit(0);
}
if (flag !== '--repo' || !checkout || extra.length) {
  console.error(help);
  process.exit(1);
}

const output = (result) => result.stdout.toString().replace(/\n$/, '');
const gitError = (result) => result.stderr.toString().trim() || `Git exited ${result.exitCode}`;

function optional(read) {
  try {
    return read();
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
  }
}

function declarations(repo) {
  const present = (...files) => files.find((file) => optional(() => lstatSync(`${repo}/${file}`)));
  const manifest = optional(() => readFileSync(`${repo}/package.json`, 'utf8'));
  const pkg = manifest === undefined ? {} : JSON.parse(manifest);
  const tools = [];
  const husky = present('.husky/pre-commit')
    || (Object.hasOwn(pkg?.husky?.hooks ?? {}, 'pre-commit') && 'package.json');
  const lefthook = present('lefthook.yml', 'lefthook.yaml', '.lefthook.yml', '.lefthook.yaml');
  const preCommit = present('.pre-commit-config.yaml', '.pre-commit-config.yml');
  if (husky) {
    const useBun = pkg?.packageManager ? /^bun@/.test(pkg.packageManager) : present('bun.lock', 'bun.lockb');
    tools.push({ tool: 'husky', source: husky, install: useBun ? 'bunx husky' : 'npx husky' });
  }
  if (lefthook) tools.push({ tool: 'lefthook', source: lefthook, install: 'lefthook install' });
  if (preCommit) tools.push({ tool: 'pre-commit', source: preCommit, install: 'pre-commit install' });
  return tools;
}

/** @param {'pass'|'fail'|'unknown'|'n/a'} status */
const term = (id, status, evidence) => ({ id, status, evidence });

function inspectPath(id, path, extraEvidence = {}) {
  const evidence = { path, ...extraEvidence };
  let target;
  try {
    if (id === 'hooks-dir') {
      const directory = optional(() => statSync(path))?.isDirectory();
      return term(id, directory ? 'pass' : 'fail', evidence);
    }
    const entry = optional(() => lstatSync(path));
    if (entry?.isSymbolicLink()) {
      target = readlinkSync(path);
      if (!optional(() => statSync(path))?.isFile()) return term(id, 'fail', { ...evidence, target });
    } else if (!entry?.isFile()) {
      return term(id, 'fail', evidence);
    }
    accessSync(path, constants.X_OK);
    return term(id, 'pass', evidence);
  } catch (error) {
    const expected = ['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)
      || (id === 'pre-commit' && error.syscall === 'access' && error.code === 'EACCES');
    return term(id, expected ? 'fail' : 'unknown', { ...evidence, target, error: error.message });
  }
}

function inspect(repo) {
  let declared;
  try {
    const tools = declarations(repo);
    declared = term('declared', tools.length ? 'pass' : 'n/a', { tools });
  } catch (error) {
    declared = term('declared', 'unknown', { error: error.message });
  }
  const paths = ['hooks-dir', 'pre-commit'];
  if (declared.status !== 'pass') {
    return [declared, ...paths.map((id) => term(id, 'n/a', { declared: declared.status }))];
  }

  const config = Bun.spawnSync(gitHookReadArgv(repo, 'config'));
  const resolved = Bun.spawnSync(gitHookReadArgv(repo, 'hooks'));
  const coreHooksPath = config.exitCode === 0 ? config.stdout.toString().slice(0, -1) : null;
  if (![0, 1].includes(config.exitCode) || resolved.exitCode !== 0) {
    const error = gitError(resolved.exitCode !== 0 ? resolved : config);
    return [declared, ...paths.map((id) => term(id, 'unknown', { coreHooksPath, error }))];
  }
  // Keep relative components intact so file lookup follows the same path as Git.
  const gitPath = output(resolved);
  const path = gitPath.startsWith('/') ? gitPath : `${repo}/${gitPath}`;
  return [declared, inspectPath('hooks-dir', path, { coreHooksPath }), inspectPath('pre-commit', `${path}/pre-commit`)];
}

try {
  const root = Bun.spawnSync(gitHookReadArgv(checkout, 'root'));
  if (root.exitCode !== 0) throw Error(gitError(root));
  const repo = output(root);
  const terms = inspect(repo);
  console.log(JSON.stringify({ inputs: { repo }, terms }));
  process.exitCode = terms.some(({ status }) => status === 'fail' || status === 'unknown') ? 2 : 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
