import { afterAll, expect, test } from 'bun:test';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/check-run.js`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/check-run-`);
afterAll(() => rmSync(root, { recursive: true }));
function git(repo, ...args) {
  const r = Bun.spawnSync(['git', '-C', repo, ...args], { stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode) throw Error(r.stderr.toString());
  return r.stdout.toString().trim();
}
function fixture() {
  const repo = mkdtempSync(`${root}/repo-`), out = mkdtempSync(`${root}/out-`);
  git(repo, 'init', '-q');
  git(repo, 'remote', 'add', 'origin', 'fixture:check-run');
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=f@x', 'commit', '--allow-empty', '-qm', 'fixture');
  const head = git(repo, 'rev-parse', 'HEAD');
  return { repo, out, args: ['--repo', repo, '--repository', 'fixture:check-run', '--head', head, '--base', head, '--out', out] };
}
function run(f, code = 'void 0;', flags = []) {
  const r = Bun.spawnSync([process.execPath, script, ...f.args, ...flags, '--', process.execPath, '-e', code], { stdout: 'pipe', stderr: 'pipe' });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

test('CLI records failing and silent child exits separately from capture completeness', () => {
  const f = fixture();
  for (const exitCode of [0, 7]) {
    const r = run(f, `process.exit(${exitCode})`);
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
    const receipt = JSON.parse(r.stdout);
    expect(receipt.exitCode).toBe(exitCode);
    expect(receipt.terms.every(t => t.status === 'pass')).toBe(true);
    expect(JSON.parse(readFileSync(receipt.receiptPath, 'utf8'))).toEqual(receipt);
    expect(lstatSync(receipt.receiptPath).mode & 0o777).toBe(0o600);
    expect(lstatSync(receipt.logPath).mode & 0o777).toBe(0o600);
  }
  expect(readdirSync(f.out)).toHaveLength(4);
});
test('CLI returns hold for dirty identity, timeout and changed source', () => {
  const f = fixture();
  writeFileSync(`${f.repo}/dirty`, 'dirty');
  expect(run(f).code).toBe(2);
  expect(readdirSync(f.out)).toHaveLength(0);
  git(f.repo, 'add', '.');
  git(f.repo, '-c', 'user.name=F', '-c', 'user.email=f@x', 'commit', '-qm', 'new head');
  expect(run(f).code).toBe(2); // Requested head is stale.
  const clean = fixture();
  expect(run(clean, 'setTimeout(() => {}, 5000)', ['--timeout-ms', '30']).code).toBe(2);
  expect(run(clean, 'await Bun.write("changed", "bytes")').code).toBe(2);
});
test('output guards reject symlinks into source and command cwd outside source', () => {
  const f = fixture();
  const inside = `${f.repo}/evidence`;
  mkdirSync(inside, { mode: 0o700 });
  const link = `${root}/evidence-link`;
  symlinkSync(inside, link);
  const args = [...f.args];
  args[args.indexOf('--out') + 1] = link;
  const linked = run({ args });
  expect(linked.code).toBe(2);
  expect(linked.stderr).toMatch(/owned|outside/);
  const cwd = run(f, 'void 0;', ['--cwd', f.out]);
  expect(cwd.code).toBe(2);
  expect(cwd.stderr).toMatch(/outside/);
  expect(readdirSync(f.out)).toHaveLength(0);
});
test('CLI rejects malformed invocations with error exit and makes help read-only', () => {
  for (const args of [[], ['--help'], ['--unknown', 'x', '--', 'true']]) {
    const r = Bun.spawnSync([process.execPath, script, ...args], { stdout: 'pipe', stderr: 'pipe', cwd: root });
    expect(r.exitCode).toBe(args[0] === '--help' ? 0 : 1);
  }
  const f = fixture();
  expect(run(f, 'void 0;', ['--timeout-ms', '0']).code).toBe(1);
  expect(run(f, 'void 0;', ['--log-bytes', '-1']).code).toBe(1);
});
test.each(['SIGINT', 'SIGTERM'])('CLI persists incomplete receipt after %s', async (signal) => {
  const f = fixture();
  const child = Bun.spawn([process.execPath, script, ...f.args, '--', process.execPath, '-e', 'console.log("ready"); setTimeout(() => {}, 5000)'], { stdout: 'pipe', stderr: 'pipe' });
  try {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const log = readdirSync(f.out).find(p => p.endsWith('.log'));
      if (log && readFileSync(`${f.out}/${log}`, 'utf8').includes('ready')) break;
      await Bun.sleep(10);
    }
    child.kill(signal);
    expect(await child.exited).toBe(2);
    const receipt = JSON.parse(await new Response(child.stdout).text());
    expect(receipt.interrupted).toBe(signal);
    expect(receipt.terms.find(t => t.id === 'capture').status).toBe('unknown');
  } finally { child.kill(); }
});
