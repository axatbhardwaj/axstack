import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

// Behavioral checks on the shipped driver precheck. The script is executed with
// `orca` and `gh` replaced by recording stubs, so these assert what the precheck
// actually does to live terminals rather than restating its source text.

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
// Both shipped drivers: pair A (axstack) and pair C (defi-com). Terminal hygiene
// and due-work detection must behave identically; only discovery differs.
const SCRIPTS = {
  A: `${root}/docs/plans/orca-automations-precheck.sh`,
  C: `${root}/docs/plans/orca-automations-precheck-c.sh`,
};
const DRIVER = 'term_driver';
const WATCHDOG = 'term_watchdog';
const BYSTANDER = 'term_bystander';

let sandbox;

const write = (path, body, mode) => {
  writeFileSync(path, body);
  if (mode) chmodSync(path, mode);
};

// Terminals as the precheck sees them. Ownership is the automation's own
// recorded ptyId, never the title: Orca rewrites a Claude terminal's title to
// the agent's current task summary, so the title of a real driver drifts and an
// unrelated session can acquire one that reads like a driver.
const WORKTREE = 'repo::/root/orca/workspaces/axstack/pr-automations';
const DRIVER_PTY = `${WORKTREE}@@driver`;
const WATCHDOG_PTY = `${WORKTREE}@@watchdog`;

const terminals = (driverIdle) => JSON.stringify({
  result: {
    terminals: [
      // A real previous-tick driver whose title has drifted to a task summary.
      { handle: DRIVER, title: '✳ Adopt PR 49 and promote', agentIdentity: 'claude', ptyId: DRIVER_PTY, idle: driverIdle },
      // The watchdog, mid-boot on the same minute. Its pty belongs to the other automation.
      { handle: WATCHDOG, title: '◑ Axstack automation watchdog', agentIdentity: 'claude', ptyId: WATCHDOG_PTY, idle: true },
      // An unrelated session whose task summary happens to read like a driver.
      { handle: BYSTANDER, title: '◑ Axstack PR automation driver is closing my terminal', agentIdentity: 'claude', ptyId: `${WORKTREE}@@bystander`, idle: true },
    ],
  },
});

// Run history for the driver automation only; this is the ownership source.
const runs = JSON.stringify({
  result: {
    runs: [
      { runNumber: 30, status: 'skipped_precheck', terminalPtyId: null },
      { runNumber: 27, status: 'completed', terminalPtyId: DRIVER_PTY },
    ],
  },
});

