import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

// Behavioral checks on the shipped driver precheck. The script is executed with
// `orca` and `gh` replaced by recording stubs, so these assert what the precheck
// actually does to live terminals rather than restating its source text.

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const SCRIPT = `${root}/docs/plans/orca-automations-precheck.sh`;
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

const setup = ({ driverIdle = true, runsFail = false } = {}) => {
  sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-precheck-`);
  const runDir = `${sandbox}/run`;
  const bin = `${sandbox}/bin`;
  mkdirSync(runDir, { recursive: true });
  mkdirSync(bin, { recursive: true });

  // The production script pins an absolute run directory; retarget the copy
  // instead of adding a test-only knob to the shipped script.
  const script = `${sandbox}/precheck.sh`;
  write(script, readFileSync(SCRIPT, 'utf8').replace(/^RUN_DIR=.*$/m, `RUN_DIR="${runDir}"`), 0o755);

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

test('precheck: never closes a watchdog terminal', () => {
  const env = setup();
  const { calls } = run(env);
  expect(calls).toContain('terminal list');
  for (const close of closesOf(calls)) {
    expect(close).not.toContain(WATCHDOG);
  }
});

test('precheck: never touches a terminal outside this automation, whatever its title reads', () => {
  const env = setup();
  const { calls } = run(env);
  for (const line of calls.split('\n')) {
    if (line.startsWith('terminal close') || line.startsWith('terminal wait')) {
      expect(line).not.toContain(BYSTANDER);
    }
  }
});

test('precheck: closes an idle driver terminal with --tab so the pane is reclaimed', () => {
  const env = setup();
  const { calls } = run(env);
  const closes = closesOf(calls);
  expect(closes.length).toBe(1);
  expect(closes[0]).toContain(DRIVER);
  expect(closes[0]).toContain('--tab');
});

test('precheck: a still-working driver is busy (exit 3) even when its title has drifted', () => {
  const env = setup({ driverIdle: false });
  const { exitCode, calls } = run(env);
  expect(exitCode).toBe(3);
  expect(closesOf(calls)).toEqual([]);
  expect(readFileSync(`${env.runDir}/precheck.log`, 'utf8')).toContain('busy');
});

test('precheck: an unreadable ownership source is an error, never a silent empty sweep', () => {
  const env = setup({ runsFail: true });
  const { exitCode, calls } = run(env);
  expect(exitCode).toBe(2);
  expect(closesOf(calls)).toEqual([]);
  expect(readFileSync(`${env.runDir}/precheck.log`, 'utf8')).toContain('error');
});
