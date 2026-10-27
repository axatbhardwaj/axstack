import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as fs from 'node:fs';
import { readHistory } from '../../skills/axstack/scripts/driver-history.js';
import { fixture, now } from './default-routing-fixtures.js';
import { decide } from '../../skills/axstack/scripts/default-policy.js';

function database(run) {
  const dir = fs.mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/driver-history-`);
  const path = `${dir}/statev2.sqlite`;
  const d = new Database(path, { create: true });
  d.exec(`CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, created_at TEXT, provider_instance_id TEXT, payload_json TEXT)`);
  const put = (id, model, source = 'web', extra = {}) => d.query('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?, ?)')
    .run(id, new Date(now - 1000).toISOString(), model.startsWith('gpt') ? 'code' : 'claude',
      JSON.stringify({ createdBy: 'user', creationSource: source, modelSelection: { model }, lineage: { parentThreadId: null }, ...extra }));
  try { run({ dir, path, d, put }); }
  finally { d.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('native database reader includes web/mobile drivers across projects without creating or changing files', () => database((f) => {
  f.put('a', 'claude-opus-5-5'); f.put('b', 'gpt-6-astra', 'mobile');
  const before = fs.readFileSync(f.path);
  const r = readHistory(`${f.dir}/settings.json`, now);
  expect(r.complete).toBe(true);
  expect(r.threads.map((t) => [t.providerInstanceId, t.model, t.parentThreadId])).toEqual([
    ['claude', 'claude-opus-5-5', null], ['code', 'gpt-6-astra', null],
  ]);
  expect(fs.readFileSync(f.path)).toEqual(before);
  expect(fs.readdirSync(f.dir)).toEqual(['statev2.sqlite']);
}));

test('missing and incompatible history are unavailable rather than empty zero-count inventories', () => database((f) => {
  expect(readHistory(`${f.dir}/missing/settings.json`, now).unavailable).toMatch(/database/);
  f.d.exec('DROP TABLE orchestration_v2_projection_threads');
  expect(readHistory(`${f.dir}/settings.json`, now).unavailable).toMatch(/database/);
}));

test('native manual start counts select Sol when it is underused, including mobile starts', () => {
  const f = fixture();
  f.usage[0].accounts.forEach((a) => { a.usageLimits.windows.forEach((w) => { w.usedPercent = 30; }); });
  const thread = (id, model, instance, source) => ({ threadId: id, createdAt: new Date(now - 1000).toISOString(),
    createdBy: 'user', creationSource: source, parentThreadId: null, providerInstanceId: instance, model });
  const threads = [thread('c1', 'claude-opus-5-5', 'claude', 'web'), thread('c2', 'claude-opus-5-5', 'claude', 'mobile'),
    ...Array.from({ length: 5 }, (_, i) => thread(`a${i}`, 'gpt-6-astra', 'code', 'mobile'))];
  const r = decide(f.settings, f.usage, f.catalogs, f.now, { threads, nextCursor: null, total: threads.length });
  expect(r.selection.model).toBe('gpt-6.1-sol');
  expect(r.history.counts).toEqual({ 'claude-opus-5-5': 2, 'gpt-6-astra': 5, 'gpt-6.1-sol': 0 });
});

for (const bad of [{ threads: [], nextCursor: 0 }, { threads: [], total: 9 },
  { threads: [{ createdBy: 'user', creationSource: 'web' }] }, { unavailable: 'database unavailable' }]) {
  test('incomplete, failed or malformed native history reports a reason without zero counts', () => {
    const f = fixture(); const r = decide(f.settings, f.usage, f.catalogs, f.now, bad);
    expect(r.history.status).toBe('unavailable');
    expect(r.history.reason).toBeTruthy();
    expect(r.history.counts).toBeUndefined();
  });
}

test('history failure still gives all similarly pressured routes a bounded turn without per-tick churn', () => {
  const f = fixture();
  f.usage[0].accounts.forEach((a) => { a.usageLimits.windows.forEach((w) => { w.usedPercent = 30; }); });
  const chosen = new Set();
  for (let slot = 0; slot < 3; slot++) {
    const at = f.now + slot * 6 * 3600000;
    const delta = at - f.now;
    const usage = structuredClone(f.usage);
    usage[0].checkedAt = new Date(at).toISOString();
    usage[0].accounts.forEach((a) => {
      a.usageLimits.checkedAt = new Date(at).toISOString();
      a.usageLimits.windows.forEach((w) => { w.resetsAt = new Date(Date.parse(w.resetsAt) + delta).toISOString(); });
    });
    const catalogs = f.catalogs.map((c) => ({ ...c, checkedAt: new Date(at).toISOString() }));
    const r = decide(f.settings, usage, catalogs, at, { unavailable: 'database unavailable' });
    chosen.add(r.selection.model); f.settings.defaultModelSelection = r.selection;
    const again = decide(f.settings, usage, catalogs, at + 1000, { unavailable: 'database unavailable' });
    expect(again.action).toBe('unchanged');
  }
  expect([...chosen].sort()).toEqual(['claude-opus-5-5', 'gpt-6-astra', 'gpt-6.1-sol']);
});

test('read-only history refuses a WAL without existing shared memory instead of creating sidecars', () => database((f) => {
  fs.writeFileSync(`${f.path}-wal`, '');
  expect(readHistory(`${f.dir}/settings.json`, now).unavailable).toMatch(/shared memory/);
  expect(fs.existsSync(`${f.path}-shm`)).toBe(false);
}));
