import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';

const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/live-run-`);
const script = `${import.meta.dir}/../../skills/axstack/scripts/check-run.js`;
const catalog = `${import.meta.dir}/run-record-scenarios.json`;
const digest = bytes => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
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
  writeFileSync(`${repo}/catalog.json`, readFileSync(catalog));
  json(`${repo}/package.json`, { version: '0.68.0' });
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=f@x', 'commit', '-qm', 'fixture');
  const head = git('rev-parse', 'HEAD');
  const binding = ['--repo', repo, '--repository', 'fixture:live-run', '--head', head, '--base', head, '--out', out];
  const expected = ['--repository', 'fixture:live-run', '--head', head, '--base', head];
  const input = { catalog: `${repo}/catalog.json`, scenario: 'stale-evidence-hold', version: '0.68.0', host: 'fixture-host',
    tokenLimit: 4000, timeLimitMs: 60000, attempt: 1, nonce: 'fixture-nonce-123456',
    recordedAt: '2026-11-16T00:00:00Z', requested: { provider: 'codex', model: 'fixture-model', options: { effort: 'low' } } };
  const inputPath = json(`${dir}/before.json`, input);
  const capture = (...args) => cli(...binding, '--', process.execPath, script, ...args);
  return { dir, repo, out, input, inputPath, expected, capture, binding };
}
function prepared(f) {
  const r = f.capture('r5-plan', '--input', f.inputPath);
  expect(r.code).toBe(0);
  const receipt = JSON.parse(r.stdout);
  expect(receipt.exitCode).toBe(0);
  return receipt;
}
function resultFor(f, receipt) {
  const plan = JSON.parse(readFileSync(receipt.logPath, 'utf8'));
  const start = Date.parse(plan.plannedAt ?? new Date().toISOString()) + 10;
  return { planSha256: new Bun.CryptoHasher('sha256').update(readFileSync(receipt.logPath)).digest('hex'),
    nonce: f.input.nonce, version: f.input.version, host: f.input.host, attempt: 1,
    requested: f.input.requested, effective: f.input.requested, outcome: 'completed',
    threadId: 'fixture-thread', runId: 'fixture-run', startedAt: new Date(start).toISOString(),
    finishedAt: new Date(start + 1000).toISOString(), tokensUsed: 100, output: `nonce: ${f.input.nonce}` };
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
    [{ finishedAt: new Date(Date.parse(result.startedAt) + 120000).toISOString() }, 'time', 'fail'],
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
  expect(r.code).toBe(2); // No readable planning script at argv[1]; provenance is incomplete.
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

test('planning records its own clock and helper identity; future declarations fail', () => {
  const f = fixture(), earliest = Date.now();
  json(f.inputPath, { ...f.input, plannedAt: '2000-01-01T00:00:00Z' });
  const plan = JSON.parse(cli('r5-plan', '--input', f.inputPath).stdout);
  expect(Date.parse(plan.plannedAt)).toBeGreaterThanOrEqual(earliest);
  expect(Date.parse(plan.plannedAt)).toBeLessThanOrEqual(Date.now());
  expect(plan.planner).toEqual({ path: realpathSync(script), sha256: digest(readFileSync(script)) });
  json(f.inputPath, { ...f.input, recordedAt: new Date(Date.now() + 60000).toISOString() });
  expect(JSON.parse(cli('r5-plan', '--input', f.inputPath).stdout).terms.find(t => t.id === 'freshness').status).toBe('fail');
});

test('a fake same-named planning script fails provenance even with identical plan fields', () => {
  const f = fixture(), before = prepared(f), plan = readFileSync(before.logPath, 'utf8');
  mkdirSync(`${f.dir}/fake`);
  const fake = `${f.dir}/fake/check-run.js`;
  writeFileSync(fake, `console.log(${JSON.stringify(plan)})`);
  const forged = JSON.parse(cli(...f.binding, '--', process.execPath, fake, 'r5-plan', '--input', f.inputPath).stdout);
  const r = JSON.parse(trace(f, forged, resultFor(f, forged)).stdout);
  expect(r.terms.find(t => t.id === 'plan-kind').status).toBe('fail');
  expect(r.terms.find(t => t.id === 'plan-tool').status).toBe('fail');
});

test('catalog must be in the captured source and unchanged; version must match captured package', () => {
  const f = fixture();
  const outside = json(`${f.dir}/outside.json`, { cases: [{ id: f.input.scenario, title: 'Forged', input: 'easy' }] });
  json(f.inputPath, { ...f.input, catalog: outside });
  const external = prepared(f);
  expect(JSON.parse(trace(f, external, resultFor(f, external)).stdout).terms.find(t => t.id === 'catalog').status).toBe('fail');
  json(f.inputPath, f.input);
  const before = prepared(f);
  writeFileSync(f.input.catalog, `${readFileSync(f.input.catalog, 'utf8')} `);
  expect(JSON.parse(trace(f, before, resultFor(f, before)).stdout).terms.find(t => t.id === 'catalog').status).toBe('fail');
  const g = fixture();
  json(g.inputPath, { ...g.input, version: '9.9.9' });
  const wrong = prepared(g), result = { ...resultFor(g, wrong), version: '9.9.9' };
  expect(JSON.parse(trace(g, wrong, result).stdout).terms.find(t => t.id === 'installation').status).toBe('fail');
  // Working-tree package bytes cannot override the captured head's version.
  json(g.repo + '/package.json', { version: '9.9.9' });
  expect(JSON.parse(trace(g, wrong, result).stdout).terms.find(t => t.id === 'installation').status).toBe('fail');
});

test('each observation guard independently detects its regression or missing evidence', () => {
  const f = fixture(), before = prepared(f), result = resultFor(f, before);
  const plan = JSON.parse(readFileSync(before.logPath, 'utf8'));
  const planTime = Date.parse(plan.plannedAt ?? new Date().toISOString());
  for (const [change, id, status] of [
    [{ requested: { ...result.requested, model: 'wrong' } }, 'settings', 'fail'],
    [{ startedAt: new Date(planTime - 5000).toISOString(), finishedAt: new Date(planTime - 4000).toISOString() }, 'time', 'fail'],
    [{ outcome: 'invented' }, 'terminal', 'fail'],
    [{ outcome: 'cancelled' }, 'scenario-outcome', 'fail'],
    [{ output: null }, 'stale-result', 'unknown'],
    [{ outcome: null }, 'terminal', 'unknown'],
    [{ outcome: null }, 'scenario-outcome', 'unknown'],
    [{ outcome: 'unavailable' }, 'terminal', 'pass'],
  ]) {
    const response = trace(f, before, { ...result, ...change }), report = JSON.parse(response.stdout);
    expect(report.terms.find(t => t.id === id).status).toBe(status);
    if (status === 'unknown') expect(response.code).toBe(2);
    if (id === 'time') expect(report.terms.filter(t => t.id !== id).every(t => t.status === 'pass')).toBe(true);
  }
});

test('each command guard rejects a receipt with just that command field changed', () => {
  const f = fixture(), original = prepared(f), originalPlan = JSON.parse(readFileSync(original.logPath, 'utf8'));
  const changes = [
    r => { r.argv[2] = 'other-mode'; },
    r => { r.argv[1] = f.inputPath; },
    r => { r.argv.push('extra'); },
    r => { r.argv[3] = '--other'; },
    r => { r.exitCode = 7; },
    r => { r.tool.name = 'other'; },
  ];
  for (const mutate of changes) {
    const copy = structuredClone(original); mutate(copy); json(original.receiptPath, copy);
    expect(JSON.parse(trace(f, copy, resultFor(f, copy)).stdout).terms.find(t => t.id === 'plan-kind').status).toBe('fail');
  }
  for (const change of [{ kind: 'other' }, { schemaVersion: 2 },
    { planner: { ...originalPlan.planner, sha256: '0'.repeat(64) } },
    { planner: { ...originalPlan.planner, path: f.inputPath } }]) {
    const copy = structuredClone(original);
    json(copy.logPath, { ...originalPlan, ...change });
    copy.logBytes = readFileSync(copy.logPath).length; copy.logSha256 = digest(readFileSync(copy.logPath)); json(copy.receiptPath, copy);
    const report = JSON.parse(trace(f, copy, resultFor(f, copy)).stdout);
    expect(report.terms.find(t => t.id === ('planner' in change ? 'plan-tool' : 'plan-kind')).status).toBe('fail');
  }
});

test('plan guards reject short/placeholder nonce, invalid time/settings, and duplicate ids', () => {
  const f = fixture();
  for (const [change, id] of [
    [{ nonce: 'short' }, 'freshness'], [{ nonce: 'replace-with-fresh-uuid' }, 'freshness'],
    [{ recordedAt: '2026-11-15' }, 'freshness'], [{ requested: null }, 'settings'],
    [{ requested: { provider: 'codex', model: 'x', options: [] } }, 'settings'],
  ]) {
    json(f.inputPath, { ...f.input, ...change });
    expect(JSON.parse(cli('r5-plan', '--input', f.inputPath).stdout).terms.find(t => t.id === id).status).toBe('fail');
  }
  json(f.inputPath, f.input);
  json(f.input.catalog, { cases: [{ id: f.input.scenario, input: 'a' }, { id: f.input.scenario, input: 'b' }] });
  expect(JSON.parse(cli('r5-plan', '--input', f.inputPath).stdout).terms.find(t => t.id === 'scenario').status).toBe('fail');
});

test('all existing catalogs, including title-less cases, support planning; mode help is read-only', () => {
  const f = fixture();
  for (const name of readdirSync(import.meta.dir).filter(n => n.endsWith('scenarios.json'))) {
    const cases = JSON.parse(readFileSync(`${import.meta.dir}/${name}`, 'utf8')).cases;
    writeFileSync(f.input.catalog, readFileSync(`${import.meta.dir}/${name}`));
    json(f.inputPath, { ...f.input, scenario: cases[0].id });
    const report = JSON.parse(cli('r5-plan', '--input', f.inputPath).stdout);
    expect(report.terms.find(t => t.id === 'scenario').status).toBe('pass');
  }
  for (const mode of ['r5-plan', 'r5-trace']) expect(cli(mode, '--help').code).toBe(0);
});

test.each(['output', 'outcome'])('missing %s is unknown rather than a failed observation', field => {
  const f = fixture(), before = prepared(f), result = resultFor(f, before);
  delete result[field];
  const response = trace(f, before, result), report = JSON.parse(response.stdout);
  expect(response.code).toBe(2);
  expect(report.terms.find(t => t.id === (field === 'output' ? 'stale-result' : 'terminal')).status).toBe('unknown');
});

test('release version declarations must agree with package.json at captured HEAD', () => {
  const f = fixture();
  json(f.inputPath, { ...f.input, version: '9.9.9' });
  const before = prepared(f), result = { ...resultFor(f, before), version: '9.9.9' };
  expect(JSON.parse(trace(f, before, result).stdout).terms.find(t => t.id === 'installation').status).toBe('fail');
});

test('R5 publication is never blocked: removal/inversion fail and rewording survives', () => {
  const source = readFileSync(`${import.meta.dir}/../../skills/axstack/references/live-run.md`, 'utf8');
  const accepts = value => value.replace(/\s+/g, ' ').split(/[.!?]\s+/).some(s =>
    /failure/i.test(s) && /unavailab/i.test(s) && /budgets?/i.test(s)
    && /\b(?:never|must not|do not) block publication/i.test(s) && !/unless|except/i.test(s));
  const paragraph = source.split(/\n\s*\n/).find(accepts);
  expect(accepts(source)).toBe(true);
  expect(accepts(source.replace(paragraph, ''))).toBe(false);
  expect(accepts(source.replace(paragraph, paragraph.replace(/\b(?:never|must not|do not) block publication/i, 'always block publication')))).toBe(false);
  expect(accepts(source.replace(paragraph, 'Unavailability, exhausted budgets and failure must not block publication.'))).toBe(true);
});

test('release flow requires the live recipe link: removal/inversion fail and rewording survives', () => {
  const source = readFileSync(`${import.meta.dir}/../../skills/axstack/references/autopilot.md`, 'utf8');
  const accepts = value => value.split(/\n\s*\n/).some(p => /\[[^\]]+\]\(live-run\.md\)/.test(p)
    && /\b(?:record|follow|use|consult)\b/i.test(p) && /release/i.test(p)
    && !/\b(?:skip|ignore|avoid|optional|do not)\b/i.test(p));
  const paragraph = source.split(/\n\s*\n/).find(accepts);
  expect(accepts(source)).toBe(true);
  expect(accepts(source.replace(paragraph, ''))).toBe(false);
  expect(accepts(source.replace('](live-run.md)', '](elsewhere.md)'))).toBe(false);
  expect(accepts(source.replace(paragraph, paragraph.replace(/\b(?:record|follow|use|consult)\b/i, 'skip')))).toBe(false);
  expect(accepts(source.replace(paragraph, 'For a release touching skills, follow the [live check](live-run.md) before closing the run.'))).toBe(true);
});
