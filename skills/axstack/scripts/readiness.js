#!/usr/bin/env bun
import { readFileSync, mkdirSync, writeFileSync, lstatSync, realpathSync, renameSync, unlinkSync } from 'node:fs';
import { executeDeclared } from './readiness-run.js';

const scriptVersion = '1.1.0';
const criteriaVersion = 1;

function gitOutput(repo, args, stdin = 'ignore') {
  const argv = ['git', '--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-C', repo, ...args];
  const result = Bun.spawnSync(argv, { stdout: 'pipe', stderr: 'pipe', stdin });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim());
  return result.stdout;
}

function git(repo, ...args) {
  return gitOutput(repo, args).toString();
}

function readTextBlobs(repo, ids) {
  const unique = [...new Set(ids)];
  const text = new Map();
  if (!unique.length) return text;
  const data = gitOutput(repo, ['cat-file', '--batch'], new TextEncoder().encode(`${unique.join('\n')}\n`));
  let offset = 0;
  for (const oid of unique) {
    const end = data.indexOf(10, offset);
    const header = end < 0 ? null : /^([0-9a-f]+) blob (\d+)$/.exec(data.subarray(offset, end).toString());
    const size = Number(header?.[2]);
    const start = end + 1;
    if (header?.[1] !== oid || !Number.isSafeInteger(size) || size < 0 || data[start + size] !== 10) throw new Error('incomplete git blob response');
    const blob = data.subarray(start, start + size);
    offset = start + size + 1;
    if (blob.includes(0)) continue;
    try { text.set(oid, new TextDecoder('utf-8', { fatal: true }).decode(blob)); }
    catch { /* Binary content is not configuration or prose. */ }
  }
  if (offset !== data.length) throw new Error('unexpected git blob response');
  return text;
}

function normalizeOrigin(origin, repo) {
  if (!origin) return '';
  const scp = /^(?:[^@/]+@)?([^/:]+):(.+)$/.exec(origin);
  let address = origin;
  if (!origin.includes('://')) {
    address = scp ? `ssh://${scp[1]}/${scp[2]}` : `file://${absolute(origin.startsWith('/') ? origin : `${repo}/${origin}`).split('/').map(encodeURIComponent).join('/')}`;
  }
  const url = new URL(address);
  let path = url.pathname.replace(/\/+$/, '').replace(/\.git$/, '');
  if (url.hostname.toLowerCase() === 'github.com') path = path.toLowerCase();
  const host = url.hostname.toLowerCase() === 'github.com' ? 'github.com' : url.host.toLowerCase();
  return `${url.protocol === 'file:' ? 'file' : 'https'}://${host}${path}`;
}

function snapshot(repo, revision) {
  const entries = new Map(git(repo, 'ls-tree', '-rz', '--full-tree', revision).split('\0').filter(Boolean).map((entry) => {
    const tab = entry.indexOf('\t');
    const [mode, type, oid] = entry.slice(0, tab).split(' ');
    return [entry.slice(tab + 1), { mode, type, oid }];
  }));
  const ids = [...entries].filter(([path, entry]) => entry.type === 'blob' && (
    /\.md$/i.test(path) || ['package.json', 'tsconfig.json', 'yarn.lock'].includes(path) || /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path)
  )).map(([, entry]) => entry.oid);
  let text;
  return {
    revision,
    paths: [...entries.keys()],
    has: (path) => entries.get(path)?.type === 'blob',
    mode: (path) => entries.get(path)?.mode,
    read(path) {
      if (entries.get(path)?.type !== 'blob') return '';
      text ??= readTextBlobs(repo, ids);
      return text.get(entries.get(path).oid) ?? '';
    },
  };
}

// tsconfig permits comments and trailing commas; preserve strings while removing them.
function jsonc(text) {
  const stripped = text.replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, (token) => token.startsWith('"') ? token : '');
  return JSON.parse(stripped.replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/g, (token) => token.startsWith('"') ? token : ''));
}

