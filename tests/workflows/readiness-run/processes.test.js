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
    const summary = JSON.parse(result.stdout);
    expect(summary.incompleteLogs).toBe(1);
    expect(summary.logIncomplete).toBe(true);
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
