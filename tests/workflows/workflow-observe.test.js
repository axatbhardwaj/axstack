import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';

const cli = `${import.meta.dir}/../../bin/axstack.js`;
const date = '2026-01-01T12:00:00Z';
const loopback = 'http://127.0.0.1:1234';
const triggers = 'CREATE TABLE workflow_triggers(trigger_id TEXT PRIMARY KEY, next_at TEXT)';
const runs = 'CREATE TABLE workflow_runs(run_id TEXT PRIMARY KEY, workflow TEXT, version INTEGER, idempotency_key TEXT, status TEXT, started_at TEXT, ended_at TEXT, input_json TEXT, result_json TEXT, parent_run_id TEXT)';

function fixture(origin = loopback) {
  const root = makeTempRoot('axstack-observe-');
  const base = `${root}/base`;
  const userdata = `${base}/userdata`;
  const runtime = `${userdata}/server-runtime.json`;
  const dbPath = `${userdata}/statev2.sqlite`;
  const token = `${root}/fixture-registry`;
  const socket = `${root}/socket-called`;
  for (const dir of [base, userdata, `${root}/bin`, `${root}/home`]) mkdirSync(dir, { mode: 0o700 });
  writeFileSync(runtime, JSON.stringify({ pid: 123, startedAt: date, serverVersion: '0.1.12', origin }));
  writeFileSync(`${userdata}/environment-id`, 'fixture-environment');
  writeFileSync(`${root}/receipt.json`, '{}');
  writeFileSync(token, 'mock-registry-value', { mode: 0o600 });
  writeFileSync(`${root}/bin/t3`, `#!/bin/sh\n${String.raw`
set -eu
case "$*" in
  --version)
    if [ "$FIXTURE_CHANGE_RUNTIME" = 1 ]; then
      printf '%s\n' '{"pid":124,"startedAt":"2026-01-01T12:00:01Z","serverVersion":"0.1.12"}' > "$FIXTURE_RUNTIME"
    fi
    printf '%s\n' 't3 v0.1.12'
    ;;
  "workflow list "*) printf '%s\n' '[]';;
  *) exit 3;;
esac
`}`, { mode: 0o700 });
  const preload = `${root}/registry-preload.mjs`;
  // Keep the test offline even if the collector erroneously accepts a remote origin.
  writeFileSync(preload, String.raw`
import { writeFileSync } from 'node:fs';
if (Bun.env.FIXTURE_WRONG_OWNER === '1') {
  const owner = process.getuid();
  process.getuid = () => owner + 1;
}
globalThis.WebSocket = class extends EventTarget {
  constructor(url, options) {
    super();
    writeFileSync(Bun.env.FIXTURE_SOCKET, JSON.stringify({
      origin: new URL(url).origin, authorized: options.headers.Authorization === 'Bearer mock-registry-value',
    }));
    queueMicrotask(() => this.dispatchEvent(new Event('open')));
  }
  send(message) {
    const request = JSON.parse(message);
    if (request.tag !== 'workflows.subscribe') return;
    const data = JSON.stringify({ _tag: 'Chunk', requestId: request.id,
      values: [{ workflows: [{ name: 'fixture-probe', version: 1 }], definition: { problem: null } }] });
    queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })));
  }
  close() {}
};
`);
  return { root, base, runtime, dbPath, token, socket, preload };
}

function observe(files, { registry = false, changeRuntime = false, wrongOwner = false } = {}) {
  const args = [
    ...(registry ? ['--preload', files.preload] : []), cli, 'workflow', 'observe',
    '--base-dir', files.base, '--conformance', `${files.root}/receipt.json`,
    ...(registry ? ['--registry-token-file', files.token] : []),
  ];
  const result = Bun.spawnSync([process.execPath, ...args], {
    env: {
      PATH: `${files.root}/bin`, HOME: `${files.root}/home`, TMPDIR: files.root,
      FIXTURE_RUNTIME: files.runtime, FIXTURE_SOCKET: files.socket,
      FIXTURE_CHANGE_RUNTIME: changeRuntime ? '1' : '0',
      FIXTURE_WRONG_OWNER: wrongOwner ? '1' : '0',
    },
    timeout: 10_000, stderr: 'pipe',
  });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return JSON.parse(result.stdout.toString());
}

function snapshot(dbPath) {
  return ['', '-wal', '-shm'].map((suffix) => {
    const path = dbPath + suffix;
    if (!existsSync(path)) return null;
    return { hash: Bun.hash(readFileSync(path)), mtime: statSync(path).mtimeMs };
  });
}

