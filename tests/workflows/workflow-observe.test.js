import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';

const cli = `${import.meta.dir}/../../bin/axstack.js`;
const date = '2026-01-01T12:00:00Z';
const loopback = 'http://127.0.0.1:1234';
const triggers = 'CREATE TABLE workflow_triggers(trigger_id TEXT PRIMARY KEY, next_at TEXT)';
const runs = `
  CREATE TABLE workflow_runs(run_id TEXT PRIMARY KEY, workflow TEXT, version INTEGER, idempotency_key TEXT,
    status TEXT, started_at TEXT, ended_at TEXT, input_json TEXT, result_json TEXT, parent_run_id TEXT);
  CREATE UNIQUE INDEX workflow_runs_key ON workflow_runs(workflow, idempotency_key);
`;

function fixture(origin = loopback) {
  const root = makeTempRoot('axstack-observe-');
  const base = `${root}/base`;
  const userdata = `${base}/userdata`;
  const runtime = `${userdata}/server-runtime.json`;
  const dbPath = `${userdata}/statev2.sqlite`;
  const token = `${root}/fixture-registry`;
  const socket = `${root}/socket-called`;
  for (const dir of [base, userdata, `${root}/bin`, `${root}/home`]) mkdirSync(dir, { mode: 0o700 });
  const runtimeRecord = { pid: 123, startedAt: date, serverVersion: '0.1.12', origin };
  writeFileSync(runtime, JSON.stringify(runtimeRecord));
  writeFileSync(`${userdata}/environment-id`, 'fixture-environment');
  writeFileSync(`${root}/receipt.json`, '{}');
  writeFileSync(token, 'mock-registry-value', { mode: 0o600 });
  writeFileSync(`${root}/bin/t3`, `#!/bin/sh\n${String.raw`
set -eu
case "$*" in
  --version)
    if [ -n "$FIXTURE_CHANGE_RUNTIME" ]; then
      printf '%s\n' "$FIXTURE_CHANGE_RUNTIME" > "$FIXTURE_RUNTIME"
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
  return { root, base, runtime, runtimeRecord, dbPath, token, socket, preload };
}

