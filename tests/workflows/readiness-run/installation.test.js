import { expect, test, afterAll } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, lstatSync, readlinkSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { main } from '../../../skills/axstack/scripts/readiness.js';

const script = `${import.meta.dir}/../../../skills/axstack/scripts/readiness.js`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/readiness-run-`);
afterAll(() => rmSync(`${root}`, { recursive: true }));
const bun = process.execPath;
const shims = `${root}/bin`;
mkdirSync(shims);
let isolation = { available: false, reason: '' };
try {
  const probe = Bun.spawnSync(['unshare', '-rn', '/bin/sh', '-c', 'ip link set lo up'], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  isolation = { available: probe.exitCode === 0, reason: probe.stderr.toString().trim() };
} catch (error) { isolation.reason = error.message; }
if (!isolation.available) console.error(`SKIP localhost/outbound fixture and isolation wrapper: ${isolation.reason}`);
let pidIsolation = false;
try { pidIsolation = Bun.spawnSync(['unshare', '-r', '--pid', '--fork', '--kill-child', '/bin/true'], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' }).exitCode === 0; }
catch { /* No unshare. */ }
if (!pidIsolation) console.error('SKIP escaped-process containment fixtures: PID namespace probe unavailable');
let pnpmExecutable;
try {
  const cache = `${process.env.COREPACK_HOME ?? `${process.env.HOME}/.cache/node/corepack`}/v1/pnpm`;
  const versions = readdirSync(cache).sort();
  pnpmExecutable = `${cache}/${versions.at(-1)}/bin/pnpm.cjs`;
  if (!lstatSync(pnpmExecutable).isFile()) pnpmExecutable = undefined;
} catch { /* No offline cached pnpm. */ }
if (!pnpmExecutable) console.error('SKIP real pnpm pre/post fixture: no offline cached executable');
// Local executables run fixture code directly; no install contacts a registry.
const manager = `#!${bun}
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--config.'));
const install = ['install', 'ci'].includes(args[0]);
console.log(JSON.stringify({ argv: args, env: process.env, stdin: await Bun.stdin.text(), cwd: process.cwd() }));
const name = install ? 'postinstall' : args[1];
const code = pkg.scripts?.[name];
if (code) {
  const child = Bun.spawn([${JSON.stringify(bun)}, ...code.split(' ').slice(1)], { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' });
  process.exit(await child.exited);
}
`;
for (const name of ['bun', 'npm', 'pnpm', 'yarn']) writeFileSync(`${shims}/${name}`, manager, { mode: 0o700 });

function command(repo, args) {
  const result = Bun.spawnSync(['git', '--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-C', repo, ...args], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}
function put(repo, name, contents) {
  const path = `${repo}/${name}`;
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  writeFileSync(path, typeof contents === 'string' ? contents : JSON.stringify(contents));
}
function fixture(scripts = { build: 'bun fixture.js build', test: 'bun fixture.js test', lint: 'bun fixture.js lint', typecheck: 'bun fixture.js typecheck' }, files = {}) {
  const repo = mkdtempSync(`${root}/repo-`);
  command(repo, ['init', '-q', '-b', 'main']);
  command(repo, ['config', 'user.email', 'fixture@example.test']);
  command(repo, ['config', 'user.name', 'Fixture']);
  for (const [name, contents] of Object.entries({
    'package.json': { scripts }, 'bun.lock': '{}',
    'fixture.js': `console.log(JSON.stringify({ env: process.env, stdin: await Bun.stdin.text() })); if (process.argv[2] === 'typecheck') process.exit(3);`,
    ...files,
  })) put(repo, name, contents);
  command(repo, ['add', '.']);
  command(repo, ['commit', '-qm', 'fixture']);
  return repo;
}
function assess(repo, extra = [], env = {}) {
  const out = `${command(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir'])}/axstack/readiness/report.json`;
  const response = Bun.spawnSync([bun, script, '--repo', repo, '--out', out, ...extra], {
    env: { ...process.env, PATH: `${shims}:${process.env.PATH}`, SECRET_FIXTURE: 'must not escape', ...env },
    stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
  });
  let report;
  try { report = JSON.parse(readFileSync(out, 'utf8')); } catch { /* An input error writes no report. */ }
  return { code: response.exitCode, stderr: response.stderr.toString(), stdout: response.stdout.toString(), report, out };
}
const item = (report, id) => report.criteria.find((entry) => entry.id === id);

function manifest(repo, relative = '') {
  const files = {};
  for (const name of readdirSync(`${repo}/${relative}`).sort()) {
    const path = relative ? `${relative}/${name}` : name;
    if (path === '.git/axstack/readiness') continue;
    const stat = lstatSync(`${repo}/${path}`);
    if (stat.isDirectory()) Object.assign(files, manifest(repo, path));
    else files[path] = stat.isSymbolicLink() ? readlinkSync(`${repo}/${path}`) : new Bun.CryptoHasher('sha256').update(readFileSync(`${repo}/${path}`)).digest('hex');
  }
  return files;
}


test.skipIf(!pnpmExecutable)('pnpm disables only declared-name pre/post hooks and retains install lifecycle scripts', () => {
  const repo = fixture({}, {
    'package.json': { name: 'prepost-fixture', version: '1.0.0', scripts: { pretest: `${bun} -e 'process.exit(55)'`, test: `${bun} -e 'console.log("declared test ran")'`, posttest: `${bun} -e 'process.exit(56)'`, postinstall: `${bun} -e 'console.log("install lifecycle ran")'` } },
    'pnpm-workspace.yaml': 'packages: []\noffline: true\nupdateNotifier: false\nenablePrePostScripts: true\n',
  });
  const home = mkdtempSync(`${root}/pnpm-home-`);
  const lock = Bun.spawnSync([pnpmExecutable, 'install', '--lockfile-only', '--offline', '--ignore-scripts'], { cwd: repo, env: { ...process.env, HOME: home, TMPDIR: root, COREPACK_ENABLE_NETWORK: '0' }, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  expect(lock.exitCode).toBe(0);
  command(repo, ['rm', 'bun.lock']);
  command(repo, ['add', '.']);
  command(repo, ['commit', '-qm', 'offline pnpm lock']);
  const bin = mkdtempSync(`${root}/pnpm-bin-`);
  symlinkSync(pnpmExecutable, `${bin}/pnpm`);
  const result = assess(repo, ['--run'], { PATH: `${bin}:${process.env.PATH}` });
  expect(result.code).toBe(0);
  expect(item(result.report, 'testing.test').status).toBe('pass');
  expect(readFileSync(result.report.commands.find((step) => step.kind === 'install').logPath, 'utf8')).toContain('install lifecycle ran');
  expect(readFileSync(result.report.commands.find((step) => step.kind === 'script').logPath, 'utf8')).toContain('declared test ran');
});

test.each([
  ['bun', 'bun.lock', '{}', ['install', '--frozen-lockfile']],
  ['npm', 'package-lock.json', '{}', ['ci']],
  ['pnpm', 'pnpm-lock.yaml', '{}', ['install', '--frozen-lockfile']],
  ['yarn', 'yarn.lock', '__metadata:\n  version: 8', ['install', '--immutable']],
])('%s lockfile selects its frozen install and script command', (name, lock, contents, flags) => {
  const repo = fixture({ test: 'bun fixture.js test' }, { [lock]: contents });
  if (lock !== 'bun.lock') { command(repo, ['rm', 'bun.lock']); command(repo, ['commit', '-qm', 'select manager']); }
  const result = assess(repo, ['--run']);
  expect(result.code).toBe(0);
  expect(result.report.commands.find((step) => step.kind === 'install').argv).toEqual([name, ...flags]);
  expect(result.report.commands.find((step) => step.kind === 'script').argv).toEqual(name === 'pnpm' ? [name, '--config.enable-pre-post-scripts=false', 'run', 'test'] : [name, 'run', 'test']);
  expect(item(result.report, 'testing.test').status).toBe('pass');
});

test('without a lockfile run criteria stay unknown and the install never starts', () => {
  const repo = fixture();
  command(repo, ['rm', 'bun.lock']);
  command(repo, ['commit', '-qm', 'no lockfile']);
  const result = assess(repo, ['--run']);
  expect(result.code).toBe(0);
  for (const id of ['env.build', 'testing.test', 'testing.lint-typecheck']) expect(item(result.report, id)).toMatchObject({ status: 'unknown', reason: 'no lockfile' });
  expect(result.report.commands).toEqual([]);
});

test('frozen npm install resolves a committed local dependency without any registry access', () => {
  const npm = Bun.which('npm');
  const repo = fixture({ test: `${bun} dependency.js` }, {
    'package.json': { name: 'offline-fixture', version: '1.0.0', scripts: { test: `${bun} dependency.js` }, dependencies: { 'local-dependency': 'file:vendor/local-dependency' } },
    '.npmrc': 'offline=true\naudit=false\nfund=false\n',
    'vendor/local-dependency/package.json': { name: 'local-dependency', version: '1.0.0', main: 'index.js' },
    'vendor/local-dependency/index.js': 'module.exports = 42;',
    'dependency.js': `import answer from 'local-dependency'; if (answer !== 42) process.exit(5); console.log('local dependency installed');`,
  });
  const generate = Bun.spawnSync([npm, 'install', '--package-lock-only', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: repo, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  expect(generate.exitCode).toBe(0);
  command(repo, ['rm', 'bun.lock']);
  command(repo, ['add', '.']);
  command(repo, ['commit', '-qm', 'offline dependency lock']);
  const bin = mkdtempSync(`${root}/real-npm-`);
  symlinkSync(npm, `${bin}/npm`);
  const before = manifest(repo);
  const result = assess(repo, ['--run'], { PATH: `${bin}:${process.env.PATH}` });
  expect(result.code).toBe(0);
  expect(item(result.report, 'testing.test').status).toBe('pass');
  expect(readFileSync(result.report.commands.find((step) => step.kind === 'script').logPath, 'utf8')).toContain('local dependency installed');
  expect(manifest(repo)).toEqual(before);
}, 20000);

test('run executes dependency-free Bun scripts without a lockfile', () => {
  const bin = mkdtempSync(`${root}/real-bun-`);
  symlinkSync(bun, `${bin}/bun`);
  for (const declaration of [{ packageManager: 'bun@1.3.14' }, { engines: { bun: '>=1.3.14' } }]) {
    const scripts = { build: 'bun fixture.js build', test: 'bun fixture.js test', lint: 'bun fixture.js lint' };
    const repo = fixture(scripts, { 'package.json': { ...declaration, scripts } });
    command(repo, ['rm', 'bun.lock']);
    command(repo, ['commit', '-qm', 'dependency-free repository']);
    const { code, report } = assess(repo, ['--run'], { PATH: `${bin}:${process.env.PATH}` });
    expect(code).toBe(0);
    expect(item(report, 'env.lockfile').status).toBe('fail');
    for (const id of ['env.build', 'testing.test', 'testing.lint-typecheck']) expect(item(report, id).status).toBe('pass');
    expect(report.commands.filter((step) => step.kind === 'script').map((step) => step.argv)).toEqual(['build', 'test', 'lint'].map((name) => ['bun', 'run', name]));
  }
});

test.each(['npm@11.0.0', 'pnpm@10.0.0', 'yarn@4.0.0', 'yarn@1.22.22'])('non-Bun declarations (%s) keep no lockfile even when engines allows Bun', (packageManager) => {
  const repo = fixture(undefined, { 'package.json': { packageManager, engines: { bun: '>=1.3.14' }, scripts: { build: 'bun fixture.js build', test: 'bun fixture.js test', lint: 'bun fixture.js lint' } } });
  command(repo, ['rm', 'bun.lock']);
  command(repo, ['commit', '-qm', 'no lockfile']);
  for (const extra of [[], ['--run']]) {
    const { code, report } = assess(repo, extra);
    expect(code).toBe(0);
    for (const id of ['env.build', 'testing.test', 'testing.lint-typecheck']) expect(item(report, id)).toMatchObject({ status: 'unknown', reason: 'no lockfile' });
    expect(report.commands ?? []).toHaveLength(0);
  }
});

test.each([
  ['array', { 'package.json': { workspaces: ['pkgs/*'], engines: { bun: '>=1.3.14' }, scripts: { test: 'bun fixture.js test' } } }],
  ['packages object', { 'package.json': { workspaces: { packages: ['pkgs/*'] }, packageManager: 'bun@1.3.14', scripts: { test: 'bun fixture.js test' } } }],
  ['pnpm file', { 'package.json': { packageManager: 'bun@1.3.14', scripts: { test: 'bun fixture.js test' } }, 'pnpm-workspace.yaml': 'packages: ["pkgs/*"]' }],
])('workspace declarations (%s) block lockfile-free installs', (_name, files) => {
  const repo = fixture(undefined, { ...files, 'pkgs/a/package.json': { name: 'a', dependencies: { 'is-number': '7.0.0' } } });
  command(repo, ['rm', 'bun.lock']);
  command(repo, ['commit', '-qm', 'lockfile-free workspace']);
  for (const extra of [[], ['--run']]) {
    const { code, report } = assess(repo, extra);
    expect(code).toBe(0);
    expect(item(report, 'testing.test')).toMatchObject({ status: 'unknown', reason: 'no lockfile' });
    expect(item(report, 'env.lockfile').status).toBe('fail');
    expect(report.commands ?? []).toHaveLength(0);
  }
});
