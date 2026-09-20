// Capability checks use injected command execution; report gh stack and
// resolved Orca runtime/guide gaps and state the probe limits.
// Spawn-boundary tests pin the Bun semantics runRealCheck depends on:
// missing binaries throw, nonzero exits report codes, timeouts kill.
import { describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import {
  checkCapabilities,
  meetsFloor,
  resolveOrcaExecutable,
  runRealCheck,
} from '../../src/capabilities.js';
import { BUN_BIN, makeTempRoot, runCli as runBunCli } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

function fakeExec(overrides = {}) {
  const base = {
    bun: { ok: true, stdout: 'v1.3.14' },
    git: { ok: true, stdout: 'git version 2.40.0' },
    gh: { ok: true, stdout: 'gh version 2.0.0' },
    'gh-stack': { ok: true, stdout: 'gh-stack available' },
    'orca-binary': { ok: true, stdout: '1.4.199' },
    'orca-runtime': { ok: true, stdout: 'ready' },
    'orca-orchestration-guide': { ok: true, stdout: 'orchestration guide' },
    'orca-cli-guide': { ok: true, stdout: 'orca-cli guide' },
    'orca-linear-guide': { ok: true, stdout: 'orca-linear guide' },
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

test('missing Orca runtime or guide capability is reported separately', async () => {
  const report = await checkCapabilities(fakeExec({
    'orca-runtime': { ok: false, stdout: 'not connected' },
    'orca-cli-guide': { ok: false, stdout: 'guide unavailable' },
    'orca-linear-guide': { ok: false, stdout: 'guide unavailable' },
  }));
  expect(report.gaps.some((g) => /runtime/i.test(g))).toBe(true);
  expect(report.gaps.some((g) => /orca cli guide/i.test(g))).toBe(true);
  expect(report.gaps.some((g) => /linear guide/i.test(g))).toBe(true);
});

test('an Orca capability failure identifies the resolved executable', async () => {
  const report = await checkCapabilities(fakeExec({
    'orca-runtime': { ok: false, stdout: 'not connected' },
  }), {
    env: { ORCA_CLI_COMMAND: '/opt/orca-custom' },
    platform: 'linux',
  });
  const runtime = report.checks.find((check) => check.name === 'orca-runtime');
  expect(runtime.ok).toBe(false);
  expect(runtime.label).toContain('/opt/orca-custom');
  expect(report.gaps.join('\n')).toContain('/opt/orca-custom');
});

test('Orca executable resolution is deterministic and shared by every Orca probe', async () => {
  const observed = [];
  const exec = async (name, context) => {
    if (name.startsWith('orca-')) observed.push(context?.orcaExecutable);
    return { ok: true, stdout: 'fixture' };
  };
  await checkCapabilities(exec, {
    env: { ORCA_CLI_COMMAND: '/opt/orca-custom' },
    platform: 'linux',
  });
  expect(observed.length).toBe(5);
  expect([...new Set(observed)]).toEqual(['/opt/orca-custom']);
});

test('Orca executable resolver follows native precedence and platform branches', () => {
  expect(resolveOrcaExecutable({
    env: { ORCA_CLI_COMMAND: ' /custom/orca ', ORCA_DEV_REPO_ROOT: '/dev/orca' },
    platform: 'linux',
  })).toBe('/custom/orca');
  expect(resolveOrcaExecutable({
    env: { ORCA_DEV_REPO_ROOT: '/dev/orca' },
    platform: 'linux',
  })).toBe('orca-dev');
  expect(resolveOrcaExecutable({ env: {}, platform: 'linux' })).toBe('orca-ide');
  expect(resolveOrcaExecutable({
    env: { ORCA_TERMINAL_HANDLE: 'term-fixture' },
    platform: 'linux',
  })).toBe('orca');
  expect(resolveOrcaExecutable({ env: {}, platform: 'darwin' })).toBe('orca');
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

test('CLI check succeeds with a controlled fake toolchain', () => {
  // Hermetic success case: every external binary is a fixture script, so the
  // test never depends on the host's live Orca/gh-stack setup. The Bun
  // runtime/version assertion stays real; missing-tool checks are untouched.
  const fakeBin = join(makeTempRoot(), 'fake-bin');
  mkdirSync(fakeBin, { recursive: true });
  const log = join(fakeBin, 'argv.log');
  const script = (name, body) => {
    const p = join(fakeBin, name);
    writeFileSync(p, `#!/bin/sh\n${body}\n`);
    chmodSync(p, 0o755);
  };
  script('git', 'echo "git version 9.9.9-fake"');
  writeFileSync(
    join(fakeBin, 'orca'),
    '#!/bin/sh\n' +
      'if [ "$1" = "--version" ]; then echo "1.4.199-fake"; exit 0; fi\n' +
      'if [ "$1" = "status" ]; then echo \'{"ok":true,"result":{"runtime":{"state":"ready","reachable":true,"connectionState":"connected"}}}\'; exit 0; fi\n' +
      'if [ "$1" = "skills" ] && [ "$2" = "get" ]; then echo "{\\"name\\":\\"$3\\",\\"markdown\\":\\"guide\\"}"; exit 0; fi\n' +
      'echo "unexpected orca args: $*" >&2; exit 1\n',
  );
  chmodSync(join(fakeBin, 'orca'), 0o755);
  writeFileSync(
    join(fakeBin, 'gh'),
    '#!/bin/sh\n' +
      `echo "gh $*" >> "${log}"\n` +
      'if [ "$1" = "--version" ]; then echo "gh version 9.9.9-fake"; exit 0; fi\n' +
      'if [ "$1" = "stack" ] && [ "$2" = "--help" ]; then echo "fake gh stack help"; exit 0; fi\n' +
      'echo "unexpected gh args: $*" >&2; exit 1\n',
  );
  chmodSync(join(fakeBin, 'gh'), 0o755);
  const r = runCli(['check'], {
    env: { PATH: fakeBin, ORCA_CLI_COMMAND: join(fakeBin, 'orca') },
  });
  expect(r.ok).toBe(true);
  expect(r.out).toContain('git version 9.9.9-fake');
  expect(r.out).toContain('1.4.199-fake');
  expect(r.out).toContain(`v${Bun.version}`);
  expect(readFileSync(log, 'utf8')).toContain('gh stack --help');
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

describe('Orca response fixture coverage', () => {
  function fixtureCli(body) {
    const dir = makeTempRoot('axstack-orca-response-');
    const executable = join(dir, 'orca-fixture');
    writeFileSync(executable, `#!/bin/sh\n${body}\n`);
    chmodSync(executable, 0o755);
    return executable;
  }

  test('malformed and not-ready runtime JSON are rejected', async () => {
    const malformed = await runRealCheck('orca-runtime', {
      orcaExecutable: fixtureCli("echo 'not-json'"),
    });
    expect(malformed).toEqual({ ok: false, stdout: 'invalid JSON response' });

    const notReady = await runRealCheck('orca-runtime', {
      orcaExecutable: fixtureCli(
        `echo '{"ok":true,"result":{"runtime":{"state":"starting","reachable":true,"connectionState":"connected"}}}'`,
      ),
    });
    expect(notReady).toEqual({ ok: false, stdout: 'runtime is not ready and connected' });
  });

  test('wrong and empty native guide responses are rejected', async () => {
    const wrong = await runRealCheck('orca-cli-guide', {
      orcaExecutable: fixtureCli(`echo '{"name":"orchestration","markdown":"guide"}'`),
    });
    expect(wrong).toEqual({ ok: false, stdout: 'orca-cli guide unavailable' });

    const empty = await runRealCheck('orca-orchestration-guide', {
      orcaExecutable: fixtureCli(`echo '{"name":"orchestration","markdown":""}'`),
    });
    expect(empty).toEqual({ ok: false, stdout: 'orchestration guide unavailable' });

    const wrongLinear = await runRealCheck('orca-linear-guide', {
      orcaExecutable: fixtureCli(`echo '{"name":"orca-cli","markdown":"guide"}'`),
    });
    expect(wrongLinear).toEqual({ ok: false, stdout: 'orca-linear guide unavailable' });
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
    expect(real.stdout.toString()).toMatch(/MISSING.*(git|gh|Orca)/);
  });
});
