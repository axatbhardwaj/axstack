import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

// Behavioral checks on the shipped driver precheck. The script is executed with
// `orca` and `gh` replaced by recording stubs, so these assert what the precheck
// actually does to live terminals rather than restating its source text.

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const SCRIPT = `${root}/docs/plans/orca-automations-precheck.sh`;
const DRIVER = 'term_driver';
const WATCHDOG = 'term_watchdog';

let sandbox;

const write = (path, body, mode) => {
  writeFileSync(path, body);
  if (mode) chmodSync(path, mode);
};

// Terminals as the precheck sees them: one idle driver pane left over from the
// previous tick and one watchdog pane that has just been dispatched.
const terminals = (driverIdle) => JSON.stringify({
  result: {
    terminals: [
      { handle: DRIVER, title: '✳ Axstack PR automation driver', agentIdentity: 'claude', idle: driverIdle },
      { handle: WATCHDOG, title: '◑ Axstack automation watchdog', agentIdentity: 'claude', idle: true },
    ],
  },
});

const setup = ({ driverIdle = true } = {}) => {
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

test('precheck: closes an idle driver terminal with --tab so the pane is reclaimed', () => {
  const env = setup();
  const { calls } = run(env);
  const closes = closesOf(calls);
  expect(closes.length).toBe(1);
  expect(closes[0]).toContain(DRIVER);
  expect(closes[0]).toContain('--tab');
});

test('precheck: a still-working driver terminal is busy (exit 3) and nothing is closed', () => {
  const env = setup({ driverIdle: false });
  const { exitCode, calls } = run(env);
  expect(exitCode).toBe(3);
  expect(closesOf(calls)).toEqual([]);
  expect(readFileSync(`${env.runDir}/precheck.log`, 'utf8')).toContain('busy');
});