test('observe leaves an absent SQLite database and its side files absent', () => {
  const files = fixture();
  expect(snapshot(files.dbPath)).toEqual([null, null, null]);
  expect(observe(files).journal).toBeNull();
  expect(snapshot(files.dbPath)).toEqual([null, null, null]);
});

test('observe leaves an existing database unchanged without creating side files', () => {
  const files = fixture();
  const db = new Database(files.dbPath);
  db.exec(triggers);
  db.exec(runs);
  db.close();
  const before = snapshot(files.dbPath);
  expect(before).toEqual([expect.anything(), null, null]);
  expect(observe(files).journal).toEqual({ triggers: [], runs: [], complete: true });
  expect(snapshot(files.dbPath)).toEqual(before);
});

test('observe leaves the database and live WAL bytes and timestamps unchanged', () => {
  const files = fixture();
  const writer = new Database(files.dbPath);
  try {
    writer.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
    writer.exec(triggers);
    writer.exec(runs);
    writer.query('INSERT INTO workflow_triggers VALUES (?, ?)').run('fixture-probe/every:60000', date);
    const before = snapshot(files.dbPath);
    expect(before.every(Boolean)).toBe(true);
    expect(observe(files).journal).toMatchObject({ triggers: [{ nextAt: date }], complete: true });
    const after = snapshot(files.dbPath);
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
    // SQLite uses the existing SHM file for WAL reader coordination.
    expect(after[2]).not.toBeNull();
  } finally {
    writer.close();
  }
});

test.each([
  ['missing table', runs],
  ['renamed column', `${triggers.replace('next_at', 'replacement')}; ${runs}`],
])('observe represents a %s as an unavailable journal', (_, schema) => {
  const files = fixture();
  const db = new Database(files.dbPath);
  db.exec(schema);
  db.close();
  expect(observe(files)).toMatchObject({ t3: { serverVersion: '0.1.12' }, journal: null });
});

test('observe drops native observations if the server changes during collection', () => {
  const files = fixture();
  expect(observe(files).t3).toMatchObject({ startedAt: date });
  const drifted = observe(files, { changeRuntime: true });
  for (const field of ['t3', 'registry', 'journal', 'activeRuns', 'shows']) expect(drifted).not.toHaveProperty(field);
});

test('observe caps the run scan even when unrelated runs fill its recent history', () => {
  const files = fixture();
  const db = new Database(files.dbPath);
  db.exec(triggers);
  db.exec(runs);
  const insert = db.query('INSERT INTO workflow_runs (run_id, idempotency_key, started_at) VALUES (?, ?, ?)');
  db.transaction(() => {
    insert.run('older-slot', 'trigger:older', date);
    for (let index = 0; index < 1000; index++) insert.run(`manual-${index}`, 'manual', date);
    insert.run('recent-slot', 'trigger:recent', date);
  })();
  db.close();
  const { journal } = observe(files);
  expect(journal.complete).toBe(false);
  expect(journal.runs.map((row) => row.runId)).toEqual(['recent-slot']);
});

test('observe caps the trigger export and marks it incomplete', () => {
  const files = fixture();
  const db = new Database(files.dbPath);
  db.exec(triggers);
  db.exec(runs);
  const insert = db.query('INSERT INTO workflow_triggers VALUES (?, ?)');
  db.transaction(() => {
    for (let index = 0; index <= 1000; index++) insert.run(`fixture-${index}`, date);
  })();
  db.close();
  const { journal } = observe(files);
  expect(journal.complete).toBe(false);
  expect(journal.triggers).toHaveLength(1000);
});

test('observe opens the registry only for a loopback origin and a private owned token', () => {
  const good = fixture();
  expect(observe(good, { registry: true }).registry).toMatchObject({
    workflows: [{ name: 'fixture-probe', version: 1 }], definition: { problem: null },
  });
  expect(JSON.parse(readFileSync(good.socket, 'utf8'))).toEqual({ origin: 'ws://127.0.0.1:1234', authorized: true });

  const files = fixture('http://fixture-registry.invalid:1234');
  expect(observe(files, { registry: true }).registry).toBeNull();
  expect(existsSync(files.socket)).toBe(false);
});

test.each(['mode', 'owner'])('observe refuses registry access with invalid token %s', (restriction) => {
  const files = fixture();
  if (restriction === 'mode') writeFileSync(`${files.token}-public`, 'mock-registry-value', { mode: 0o644 });
  const candidate = restriction === 'mode' ? { ...files, token: `${files.token}-public` } : files;
  expect(observe(candidate, { registry: true, wrongOwner: restriction === 'owner' }).registry).toBeNull();
  expect(existsSync(files.socket)).toBe(false);
});