const setup = ({ script: which = 'A', driverIdle = true, runsFail = false, cursor = null } = {}) => {
  sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-precheck-`);
  const runDir = `${sandbox}/run`;
  const bin = `${sandbox}/bin`;
  mkdirSync(runDir, { recursive: true });
  mkdirSync(bin, { recursive: true });

  // The production script pins an absolute run directory; retarget the copy
  // instead of adding a test-only knob to the shipped script.
  const script = `${sandbox}/precheck.sh`;
  write(script, readFileSync(SCRIPTS[which], 'utf8').replace(/^RUN_DIR=.*$/m, `RUN_DIR="${runDir}"`), 0o755);
  if (cursor) write(`${runDir}/cursor.json`, JSON.stringify(cursor));

  write(`${bin}/orca`, [
    '#!/usr/bin/env bash',
    `printf '%s\\n' "$*" >> "${sandbox}/orca.log"`,
    'case "$1 $2" in',
    `  "terminal list") cat <<'JSON'\n${terminals(driverIdle)}\nJSON`,
    '    ;;',
    ...(runsFail
      ? ['  "automations runs") exit 1', '    ;;']
      : [`  "automations runs") cat <<'JSON'\n${runs}\nJSON`, '    ;;']),
    '  "terminal wait")',
    '    handle=""; for a in "$@"; do [ "$prev" = "--terminal" ] && handle="$a"; prev="$a"; done',
    `    idle=true; [ "$handle" = "${DRIVER}" ] && idle=${driverIdle}`,
    '    printf \'{"result":{"wait":{"satisfied":%s}}}\\n\' "$idle"',
    '    ;;',
    '  *) printf \'{"result":{}}\\n\' ;;',
    'esac',
    'exit 0',
  ].join('\n'), 0o755);

  // Minimal gh stub: authenticated user, empty PR searches. Discovery is not
  // what these checks are about, so every search returns no results.
  write(`${bin}/gh`, [
    '#!/usr/bin/env bash',
    'case "$1 $2" in',
    '  "api user") printf \'axatbhardwaj\\n\' ;;',
    '  *) printf \'[]\\n\' ;;',
    'esac',
    'exit 0',
  ].join('\n'), 0o755);

  return { script, runDir, bin };
};

const run = ({ script, bin }) => {
  const result = Bun.spawnSync(['bash', script], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 30000,
  });
  let calls = '';
  try {
    calls = readFileSync(`${sandbox}/orca.log`, 'utf8');
  } catch {
    calls = '';
  }
  return { exitCode: result.exitCode, calls };
};

const closesOf = (calls) =>
  calls.split('\n').filter((line) => line.startsWith('terminal close'));

beforeEach(() => {
  sandbox = null;
});

afterEach(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
});

for (const which of Object.keys(SCRIPTS)) {

test(`precheck ${which}: never closes a watchdog terminal`, () => {
  const env = setup({ script: which });
  const { calls } = run(env);
  expect(calls).toContain('terminal list');
  for (const close of closesOf(calls)) {
    expect(close).not.toContain(WATCHDOG);
  }
});

test(`precheck ${which}: never touches a terminal outside this automation, whatever its title reads`, () => {
  const env = setup({ script: which });
  const { calls } = run(env);
  for (const line of calls.split('\n')) {
    if (line.startsWith('terminal close') || line.startsWith('terminal wait')) {
      expect(line).not.toContain(BYSTANDER);
    }
  }
});

test(`precheck ${which}: closes an idle driver terminal with --tab so the pane is reclaimed`, () => {
  const env = setup({ script: which });
  const { calls } = run(env);
  const closes = closesOf(calls);
  expect(closes.length).toBe(1);
  expect(closes[0]).toContain(DRIVER);
  expect(closes[0]).toContain('--tab');
});

test(`precheck ${which}: a still-working driver is busy (exit 3) even when its title has drifted`, () => {
  const env = setup({ script: which, driverIdle: false });
  const { exitCode, calls } = run(env);
  expect(exitCode).toBe(3);
  expect(closesOf(calls)).toEqual([]);
  expect(readFileSync(`${env.runDir}/precheck.log`, 'utf8')).toContain('busy');
});

test(`precheck ${which}: an unreadable ownership source is an error, never a silent empty sweep`, () => {
  const env = setup({ script: which, runsFail: true });
  const { exitCode, calls } = run(env);
  expect(exitCode).toBe(2);
  expect(closesOf(calls)).toEqual([]);
  expect(readFileSync(`${env.runDir}/precheck.log`, 'utf8')).toContain('error');
});

}

// Due control work for pair C: an open blocking-review obligation must wake the
// driver even when GitHub is unchanged. The driver writes `obligations[].pr`,
// `repair_caps{url:{expires_at}}` and `pending_relay_retries`; the precheck has
// to read that shape, not a different one, or a block is never revisited.
test('precheck C: an open obligation in the driver-written cursor shape is due work (exit 0, `due`)', () => {
  const env = setup({ script: 'C', cursor: {
    fingerprint: 'stale-but-irrelevant',
    obligations: [{ pr: 'https://github.com/defi-com/monorepo/pull/1092', review_id: 1, head: 'eebb78e5', submitted_at: '2026-09-16T20:14:09Z', supersede_available: true }],
    repair_caps: {},
    pending_relay_retries: [],
  } });
  // Make the fingerprint match what the stubbed discovery produces so only due-work can wake the driver.
  const first = run(env);
  const pending = JSON.parse(readFileSync(`${env.runDir}/pending.json`, 'utf8'));
  const cursor = JSON.parse(readFileSync(`${env.runDir}/cursor.json`, 'utf8'));
  writeFileSync(`${env.runDir}/cursor.json`, JSON.stringify({ ...cursor, fingerprint: pending.fingerprint }));
  rmSync(`${sandbox}/orca.log`, { force: true });
  const second = run(env);
  expect(first.exitCode).toBe(0);
  expect(second.exitCode).toBe(0);
  expect(readFileSync(`${env.runDir}/precheck.log`, 'utf8').trim().split('\n').pop()).toContain('due');
});

test('precheck C: an expired per-PR repair cap in the driver-written cursor shape is due work', () => {
  const env = setup({ script: 'C', cursor: {
    obligations: [],
    repair_caps: { 'https://github.com/defi-com/monorepo/pull/1007': { last_repair_at: '2000-01-01T00:00:00Z', expires_at: '2000-01-02T00:00:00Z' } },
    pending_relay_retries: [],
  } });
  run(env);
  const pending = JSON.parse(readFileSync(`${env.runDir}/pending.json`, 'utf8'));
  const cursor = JSON.parse(readFileSync(`${env.runDir}/cursor.json`, 'utf8'));
  writeFileSync(`${env.runDir}/cursor.json`, JSON.stringify({ ...cursor, fingerprint: pending.fingerprint }));
  const { exitCode } = run(env);
  expect(exitCode).toBe(0);
  expect(readFileSync(`${env.runDir}/precheck.log`, 'utf8').trim().split('\n').pop()).toContain('due');
});
