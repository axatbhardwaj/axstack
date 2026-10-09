import { expect, test, afterAll } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, lstatSync, readlinkSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { main } from '../../skills/axstack/scripts/readiness.js';

const script = `${import.meta.dir}/../../skills/axstack/scripts/readiness.js`;
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

function liveFixturePid(pid) {
  try { return !/^State:\s+Z/m.test(readFileSync(`/proc/${pid}/status`, 'utf8')); }
  catch { return false; }
}

// The same deadline covers clone/checkout and runtime startup on slow CI runners.
const escapedTimeoutMs = 5000;
const escapedDurationBoundMs = escapedTimeoutMs + 200 + 500; // Drain grace + scheduling margin.

function escapedFixture(mode) {
  const childFile = `escaped-${crypto.randomUUID()}.js`;
  const readyFile = `${root}/${childFile}.ready`; // Survives removal of the command's cwd.
  const repo = fixture({ test: 'bun escape.js', ...(mode === 'postinstall' && { postinstall: 'bun escape.js' }) }, {
    [childFile]: `import { readFileSync, writeFileSync, writeSync, renameSync } from 'node:fs';
const status = readFileSync('/proc/self/status', 'utf8');
const identity = { escapedPid: Number(/^Pid:\\s+(\\d+)/m.exec(status)[1]), sid: Number(/^NSsid:\\s+(\\d+)/m.exec(status)[1]) };
setTimeout(() => {}, 15000);
writeSync(1, JSON.stringify(identity) + String.fromCharCode(10));
writeFileSync(${JSON.stringify(`${readyFile}.tmp`)}, JSON.stringify(identity), { mode: 0o600 });
renameSync(${JSON.stringify(`${readyFile}.tmp`)}, ${JSON.stringify(readyFile)});`,
    'escape.js': `import { existsSync } from 'node:fs';
Bun.spawn([${JSON.stringify(bun)}, ${JSON.stringify(childFile)}], { detached: true, stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' });
while (!existsSync(${JSON.stringify(readyFile)})) await Bun.sleep(10);
${mode === 'exit' ? 'process.exit(0);' : 'setTimeout(() => {}, 15000);'}`,
  });
  return { repo, childFile, readyFile };
}

function escapedObservation(report, kind) {
  const step = report.commands.find((entry) => entry.kind === kind);
  expect(step).toBeDefined();
  const observed = readFileSync(step.logPath, 'utf8').trim().split('\n').map((line) => { try { return JSON.parse(line); } catch { return {}; } }).find((entry) => entry.escapedPid);
  expect(observed).toBeDefined();
  expect(observed.escapedPid).toBe(observed.sid); // The writer really escaped the original process group.
  return { step, pid: observed.escapedPid };
}

function stopFixture(pid, childFile, readyFile) {
  // Cleanup still has an identity if an assertion fails before the log is parsed.
  if (!pid) {
    try { const ready = JSON.parse(readFileSync(readyFile, 'utf8')); pid = ready.pid ?? ready.escapedPid; } catch { /* Child never became ready. */ }
  }
  if (pid && liveFixturePid(pid) && readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(childFile)) process.kill(pid, 'SIGKILL');
}

test.each(['timeout', 'exit', 'postinstall'])('escaped pipe writer cannot delay %s cleanup when namespaces are unavailable', (mode) => {
  const { repo, childFile, readyFile } = escapedFixture(mode);
  const bin = mkdtempSync(`${root}/no-namespace-`);
  writeFileSync(`${bin}/unshare`, `#!${bun}\nprocess.exit(1);`, { mode: 0o700 });
  let pid;
  try {
    const result = assess(repo, ['--run', '--timeout-ms', String(escapedTimeoutMs)], { PATH: `${bin}:${shims}:${process.env.PATH}` });
    expect(result.report?.executionError).toBeUndefined();
    expect(result.code).toBe(0);
    const observed = escapedObservation(result.report, mode === 'postinstall' ? 'install' : 'script');
    pid = observed.pid;
    expect(observed.step.durationMs).toBeLessThan(escapedDurationBoundMs);
    expect(liveFixturePid(pid)).toBe(true); // Return before the escaped writer closes its pipes.
    expect(observed.step.timedOut).toBe(mode !== 'exit');
    expect(observed.step.logIncomplete).toBe(true);
    expect(result.report.header.descendants).toBe('not contained');
    expect(JSON.parse(result.stdout).incompleteLogs).toBe(1);
    expect(item(result.report, 'testing.test')).toMatchObject(mode === 'postinstall' ? { status: 'unknown', reason: 'install failed' } : mode === 'exit' ? { status: 'pass' } : { status: 'fail', reason: 'timeout' });
    expect(() => lstatSync(result.report.header.scratch)).toThrow();
  } finally { stopFixture(pid, childFile, readyFile); }
}, 30000); // Includes setup; the command deadline and duration assertion bound cleanup.

