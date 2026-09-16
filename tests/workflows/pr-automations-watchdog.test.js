import { afterEach, expect, test } from 'bun:test';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const watchdog = `${root}/docs/plans/pr-automations-watchdog.sh`;
let sandbox;

const write = (path, body, mode) => {
  writeFileSync(path, body);
  if (mode) chmodSync(path, mode);
};

const setup = () => {
  sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-watchdog-`);
  const runDir = `${sandbox}/run`;
  const bin = `${sandbox}/bin`;
  mkdirSync(`${runDir}/decisions`, { recursive: true });
  mkdirSync(bin);
  write(`${runDir}/cursor.json`, JSON.stringify({
    tick_started_at: '2999-01-01T00:00:00Z',
    tick_done_at: '2999-01-01T00:01:00Z',
    dispatch_markers: {},
  }));
  write(`${runDir}/precheck.log`, '2999-01-01T00:00:00Z unchanged\n');
  write(`${bin}/orca`, [
    '#!/usr/bin/env bash',
    `printf '%s\\n' "$*" >> "${sandbox}/orca.calls"`,
    '[ "${ORCA_FAIL:-0}" = 1 ] && exit 1',
    'printf \'{"result":{"runs":[]}}\\n\'',
  ].join('\n'), 0o755);
  write(`${bin}/hermes`, [
    '#!/usr/bin/env bash',
    `count_file="${sandbox}/hermes.count"`,
    'count=0; [ -f "$count_file" ] && count="$(cat "$count_file")"',
    'count=$((count + 1)); printf \'%s\' "$count" > "$count_file"',
    `printf '%s\\n' "$*" >> "${sandbox}/hermes.calls"`,
    'case "${HERMES_MODE:-sent}" in',
    '  failed) printf \'{"ok":false,"error":"offline"}\\n\'; exit 1 ;;',
    '  fail-once) [ "$count" -eq 1 ] && { printf \'{"ok":false}\\n\'; exit 1; } ;;',
    '  uncertain) printf \'{"ok":true}\\n\'; exit 0 ;;',
    'esac',
    'printf \'{"ok":true,"message_id":"msg-%s"}\\n\' "$count"',
  ].join('\n'), 0o755);
  return { runDir, bin };
};

const tick = ({ runDir, bin }, extraEnv = {}, useArgs = false) => Bun.spawnSync(
  ['bash', watchdog, ...(useArgs ? ['--run-dir', runDir, '--driver-automation-id', 'driver-1'] : [])],
  {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ...(useArgs ? {} : { RUN_DIR: runDir, DRIVER_AUTOMATION_ID: 'driver-1' }),
      ...extraEnv,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
);

const lines = (runDir) => readFileSync(`${runDir}/watchdog.log`, 'utf8')
  .trim().split('\n').map(JSON.parse);
const expectOnlyTrip = (runDir, check) => {
  const tickLine = lines(runDir).at(-1);
  expect(tickLine.checks[check].status).toBe('trip');
  expect(tickLine.trips).toHaveLength(1);
  expect(tickLine.trips[0].check).toBe(check);
};
const sendCount = () => {
  try { return Number(readFileSync(`${sandbox}/hermes.count`, 'utf8')); }
  catch { return 0; }
};

afterEach(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
  sandbox = null;
});

test('watchdog: an old changed line trips driver stuck even when the driver never started', () => {
  const env = setup();
  write(`${env.runDir}/cursor.json`, JSON.stringify({ dispatch_markers: {} }));
  write(`${env.runDir}/precheck.log`, '2000-01-01T00:00:00Z changed\n');
  const result = tick(env);
  expect(result.exitCode).not.toBe(0);
  expectOnlyTrip(env.runDir, 'driver_stuck');
  expect(sendCount()).toBe(1);
  expect(readFileSync(`${sandbox}/orca.calls`, 'utf8')).toContain('automations runs --id driver-1 --json');
});

test('watchdog: the last three error lines trip precheck failing', () => {
  const env = setup();
  write(`${env.runDir}/precheck.log`, [
    '2000-01-01T00:00:00Z unchanged',
    '2000-01-01T00:01:00Z error',
    '2000-01-01T00:02:00Z error',
    '2000-01-01T00:03:00Z error',
  ].join('\n') + '\n');
  tick(env);
  expectOnlyTrip(env.runDir, 'precheck_failing');
  expect(sendCount()).toBe(1);
});

test('watchdog: a dispatch marker older than three hours thirty minutes trips worker stuck', () => {
  const env = setup();
  write(`${env.runDir}/cursor.json`, JSON.stringify({
    tick_done_at: '2999-01-01T00:00:00Z',
    dispatch_markers: { 'defi-com/monorepo#1': { started_at: '2000-01-01T00:00:00Z' } },
  }));
  tick(env);
  expectOnlyTrip(env.runDir, 'worker_stuck');
  expect(sendCount()).toBe(1);
});

test('watchdog: an open decision older than twenty-four hours trips decision waiting', () => {
  const env = setup();
  write(`${env.runDir}/decisions/0123456789abcdef01234567.json`, JSON.stringify({
    state: 'open', created_at: '2000-01-01T00:00:00Z',
  }));
  tick(env);
  expectOnlyTrip(env.runDir, 'decision_waiting');
  expect(sendCount()).toBe(1);
});

test('watchdog: an occurrence sends once and sends again only after an observed clear', () => {
  const env = setup();
  write(`${env.runDir}/precheck.log`, '2000-01-01T00:00:00Z error\n2000-01-01T00:01:00Z error\n2000-01-01T00:02:00Z error\n');
  tick(env);
  tick(env);
  expect(sendCount()).toBe(1);
  write(`${env.runDir}/precheck.log`, '2999-01-01T00:00:00Z unchanged\n');
  tick(env);
  write(`${env.runDir}/precheck.log`, '2000-01-01T00:00:00Z error\n2000-01-01T00:01:00Z error\n2000-01-01T00:02:00Z error\n');
  tick(env);
  expect(sendCount()).toBe(2);
});

test('watchdog: a failed send receipt is persisted and retried on the next tick', () => {
  const env = setup();
  write(`${env.runDir}/precheck.log`, '2000-01-01T00:00:00Z error\n2000-01-01T00:01:00Z error\n2000-01-01T00:02:00Z error\n');
  tick(env, { HERMES_MODE: 'fail-once' });
  expect(lines(env.runDir).at(-1).sent[0].status).toBe('failed');
  tick(env, { HERMES_MODE: 'fail-once' });
  expect(lines(env.runDir).at(-1).sent[0]).toMatchObject({ status: 'sent', message_id: 'msg-2' });
  expect(sendCount()).toBe(2);
});

test('watchdog: an uncertain receipt is re-read from state and never blindly retried', () => {
  const env = setup();
  write(`${env.runDir}/precheck.log`, '2000-01-01T00:00:00Z error\n2000-01-01T00:01:00Z error\n2000-01-01T00:02:00Z error\n');
  tick(env, { HERMES_MODE: 'uncertain' });
  expect(lines(env.runDir).at(-1).sent[0].status).toBe('uncertain');
  tick(env, { HERMES_MODE: 'sent' });
  expect(sendCount()).toBe(1);
  expect(lines(env.runDir).at(-1).checks.precheck_failing.send.status).toBe('uncertain');
});

test('watchdog: unreadable evidence creates unknown occurrences and never reports ok', () => {
  const env = setup();
  write(`${env.runDir}/cursor.json`, '{broken');
  rmSync(`${env.runDir}/precheck.log`);
  write(`${env.runDir}/decisions/0123456789abcdef01234567.json`, '{broken');
  tick(env, { ORCA_FAIL: '1' });
  const checks = lines(env.runDir).at(-1).checks;
  for (const check of Object.values(checks)) expect(check.status).toBe('unknown');
  expect(lines(env.runDir).at(-1).trips).toHaveLength(4);
});

test('watchdog: a healthy tick sends nothing, logs the required shape, and exits non-zero', () => {
  const env = setup();
  const result = tick(env, {}, true);
  const repeated = tick(env, {}, true);
  expect(result.exitCode).not.toBe(0);
  expect(repeated.exitCode).not.toBe(0);
  expect(sendCount()).toBe(0);
  expect(lines(env.runDir).at(-1)).toMatchObject({ trips: [], sent: [] });
  expect(Object.keys(lines(env.runDir).at(-1).checks).sort()).toEqual([
    'decision_waiting', 'driver_stuck', 'precheck_failing', 'worker_stuck',
  ]);
  const calls = readFileSync(`${sandbox}/orca.calls`, 'utf8').trim().split('\n');
  expect(calls).toEqual([
    'automations runs --id driver-1 --json',
    'automations runs --id driver-1 --json',
  ]);
});
