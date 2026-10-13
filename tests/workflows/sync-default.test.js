import { afterEach, expect, test, spyOn } from 'bun:test';
import * as fs from 'node:fs';
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { commit, decide } from '../../skills/axstack/scripts/sync-default.js';

const script = `${import.meta.dir}/../../skills/axstack/scripts/sync-default.js`;
const token = 'sync-fixture-secret';
const servers = [];
afterEach(() => { for (const server of servers.splice(0)) server.stop(true); });
const weekly = (used, hours) => ({ five_hour: { utilization: 10,
  resets_at: new Date(Date.now() + 3 * 3600000).toISOString() },
  seven_day: { utilization: used, resets_at: new Date(Date.now() + hours * 3600000).toISOString() } });

function fixture(accounts = [{ id: 'claudeAgent', body: weekly(66, 62), tier: 'default_claude_max_20x' },
  { id: 'claudeAlt', body: weekly(63, 43), tier: 'default_claude_max_5x' }], driver = 'claudeAgent') {
  const home = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/sync-default-`);
  const replies = new Map(accounts.map((account) => [account.id, account]));
  const requests = [];
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const id = request.headers.get('authorization')?.replace(`Bearer ${token}-`, '');
    requests.push(id);
    const reply = replies.get(id);
    return Response.json(reply?.body ?? {}, { status: reply?.status ?? 200 });
  } });
  servers.push(server);
  const instances = Object.fromEntries(accounts.map((account, i) => {
    const dir = `${home}/account-${i}`;
    mkdirSync(dir);
    const accountDriver = account.driver ?? driver;
    if (!account.missing) writeFileSync(`${dir}/${accountDriver === 'codex' ? 'auth.json' : '.credentials.json'}`,
      JSON.stringify(accountDriver === 'codex' ? { tokens: { access_token: `${token}-${account.id}`, account_id: account.id } }
        : { claudeAiOauth: { accessToken: `${token}-${account.id}`, rateLimitTier: account.tier } }));
    return [account.id, { driver: account.driver ?? driver, enabled: account.enabled ?? true, config: { homePath: dir } }];
  }));
  const settings = `${home}/settings.json`;
  const data = { providerInstances: instances, defaultModelSelection: { instanceId: accounts[0]?.id, model: 'keep-model' },
    planModelSelection: { instanceId: 'unchanged', model: 'other' },
    projectSettingsOverrides: { project: { defaultModelSelection: { instanceId: 'unchanged', model: 'project' } } } };
  writeFileSync(settings, JSON.stringify(data, null, 2) + '\n');
  async function run(args = [], env = {}) {
    const child = Bun.spawn(['bun', script, '--settings', settings, ...args], {
      env: { ...process.env, HOME: home, XDG_CACHE_HOME: `${home}/cache`, AXSTACK_SYNC_DEFAULT: '1', AXSTACK_SYNC_POOL: '',
        AXSTACK_CLAUDE_USAGE_URL: server.url.href, AXSTACK_CODEX_USAGE_URL: server.url.href, ...env },
      stdout: 'pipe', stderr: 'pipe',
    });
    const [output, error, status] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    expect(output + error).not.toContain(token);
    return { output, error, status, data: output.startsWith('{') ? JSON.parse(output) : null };
  }
  return { home, settings, data, requests, replies, run };
}

test('Usage CLI dry-run reports weekly pace choice in one JSON line without writing settings', async () => {
  const f = fixture();
  const before = readFileSync(f.settings);
  const result = await f.run(['--dry-run']);
  expect(result.status).toBe(0);
  expect(result.data).toMatchObject({ action: 'updated', from: 'claudeAgent', to: 'claudeAlt' });
  expect(result.output.trim().split('\n')).toHaveLength(1);
  expect(result.error).toBe('');
  expect(f.requests).toEqual(['claudeAgent', 'claudeAlt']);
  expect(readFileSync(f.settings)).toEqual(before);
});

test('weekly switch changes only the instance string, preserving formatting and every other selection', async () => {
  const f = fixture();
  const before = readFileSync(f.settings, 'utf8');
  const result = await f.run();
  expect(result.status).toBe(0);
  expect(result.data).toMatchObject({ action: 'updated', from: 'claudeAgent', to: 'claudeAlt' });
  expect(readFileSync(f.settings, 'utf8')).toBe(before.replace('"instanceId": "claudeAgent"', '"instanceId": "claudeAlt"'));
});

test('lead below ten leaves bytes and mtime untouched, independent of plan weight', async () => {
  const f = fixture([{ id: 'current', body: weekly(60, 60), tier: 'default_claude_max_5x' },
    { id: 'other', body: weekly(55, 60), tier: 'default_claude_max_20x' }]);
  const before = readFileSync(f.settings);
  const mtime = statSync(f.settings).mtimeMs;
  const result = await f.run();
  expect(result.status).toBe(0);
  expect(result.data).toMatchObject({ action: 'unchanged', reason: 'margin', from: 'current', to: 'current' });
  expect(readFileSync(f.settings)).toEqual(before);
  expect(statSync(f.settings).mtimeMs).toBe(mtime);
});

test('any exhausted window switches without margin; both exhausted stay unchanged', async () => {
  for (const window of ['five_hour', 'seven_day']) {
    const exhausted = weekly(60, 60);
    exhausted[window].utilization = 95;
    const f = fixture([{ id: 'current', body: exhausted }, { id: 'other', body: weekly(94, 60) }]);
    expect((await f.run()).data).toMatchObject({ action: 'updated', reason: 'current-excluded', to: 'other' });
    f.data.defaultModelSelection.instanceId = 'current';
    writeFileSync(f.settings, JSON.stringify(f.data));
    // This fresh cache deliberately leaves both accounts excluded on the next run.
    const cachePath = `${f.home}/cache/axstack/usage.json`;
    const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
    Object.values(cache).forEach((entry) => { entry.utilization = 95; });
    writeFileSync(cachePath, JSON.stringify(cache));
    const before = readFileSync(f.settings);
    expect((await f.run()).data.action).toBe('unchanged');
    expect(readFileSync(f.settings)).toEqual(before);
  }
});

test('unknown API, missing reset clock and expired cache hold a comparable pair', async () => {
  for (const uncertain of [{ status: 503 }, { status: 401 }, { status: 403 }, { body: { five_hour: { utilization: 10 }, seven_day: { utilization: 20 } } }]) {
    const f = fixture([{ id: 'current', body: weekly(66, 62) }, { id: 'other', ...uncertain }, { id: 'leader', body: weekly(30, 43) }]);
    const before = readFileSync(f.settings);
    expect((await f.run()).data).toMatchObject({ action: 'unchanged', reason: 'unknown' });
    expect(readFileSync(f.settings)).toEqual(before);
  }
  const f = fixture();
  expect((await f.run(['--dry-run'])).status).toBe(0);
  const cachePath = `${f.home}/cache/axstack/usage.json`;
  const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
  Object.values(cache).forEach((entry) => { entry.updatedAt = Date.now() - 360000; });
  writeFileSync(cachePath, JSON.stringify(cache));
  f.replies.forEach((entry) => { entry.status = 503; });
  expect((await f.run()).data).toMatchObject({ action: 'unchanged', reason: 'unknown' });
});

test('excluded or unauthorized current can escape to known sibling despite another unknown account', async () => {
  for (const current of [{ body: weekly(95, 60) }, { status: 401 }, { missing: true }]) {
    const f = fixture([{ id: 'current', ...current }, { id: 'eligible', body: weekly(90, 60) },
      { id: 'unknown', status: 503 }]);
    expect((await f.run()).data).toMatchObject({ action: 'updated', reason: 'current-excluded', to: 'eligible' });
  }
});

test('missing default, unmanaged driver and disabled switch are no-ops without usage requests', async () => {
  for (const mode of ['missing', 'empty-settings', 'unmanaged', 'unmanaged-prototype', 'disabled']) {
    const f = fixture();
    if (mode === 'missing') delete f.data.defaultModelSelection;
    if (mode === 'unmanaged') f.data.providerInstances.claudeAgent.driver = 'grok';
    if (mode === 'unmanaged-prototype') {
      f.data.providerInstances.claudeAgent.driver = 'constructor';
      writeFileSync(`${f.home}/account-0/auth.json`, JSON.stringify({ tokens: {
        access_token: `${token}-claudeAgent`, account_id: 'claudeAgent' } }));
    }
    writeFileSync(f.settings, JSON.stringify(mode === 'empty-settings' ? {} : f.data));
    const before = readFileSync(f.settings);
    const result = await f.run([], mode === 'disabled' ? { AXSTACK_SYNC_DEFAULT: '0' } : {});
    expect(result.status).toBe(0);
    expect(result.data.action).toBe('unchanged');
    expect(readFileSync(f.settings)).toEqual(before);
    expect(f.requests).toEqual([]);
  }
});

const codex = (primary, secondary, reached = false) => ({ rate_limit: { limit_reached: reached,
  primary_window: { used_percent: primary, limit_window_seconds: 18000, reset_after_seconds: 7200 },
  ...(secondary && { secondary_window: secondary }) } });
test('Codex uses secondary clock or primary fallback, and ignores disabled or cross-provider instances', async () => {
  for (const secondary of [true, false]) {
    const f = fixture([{ id: 'current', body: codex(60, secondary && { used_percent: 60,
      limit_window_seconds: 604800, reset_at: Math.floor(Date.now() / 1000) + 216000 }) },
    { id: 'other', body: codex(40, secondary && { used_percent: 40,
      limit_window_seconds: 604800, reset_after_seconds: 216000 }) },
    { id: 'disabled', enabled: false, body: codex(0) },
    { id: 'wrong-driver', driver: 'claudeAgent', body: codex(0) }], 'codex');
    expect((await f.run()).data).toMatchObject({ action: 'updated', to: 'other' });
    expect(f.requests).toEqual(['current', 'other']);
  }
  const f = fixture([{ id: 'current', body: codex(1, null, true) }, { id: 'other', body: codex(94) }], 'codex');
  expect((await f.run()).data).toMatchObject({ action: 'updated', reason: 'current-excluded', to: 'other' });
});

test('malformed settings and invalid CLI exit one without changing the settings', async () => {
  const f = fixture();
  for (const bytes of ['{invalid', 'null', '{"providerInstances":[]}']) {
    writeFileSync(f.settings, bytes);
    const result = await f.run();
    expect(result.status).toBe(1);
    expect(result.output).toBe('');
    expect(readFileSync(f.settings, 'utf8')).toBe(bytes);
  }
  writeFileSync(f.settings, JSON.stringify(f.data));
  expect((await f.run(['--unknown'])).status).toBe(1);
  expect((await f.run(['--settings'])).status).toBe(1);
});


test('commit detects a settings edit after the decision and refuses to overwrite it', async () => {
  const f = fixture();
  const original = readFileSync(f.settings, 'utf8');
  expect((await f.run(['--dry-run'])).data.action).toBe('updated');
  const next = original.replace('"instanceId": "claudeAgent"', '"instanceId": "claudeAlt"');
  const concurrent = original.replace('keep-model', 'new-model');
  writeFileSync(f.settings, concurrent);
  expect(commit(f.settings, original, next)).toBe('concurrent-edit');
  expect(readFileSync(f.settings, 'utf8')).toBe(concurrent);
});

test('commit refuses an extra selection change and leaves the original file intact', () => {
  const f = fixture();
  const original = readFileSync(f.settings, 'utf8');
  const next = original.replace('"instanceId": "claudeAgent"', '"instanceId": "claudeAlt"').replace('keep-model', 'bad-model');
  expect(() => commit(f.settings, original, next)).toThrow();
  expect(readFileSync(f.settings, 'utf8')).toBe(original);
});

test('an overlapping commit is skipped while the exclusive lock is held', () => {
  const f = fixture();
  const original = readFileSync(f.settings, 'utf8');
  mkdirSync(`${f.settings}.axstack-default-sync.lock`);
  expect(commit(f.settings, original, original.replace('"instanceId": "claudeAgent"', '"instanceId": "claudeAlt"'))).toBe('locked');
  expect(readFileSync(f.settings, 'utf8')).toBe(original);
});

test('commit recovers a lock older than sixty seconds and writes the requested instance', () => {
  const f = fixture();
  const original = readFileSync(f.settings, 'utf8');
  const next = original.replace('"instanceId": "claudeAgent"', '"instanceId": "claudeAlt"');
  const lock = `${f.settings}.axstack-default-sync.lock`;
  mkdirSync(lock);
  const stale = new Date(Date.now() - 61000);
  fs.utimesSync(lock, stale, stale);
  expect(commit(f.settings, original, next)).toBe('updated');
  expect(readFileSync(f.settings, 'utf8')).toBe(next);
  expect(fs.existsSync(lock)).toBe(false);
});

test('commit preserves mode, fsyncs before rename, and reads the replaced settings back', () => {
  const f = fixture();
  fs.chmodSync(f.settings, 0o640);
  const original = readFileSync(f.settings, 'utf8');
  const next = original.replace('"instanceId": "claudeAgent"', '"instanceId": "claudeAlt"');
  const events = [];
  const realSync = fs.fsyncSync;
  const realRename = fs.renameSync;
  const realRead = fs.readFileSync;
  const spies = [spyOn(fs, 'fsyncSync').mockImplementation((fd) => { events.push('fsync'); return realSync(fd); }),
    spyOn(fs, 'renameSync').mockImplementation((a, b) => { events.push('rename'); return realRename(a, b); }),
    spyOn(fs, 'readFileSync').mockImplementation((...args) => { if (args[0] === f.settings) events.push('read'); return realRead(...args); })];
  try { expect(commit(f.settings, original, next)).toBe('updated'); }
  finally { spies.forEach((spy) => { spy.mockRestore(); }); }
  expect(events).toEqual(['fsync', 'read', 'rename', 'read']);
  expect(statSync(f.settings).mode & 0o777).toBe(0o640);
  expect(readFileSync(f.settings, 'utf8')).toBe(next);
});

test('write failure keeps original bytes and releases the lock; a post-rename mismatch throws', () => {
  const f = fixture();
  const original = readFileSync(f.settings, 'utf8');
  const next = original.replace('"instanceId": "claudeAgent"', '"instanceId": "claudeAlt"');
  const fail = spyOn(fs, 'fsyncSync').mockImplementation(() => { throw new Error('fixture disk failure'); });
  try { expect(() => commit(f.settings, original, next)).toThrow(); }
  finally { fail.mockRestore(); }
  expect(readFileSync(f.settings, 'utf8')).toBe(original);
  expect(fs.existsSync(`${f.settings}.axstack-default-sync.lock`)).toBe(false);
  expect(fs.readdirSync(f.home).some((name) => name.endsWith('.tmp'))).toBe(false);
  const realRename = fs.renameSync;
  const mismatch = spyOn(fs, 'renameSync').mockImplementation((a, b) => {
    realRename(a, b); writeFileSync(b, original);
  });
  try { expect(() => commit(f.settings, original, next)).toThrow('read-back mismatch'); }
  finally { mismatch.mockRestore(); }
});

const pool = 'claudeAgent=claude-opus-5-5,codex=gpt-6-astra:medium';
const codexWeekly = (used, hours = 60) => codex(10, { used_percent: used,
  limit_window_seconds: 604800, reset_after_seconds: hours * 3600 });

test('Usage env pool dry-run chooses the other driver and prints its full selection', async () => {
  const f = fixture([{ id: 'current', body: weekly(66, 62) },
    { id: 'sol', driver: 'codex', body: codexWeekly(30, 43) },
    { id: 'disabled', driver: 'codex', enabled: false, body: codexWeekly(0, 1) }]);
  const before = readFileSync(f.settings);
  const result = await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: pool });
  expect(result.status).toBe(0);
  expect(result.data).toMatchObject({ action: 'updated', to: 'sol', selection: {
    instanceId: 'sol', model: 'gpt-6-astra', options: [{ id: 'reasoningEffort', value: 'medium' }] } });
  expect(result.output.trim().split('\n')).toHaveLength(1);
  expect(result.error).toBe('');
  expect(f.requests).toEqual(['current', 'sol']);
  expect(readFileSync(f.settings)).toEqual(before);
});

test('pooled writes replace the full root selection and preserve every surrounding byte', async () => {
  for (const driver of ['codex', 'claudeAgent']) {
    const f = fixture([{ id: 'current', body: weekly(66, 62) },
      { id: 'winner', driver, body: driver === 'codex' ? codexWeekly(30, 43) : weekly(30, 43) }]);
    const before = readFileSync(f.settings, 'utf8');
    const selection = driver === 'codex'
      ? { instanceId: 'winner', model: 'gpt-6-astra', options: [{ id: 'reasoningEffort', value: 'medium' }] }
      : { instanceId: 'winner', model: 'claude-opus-5-5' };
    expect((await f.run([], { AXSTACK_SYNC_POOL: pool })).data).toMatchObject({ action: 'updated', selection });
    const originalSelection = JSON.stringify(f.data.defaultModelSelection, null, 2).replaceAll('\n', '\n  ');
    expect(readFileSync(f.settings, 'utf8')).toBe(before.replace(originalSelection, JSON.stringify(selection)));
  }
  const f = fixture();
  const selection = { instanceId: 'claudeAlt', model: 'claude-opus-5-5', options: [{ id: 'effort', value: 'high' }] };
  f.data.defaultModelSelection = { ...selection, instanceId: 'claudeAgent' };
  writeFileSync(f.settings, JSON.stringify(f.data, null, 2));
  const before = readFileSync(f.settings, 'utf8');
  expect((await f.run([], { AXSTACK_SYNC_POOL: 'claudeAgent=claude-opus-5-5:high' })).status).toBe(0);
  expect(readFileSync(f.settings, 'utf8')).toBe(before.replace('"instanceId": "claudeAgent"', '"instanceId": "claudeAlt"'));
});

test('commit accepts only the decided root selection and rejects changes elsewhere', () => {
  const f = fixture();
  const original = readFileSync(f.settings, 'utf8');
  const selection = { instanceId: 'claudeAlt', model: 'pool-model' };
  const next = { ...f.data, defaultModelSelection: selection };
  expect(() => commit(f.settings, original, JSON.stringify({ ...next, planModelSelection: selection }), selection)).toThrow();
  expect(() => commit(f.settings, original, JSON.stringify({ ...next,
    defaultModelSelection: { ...selection, options: [] } }), selection)).toThrow();
  expect(readFileSync(f.settings, 'utf8')).toBe(original);
  expect(commit(f.settings, original, JSON.stringify(next), selection)).toBe('updated');
  expect(JSON.parse(readFileSync(f.settings, 'utf8'))).toEqual(next);
});

test('non-current absent credentials are excluded but malformed or unreadable credentials hold in both modes', async () => {
  for (const poolValue of ['', pool]) {
    for (const failure of ['absent', 'malformed', 'unreadable']) {
      const f = fixture([{ id: 'current', body: weekly(66, 62) },
        { id: 'other', missing: true }, { id: 'winner', body: weekly(30, 43) }]);
      const path = `${f.home}/account-1/.credentials.json`;
      if (failure === 'malformed') writeFileSync(path, '{invalid');
      if (failure === 'unreadable') mkdirSync(path);
      const before = readFileSync(f.settings);
      const result = await f.run([], { AXSTACK_SYNC_POOL: poolValue });
      expect(result.data).toMatchObject(failure === 'absent'
        ? { action: 'updated', to: 'winner' } : { action: 'unchanged', reason: 'unknown' });
      expect(result.data.instances.find((entry) => entry.instanceId === 'other').state)
        .toBe(failure === 'absent' ? 'excluded' : 'unknown');
      if (failure !== 'absent') expect(readFileSync(f.settings)).toEqual(before);
    }
  }
});

test('pooled short Codex windows are unknown while weekly primary clocks qualify', async () => {
  for (const seconds of [18000, 604800]) {
    const f = fixture([{ id: 'current', body: weekly(66, 62) }, { id: 'sol', driver: 'codex', body: {
      rate_limit: { primary_window: { used_percent: 20, limit_window_seconds: seconds,
        reset_after_seconds: seconds / 4 } } } }]);
    const before = readFileSync(f.settings);
    const result = await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: pool });
    expect(result.data).toMatchObject(seconds < 604800
      ? { action: 'unchanged', reason: 'unknown' } : { action: 'updated', to: 'sol' });
    expect(readFileSync(f.settings)).toEqual(before);
  }
});

test('pooled short-window exhaustion still allows current escape across drivers', async () => {
  for (const body of [codex(95), codex(10, null, true)]) {
    const f = fixture([{ id: 'current', body },
      { id: 'opus', driver: 'claudeAgent', body: weekly(90, 60) }], 'codex');
    expect((await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: pool })).data)
      .toMatchObject({ action: 'updated', reason: 'current-excluded', to: 'opus',
        selection: { instanceId: 'opus', model: 'claude-opus-5-5' } });
  }
});

test('pooled manual picks persist on margin or unknown, excluded current escapes across drivers', async () => {
  for (const scenario of ['margin', 'unknown', 'exhausted', 'unauthorized', 'skipped']) {
    const f = fixture([{ id: 'current', body: weekly(scenario === 'exhausted' ? 95 : 60, 60),
      ...(scenario === 'unauthorized' && { status: 401 }), ...(scenario === 'skipped' && { missing: true }) },
    { id: 'sol', driver: 'codex', body: codexWeekly(55) },
    ...(scenario === 'unknown' || scenario === 'exhausted' ? [{ id: 'unknown', status: 503 }] : [])]);
    const before = readFileSync(f.settings);
    const result = await f.run([], { AXSTACK_SYNC_POOL: pool });
    expect(result.data).toMatchObject(['margin', 'unknown'].includes(scenario)
      ? { action: 'unchanged', reason: scenario } : { action: 'updated', reason: 'current-excluded', to: 'sol' });
    if (['margin', 'unknown'].includes(scenario)) expect(readFileSync(f.settings)).toEqual(before);
  }
});

test('pool outside current driver is unmanaged and invalid pools fail without requests or writes', async () => {
  const f = fixture();
  const before = readFileSync(f.settings);
  expect((await f.run([], { AXSTACK_SYNC_POOL: 'codex=gpt-6-astra:medium' })).data)
    .toMatchObject({ action: 'unchanged', reason: 'unmanaged' });
  for (const value of ['grok=model', 'claudeAgent=', 'codex=sol,codex=astra', 'codex=sol:extra-high',
    'codex=sol:HIGH', 'codex=sol:', 'codex=sol,', 'constructor=sol']) {
    expect((await f.run([], { AXSTACK_SYNC_POOL: value })).status).toBe(1);
  }
  expect(f.requests).toEqual([]);
  expect(readFileSync(f.settings)).toEqual(before);
  expect((await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: 'claudeAgent=opus:future' })).data.selection)
    .toEqual({ instanceId: 'claudeAlt', model: 'opus', options: [{ id: 'effort', value: 'future' }] });
});

const policyNow = 2000000000000;
const policyPool = { claudeAgent: { model: 'claude-opus-5-5' },
  codex: { model: 'gpt-6-astra', options: [{ id: 'reasoningEffort', value: 'medium' }] } };
function policyPair(currentUsed, otherUsed, currentElapsed = 90, otherElapsed = 10) {
  const settings = { providerInstances: {
    current: { driver: 'claudeAgent', enabled: true }, other: { driver: 'codex', enabled: true } },
  defaultModelSelection: { instanceId: 'current', model: 'manual', options: [{ id: 'effort', value: 'high' }] } };
  const usage = [currentUsed, otherUsed].map((used, i) => ({ instanceId: i ? 'other' : 'current',
    state: 'fresh', updatedAt: policyNow, utilization: used, windows: [{ used: 10 },
      { used, seconds: 604800, resetAt: policyNow + 604800000 * (1 - (i ? otherElapsed : currentElapsed) / 100) }] }));
  return { settings, usage };
}

for (const [currentUsed, otherUsed, to] of [
  [86, 85, 'other'], [91, 90, 'other'], // R=14 -> 15 and R=9 -> 10
  [85.001, 85, 'other'], [90.001, 90, 'other'],
  [86, 85.001, 'current'], [91, 90.001, 'current'],
]) {
  test(`pooled used ${currentUsed} versus ${otherUsed} selects ${to} despite opposing pace`, () => {
    const { settings, usage } = policyPair(currentUsed, otherUsed);
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({
      action: to === 'other' ? 'updated' : 'unchanged', to });
    // Reverse the pace advantage: the higher-band current must stay selected.
    const reversed = policyPair(otherUsed, currentUsed, 10, 90);
    expect(decide(reversed.settings, reversed.usage, policyNow, policyPool).to)
      .toBe(to === 'other' ? 'current' : 'other');
  });
}

test('every pooled band keeps the ten-point pace margin, current ties, and low accounts usable', () => {
  for (const used of [50, 88, 92]) {
    for (const [elapsed, to] of [[50, 'current'], [59, 'current'], [60, 'other'], [65, 'other']]) {
      const { settings, usage } = policyPair(used, used, 50, elapsed);
      expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({
        action: to === 'other' ? 'updated' : 'unchanged', to });
      // Candidate enumeration order must not turn a tie into a switch.
      if (elapsed === 50) {
        settings.providerInstances = { other: settings.providerInstances.other, current: settings.providerInstances.current };
        expect(decide(settings, usage, policyNow, policyPool).to).toBe('current');
      }
    }
    // Better pace can win with less remaining quota within the same band.
    const { settings, usage } = policyPair(used, used + 1, 50, 65);
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'updated', to: 'other' });
  }
});

test('reserve preference keeps unknown holds, excluded-current escape, and hard exclusions in order', () => {
  for (const unknown of [{ state: 'unknown' }, { updatedAt: policyNow - 300000 },
    { windows: [{ used: 10 }, { used: 0, seconds: 604800 }] },
    { windows: [{ used: 0, seconds: 18000, resetAt: policyNow + 100000 }] }]) {
    const { settings, usage } = policyPair(91, 85);
    settings.providerInstances.uncertain = { driver: 'codex', enabled: true };
    usage.push({ ...usage[1], instanceId: 'uncertain', ...unknown });
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'unchanged', reason: 'unknown' });
    usage[0].utilization = 95;
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'updated', reason: 'current-excluded', to: 'other' });
  }
  for (const exclusion of [{ utilization: 95 }, { limitReached: true }, { credentialsAbsent: true }]) {
    const { settings, usage } = policyPair(92, 85);
    Object.assign(usage[1], exclusion);
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'unchanged', to: 'current' });
    usage[0].utilization = 95;
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'unchanged', reason: 'no-eligible' });
  }
});

test('without a pool reserve thresholds do not change pace selection or enforce a model', () => {
  const { settings, usage } = policyPair(86, 85);
  settings.providerInstances.other.driver = 'claudeAgent';
  expect(decide(settings, usage, policyNow)).toEqual({ action: 'unchanged', reason: 'margin',
    from: 'current', to: 'current', instances: [
      { instanceId: 'current', state: 'eligible', pace: 4 }, { instanceId: 'other', state: 'eligible', pace: -75 } ] });
  usage[1].windows[1].used = 65;
  usage[1].windows[1].resetAt = usage[0].windows[1].resetAt;
  expect(decide(settings, usage, policyNow).selection).toEqual({ ...settings.defaultModelSelection, instanceId: 'other' });
  expect(decide(settings, [usage[0]], policyNow, policyPool)).toMatchObject({ action: 'unchanged', reason: 'unknown' });
});

test('reserve-driven CLI dry-run and write preserve settings bytes outside the selected root object', async () => {
  const f = fixture([{ id: 'current', body: weekly(86, 10) },
    { id: 'astra', driver: 'codex', body: codexWeekly(85, 160) }]);
  const before = readFileSync(f.settings, 'utf8');
  const selection = { instanceId: 'astra', ...policyPool.codex };
  const dry = await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: pool });
  expect(dry.status).toBe(0);
  expect(dry.data).toMatchObject({ action: 'updated', to: 'astra', selection });
  expect(readFileSync(f.settings, 'utf8')).toBe(before);
  const written = await f.run([], { AXSTACK_SYNC_POOL: pool });
  expect(written.status).toBe(0);
  expect(written.data).toMatchObject({ action: 'updated', to: 'astra', selection });
  const originalSelection = JSON.stringify(f.data.defaultModelSelection, null, 2).replaceAll('\n', '\n  ');
  expect(readFileSync(f.settings, 'utf8')).toBe(before.replace(originalSelection, JSON.stringify(selection)));
});
