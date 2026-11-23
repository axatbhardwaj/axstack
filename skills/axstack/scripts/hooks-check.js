import { accessSync, constants, lstatSync, readFileSync, readlinkSync, statSync } from 'node:fs';
import { gitEnv, gitHookReadArgv } from './git-argv.js';

const help = `Usage: bun hooks-check.js --repo <checkout>
  --repo <checkout>  Required Git checkout to inspect.
  --help             Show this help.
Read-only. Reads Git config and file metadata. Executes and installs no hooks.
Exit: 0 pass or n/a, 2 hold (fail or unknown), 1 usage, input or Git repository error.`;

const paths = ['hooks-dir', 'pre-commit'];
const git = (repo, read) => Bun.spawnSync(gitHookReadArgv(repo, read), { env: gitEnv() });
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
  if (husky) tools.push({ tool: 'husky', source: husky });
  if (lefthook) tools.push({ tool: 'lefthook', source: lefthook });
  if (preCommit) tools.push({ tool: 'pre-commit', source: preCommit });
  return tools;
}

/** @param {'pass'|'fail'|'unknown'|'n/a'} status */
const term = (id, status, evidence) => ({ id, status, evidence });

function inspectPath(id, path, extraEvidence = {}) {
  const evidence = { path, ...extraEvidence };
  let target;
  try {
    if (id === 'hooks-dir') {
      return term(id, statSync(path).isDirectory() ? 'pass' : 'fail', evidence);
    }
    if (lstatSync(path).isSymbolicLink()) target = readlinkSync(path);
    if (!statSync(path).isFile()) return term(id, 'fail', { ...evidence, target });
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
  const config = git(repo, 'config');
  const coreHooksPath = config.exitCode === 0 ? config.stdout.toString().slice(0, -1) : null;
  const unknown = (error) => [declared, ...paths.map((id) => term(id, 'unknown', { coreHooksPath, error }))];
  const unset = config.exitCode === 1 && config.stderr.length === 0;
  if (config.exitCode !== 0 && !unset) return unknown(gitError(config));
  if (coreHooksPath === '') return unknown('core.hooksPath is empty');
  if (unset && declared.status !== 'pass') {
    return [declared, ...paths.map((id) => term(id, 'n/a', { coreHooksPath, declared: declared.status }))];
  }
  const resolved = git(repo, 'hooks');
  if (resolved.exitCode !== 0) return unknown(gitError(resolved));
  // Keep relative components intact so file lookup follows the same path as Git.
  const gitPath = output(resolved);
  const path = gitPath.startsWith('/') ? gitPath : `${repo}/${gitPath}`;
  return [declared, inspectPath('hooks-dir', path, { coreHooksPath }), inspectPath('pre-commit', `${path}/pre-commit`)];
}

const report = (repo, terms) => console.log(JSON.stringify({ inputs: { repo }, terms }));

/** @param {string[]} args */
function main(args) {
  const [flag, checkout, ...extra] = args;
  if (flag === '--help' && checkout === undefined) {
    console.log(help);
    return 0;
  }
  try {
    if (flag !== '--repo' || !checkout || extra.length) throw Error(help);
    const root = git(checkout, 'root');
    if (root.exitCode !== 0) throw Error(gitError(root));
    const repo = output(root);
    const terms = inspect(repo);
    report(repo, terms);
    return terms.some(({ status }) => status === 'fail' || status === 'unknown') ? 2 : 0;
  } catch (error) {
    console.error(error.message);
    report(checkout ?? null, ['declared', ...paths].map((id) => term(id, 'unknown', { error: error.message })));
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
