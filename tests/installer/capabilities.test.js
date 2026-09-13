// Capability checks use injected command execution; report gh stack and
// Paseo gaps and state the probe limits (no Linear MCP / quota proof).
// Spawn-boundary tests pin the Bun semantics runRealCheck depends on:
// missing binaries throw, nonzero exits report codes, timeouts kill.
import { describe, expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { checkCapabilities, meetsFloor, runRealCheck } from '../../src/capabilities.js';
import { BUN_BIN, makeTempRoot, runCli as runBunCli } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

function fakeExec(overrides = {}) {
  const base = {
    bun: { ok: true, stdout: 'v1.3.14' },
    git: { ok: true, stdout: 'git version 2.40.0' },
    gh: { ok: true, stdout: 'gh version 2.0.0' },
    'gh-stack': { ok: true, stdout: 'gh-stack available' },
    paseo: { ok: true, stdout: 'paseo 1.0.0' },
  };
  return async (name) => ({ ...base[name], ...overrides[name] } ?? { ok: false, stdout: '' });
}

test('all tools present reports ok with probe-limit disclaimer', async () => {
  const report = await checkCapabilities(fakeExec());
  expect(report.checks.length >= 4).toBe(true);
  expect(report.gaps).toEqual([]);
  expect(report.limitations.join(' ')).toMatch(/Linear/i);
  expect(report.limitations.join(' ')).toMatch(/quota|model/i);
});

test('missing gh stack extension is reported as a gap', async () => {
  const report = await checkCapabilities(fakeExec({ 'gh-stack': { ok: false, stdout: '' } }));
  expect(report.gaps.some((g) => /stack/i.test(g))).toBe(true);
  expect(report.checks.find((c) => c.name === 'gh-stack').ok).toBe(false);
});

test('missing paseo binary is reported as a gap', async () => {
  const report = await checkCapabilities(fakeExec({ paseo: { ok: false, stdout: 'not found' } }));
  expect(report.gaps.some((g) => /paseo/i.test(g))).toBe(true);
});

test('CLI check reports gaps and exits non-zero with an empty tool PATH', () => {
  // Fresh empty directory (not PATH=""): Bun ignores an empty-string PATH
  // when resolving binaries, so only an empty dir isolates deterministically.
  const emptyBin = join(makeTempRoot(), 'empty-bin');
  mkdirSync(emptyBin, { recursive: true });
  const r = runCli(['check'], {
    expectFail: true,
    env: { PATH: emptyBin },
  });
  expect(r.out.toLowerCase()).toMatch(/gap|missing|not found/);
});

test('CLI check passes against the real toolchain', () => {
  const r = runCli(['check']);
  expect(r.ok).toBe(true);
  expect(r.out).toMatch(/bun >= 1\.3\.14 runtime/);
});

describe('Bun runtime floor', () => {
  test('meetsFloor compares release segments', () => {
    expect(meetsFloor('1.3.14')).toBe(true);
    expect(meetsFloor('1.4.2')).toBe(true);
    expect(meetsFloor('2.0.0')).toBe(true);
    expect(meetsFloor('1.3.13')).toBe(false);
    expect(meetsFloor('1.2.99')).toBe(false);
    expect(meetsFloor('0.9.0')).toBe(false);
  });

  test('runRealCheck reports the actual Bun version, not a shim', async () => {
    const result = await runRealCheck('bun');
    expect(result.ok).toBe(true);
    expect(result.stdout).toBe(`v${Bun.version}`);
  });
});

describe('Bun spawn semantics', () => {
  test('missing binaries throw instead of returning', () => {
    expect(() =>
      Bun.spawnSync(['definitely-not-a-real-binary-xyz'], { timeout: 5000 }),
    ).toThrow();
  });

  test('nonzero exits report codes without throwing', () => {
    const result = Bun.spawnSync(['sh', '-c', 'exit 3'], {
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 5000,
    });
    expect(result.exitCode).toBe(3);
    expect(result.success).toBe(false);
  });

  test('timeouts kill the child instead of hanging', () => {
    const result = Bun.spawnSync(['sleep', '30'], { timeout: 100 });
    expect(result.exitCode).toBeNull();
    expect(result.signalCode).toBe('SIGTERM');
    expect(result.success).toBe(false);
  });

  test('real check of a missing tool reports a gap', async () => {
    const emptyBin = join(makeTempRoot(), 'empty-bin');
    mkdirSync(emptyBin, { recursive: true });
    const real = Bun.spawnSync(
      [BUN_BIN, CLI, 'check'],
      { stdout: 'pipe', stderr: 'pipe', env: { ...Bun.env, PATH: emptyBin }, timeout: 60000 },
    );
    expect(real.exitCode).not.toBe(0);
    expect(real.stdout.toString()).toMatch(/MISSING.*(git|gh|paseo)/);
  });
});