function observe(files, { registry = false, changeRuntime, wrongOwner = false } = {}) {
  const args = [
    ...(registry ? ['--preload', files.preload] : []), cli, 'workflow', 'observe',
    '--base-dir', files.base, '--conformance', `${files.root}/receipt.json`,
    ...(registry ? ['--registry-token-file', files.token] : []),
  ];
  const result = Bun.spawnSync([process.execPath, ...args], {
    env: {
      PATH: `${files.root}/bin`, HOME: `${files.root}/home`, TMPDIR: files.root,
      FIXTURE_RUNTIME: files.runtime, FIXTURE_SOCKET: files.socket,
      FIXTURE_CHANGE_RUNTIME: changeRuntime ? JSON.stringify({ ...files.runtimeRecord, ...changeRuntime }) : '',
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
    const { size, mtimeMs } = statSync(path);
    return { hash: Bun.hash(readFileSync(path)), size, mtime: mtimeMs };
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

test('observe preserves live WAL data while a separate writer holds the locks', async () => {
  const files = fixture();
  const writer = Bun.spawn([process.execPath, '-e', `
    import { Database } from 'bun:sqlite';
    const db = new Database(${JSON.stringify(files.dbPath)});
    db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
    db.exec(${JSON.stringify(triggers)});
    db.exec(${JSON.stringify(runs)});
    const insert = db.query('INSERT INTO workflow_triggers VALUES (?, ?)');
    insert.run('fixture-probe/every:60000', ${JSON.stringify(date)});
    console.log('ready');
    await Bun.stdin.text();
    insert.run('fixture-after/every:60000', ${JSON.stringify(date)});
    if (db.query('PRAGMA integrity_check').get().integrity_check !== 'ok') process.exitCode = 1;
    db.close();
  `], { stdin: 'pipe', stdout: 'pipe', env: { HOME: `${files.root}/home`, TMPDIR: files.root } });
  try {
    const stdout = writer.stdout.getReader();
    const ready = await stdout.read();
    stdout.releaseLock();
    expect(new TextDecoder().decode(ready.value)).toBe('ready\n');
    const before = snapshot(files.dbPath);
    expect(before.every(Boolean)).toBe(true);
    expect(observe(files).journal).toMatchObject({ triggers: [{ nextAt: date }], complete: true });
    const after = snapshot(files.dbPath);
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
    // The reader may publish its WAL read mark in the existing SHM mapping.
    expect(after[2]?.size).toBe(before[2].size);
    writer.stdin.end();
    expect(await writer.exited).toBe(0);
  } finally {
    if (writer.exitCode === null) {
      writer.kill();
      await writer.exited;
    }
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

test.each([
  ['pid', { pid: 124 }],
  ['startedAt', { startedAt: '2026-01-01T12:00:01Z' }],
  ['serverVersion', { serverVersion: '0.1.13' }],
])('observe drops native observations on a server %s change during collection', (_, changeRuntime) => {
  const files = fixture();
  expect(observe(files).t3).toMatchObject({ startedAt: date });
  const drifted = observe(files, { changeRuntime });
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

test.each([
  ['old slot and old history', '2026-01-01T09:00:00.000Z', '2026-01-01T10:00:00Z', true, 'fail'],
  ['slot at the unobserved cutoff', '2026-01-01T11:00:00.000Z', '2026-01-01T11:45:00Z', true, 'unknown'],
  ['no run for the trigger', null, '2026-01-01T10:00:00Z', true, 'fail'],
  ['old history and a missing native index', '2026-01-01T09:00:00.000Z', '2026-01-01T10:00:00Z', false, 'unknown'],
])('health evaluates a capped journal with %s', (_, scheduledAt, manualAt, indexed, status) => {
  const files = fixture();
  const db = new Database(files.dbPath);
  db.exec(triggers);
  db.exec(runs);
  if (!indexed) db.exec('DROP INDEX workflow_runs_key');
  const workflow = 'fixture-probe';
  const identity = `${workflow}@1`;
  const triggerId = `${workflow}/every:1800000`;
  db.query('INSERT INTO workflow_triggers VALUES (?, ?)').run(triggerId, date);
  const insert = db.query('INSERT INTO workflow_runs VALUES (?, ?, 1, ?, ?, ?, ?, ?, NULL, NULL)');
  db.transaction(() => {
    if (scheduledAt) insert.run('last-slot', workflow, `trigger:${triggerId}:${scheduledAt}`, 'completed',
      scheduledAt, scheduledAt, JSON.stringify({ scheduledAt }));
    const manualRuns = scheduledAt ? 1000 : 1001;
    for (let index = 0; index < manualRuns; index++) {
      insert.run(`manual-${index}`, 'fixture-other', `manual-${index}`, 'completed', manualAt, manualAt, null);
    }
  })();
  db.close();

  const observed = observe(files);
  expect(observed.journal).toMatchObject({ complete: false, runs: [] });
  const record = { digest: 'a'.repeat(64), bindingDigest: 'b'.repeat(64), binding: `${files.root}/binding.json` };
  const result = Bun.spawnSync([process.execPath, cli, 'workflow', 'health', '--input', '-'], {
    env: { HOME: `${files.root}/home`, TMPDIR: files.root },
    stdin: Buffer.from(JSON.stringify({ at: date, hosts: [{
      ...observed, host: 'fixture-host',
      manifest: { version: 1, workflows: { [identity]: record } }, catalog: { [workflow]: 1 },
      policies: { [identity]: { kind: 'scheduled', firstDueAt: '2026-01-01T08:00:00Z', intervalMs: 1_800_000, triggerId } },
    }] })),
    stderr: 'pipe',
  });
  expect(result.exitCode, result.stderr.toString()).toBe(2); // The fixture has no registry or conformance receipt.
  const { hosts } = JSON.parse(result.stdout.toString());
  const dueSlot = hosts[0].workflows[0].checks.dueSlot;
  expect(dueSlot).toMatchObject({ status });
  if (status === 'fail') expect(dueSlot.evidence.latestIndexedSlot).toBe(scheduledAt);
});