test.skipIf(!pidIsolation).each(['timeout', 'exit', 'postinstall'])('PID containment kills escaped descendants after %s and covers every started step', (mode) => {
  const { repo, childFile, readyFile } = escapedFixture(mode);
  let pid;
  try {
    const result = assess(repo, ['--run', '--timeout-ms', String(escapedTimeoutMs)]);
    expect(result.report?.executionError).toBeUndefined();
    expect(result.code).toBe(0);
    const observed = escapedObservation(result.report, mode === 'postinstall' ? 'install' : 'script');
    pid = observed.pid;
    expect(liveFixturePid(pid)).toBe(false);
    expect(result.report.header.descendants).toBe('contained');
    expect(observed.step.durationMs).toBeLessThan(escapedDurationBoundMs);
    expect(observed.step.timedOut).toBe(mode !== 'exit');
    expect(() => lstatSync(result.report.header.scratch)).toThrow();
    for (const step of result.report.commands) {
      expect(step.spawnArgv).toContain('--pid');
      expect(step.spawnArgv).toContain('--fork');
      expect(step.spawnArgv).toContain('--kill-child');
    }
  } finally { stopFixture(pid, childFile, readyFile); }
}, 30000);

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
    'fixture.js': `import { statSync } from 'node:fs'; console.log(JSON.stringify({ env: process.env, stdin: await Bun.stdin.text(), mode: statSync(process.env.HOME).mode & 0o777, uid: statSync(process.env.HOME).uid }));`,
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
    expect(observations.at(-1).uid).toBe(process.getuid());
  }
});

test.each(['test', 'postinstall'])('%s timeout kills the process group and removes scratch', (name) => {
  const timeoutMs = 5000;
  const childFile = `hang-child-${crypto.randomUUID()}.js`;
  const readyFile = `${root}/${childFile}.ready`;
  const repo = fixture({ test: 'bun hang.js', ...(name === 'postinstall' && { postinstall: 'bun hang.js' }) }, {
    [childFile]: `import { readFileSync, writeFileSync, renameSync } from 'node:fs';
setTimeout(() => {}, 15000);
const pid = Number(/^Pid:\\s+(\\d+)/m.exec(readFileSync('/proc/self/status', 'utf8'))[1]);
writeFileSync(${JSON.stringify(`${readyFile}.tmp`)}, JSON.stringify({ pid }));
renameSync(${JSON.stringify(`${readyFile}.tmp`)}, ${JSON.stringify(readyFile)});`,
    'hang.js': `import { existsSync, readFileSync } from 'node:fs';
const child = Bun.spawn([${JSON.stringify(bun)}, ${JSON.stringify(childFile)}], { stdout: 'ignore', stderr: 'ignore' });
while (!existsSync(${JSON.stringify(readyFile)})) await Bun.sleep(10);
console.log(JSON.stringify({ pids: [Number(/^Pid:\\s+(\\d+)/m.exec(readFileSync('/proc/self/status', 'utf8'))[1]), JSON.parse(readFileSync(${JSON.stringify(readyFile)}, 'utf8')).pid] })); await child.exited;`,
  });
  try {
    const result = assess(repo, ['--run', '--timeout-ms', String(timeoutMs)]);
    expect(result.code).toBe(0);
    expect(item(result.report, 'testing.test')).toMatchObject(name === 'test' ? { status: 'fail', reason: 'timeout' } : { status: 'unknown', reason: 'install failed' });
    const step = result.report.commands.find((entry) => entry.kind === (name === 'test' ? 'script' : 'install'));
    expect(step.timedOut).toBe(true);
    expect(step.durationMs).toBeLessThan(timeoutMs + 200 + 500); // Drain grace + scheduling margin.
    const pids = readFileSync(step.logPath, 'utf8').trim().split('\n').map(JSON.parse).find((entry) => entry.pids).pids;
    for (const pid of pids) {
      let alive = false;
      try { alive = !/^State:\s+Z/m.test(readFileSync(`/proc/${pid}/status`, 'utf8')); } catch { /* Reaped. */ }
      expect(alive).toBe(false);
    }
    expect(() => lstatSync(result.report.header.scratch)).toThrow();
  } finally { stopFixture(undefined, childFile, readyFile); }
}, 30000);

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

