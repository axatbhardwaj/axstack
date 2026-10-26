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
