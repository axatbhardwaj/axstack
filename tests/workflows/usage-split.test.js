import { afterEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, linkSync, rmSync } from 'node:fs';

const fixture = await Bun.file(`${import.meta.dir}/fixtures/usage-split.json`).json();
const script = `${import.meta.dir}/../../skills/axstack/scripts/usage-split.js`;
const term = (report, id) => report.terms.find((item) => item.id === id);
const roots = [];
afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true });
});
function setup(change = () => {}) {
  const data = structuredClone(fixture);
  change(data);
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/usage-split-`);
  roots.push(dir);
  for (const key of ['cache', 'rates', 'state', 'prs']) writeFileSync(`${dir}/${key}.json`, JSON.stringify(data[key]));
  const args = ['--cache', `${dir}/cache.json`, '--rates', `${dir}/rates.json`, '--state', `${dir}/state.json`,
    '--prs', `${dir}/prs.json`, '--start', data.start, '--end', data.end];
  return { dir, data, args };
}
function run(input, extra = []) {
  const args = [...input.args];
  for (let i = 0; i < extra.length; i += 2) {
    const index = args.indexOf(extra[i]);
    if (index >= 0) args.splice(index, 2);
  }
  const result = Bun.spawnSync([process.execPath, script, ...args, ...extra], { stdout: 'pipe', stderr: 'pipe' });
  return { code: result.exitCode, report: result.stdout.length ? JSON.parse(result.stdout.toString()) : null,
    error: result.stderr.toString() };
}

test('fixture pins deduplication, interval edges, four token components, class precedence and partial cost', () => {
  const input = setup();
  const { report, code } = run(input);
  // Independent hand-calculated expected values were committed before implementation.
  expect(report.totals.tokens).toBe(fixture.expected.totals.tokens);
  expect(code).toBe(2);
  for (const [name, tokens] of Object.entries(fixture.expected.classes)) {
    expect(report.classes.find((row) => row.class === name).tokens).toBe(tokens);
  }
  for (const [name, value] of Object.entries(fixture.expected.totals)) {
    expect(Math.abs(report.totals[name] - value)).toBeLessThanOrEqual(
      name === 'knownRateProxyUsd' ? fixture.expected.tolerance.usdAbsolute : fixture.expected.tolerance.tokens);
  }
  expect(report.duplicatesRemoved).toBe(1);
  expect(report.interval).toEqual({ start: fixture.start, end: fixture.end, endExclusive: true });
  expect(report.billedCost).toBeNull();
  expect(report.classes.find((row) => row.class === 'authoring').turns).toBeNull();
  expect(term(report, 'rates').status).toBe('unknown');
  expect(term(report, 'billed-cost').status).toBe('unknown');
  expect(term(report, 'merged-prs').status).toBe('pass');
  expect(report.roleMapping.find((r) => r.threadId === 'thread-a').class).toBe('authoring');
  expect(report.roleMapping.find((r) => r.threadId === 'thread-v').class).toBe('verification');
});

test('PR coverage never divides shared work or invents a zero for an unobserved PR', () => {
  const { report } = run(setup());
  expect(report.attribution).toMatchObject(fixture.expected.attribution);
  expect(report.prs).toHaveLength(10);
  expect(report.prs[0]).toMatchObject({ exclusiveTokens: 135, sharedTokens: 8, observedTokens: 143,
    exclusiveFraction: 135 / 143 });
  expect(report.prs[4]).toMatchObject({ exclusiveTokens: null, sharedTokens: null, exclusiveFraction: null });
  expect(term(report, 'pr:5').status).toBe('unknown');
  expect(report.shared).toEqual([expect.objectContaining({ threadId: 'thread-s', tokens: 8 })]);
  expect(report.unattributed.reduce((sum, row) => sum + row.tokens, 0)).toBe(25);
});

test('snapshot hashes bind all input bytes and caller output changes no input', () => {
  const input = setup();
  const before = Object.fromEntries(['cache', 'rates', 'state', 'prs'].map((key) =>
    [key, readFileSync(`${input.dir}/${key}.json`)]));
  const out = `${input.dir}/report.json`;
  const { report } = run(input, ['--out', out]);
  expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(report);
  for (const [key, bytes] of Object.entries(before)) {
    expect(report.snapshot.inputs[key].sha256).toBe(new Bun.CryptoHasher('sha256').update(bytes).digest('hex'));
    expect(readFileSync(`${input.dir}/${key}.json`)).toEqual(bytes);
  }
  expect(report.snapshot.sha256).toMatch(/^[a-f0-9]{64}$/);
  writeFileSync(`${input.dir}/rates.json`, `${before.rates}\n`);
  expect(run(input).report.snapshot.sha256).not.toBe(report.snapshot.sha256);
  for (const item of report.terms) {
    expect(['pass', 'fail', 'unknown', 'n/a']).toContain(item.status);
    expect(item.evidence.length).toBeGreaterThan(0);
  }
  expect(report.verdict).toBeUndefined();
  expect(report.summary).toEqual(expect.objectContaining({ unknown: expect.any(Number) }));
});

test('missing components, rate fields and ambiguous joins stay unknown', () => {
  const { report, code } = run(setup((data) => {
    data.cache.files['synthetic-a'].r[0][3] = null;
    delete data.cache.files['synthetic-copy'];
    delete data.rates.document['synthetic-priced'].cache_read_input_token_cost;
    data.state.providers.push({ thread_id: 'thread-r', native: 'session-a' });
  }));
  expect(code).toBe(2);
  expect(report.totals.input).toBeNull();
  expect(report.totals.tokens).toBeNull();
  expect(report.totals.knownRateProxyUsd).toBe(0);
  expect(report.ambiguousRecords).toBe(1);
  expect(term(report, 'token-components').status).toBe('unknown');
  expect(term(report, 'native-join').status).toBe('unknown');
  expect(report.prs[0].exclusiveTokens).toBeNull();
});

test('saved sqlite and exported provider rows agree and create no database sidecars', () => {
  const input = setup((data) => { data.state.runs = [{ thread_id: 'thread-a', turns: 2 }]; });
  const path = `${input.dir}/state.sqlite`;
  const db = new Database(path);
  db.run('CREATE TABLE orchestration_v2_projection_provider_threads (thread_id TEXT, payload_json TEXT)');
  db.run('CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, title TEXT, payload_json TEXT)');
  db.run('CREATE TABLE orchestration_v2_projection_runs (thread_id TEXT, requested_at TEXT)');
  for (const requestedAt of [fixture.start, '2026-01-01T12:00:00.000Z', fixture.end, '2025-12-31T23:59:59.999Z']) {
    db.run('INSERT INTO orchestration_v2_projection_runs VALUES (?, ?)', ['thread-a', requestedAt]);
  }
  for (const row of input.data.state.providers) db.run('INSERT INTO orchestration_v2_projection_provider_threads VALUES (?, ?)',
    [row.thread_id, row.payload_json]);
  for (const row of input.data.state.threads) db.run('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?)',
    [row.thread_id, row.title, JSON.stringify({ pullRequests: row.prs })]);
  db.close();
  const before = readFileSync(path);
  const expected = run(input).report;
  const { report } = run(input, ['--state', path]);
  expect(report.totals).toEqual(expected.totals);
  expect(report.classes).toEqual(expected.classes);
  expect(report.classes.find((row) => row.class === 'authoring').turns).toBe(2);
  expect(term(report, 'run-counts').status).toBe('pass');
  expect(report.prs).toEqual(expected.prs);
  expect(readFileSync(path)).toEqual(before);
  expect(readdirSync(input.dir).filter((f) => f.startsWith('state.sqlite'))).toEqual(['state.sqlite']);
  writeFileSync(`${path}-wal`, 'unsaved WAL');
  expect(run(input, ['--state', path]).code).toBe(2);
});

test('state sidecars are refused before reading or hashing the saved database', () => {
  const input = setup();
  writeFileSync(`${input.dir}/state.json-wal`, 'unmerged state');
  const { report, code } = run(input);
  expect(code).toBe(2);
  expect(report.snapshot.inputs.state).toBeUndefined();
  expect(term(report, 'input:state').status).toBe('unknown');
});

test('declared turns without usage remain unknown and role-labelled IDs override generic titles', () => {
  const { report } = run(setup((data) => {
    data.state.threads.push({ thread_id: 'thread:delegated-task:%2561xstack-author:synthetic', title: 'Review test' });
    data.state.runs = [{ thread_id: 'thread:delegated-task:%2561xstack-author:synthetic', turns: 2 }];
  }));
  const author = report.classes.find((row) => row.class === 'authoring');
  expect(author).toMatchObject({ tokens: 143, threads: 3, turns: 2, missingUsageThreads: 1 });
  expect(term(report, 'usage-coverage').status).toBe('unknown');
  expect(report.roleMapping.find((row) => row.threadId.includes('delegated-task')).tokens).toBeNull();
});

test.each([
  ['invalid turns', 'thread-a', 'authoring', [
    { thread_id: 'thread-a', turns: 3 },
    { thread_id: 'thread-a', turns: 'invalid' },
    { thread_id: 'thread-a', turns: 2 },
  ]],
  ['unknown thread', 'thread-absent', 'other', [{ thread_id: 'thread-absent', turns: 7 }]],
])('%s cannot produce a known turn total', (_name, threadId, roleClass, runs) => {
  const { report, code } = run(setup((data) => { data.state.runs = runs; }));
  expect(report.classes.find((row) => row.class === roleClass).turns).toBeNull();
  expect(report.roleMapping.find((row) => row.threadId === threadId)?.turns).toBeNull();
  expect(code).toBe(2);
  expect(term(report, 'run-counts')).toMatchObject({ status: 'unknown', evidence: [
    expect.objectContaining({ invalidRows: expect.any(Array), unknownThreads: expect.any(Array) }),
  ] });
});

test.each([false, true])('zero observed usage requires explicit run coverage (runs supplied: %s)', (runsSupplied) => {
  const input = setup((data) => {
    data.rates.document['synthetic-unpriced'] = data.rates.document['synthetic-priced'];
    data.cache.files['synthetic-a'].r = [];
    delete data.cache.files['synthetic-copy'];
    if (runsSupplied) data.state.runs = [];
  });
  const billed = `${input.dir}/billed.json`;
  writeFileSync(billed, JSON.stringify({ usd: 0, start: fixture.start, end: fixture.end, evidence: 'synthetic statement' }));
  const { code, report } = run(input, ['--billed', billed]);
  expect(code).toBe(runsSupplied ? 0 : 2);
  expect(report.billedCost.usd).toBe(0);
  expect(term(report, 'run-counts').status).toBe(runsSupplied ? 'pass' : 'unknown');
  expect(term(report, 'usage-coverage').status).toBe(runsSupplied ? 'pass' : 'unknown');
  expect(term(report, 'pr:1').status).toBe(runsSupplied ? 'n/a' : 'unknown');
  expect(report.prs[0].exclusiveTokens).toBe(runsSupplied ? 0 : null);
  expect(report.prs[0].sharedTokens).toBe(runsSupplied ? 0 : null);
  expect(report.totals.tokens).toBe(0);
  expect(report.classes).toEqual([]);
});

test('unattributed usage retains its observed sum alongside missing thread usage', () => {
  const { report } = run(setup((data) => {
    data.state.threads.push({ thread_id: 'thread-gap', title: 'Unlinked driver' });
    data.state.runs = [{ thread_id: 'thread-gap', turns: 1 }];
  }));
  expect(report.attribution.unattributedTokens).toBeNull();
  expect(report.attribution.observedUnattributedTokens).toBe(25);
});

test('shared-only attribution is a known limitation, not n/a', () => {
  const { report } = run(setup((data) => {
    data.state.providers.push({ thread_id: 'thread-u', native: 'session-u' });
    data.state.threads.push({ thread_id: 'thread-u', title: 'Unmatched author', prs: [data.prs[0].url] });
    data.state.threads.find((row) => row.thread_id === 'thread-x').prs = [data.prs[0].url];
  }));
  expect(report.attribution.unattributedTokens).toBe(0);
  expect(report.attribution.sharedTokens).toBe(8);
  expect(term(report, 'attribution').status).toBe('unknown');
});

test('repeated flags are input errors even when their values agree', () => {
  expect(run(setup(), ['--start', fixture.start, '--start', fixture.start]).code).toBe(1);
});

test('invalid identities are measured failures, while absent/unsupported inputs are incomplete', () => {
  const input = setup((data) => { data.prs[0].mergedAt = null; });
  expect(term(run(input).report, 'merged-prs').status).toBe('fail');
  expect(run(input, ['--cache', `${input.dir}/absent`]).code).toBe(2);
  expect(run(setup((data) => { data.cache.version = 999; }))).toMatchObject({ code: 2 });
  expect(run(input, ['--start', 'invalid']).code).toBe(1);
  expect(run(input, ['--typo', 'value']).code).toBe(1);
  writeFileSync(`${input.dir}/cache.json`, 'not JSON');
  expect(run(input).code).toBe(1);
});

test('empty accounting cannot certify a structurally absent saved state', () => {
  const input = setup((data) => { data.state = null; });
  const billed = `${input.dir}/billed.json`;
  writeFileSync(billed, JSON.stringify({ usd: 0, start: fixture.start, end: fixture.end, evidence: 'synthetic statement' }));
  const { code, report } = run(input, ['--billed', billed]);
  expect(code).toBe(2);
  expect(term(report, 'state-format').status).toBe('unknown');
});

test('help discloses all flags and effects; output cannot overwrite inputs through an alias', () => {
  const help = Bun.spawnSync([process.execPath, script, '--help']);
  expect(help.exitCode).toBe(0);
  for (const flag of ['cache', 'rates', 'state', 'start', 'end', 'prs', 'billed', 'out', 'help']) {
    expect(help.stdout.toString()).toContain(`--${flag}`);
  }
  expect(help.stdout.toString()).toContain('Side effects: none');
  const input = setup();
  const bytes = readFileSync(`${input.dir}/cache.json`);
  const alias = `${input.dir}/alias`;
  linkSync(`${input.dir}/cache.json`, alias);
  expect(run(input, ['--out', alias]).code).toBe(1);
  expect(readFileSync(alias)).toEqual(bytes);
});
