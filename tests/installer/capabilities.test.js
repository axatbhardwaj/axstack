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
import { makeTempRoot, runCli as runBunCli } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

function fakeExec(overrides = {}) {
  const base = {
    bun: { ok: true, stdout: 'v1.3.14' },
    git: { ok: true, stdout: 'git version 2.40.0' },
    gh: { ok: true, stdout: 'gh version 2.0.0' },
    'gh-stack': { ok: true, stdout: 'gh-stack available' },
    't3-binary': { ok: true, stdout: 't3 v0.1.0' },
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

test.each([
  '0.1.0', 'v0.1.0', 't3 0.1.0', 't3 v0.1.0',
  '  t3 v0.1.0\n', 't3 v0.1.1', 't3 0.2.0', 't3 v1.0.0',
])('T3 stable prerequisite accepts supported output %j', async (stdout) => {
  const report = await checkCapabilities(fakeExec({ 't3-binary': { ok: true, stdout } }));
  expect(report.checks.find((check) => check.name === 't3-binary')?.ok).toBe(true);
  expect(report.gaps).toEqual([]);
});

test.each([
  't3 v0.0.46', 't3 v0.0.99',
  't3 v0.0.46-nightly.20261003.2610', 't3 v0.1.0-nightly.20261016.1',
  't3 v1.0.0-nightly.20261016.1', 't3 v0.1.0-beta.1', 't3 v1.0.0-rc.1',
  'not a version', '', 't3 v0.1', 't3 v0.1.0 extra',
  't3 v0.1.0.1', 't3 v00.1.0', 't3 v0.01.0', 't3 v0.1.00',
  't3 v0.1.0\nt3 v1.0.0',
])('T3 stable prerequisite rejects %j with actionable remediation', async (stdout) => {
  const report = await checkCapabilities(fakeExec({ 't3-binary': { ok: true, stdout } }));
  const check = report.checks.find((check) => check.name === 't3-binary');
  expect(check?.ok).toBe(false);
  expect(report.gaps).toHaveLength(1);
  expect(check?.detail).toMatch(/install.*T3.*stable.*0\.1\.0.*PATH/i);
  expect(check?.detail).toMatch(/rerun.*axstack check/i);
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

test.each([
  ['t3 v0.1.0', true],
  ['t3 v0.0.46', false],
  ['t3 v1.0.0-nightly.20261016.1', false],
  ['t3 v1.0.0-rc.1', false],
  ['not a version', false],
])('CLI check is read-only with T3 output %j', (output, ok) => {
  const root = makeTempRoot();
  const fakeBin = join(root, 'fake-bin');
  const home = join(root, 'home');
  mkdirSync(fakeBin);
  mkdirSync(home);
  const settings = join(home, 'settings.json');
  writeFileSync(settings, '{"updateChannel":"nightly","custom":true}\n');
  const log = join(root, 'argv.log');
  for (const [name, stdout] of [
    ['git', 'git version 9.9.9-fake'], ['gh', 'gh version 9.9.9-fake'], ['t3', output],
  ]) {
    const file = join(fakeBin, name);
    writeFileSync(file, `#!/bin/sh\necho "${name} $*" >> "${log}"\n[ "$#" = 1 ] && [ "$1" = --version ] || exit 99\necho '${stdout}'\n`);
    chmodSync(file, 0o755);
  }
  const snapshot = () => Object.fromEntries(Array.from(new Bun.Glob('**/*').scanSync({ cwd: home, dot: true, onlyFiles: true }))
    .map((path) => [path, readFileSync(join(home, path), 'utf8')]));
  const before = snapshot();
  // Disable Bun's runtime cache so HOME snapshots measure Axstack writes.
  const result = runCli(['check'], {
    expectFail: !ok, env: { HOME: home, PATH: fakeBin, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' },
  });
  expect(result.ok).toBe(ok);
  expect(result.out).toMatch(/T3 Code.*stable.*0\.1\.0/i);
  expect(result.out).toContain(`v${Bun.version}`);
  if (!ok) expect(result.out).toMatch(/install.*stable.*rerun.*axstack check/i);
  expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
    'git --version', 'gh --version', 't3 --version',
  ]);
  expect(snapshot()).toEqual(before);
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
    const real = runCli(['check'], { expectFail: true, env: { PATH: emptyBin } });
    expect(real.ok).toBe(false);
    expect(real.out).toMatch(/MISSING.*(git|gh|T3)/);
  });
});