const definitions = [
  ['docs.agents', 'Docs'], ['docs.claude', 'Docs'],
  ['style.linter', 'Style'], ['style.formatter', 'Style'], ['style.strict', 'Style'], ['style.pre-commit', 'Style'],
  ['env.lockfile', 'Build/Env'], ['env.toolchain', 'Build/Env'], ['env.build', 'Build/Env', 'executed'],
  ['testing.files', 'Testing'], ['testing.test', 'Testing', 'executed'], ['testing.lint-typecheck', 'Testing', 'executed'], ['testing.verify-skill', 'Testing'],
  ['security.pr-tests', 'Governance/Security'], ['security.status-checks', 'Governance/Security'], ['security.updates', 'Governance/Security'], ['security.secrets', 'Governance/Security'],
];

function packageManager(files, pkg) {
  const locks = [
    ['bun', ['bun.lock', 'bun.lockb']], ['npm', ['package-lock.json', 'npm-shrinkwrap.json']],
    ['pnpm', ['pnpm-lock.yaml']], ['yarn', ['yarn.lock']],
  ].filter(([, names]) => names.some(files.has));
  if (!locks.length) {
    const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'bundledDependencies', 'bundleDependencies', 'workspaces'];
    if (!files.has('pnpm-workspace.yaml') && dependencyFields.every((field) => !pkg?.[field] || Object.keys(pkg[field]).length === 0)) {
      if (typeof pkg?.packageManager === 'string' && /^bun@[^@\s]+$/.test(pkg.packageManager)) return { name: 'bun', paths: ['package.json: packageManager'] };
      if (pkg?.packageManager === undefined && typeof pkg?.engines?.bun === 'string' && pkg.engines.bun.trim()) return { name: 'bun', paths: ['package.json: engines.bun'] };
    }
    return { reason: 'no lockfile' };
  }
  if (locks.length > 1) return { reason: 'ambiguous lockfile' };
  const [name, paths] = locks[0];
  if (name === 'yarn' && !/^__metadata:/m.test(files.read('yarn.lock'))) return { reason: 'unsupported package manager' };
  return { name, paths: paths.filter(files.has) };
}

function declaredCommands(files, pkg, manager, set, invalidPackage) {
  const prose = files.paths.filter((path) => /\.md$/i.test(path)).map((path) => files.read(path)).join('\n');
  for (const [id, names] of [['env.build', ['build']], ['testing.test', ['test']], ['testing.lint-typecheck', ['lint', 'typecheck']]]) {
    if (invalidPackage) {
      set(id, 'unknown', [`git show ${files.revision}:package.json`], 'invalid package.json');
      continue;
    }
    const present = names.filter((name) => typeof pkg.scripts?.[name] === 'string' && pkg.scripts[name].trim());
    const evidence = present.map((name) => `git show ${files.revision}:package.json: scripts.${name}`);
    if (!present.length) {
      const mentioned = names.some((name) => new RegExp(`\\b(?:bun|npm|pnpm|yarn)\\s+(?:run\\s+)?${name}\\b`).test(prose));
      const reason = `missing ${names.join(' and ')} script${names.length > 1 ? 's' : ''}${mentioned ? '; prose-declared; not run' : ''}`;
      set(id, id === 'env.build' ? 'n/a' : 'fail', ['committed package.json script declarations'], reason);
      continue;
    }
    if (manager.reason) set(id, 'unknown', evidence.concat(['committed lockfile selection']), manager.reason);
    else set(id, 'unknown', evidence.concat(manager.paths, present.map((name) => `${manager.name} run ${name} (not executed)`)), 'not run');
  }
}

