import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/live-run-`);
const script = `${import.meta.dir}/../../skills/axstack/scripts/check-run.js`;
const catalog = `${import.meta.dir}/run-record-scenarios.json`;
afterAll(() => rmSync(root, { recursive: true }));
function json(path, value) { writeFileSync(path, `${JSON.stringify(value)}\n`); return path; }
function cli(...args) {
  const r = Bun.spawnSync([process.execPath, script, ...args], { stdout: 'pipe', stderr: 'pipe' });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}
function fixture() {
  const dir = mkdtempSync(`${root}/case-`), repo = `${dir}/repo`, out = `${dir}/out`;
  mkdirSync(repo); mkdirSync(out, { mode: 0o700 });
  function git(...args) {
    const r = Bun.spawnSync(['git', '-C', repo, ...args], { stdout: 'pipe', stderr: 'pipe' });
    if (r.exitCode) throw Error(r.stderr.toString());
    return r.stdout.toString().trim();
  }
  git('init', '-q'); git('remote', 'add', 'origin', 'fixture:live-run');
  git('-c', 'user.name=Fixture', '-c', 'user.email=f@x', 'commit', '--allow-empty', '-qm', 'fixture');
  const head = git('rev-parse', 'HEAD');
  const binding = ['--repo', repo, '--repository', 'fixture:live-run', '--head', head, '--base', head, '--out', out];
  const expected = ['--repository', 'fixture:live-run', '--head', head, '--base', head];
  const input = { catalog, scenario: 'stale-evidence-hold', version: '0.68.0', host: 'fixture-host',
    tokenLimit: 4000, timeLimitMs: 60000, attempt: 1, nonce: 'fixture-nonce-123456',
    recordedAt: '2026-11-16T00:00:00Z', requested: { provider: 'codex', model: 'fixture-model', options: { effort: 'low' } } };
  const inputPath = json(`${dir}/before.json`, input);
  const capture = (...args) => cli(...binding, '--', process.execPath, script, ...args);
  return { dir, out, input, inputPath, expected, capture };
}
function prepared(f) {
  const r = f.capture('r5-plan', '--input', f.inputPath);
  expect(r.code).toBe(0);
  const receipt = JSON.parse(r.stdout);
  expect(receipt.exitCode).toBe(0);
  return receipt;
}
function resultFor(f, receipt) {
  return { planSha256: new Bun.CryptoHasher('sha256').update(readFileSync(receipt.logPath)).digest('hex'),
    nonce: f.input.nonce, version: f.input.version, host: f.input.host, attempt: 1,
    requested: f.input.requested, effective: f.input.requested, outcome: 'completed',
    threadId: 'fixture-thread', runId: 'fixture-run', startedAt: '2026-11-16T00:00:01Z',
    finishedAt: '2026-11-16T00:00:02Z', tokensUsed: 100, output: `nonce: ${f.input.nonce}` };
}
function trace(f, receipt, result) {
  const resultPath = json(`${f.dir}/after.json`, result);
  return cli('r5-trace', '--plan-receipt', receipt.receiptPath, '--result', resultPath, ...f.expected);
}

test('R5 plan selects catalog input, excludes the answer, and binds numeric one-attempt limits', () => {
  const f = fixture();
  const r = cli('r5-plan', '--input', f.inputPath);
  expect(r.stderr).toBe(''); expect(r.code).toBe(0);
  const plan = JSON.parse(r.stdout);
  expect(plan.scenario.id).toBe('stale-evidence-hold');
  expect(plan.scenario.input.facts).toContain('current candidate SHA');
  expect(plan.scenario.expected).toBeUndefined();
  expect(plan.catalog.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(plan.terms.every(t => t.status === 'pass')).toBe(true);
  for (const change of [{ tokenLimit: '4000' }, { tokenLimit: 0 }, { timeLimitMs: -1 }, { attempt: 2 }, { nonce: '' }, { scenario: 'absent' }]) {
    json(f.inputPath, { ...f.input, ...change });
    const bad = cli('r5-plan', '--input', f.inputPath);
    expect(bad.code).toBe(0); // Measured failed criteria never grant or deny publication.
    expect(JSON.parse(bad.stdout).terms.some(t => t.status === 'fail')).toBe(true);
  }
});

test('offline end-to-end captures both R5 phases and produces a trace citing the before receipt', () => {
  const f = fixture(), before = prepared(f), result = resultFor(f, before);
  const resultPath = json(`${f.dir}/after.json`, result);
  const r = f.capture('r5-trace', '--plan-receipt', before.receiptPath, '--result', resultPath, ...f.expected);
  expect(r.code).toBe(0);
  const receipt = JSON.parse(r.stdout), trace = JSON.parse(readFileSync(receipt.logPath, 'utf8'));
  expect(receipt.schemaVersion).toBe(1); expect(receipt.exitCode).toBe(0);
  expect(trace.planReceipt.path).toBe(before.receiptPath);
  expect(trace.before.requested.model).toBe('fixture-model');
  expect(trace.after.effective).toEqual(result.effective);
  expect(trace.after.runId).toBe('fixture-run');
  expect(trace.terms.every(t => t.status === 'pass')).toBe(true);
  expect(trace.counts).toEqual({ pass: trace.terms.length, fail: 0, unknown: 0, 'n/a': 0 });
});

test('R5 trace detects stale runs, settings drift, exhausted limits and incomplete observations', () => {
  const f = fixture(), before = prepared(f), result = resultFor(f, before);
  for (const [change, term, status] of [
    [{ nonce: 'older-nonce' }, 'stale-result', 'fail'],
    [{ planSha256: '0'.repeat(64) }, 'stale-result', 'fail'],
    [{ startedAt: '2026-11-15T23:59:00Z' }, 'time', 'fail'],
    [{ attempt: 2 }, 'stale-result', 'fail'],
    [{ output: 'old output' }, 'stale-result', 'fail'],
    [{ host: 'other-host' }, 'installation', 'fail'],
    [{ version: '0.67.0' }, 'installation', 'fail'],
    [{ effective: { ...result.effective, model: 'other' } }, 'settings', 'fail'],
    [{ tokensUsed: 4001 }, 'tokens', 'fail'],
    [{ finishedAt: '2026-11-16T00:02:00Z' }, 'time', 'fail'],
    [{ tokensUsed: null }, 'tokens', 'unknown'],
    [{ runId: null }, 'terminal', 'unknown'],
  ]) {
    const r = trace(f, before, { ...result, ...change });
    expect(r.code).toBe(status === 'unknown' ? 2 : 0);
    expect(JSON.parse(r.stdout).terms.find(t => t.id === term).status).toBe(status);
  }
  for (const outcome of ['failed', 'unavailable', 'budget-exhausted']) {
    const r = trace(f, before, { ...result, outcome });
    expect(r.code).toBe(outcome === 'unavailable' ? 2 : 0);
    expect(JSON.parse(r.stdout).after.outcome).toBe(outcome);
  }
  const unavailable = trace(f, before, { ...result, outcome: 'unavailable', effective: null,
    threadId: null, runId: null, startedAt: null, tokensUsed: null, output: null });
  expect(unavailable.code).toBe(2);
  expect(JSON.parse(unavailable.stdout).after.outcome).toBe('unavailable');
});

test('R5 trace revalidates the capture receipt and detects changed plan bytes', () => {
  const f = fixture(), before = prepared(f), result = resultFor(f, before);
  writeFileSync(before.logPath, `${readFileSync(before.logPath, 'utf8')} `);
  const r = trace(f, before, result);
  expect(r.code).toBe(0);
  expect(JSON.parse(r.stdout).terms.find(t => t.id === 'plan-log').status).toBe('fail');
});

test('a generic capture printing R5-shaped data cannot stand in for the planned invocation', () => {
  const f = fixture(), before = prepared(f);
  const args = JSON.parse(readFileSync(before.receiptPath, 'utf8')).argv;
  args.splice(1, args.length - 1, '-e', `console.log(${JSON.stringify(readFileSync(before.logPath, 'utf8'))})`);
  const captureArgs = ['--repo', `${f.dir}/repo`, ...f.expected, '--out', f.out, '--', ...args];
  const forged = JSON.parse(cli(...captureArgs).stdout);
  const r = trace(f, forged, resultFor(f, forged));
  expect(r.code).toBe(0);
  expect(JSON.parse(r.stdout).terms.find(t => t.id === 'plan-kind').status).toBe('fail');
});

test('R5 fact modes report unavailable files, reject invalid input, and write nothing', () => {
  const f = fixture();
  expect(cli('r5-plan', '--input', `${f.dir}/missing`).code).toBe(2);
  expect(cli('r5-plan').code).toBe(1);
  expect(cli('r5-trace', '--unexpected', 'value').code).toBe(1);
  json(f.inputPath, { ...f.input, catalog: `${f.dir}/missing` });
  const absent = cli('r5-plan', '--input', f.inputPath);
  expect(JSON.parse(absent.stdout).terms[0].status).toBe('unknown');
  writeFileSync(f.inputPath, '{');
  expect(cli('r5-plan', '--input', f.inputPath).code).toBe(1);
  expect(readdirSync(f.out)).toEqual([]);
});
