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


test('help discloses implicit hooks, drain grace, containment fallback and hard-kill cleanup limits', async () => {
  let help = '';
  expect(await main(['--help'], { stdout: (text) => { help += text; }, stderr: () => {} })).toBe(0);
  expect(help).toMatch(/(?:Bun.*npm|npm.*Bun).*pre\/post/i);
  expect(help).toMatch(/pnpm.*(?:disable|opt.out).*pre\/post/i);
  expect(help).toMatch(/SIGINT.*SIGTERM.*clean/i);
  expect(help).toMatch(/SIGKILL.*cannot.*clean/i);
  expect(help).toMatch(/200\s*ms.*(?:drain|grace)/i);
  expect(help).toMatch(/descendants: not contained/);
});

test('run executes only committed declared scripts, once after frozen install, with recorded evidence', () => {
  const repo = fixture();
  put(repo, 'package.json', { scripts: { test: 'exit 88' } });
  const result = assess(repo, ['--run']);
  expect(result.code).toBe(0);
  expect(item(result.report, 'env.build').status).toBe('pass');
  expect(item(result.report, 'testing.test').status).toBe('pass');
  expect(item(result.report, 'testing.lint-typecheck').status).toBe('fail');
  expect(result.report.commands.filter((step) => step.kind === 'install').map((step) => step.argv)).toEqual([['bun', 'install', '--frozen-lockfile']]);
  const steps = result.report.commands.filter((step) => step.kind === 'script');
  expect(steps.map((step) => step.argv)).toEqual(['build', 'test', 'lint', 'typecheck'].map((name) => ['bun', 'run', name]));
  expect(steps.map((step) => step.exitCode)).toEqual([0, 0, 0, 3]);
  for (const step of result.report.commands) {
    expect(step.durationMs).toBeGreaterThanOrEqual(0);
    expect(step.logPath.startsWith(`${result.out.slice(0, -5)}/`)).toBe(true);
    expect(readFileSync(step.logPath).length).toBeGreaterThanOrEqual(0);
  }
  expect(result.report.header.revision).toBe(command(repo, ['rev-parse', 'HEAD']));
});

test('run preserves presence and lockfile precedence and never executes prose-only commands', () => {
  const cases = [
    [{}, { 'bun.lock': '' }, ['n/a', 'fail', 'fail']],
    [{ test: 'bun fixture.js test' }, { 'bun.lock': '', 'package-lock.json': '{}' }, ['n/a', 'unknown', 'fail']],
    [{ test: 'bun fixture.js test' }, { 'bun.lock': '', 'yarn.lock': '# yarn lockfile v1' }, ['n/a', 'unknown', 'fail']],
  ];
  for (const [scripts, files, expected] of cases) {
    const repo = fixture(scripts, { ...files, 'AGENTS.md': 'Use bun run build and bun run test to create PROSE_RAN.' });
    // Empty still counts as committed: explicitly remove bun.lock for the Yarn-only case.
    if (files['yarn.lock']) { command(repo, ['rm', 'bun.lock']); command(repo, ['commit', '-qm', 'only classic yarn']); }
    const result = assess(repo, ['--run']);
    expect(result.code).toBe(0);
    expect(['env.build', 'testing.test', 'testing.lint-typecheck'].map((id) => item(result.report, id).status)).toEqual(expected);
    expect(result.report.commands ?? []).toHaveLength(0);
    expect(() => readFileSync(`${repo}/PROSE_RAN`)).toThrow();
  }
});

test('install and scripts receive only the allowlist, closed stdin and private scratch; source bytes stay unchanged', () => {
  const repo = fixture({ test: 'bun fixture.js test', postinstall: 'bun fixture.js postinstall' }, {
    '.gitignore': 'ignored/\n',
    'fixture.js': `import { statSync } from 'node:fs'; console.log(JSON.stringify({ env: process.env, stdin: await Bun.stdin.text(), mode: statSync(process.env.HOME).mode & 0o777, uid: statSync(process.env.HOME).uid, processUid: process.getuid() }));`,
  });
  put(repo, 'package.json', { scripts: {} });
  command(repo, ['add', 'package.json']);
  put(repo, 'fixture.js', 'unstaged');
  put(repo, 'untracked', 'untracked');
  put(repo, 'ignored/data', 'ignored');
  const before = { files: manifest(repo), head: command(repo, ['rev-parse', 'HEAD']), status: command(repo, ['status', '--porcelain', '--ignored']) };
  const result = assess(repo, ['--run']);
  expect(result.code).toBe(0);
  expect(item(result.report, 'testing.test').status).toBe('pass');
  expect({ files: manifest(repo), head: command(repo, ['rev-parse', 'HEAD']), status: command(repo, ['status', '--porcelain', '--ignored']) }).toEqual(before);
  for (const step of result.report.commands.filter((step) => ['install', 'script'].includes(step.kind))) {
    const observations = readFileSync(step.logPath, 'utf8').trim().split('\n').map(JSON.parse);
    for (const observed of observations) {
      expect(Object.keys(observed.env).sort()).toEqual(['CI', 'HOME', 'LANG', 'PATH', 'TMPDIR']);
      expect(observed.env.CI).toBe('1');
      expect(observed.env.HOME).toBe(observed.env.TMPDIR);
      expect(observed.env.HOME.startsWith(`${process.env.HOME}/`)).toBe(false);
      expect(observed.stdin).toBe('');
      expect(() => lstatSync(observed.env.HOME)).toThrow();
    }
    expect(observations.at(-1).mode).toBe(0o700);
    // Installs use containment only; scripts also use the network user namespace.
    const mapped = result.report.header.descendants === 'contained'
      || (step.kind === 'script' && result.report.header.network === 'isolated');
    expect(observations.at(-1).processUid).toBe(mapped ? 0 : process.getuid());
    expect(observations.at(-1).uid).toBe(observations.at(-1).processUid);
  }
});

