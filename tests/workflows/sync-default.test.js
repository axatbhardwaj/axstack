import { expect, test, spyOn } from 'bun:test';
import * as fs from 'node:fs';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { commit } from '../../skills/axstack/scripts/sync-default.js';
import { fixture, weekly, codex, token } from './sync-default-fixture.js';

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

test('higher tier switches even when its pace lead is below ten', async () => {
  const f = fixture([{ id: 'current', body: weekly(60, 60), tier: 'default_claude_max_5x' },
    { id: 'other', body: weekly(55, 60), tier: 'default_claude_max_20x' }]);
  const before = readFileSync(f.settings);
  const result = await f.run();
  expect(result.status).toBe(0);
  expect(result.data).toMatchObject({ action: 'updated', from: 'current', to: 'other' });
  expect(readFileSync(f.settings)).not.toEqual(before);
});

test('eligible claudeAlt tier-ups to claudeAgent before band and pace', async () => {
  const f = fixture([{ id: 'claudeAlt', body: weekly(0, 60), tier: 'default_claude_max_5x' },
    { id: 'claudeAgent', body: weekly(80, 60), tier: 'default_claude_max_20x' }]);
  const result = await f.run(['--dry-run']);
  expect(result.data).toMatchObject({ action: 'updated', from: 'claudeAlt', to: 'claudeAgent' });
});

test('lower tier cannot displace an eligible higher tier with better band or pace', async () => {
  const f = fixture([{ id: 'claudeAgent', body: weekly(80, 60), tier: 'default_claude_max_20x' },
    { id: 'claudeAlt', body: weekly(0, 60), tier: 'default_claude_max_5x' }]);
  expect((await f.run(['--dry-run'])).data).toMatchObject({ action: 'unchanged', to: 'claudeAgent' });
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