test.skipIf(!isolation.available)('a successful one-time isolation probe wraps scripts but leaves the frozen install outside', () => {
  const result = assess(fixture(), ['--run']);
  expect(result.code).toBe(0);
  expect(result.report.header.network).toBe('isolated');
  expect(result.report.commands.filter((step) => step.kind === 'network-probe')).toHaveLength(1);
  for (const step of result.report.commands.filter((step) => step.kind === 'script')) expect(step.spawnArgv[0]).toBe(Bun.which('unshare'));
  const install = result.report.commands.find((step) => step.kind === 'install');
  expect(install.spawnArgv).not.toContain('-rn');
  expect(install.spawnArgv.slice(-install.argv.length)).toEqual(install.argv);
});

test.skipIf(!isolation.available)('isolated scripts can serve localhost while outbound connections fail', () => {
  // Do not even start the network fixture unless the real namespace probe succeeds.
  const repo = fixture({ test: 'bun network.js' }, {
    'network.js': `import { readlinkSync } from 'node:fs';
if (readlinkSync('/proc/self/ns/net') === ${JSON.stringify(readlinkSync('/proc/self/ns/net'))}) process.exit(91);
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('local') });
if (await (await fetch(server.url)).text() !== 'local') process.exit(8);
server.stop(true);
try { await fetch('http://192.0.2.1:80', { signal: AbortSignal.timeout(300) }); process.exit(9); }
catch { console.log('localhost passed; outbound blocked'); }`,
  });
  const result = assess(repo, ['--run']);
  expect(result.report.header.network).toBe('isolated');
  expect(item(result.report, 'testing.test').status).toBe('pass');
  expect(readFileSync(result.report.commands.find((step) => step.kind === 'script').logPath, 'utf8')).toContain('localhost passed; outbound blocked');
});

test.each(['missing-ip', 'probe-failed'])('%s reports not isolated and runs only safe offline fixture code', (failure) => {
  const bin = mkdtempSync(`${root}/isolation-`);
  for (const name of ['bun', 'npm', 'pnpm', 'yarn']) writeFileSync(`${bin}/${name}`, manager, { mode: 0o700 });
  writeFileSync(`${bin}/git`, `#!${bun}\nconst p = Bun.spawn([${JSON.stringify(Bun.which('git'))}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }); process.exit(await p.exited);`, { mode: 0o700 });
  writeFileSync(`${bin}/unshare`, `#!${bun}\nconsole.error('fixture: unshare denied'); process.exit(1);`, { mode: 0o700 });
  if (failure === 'probe-failed') writeFileSync(`${bin}/ip`, `#!${bun}\nprocess.exit(0);`, { mode: 0o700 });
  const result = assess(fixture({ test: 'bun fixture.js test' }), ['--run'], { PATH: bin });
  expect(result.code).toBe(0);
  expect(result.report.header.network).toBe('not isolated');
  expect(result.report.commands.filter((step) => step.kind === 'network-probe')).toHaveLength(failure === 'missing-ip' ? 0 : 1);
  expect(item(result.report, 'testing.test').status).toBe('pass');
  const step = result.report.commands.find((step) => step.kind === 'script');
  expect(step.spawnArgv).toEqual(step.argv);
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
});

test('linked checkout clones across devices without hardlinks and source hooks stay disabled', () => {
  let cross;
  try {
    if (statSync(root).dev === statSync('/dev/shm').dev) throw new Error('no different device');
    cross = mkdtempSync('/dev/shm/readiness-cross-');
  } catch (error) {
    console.error(`SKIP cross-device fixture: ${error.message}`);
    return;
  }
  try {
    const repo = fixture({ test: 'bun fixture.js test' });
    const linked = `${root}/linked`;
    command(repo, ['worktree', 'add', '-b', 'linked', linked]);
    put(linked, 'fixture.js', 'console.log("linked revision ran");');
    command(linked, ['add', '.']);
    command(linked, ['commit', '-qm', 'linked revision']);
    put(repo, '.git/hooks/post-checkout', `#!/bin/sh\ntouch ${repo}/HOOK_RAN\n`);
    const before = { common: manifest(repo), linked: manifest(linked) };
    const result = assess(linked, ['--run'], { TMPDIR: cross });
    expect(result.code).toBe(0);
    expect(result.report.header.revision).toBe(command(linked, ['rev-parse', 'HEAD']));
    expect(item(result.report, 'testing.test').status).toBe('pass');
    const clone = result.report.commands.find((step) => step.kind === 'clone');
    expect(clone.argv).toContain('--no-hardlinks');
    expect(clone.argv).toContain('--no-checkout');
    for (const step of result.report.commands.filter((step) => ['clone', 'checkout'].includes(step.kind))) expect(step.argv).toContain('core.hooksPath=/dev/null');
    expect(result.report.header.scratch.startsWith(`${cross}/`)).toBe(true);
    expect(() => lstatSync(result.report.header.scratch)).toThrow();
    expect({ common: manifest(repo), linked: manifest(linked) }).toEqual(before);
  } finally { rmSync(`${cross}`, { recursive: true }); }
});