test('capped stdout and stderr logs count omitted bytes without blocking noisy scripts', () => {
  const repo = fixture({ test: 'bun noisy.js' }, {
    'noisy.js': `process.stdout.write('x'.repeat(100000)); process.stderr.write('y'.repeat(100000));`,
  });
  const result = assess(repo, ['--run', '--log-bytes', '1024']);
  expect(result.code).toBe(0);
  expect(item(result.report, 'testing.test').status).toBe('pass');
  const step = result.report.commands.find((entry) => entry.kind === 'script');
  expect(lstatSync(step.logPath).size).toBe(1024);
  expect(step.logBytes).toBe(1024);
  expect(step.omittedBytes).toBeGreaterThanOrEqual(199000);
});

test('a failed install records its exit and makes only runnable criteria unknown', () => {
  const repo = fixture({ test: 'bun fixture.js test', postinstall: 'bun fail.js' }, { 'fail.js': 'process.exit(7);' });
  const result = assess(repo, ['--run']);
  expect(result.code).toBe(0);
  expect(item(result.report, 'testing.test')).toMatchObject({ status: 'unknown', reason: 'install failed' });
  expect(item(result.report, 'env.build').status).toBe('n/a');
  expect(result.report.commands.find((step) => step.kind === 'install').exitCode).toBe(7);
  expect(result.report.commands.filter((step) => step.kind === 'script')).toHaveLength(0);
  expect(() => lstatSync(result.report.header.scratch)).toThrow();
});

test('run CLI returns concise revision/input/count summary and command receipts inside evidence; main accepts io', async () => {
  const repo = fixture({ test: 'bun fixture.js test' });
  const result = assess(repo, ['--run']);
  expect(result.code).toBe(0);
  const summary = JSON.parse(result.stdout);
  expect(summary.reportPath).toBe(result.out);
  expect(summary.revision).toBe(result.report.header.revision);
  expect(summary.inputs).toMatchObject({ repo, run: true });
  expect(summary.omittedCriteria).toBe(17);
  expect(summary.omittedCommands).toBe(result.report.commands.length);
  expect(summary.counts.pass + summary.counts.fail + summary.counts.unknown + summary.counts['n/a']).toBe(17);
  expect(summary.criteria).toBeUndefined();
  expect(summary.incompleteLogs).toBe(0);
  expect(summary.logIncomplete).toBe(false);
  for (const step of result.report.commands) {
    expect(step.receiptPath.startsWith(`${result.out.slice(0, -5)}/`)).toBe(true);
    expect(JSON.parse(readFileSync(step.receiptPath, 'utf8'))).toEqual(step);
  }
  let stdout = '', stderr = '';
  const io = { stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; } };
  expect(await main(['--help'], io)).toBe(0);
  for (const flag of ['--repo', '--rev', '--baseline', '--out', '--run', '--timeout-ms', '--log-bytes', '--help']) expect(stdout).toContain(flag);
  expect(stdout).toContain('Example: bun readiness.js --repo /repo');
  stdout = '';
  expect(await main(['--repo', repo], io)).toBe(1);
  expect(stderr).toContain('pass --repo');
  for (const [flag, value] of [['--timeout-ms', '0'], ['--log-bytes', 'no'], ['--timeout-ms', '2147483648']]) expect(assess(repo, [flag, value]).code).toBe(1);
});

test('in-process main names report inputs and sends baseline gaps and actionable input errors through io', async () => {
  const repo = fixture({});
  const out = `${repo}/.git/axstack/readiness/in-process.json`;
  const baseline = `${root}/missing-baseline.json`;
  let stdout = '', stderr = '';
  const io = { stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; } };
  expect(await main(['--repo', repo, '--rev', 'HEAD', '--out', out, '--baseline', baseline], io)).toBe(2);
  const report = JSON.parse(readFileSync(out, 'utf8'));
  expect(report.header.inputs).toEqual({ repo, rev: 'HEAD', baseline, run: false });
  expect(report.header.scriptVersion).toBe('1.1.0');
  expect(JSON.parse(stdout)).toMatchObject({ revision: report.header.revision, inputs: report.header.inputs, reportPath: out, omittedCriteria: 17 });
  expect(stderr).toContain('comparison unavailable');
  stdout = ''; stderr = '';
  expect(await main(['--repo', repo, '--rev', 'missing-ref', '--out', out], io)).toBe(1);
  expect(stderr).toContain('pass --rev');
  stderr = '';
  expect(await main(['--repo', root, '--out', out], io)).toBe(1);
  expect(stderr).toContain('pass --repo');
});
