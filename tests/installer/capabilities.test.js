// Capability checks use injected command execution; report Git, gh and
// T3 binary gaps and state the in-thread preflight boundary.
// Spawn-boundary tests pin the Bun semantics runRealCheck depends on:
// missing binaries throw, nonzero exits report codes, timeouts kill.
import { describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import {
  checkCapabilities,
  meetsFloor,
  runRealCheck,
} from '../../src/capabilities.js';
import * as capabilities from '../../src/capabilities.js';
import { sentences, requires } from '../workflows/prose-contract.js';
import { BUN_BIN, makeTempRoot, runCli as runBunCli } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

function fakeExec(overrides = {}) {
  const base = {
    bun: { ok: true, stdout: 'v1.3.14' },
    git: { ok: true, stdout: 'git version 2.40.0' },
    gh: { ok: true, stdout: 'gh version 2.0.0' },
    'gh-stack': { ok: true, stdout: 'gh-stack available' },
    't3-binary': { ok: true, stdout: 't3 v0.0.46-nightly.20261003.2610' },
  };
  return async (name) => ({ ...base[name], ...overrides[name] } ?? { ok: false, stdout: '' });
}

test('all tools present reports ok with probe-limit disclaimer', async () => {
  const report = await checkCapabilities(fakeExec());
  expect(report.checks.map((check) => check.name)).toEqual(['bun', 'git', 'gh', 't3-binary']);
  expect(report.gaps).toEqual([]);
  expect(report.limitations.join(' ')).toMatch(/T3.*MCP.*provider auth.*models.*effort.*verified by driver preflight.*T3 thread/i);
  expect(report.limitations.join(' ')).toMatch(/quotas/i);
});


// Prose commitments: one sentence must carry the whole rule, independent of order.
const prohibits = (text, ...concepts) => sentences(text).some((sentence) =>
  sentence.match(/\b(?:cannot|can not|do not|does not|never)\b/gi)?.length === 1
  && concepts.every((concept) => concept.test(sentence))
  && requires(sentence.replace(/\b(?:cannot|can not|do not|does not|never)\b/i, ''), /^/));
const limitationRules = {
  binary: (text) => prohibits(text, /binary probe/i, /prov\w*/i, /model availability/i, /quotas?/i),
  pause: (text) => requires(text, /unavailable/i, /exhausted/i, /models?/i,
    /affected work/i, /paus\w*/i, /until (?:the )?user decid\w*/i),
  parity: (text) => prohibits(text, /stored role/i, /model/i, /effort/i,
    /permission intent/i, /prov\w*/i, /T3 launch parity/i),
};
const limitationHoldouts = {
  binary: [
    'A binary probe does not prove quotas or model availability.',
    'Model availability and quotas cannot be proven by a binary probe.',
  ],
  pause: [
    'If a model is exhausted or unavailable, pause affected work until the user decides.',
    'Affected work pauses until the user decides when models are unavailable or exhausted.',
  ],
  parity: [
    'Stored role permission intent, effort and model do not prove T3 launch parity.',
    'T3 launch parity cannot be proven by stored role model, effort and permission intent.',
  ],
};
const limitationInversions = (text) => [
  'Do not follow this instruction: ' + text,
  text.replace(/\b(?:cannot|can not)\b/gi, 'can').replace(/\b(?:do not|does not)\b/gi, 'does'),
  text.replace(/\b(pause\w*|prov\w*)\b/gi, 'avoid $1'),
  text.replace(/\bpaus\w*/gi, 'continues'),
  text.replace(/\buser\b/gi, 'author'),
  text.replace(/\buntil\b/gi, 'before'),
  text.replace(/\bpermission intent\b/gi, 'intent'),
  text.replace(/[.]$/, '') + ' only for optional work',
].filter((changed) => changed !== text);
for (const [name, accepts] of Object.entries(limitationRules)) {
  test(`probe limitation ${name} rejects removal and inversions and accepts holdouts`, () => {
    const source = capabilities.PROBE_LIMITATIONS;
    const matching = source.filter(accepts);
    expect(matching.length).toBeGreaterThan(0);
    expect(accepts(source.filter((sentence) => !accepts(sentence)).join(' '))).toBe(false);
    for (const holdout of limitationHoldouts[name]) expect(accepts(holdout), holdout).toBe(true);
    for (const sentence of [...matching, ...limitationHoldouts[name]]) {
      for (const changed of limitationInversions(sentence)) expect(accepts(changed), changed).toBe(false);
    }
  });
}

test('ordinary capability checks neither require nor invoke gh-stack', async () => {
  const calls = [];
  const report = await checkCapabilities(async (name) => {
    calls.push(name);
    if (name === 'gh-stack') throw Error('extension unavailable');
    return fakeExec()(name);
  });
  expect(calls).toEqual(['bun', 'git', 'gh', 't3-binary']);
  expect(report.gaps).toEqual([]);
});

test('missing T3 is a capability gap', async () => {
  const report = await checkCapabilities(fakeExec({ 't3-binary': { ok: false, stdout: 'not found' } }));
  expect(report.gaps).toHaveLength(1);
  expect(report.gaps[0]).toMatch(/T3/i);
  expect(report.checks.find((check) => check.name === 't3-binary')?.ok).toBe(false);
});

test('T3 floor compares base versions before nightly dates and builds', async () => {
  for (const [stdout, ok] of [
    ['t3 v0.0.46-nightly.20261003.2610', true],
    ['0.0.46-nightly.20261003', false],
    ['t3 v0.0.46-nightly.20261003.2609', false],
    ['t3 v0.0.46-nightly.20261003.2611', true],
    ['t3 v0.0.46-nightly.20261003.99', false],
    ['t3 v0.0.46-nightly.20261004.1', true],
    ['t3 v0.0.46-nightly.20261002.9999', false],
    ['t3 v0.0.45-nightly.20261004.1', false],
    ['t3 v0.0.47', true],
    ['t3 v1.0.0', true],
    ['t3 v0.0.46', true],
    ['t3 v0.0.45', false],
    ['t3 v0.0.47-nightly.20261002.1', true],
    ['t3 v0.0.47-nightly.20261003.2609', true],
    ['t3 v0.0.47-nightly.20261002', true],
    ['t3 v0.0.47-beta.1', false],
    ['t3 v0.0.46-nightly.20261303.1', false],
    ['t3 v0.0.46-nightly.20260230.1', false],
    ['t3 v0.0.46-nightly.20261003.garbage', false],
    ['not a version', false],
    ['', false],
    ['t3 v0.0.47 extra', false],
  ]) {
    const report = await checkCapabilities(fakeExec({ 't3-binary': { ok: true, stdout } }));
    expect(report.checks.find((check) => check.name === 't3-binary')?.ok, stdout).toBe(ok);
  }
  expect(capabilities.T3_FLOOR).toBe('0.0.46-nightly.20261003.2610');
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
  // test never depends on the host's live T3/gh-stack setup. The Bun
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
  script('t3', `echo "t3 $*" >> "${log}"
echo 't3 v0.0.46-nightly.20261003.2610'`);
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
    env: { PATH: fakeBin },
  });
  expect(r.ok).toBe(true);
  expect(r.out).toContain('git version 9.9.9-fake');
  expect(r.out).toContain('0.0.46-nightly.20261003.2610');
  expect(readFileSync(log, 'utf8')).toContain('t3 --version');
  expect(r.out).toContain(`v${Bun.version}`);
  expect(readFileSync(log, 'utf8')).not.toContain('gh stack');
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
    expect(real.stdout.toString()).toMatch(/MISSING.*(git|gh|T3)/);
  });
});