function assess(files) {
  const revision = files.revision;
  const has = (pattern) => files.paths.filter((path) => files.has(path) && pattern.test(path));
  const js = files.has('package.json') || has(/\.[cm]?[jt]sx?$/).length > 0;
  let pkg = {};
  let invalidPackage = false;
  try {
    pkg = JSON.parse(files.read('package.json') || '{}');
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('invalid package.json');
  } catch { pkg = {}; invalidPackage = true; }
  const criteria = definitions.map(([id, pillar, kind = 'configured']) => ({ id, pillar, kind, status: 'unknown', evidence: [`git ls-tree -r ${revision}`], reason: js ? 'not run' : 'unsupported stack' }));
  const set = (id, status, evidence, reason = '') => Object.assign(criteria.find((item) => item.id === id), { status, evidence, reason });
  const configured = (id, matches) => set(id, matches.length ? 'pass' : 'fail', matches.length ? matches.map((path) => `git show ${revision}:${path}`) : [`git ls-tree -r ${revision}: no matching configuration`], matches.length ? '' : 'missing configuration');
  if (!js) return criteria;
  configured('docs.agents', files.has('AGENTS.md') ? ['AGENTS.md'] : []);
  const claude = files.read('CLAUDE.md');
  const linked = files.mode('CLAUDE.md') === '120000' ? /^(\.\/)?AGENTS\.md$/.test(claude.trim()) : /@AGENTS\.md\b/.test(claude);
  configured('docs.claude', linked ? ['CLAUDE.md'] : []);
  configured('style.linter', has(/(^|\/)(eslint\.config\.[cm]?[jt]s|\.eslintrc(?:\.[^/]+)?|biome\.jsonc?|oxlint\.json)$/).concat(pkg.eslintConfig ? ['package.json'] : []));
  configured('style.formatter', has(/(^|\/)(\.prettierrc(?:\.[^/]+)?|prettier\.config\.[cm]?[jt]s|biome\.jsonc?|\.dprint\.json|dprint\.json)$/).concat(pkg.prettier ? ['package.json'] : []));
  if (!files.has('tsconfig.json') && !has(/\.[cm]?tsx?$/).length && !pkg.dependencies?.typescript && !pkg.devDependencies?.typescript) {
    set('style.strict', 'n/a', [`git ls-tree -r ${revision}: no TypeScript`], 'no TypeScript');
  } else {
    try {
      set('style.strict', jsonc(files.read('tsconfig.json') || '{}').compilerOptions?.strict === true ? 'pass' : 'fail', [`git show ${revision}:tsconfig.json`], '');
    } catch { set('style.strict', 'unknown', [`git show ${revision}:tsconfig.json`], 'invalid tsconfig'); }
  }
  configured('style.pre-commit', has(/(^|\/)(\.pre-commit-config\.ya?ml|lefthook\.ya?ml|\.lefthook\.ya?ml|\.husky\/pre-commit)$/).concat(pkg.husky?.hooks?.['pre-commit'] ? ['package.json'] : []));
  configured('env.lockfile', has(/^(bun\.lockb?|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/));
  const manager = packageManager(files, pkg);
  declaredCommands(files, pkg, manager, set, invalidPackage);
  configured('env.toolchain', has(/^(\.tool-versions|mise\.toml|\.mise\.toml|\.nvmrc|\.devcontainer\.json|\.devcontainer\/(devcontainer\.json|[^/]+\/devcontainer\.json))$/).concat(pkg.engines && Object.keys(pkg.engines).length ? ['package.json'] : []));
  configured('testing.files', has(/(^|\/)((tests?|__tests__)\/.*\.[cm]?[jt]sx?|[^/]+\.(test|spec)\.[cm]?[jt]sx?)$/));
  configured('testing.verify-skill', has(/^\.agents\/skills\/verify-[^/]+\/SKILL\.md$/));
  const workflows = has(/^\.github\/workflows\/[^/]+\.ya?ml$/);
  let prTests = false;
  let prCandidate = false;
  let invalid = false;
  const codeql = [];
  for (const path of workflows) {
    try {
      const workflow = Bun.YAML.parse(files.read(path));
      const trigger = workflow?.on;
      const pr = trigger === 'pull_request' || (Array.isArray(trigger) ? trigger.includes('pull_request') : trigger && Object.hasOwn(trigger, 'pull_request'));
      const steps = Object.values(workflow?.jobs ?? {}).flatMap((job) => job?.steps ?? []);
      const runs = steps.map((step) => step?.run).filter((run) => typeof run === 'string');
      if (steps.some((step) => typeof step?.uses === 'string' && /^github\/codeql-action\//.test(step.uses))) codeql.push(path);
      const invokes = (run, name) => new RegExp(`(?:^|[\\n;&|])\\s*${name}\\s+(?:run\\s+)?test(?:\\s|[;&|]|$)`).test(run);
      if (pr && runs.some((run) => ['bun', 'npm', 'pnpm', 'yarn'].some((name) => invokes(run, name)))) prCandidate = true;
      if (pr && manager.name && runs.some((run) => invokes(run, manager.name))) prTests = true;
    } catch { invalid = true; }
  }
  const workflowReason = prTests ? '' : invalid ? 'invalid workflow YAML' : prCandidate && manager.reason ? manager.reason : 'missing pull_request test step';
  set('security.pr-tests', prTests ? 'pass' : invalid || (prCandidate && manager.reason) ? 'unknown' : 'fail', workflows.length ? workflows.map((path) => `git show ${revision}:${path}`) : [`git ls-tree -r ${revision}: no workflows`], workflowReason);
  configured('security.updates', has(/(^|\/)(\.github\/(dependabot\.ya?ml|codeql\/[^/]+\.ya?ml)|(?:\.?)renovaterc(?:\.json5?)?|renovate\.json5?)$/).concat(codeql));
  const secrets = has(/(^|\/)(\.env[^/]*|id_(rsa|dsa|ecdsa|ed25519)|[^/]+\.(pem|key|p12|pfx))$/).filter((path) => !/(^|\/)\.env\.(example|sample|template)$/.test(path));
  set('security.secrets', secrets.length ? 'fail' : 'pass', secrets.length ? [...new Set(secrets)].map((path) => `git show ${revision}:${path}`) : [`git ls-tree -r ${revision}: no tracked env or private keys`], secrets.length ? 'tracked env or private keys' : '');
  return criteria;
}

export function summarizePillars(criteria) {
  const result = {};
  for (const item of criteria) {
    const pillar = result[item.pillar] ??= { passes: 0, total: 0, unknown: 0, na: 0 };
    if (item.status === 'n/a') pillar.na++;
    else pillar.total++;
    if (item.status === 'pass') pillar.passes++;
    if (item.status === 'unknown') pillar.unknown++;
  }
  for (const pillar of Object.values(result)) pillar.fraction = `${pillar.passes}/${pillar.total}`;
  return result;
}

function parsePages(text) {
  const pages = [];
  let start = -1, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (start < 0) {
      if (/\s/.test(char)) continue;
      if (char !== '{' && char !== '[') throw new Error('invalid gh page');
      start = i;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') depth--;
    if (depth === 0) {
      pages.push(JSON.parse(text.slice(start, i + 1)));
      start = -1;
    }
  }
  if (start >= 0 || !pages.length) throw new Error('incomplete gh response');
  return pages;
}

function forgeStatus(origin) {
  const match = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)$/.exec(origin);
  const evidence = [];
  const result = (status, reason) => ({ status, reason, evidence: evidence.length ? evidence : ['origin remote'] });
  if (!match) return result('unknown', 'no GitHub origin');
  function api(endpoint) {
    const argv = [process.env.GH || 'gh', 'api', '--hostname', 'github.com', '--method', 'GET', '--paginate', endpoint];
    evidence.push(`gh api --method GET --paginate ${endpoint}`);
    const response = Bun.spawnSync(argv, { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
    if (response.exitCode !== 0) throw new Error(response.stderr.toString().trim());
    return parsePages(response.stdout.toString());
  }
  try {
    const metadata = api(`repos/${match[1]}`);
    if (metadata.length !== 1 || typeof metadata[0]?.default_branch !== 'string' || !metadata[0].default_branch) throw new Error('missing default branch');
    const branch = encodeURIComponent(metadata[0].default_branch);
    let protectionGap = false;
    try {
      const protection = api(`repos/${match[1]}/branches/${branch}/protection`);
      if (protection.length !== 1 || !protection[0] || Array.isArray(protection[0])) throw new Error('incomplete protection response');
      const required = protection[0].required_status_checks;
      const checks = [...(required?.contexts ?? []), ...(required?.checks ?? []).map((check) => check.context)];
      if (checks.some((name) => typeof name === 'string' && name.length)) {
        evidence.push(`default branch ${metadata[0].default_branch}: required checks ${checks.join(', ')}`);
        return result('pass', '');
      }
    } catch (error) {
      if (!/\bHTTP (403|404)\b/.test(error.message)) throw error;
      protectionGap = !/Branch not protected.*(?:404)|(?:404).*Branch not protected/i.test(error.message);
      evidence.push(error.message);
    }
    const pages = api(`repos/${match[1]}/rules/branches/${branch}?per_page=100`);
    if (pages.some((page) => !Array.isArray(page))) throw new Error('incomplete branch rules response');
    const required = pages.flat().filter((rule) => rule?.type === 'required_status_checks').flatMap((rule) => rule.parameters?.required_status_checks ?? []);
    if (required.some((check) => typeof check?.context === 'string' && check.context.length)) {
      evidence.push(`default branch ${metadata[0].default_branch}: active rules require ${required.map((check) => check.context).join(', ')}`);
      return result('pass', '');
    }
    return result(protectionGap ? 'unknown' : 'fail', protectionGap ? 'gh settings unavailable' : 'needs admin');
  } catch (error) {
    evidence.push(error.message);
    return result('unknown', 'gh settings unavailable');
  }
}

function dirty(repo) {
  // Status normally invokes clean/process filters. Observe raw source bytes instead.
  const keys = git(repo, 'config', '--null', '--list').split('\0').map((entry) => entry.split('\n')[0]).filter((key) => /^filter\..*\.(clean|process)$/.test(key));
  const overrides = keys.flatMap((key) => ['-c', `${key}=`, '-c', `${key.replace(/\.(clean|process)$/, '.required')}=false`]);
  return git(repo, ...overrides, 'status', '--porcelain', '--untracked-files=all').length > 0;
}

async function report(args, paths) {
  const repo = args['--repo'];
  let revision;
  try { revision = git(repo, 'rev-parse', '--verify', '--end-of-options', `${args['--rev'] ?? 'HEAD'}^{commit}`).trim(); }
  catch (error) { throw new Error(`${error.message}; pass --rev <existing commit or ref>`); }
  let rawOrigin = '';
  try { rawOrigin = git(repo, 'remote', 'get-url', 'origin').trim(); } catch { /* No origin. */ }
  const origin = normalizeOrigin(rawOrigin, repo);
  const header = {
    inputs: { repo: realpathSync(repo), rev: args['--rev'] ?? 'HEAD', baseline: args['--baseline'] ?? null, run: Boolean(args['--run']) },
    repoIdentity: { roots: git(repo, 'rev-list', '--max-parents=0', revision).trim().split('\n').sort(), origin },
    revision, dirty: dirty(repo),
    observedAt: new Date().toISOString(), ghObservedAt: new Date().toISOString(), scriptVersion, criteriaVersion,
  };
  const files = snapshot(repo, revision);
  const criteria = assess(files);
  let execution;
  if (args['--run']) {
    let pkg = {};
    try { pkg = JSON.parse(files.read('package.json') || '{}'); } catch { /* Static criteria already record invalid JSON. */ }
    execution = await executeDeclared(repo, revision, paths, criteria, packageManager(files, pkg), pkg, {
      timeoutMs: Number(args['--timeout-ms'] ?? 120000), logBytes: Number(args['--log-bytes'] ?? 1048576),
    });
    header.network = execution.network;
    header.descendants = execution.descendants;
    header.scratch = execution.scratch;
  }
  header.ghObservedAt = new Date().toISOString();
  const settings = criteria.find((item) => item.id === 'security.status-checks');
  if (settings.reason !== 'unsupported stack') Object.assign(settings, forgeStatus(origin));
  return { header, criteria, pillars: summarizePillars(criteria), ...(execution && { commands: execution.commands, executionError: execution.error }) };
}

function absolute(path) {
  const parts = [];
  for (const part of (path.startsWith('/') ? path : `${process.cwd()}/${path}`).split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return `/${parts.join('/')}`;
}

function rejectSymlinks(path) {
  let current = path.startsWith('/') ? '' : process.cwd();
  for (const part of path.split('/').filter(Boolean)) {
    current += `/${part}`;
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`--out symlink rejected: ${current}; pass --out <path without symlinks>`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function outputPaths(args) {
  let common;
  try { common = realpathSync(git(args['--repo'], 'rev-parse', '--path-format=absolute', '--git-common-dir').trim()); }
  catch (error) { throw new Error(`${error.message}; pass --repo <existing Git checkout>`); }
  const out = absolute(args['--out']);
  if (!args['--out'].endsWith('.json')) throw new Error('--out must end in .json; pass --out <git-common-dir>/axstack/readiness/<name>.json');
  if (!out.startsWith(`${common}/axstack/readiness/`)) throw new Error('--out must be under <git-common-dir>/axstack/readiness/; pass --out <git-common-dir>/axstack/readiness/<name>.json');
  rejectSymlinks(args['--out']);
  const evidence = out.slice(0, -5);
  rejectSymlinks(evidence);
  return { out, evidence };
}

function writeReport(paths, report) {
  // Stage inside the allowed evidence folder; replacing the inode also avoids hardlink writes.
  mkdirSync(paths.evidence, { recursive: true, mode: 0o700 });
  const staged = `${paths.evidence}/.${crypto.randomUUID()}.report.json`;
  writeFileSync(staged, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  try { renameSync(staged, paths.out); }
  catch (error) {
    unlinkSync(staged);
    throw error;
  }
}

function compareBaseline(report, path, io) {
  if (!path) return 0;
  try {
    const before = JSON.parse(readFileSync(path, 'utf8'));
    if (before.header?.criteriaVersion !== report.header.criteriaVersion) throw new Error('criteria version mismatch');
    const identity = before.header?.repoIdentity;
    if (!identity || identity.origin !== report.header.repoIdentity.origin || JSON.stringify(identity.roots) !== JSON.stringify(report.header.repoIdentity.roots)) throw new Error('foreign repository');
    if (!Array.isArray(before.criteria) || before.criteria.some((item) => !item || typeof item.id !== 'string' || !['pass', 'fail', 'unknown', 'n/a'].includes(item.status))) throw new Error('invalid baseline criteria');
    const previous = new Map(before.criteria.map((item) => [item.id, item.status]));
    if (previous.size !== before.criteria.length) throw new Error('duplicate baseline criterion');
    const current = new Map(report.criteria.map((item) => [item.id, item.status]));
    const changes = [...new Set([...previous.keys(), ...current.keys()])].sort().filter((id) => previous.get(id) !== current.get(id)).map((id) => ({ id, before: previous.get(id) ?? null, after: current.get(id) ?? null }));
    const regressions = changes.filter((item) => item.before === 'pass' && item.after === 'fail').map((item) => item.id);
    report.comparison = { changes, regressions };
    if (regressions.length) io.stderr(`Readiness regressions: ${regressions.join(', ')}\n`);
    return regressions.length ? 10 : 0;
  } catch (error) {
    report.comparisonUnavailable = `comparison unavailable: ${error.message}`;
    io.stderr(`${report.comparisonUnavailable}\n`);
    return 2;
  }
}

const help = `Usage: bun readiness.js --repo <path> [--rev <ref>] [--baseline <report.json>] [--run] --out <path>
Assessment of committed JavaScript/TypeScript repository files.
Flags: --repo, --rev (default HEAD), --baseline, --run, --out, --help,
--timeout-ms (positive integer; default 120000), --log-bytes (positive integer; default 1048576).
Prints revision, inputs, counts, full JSON path and omitted criterion/command/log counts.
Writes only --out and its evidence folder under <git-common-dir>/axstack/readiness/.
--out must end in .json; symlinks are rejected. Its evidence folder omits that suffix.
--run also creates an owned 0700 scratch clone outside HOME in TMPDIR (fallback /tmp),
installs dependencies there and runs declared build/test/lint/typecheck scripts.
Bun and npm also run implicit pre/post scripts for those declared names.
pnpm disables declared-name pre/post hooks with --config.enable-pre-post-scripts=false;
Yarn Berry has no implicit declared-name hooks. Install lifecycle scripts still run.
Removes scratch afterwards; capped logs and argv/exit/duration JSON receipts are
written in the evidence folder next to --out. Every command gets closed stdin,
the PATH/LANG/CI/HOME/TMPDIR allowlist, its own timeout and process-group cleanup.
Only the frozen install permits network when unshare -rn plus loopback-up probe
succeeds; otherwise the header says network: not isolated. Limits apply to all steps.
Each step uses a probed PID namespace with --kill-child when available; otherwise
the header says descendants: not contained and escaped processes may survive.
200 ms drain grace after exit or timeout bounds pipe waits; incomplete logs are recorded.
SIGINT and SIGTERM terminate the active group and clean scratch before returning.
SIGKILL cannot trigger cleanup; scratch and active processes may remain.
Repository code can write outside scratch; --run is not a sandbox.
Without --run no repository commands execute. GH selects the read-only gh executable.
Dirty observation disables Git filters and filesystem-monitor hooks.
Example: bun readiness.js --repo /repo --run --out /repo/.git/axstack/readiness/check.json
Exit codes: 0 report (including failed criteria), 1 error, 2 incomplete, 10 regression.`;

export async function main(argv, io = { stdout: (text) => process.stdout.write(text), stderr: (text) => process.stderr.write(text) }) {
  try {
    if (argv.includes('--help')) {
      io.stdout(`${help}\n`);
      return 0;
    }
    const args = {};
    for (let i = 0; i < argv.length; i++) {
      const flag = argv[i];
      if (flag === '--run' && !args[flag]) { args[flag] = true; continue; }
      if (!['--repo', '--rev', '--baseline', '--out', '--timeout-ms', '--log-bytes'].includes(flag) || !argv[i + 1] || args[flag]) {
        throw new Error(`invalid argument: ${flag}; use --help for flags and an example`);
      }
      args[flag] = argv[++i];
    }
    if (!args['--repo'] || !args['--out']) throw new Error('missing inputs; pass --repo <path> and --out <git-common-dir>/axstack/readiness/<name>.json');
    for (const flag of ['--timeout-ms', '--log-bytes']) {
      if (args[flag] && (!/^\d+$/.test(args[flag]) || !Number.isSafeInteger(Number(args[flag])) || Number(args[flag]) < 1 || Number(args[flag]) > 2147483647)) throw new Error(`invalid ${flag}; pass a positive integer up to 2147483647`);
    }
    const paths = outputPaths(args);
    const result = await report(args, paths);
    const code = compareBaseline(result, args['--baseline'], io);
    writeReport(paths, result);
    const counts = Object.fromEntries(['pass', 'fail', 'unknown', 'n/a'].map((status) => [status, result.criteria.filter((item) => item.status === status).length]));
    io.stdout(`${JSON.stringify({
      revision: result.header.revision, inputs: result.header.inputs, network: result.header.network, descendants: result.header.descendants, executionError: result.executionError,
      reportPath: paths.out, counts, pillars: result.pillars, omittedCriteria: result.criteria.length, omittedCommands: result.commands?.length ?? 0,
      omittedLogBytes: (result.commands ?? []).reduce((total, step) => total + step.omittedBytes, 0),
      incompleteLogs: (result.commands ?? []).filter((step) => step.logIncomplete).length,
    })}\n`);
    return code || (result.executionError ? 2 : 0);
  } catch (error) {
    io.stderr(`Readiness error: ${error.message}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