test.each([['SIGINT', false], ['SIGTERM', false], ['SIGINT', true], ['SIGTERM', true]])('%s cleans escaped pipe writers (namespaces unavailable: %s)', async (signal, unavailable) => {
  const { repo, childFile, readyFile } = escapedFixture('timeout');
  const out = `${repo}/.git/axstack/readiness/interrupted.json`;
  const bin = mkdtempSync(`${root}/signal-namespace-`);
  if (unavailable) writeFileSync(`${bin}/unshare`, `#!${bun}\nprocess.exit(1);`, { mode: 0o700 });
  const child = Bun.spawn([bun, script, '--repo', repo, '--out', out, '--run'], {
    env: { ...process.env, PATH: `${bin}:${shims}:${process.env.PATH}`, TMPDIR: root }, stdin: 'ignore', stdout: 'ignore', stderr: 'ignore',
  });
  let scratch, pid;
  try {
    const deadline = Date.now() + 2000;
    while (!pid && Date.now() < deadline) {
      await Bun.sleep(20);
      let logs = [];
      try { logs = readdirSync(out.slice(0, -5)).filter((name) => name.endsWith('-script.log')); } catch { /* Still cloning. */ }
      for (const name of logs) {
        for (const line of readFileSync(`${out.slice(0, -5)}/${name}`, 'utf8').trim().split('\n')) {
          try { const observed = JSON.parse(line); scratch ??= observed.env?.HOME; pid ??= observed.escapedPid; } catch { /* Partial line. */ }
        }
      }
    }
    expect(pid).toBeNumber();
    const started = performance.now();
    child.kill(signal);
    const code = await child.exited;
    expect(performance.now() - started).toBeLessThan(1000);
    expect(() => lstatSync(scratch)).toThrow();
    expect(code).toBe(2);
    let alive = false;
    try { alive = !/^State:\s+Z/m.test(readFileSync(`/proc/${pid}/status`, 'utf8')); } catch { /* Reaped. */ }
    if (pidIsolation && !unavailable) expect(alive).toBe(false);
    const report = JSON.parse(readFileSync(out, 'utf8'));
    expect(report.executionError).toContain(signal);
    expect(report.header.descendants).toBe(pidIsolation && !unavailable ? 'contained' : 'not contained');
  } finally {
    child.kill();
    stopFixture(pid, childFile, readyFile);
    if (scratch?.startsWith(`${root}/`)) rmSync(`${scratch}`, { recursive: true, force: true });
  }
});

test('clone error still writes bounded command evidence, removes scratch, and disables hooks on every git call', () => {
  const repo = fixture({ test: 'bun fixture.js test' });
  const bin = mkdtempSync(`${root}/clone-error-`);
  const log = `${bin}/calls.jsonl`;
  writeFileSync(`${bin}/git`, `#!${bun}
import { appendFileSync } from 'node:fs';
const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(log)}, JSON.stringify(argv) + '\\n');
if (argv.includes('clone')) { console.error('fixture clone failure'); process.exit(9); }
const p = Bun.spawn([${JSON.stringify(Bun.which('git'))}, ...argv], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }); process.exit(await p.exited);`, { mode: 0o700 });
  const result = assess(repo, ['--run'], { PATH: `${bin}:${shims}:${process.env.PATH}` });
  expect(result.code).toBe(2);
  expect(item(result.report, 'testing.test')).toMatchObject({ status: 'unknown', reason: 'execution unavailable' });
  expect(result.report.executionError).toContain('clone failed');
  const clones = result.report.commands.filter((step) => step.kind === 'clone');
  expect(clones).toHaveLength(1);
  expect(clones[0].exitCode).toBe(9);
  expect(JSON.parse(readFileSync(clones[0].receiptPath, 'utf8'))).toEqual(clones[0]);
  expect(() => lstatSync(result.report.header.scratch)).toThrow();
  for (const argv of readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)) {
    expect(argv).toContain('--no-optional-locks');
    expect(argv).toContain('core.hooksPath=/dev/null');
  }
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
])('workspace declarations (%s) block lockfile-free installs', (name, files) => {
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
