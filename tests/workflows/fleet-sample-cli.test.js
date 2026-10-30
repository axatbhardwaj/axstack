import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { fixture } from './fleet-route-fixture.js';
import { recommend } from '../../skills/axstack/scripts/fleet-route.js';
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/c2-cli-`);
chmodSync(root, 0o700);
afterAll(() => rmSync(root, { recursive: true }));
const f = fixture();
const now = Date.now();
const rebase = (value) => {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (['observedAt', 'inventoryObservedAt', 'receivedAt'].includes(key)) value[key] = now;
    else if (key === 'expiresAt') value[key] = now + 60000;
    else rebase(value[key]);
  }
};
rebase(f.config); rebase(f.input);
const input = f.bind();
// Synthetic SSH failure: no DNS, socket, credential or network dependence.
writeFileSync(`${root}/ssh`, '#!/bin/sh\nexit 255\n'); chmodSync(`${root}/ssh`, 0o700);
writeFileSync(`${root}/input.json`, JSON.stringify(input));
writeFileSync(`${root}/config.json`, input.configText);
const manifest = { schemaVersion: 1, hosts: [{ hostId: 'worker-a', environmentId: 'env-worker-a',
  transport: 'ssh', destination: 'synthetic-nonexistent-worker' }] };
writeFileSync(`${root}/manifest.json`, JSON.stringify(manifest));
const run = (args) => {
  const r = Bun.spawnSync([process.execPath, 'skills/axstack/scripts/fleet-route.js', ...args],
    { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, HOME: root, PATH: `${root}:${process.env.PATH}` }, timeout: 20000 });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
};
const args = ['--fleet', `${root}/manifest.json`, '--config', `${root}/config.json`,
  '--config-digest', input.configDigest, '--interval-ms', '5000', '--timeout-ms', '6000', '--json'];

test('help describes bounded sample and one-command integration', () => {
  const r = run(['--help']);
  expect(r.code).toBe(0);
  for (const text of ['sample-recommend', '--fleet', '--interval-ms', '--timeout-ms', '5000', '120000']) expect(r.out).toContain(text);
});

test('sample command returns unknown SSH telemetry without config or route mutation', () => {
  const before = JSON.stringify(input);
  const r = run(['sample', ...args]);
  expect(r.code).toBe(0); expect(r.err).toBe('');
  const output = JSON.parse(r.out);
  expect(output.configDigest).toBe(input.configDigest);
  expect(output.telemetry).toHaveLength(1);
  expect(output.telemetry[0].ageMs).toBeGreaterThanOrEqual(0);
  expect(output.telemetry[0].ageMs).toBe(output.collectedAt - output.telemetry[0].receivedAt);
  expect(output.telemetry[0]).toMatchObject({ environmentId: 'env-worker-a', status: 'failed',
    source: 'linux-proc-ssh', intervalMs: 5000, timeoutMs: 6000 });
  expect(JSON.stringify(input)).toBe(before);
});

test('one-command sample/recommend saves replayable supplied facts and preserves gates', () => {
  const r = run(['sample-recommend', ...args, '--input', `${root}/input.json`]);
  expect(r.code).toBe(0); expect(r.err).toBe('');
  const output = JSON.parse(r.out);
  expect(output.input.telemetry).toHaveLength(1);
  expect(output.recommendation.stage).toBe('pool-unknown');
  expect(output.recommendation.selected).toMatchObject({ hostId: 'worker-a', environmentId: 'env-worker-a',
    projectId: 'project-worker-a', telemetry: { status: 'unknown', reason: 'failed' } });
  expect(output.recommendation).toEqual(recommend(output.input, output.evaluatedAt));
  const denied = structuredClone(output.input);
  denied.routeFacts.forEach((r) => { r.authorized = false; });
  expect(recommend(denied, output.evaluatedAt).stage).toBe('no-route');
});

test('sample flags fail before I/O with exact structured errors', () => {
  for (const [extra, code] of [[['--interval-ms', '4999'], 'sample-interval'],
    [['--timeout-ms', '5999'], 'sample-timeout'], [['--interval-ms', '5e3'], 'sample-interval'],
    [['--now', '100000'], 'unexpected-argument'], [['--input', 'x'], 'unexpected-argument']]) {
    const base = args.filter((v, i) => !['--interval-ms', '--timeout-ms'].includes(v)
      && !['--interval-ms', '--timeout-ms'].includes(args[i - 1]));
    const r = run(['sample', ...base, ...extra]);
    expect(r.code).toBe(1); expect(r.out).toBe(''); expect(JSON.parse(r.err).error.code).toBe(code);
  }
  const missing = run(['sample', '--fleet', `${root}/manifest.json`]);
  expect(JSON.parse(missing.err).error.code).toBe('missing-config');
});

test('one-command local sample has real pressure and replayable C1 identity binding', () => {
  writeFileSync(`${root}/local.json`, JSON.stringify({ schemaVersion: 1, hosts: [
    { hostId: 'personal-a', environmentId: 'env-personal-a', transport: 'local' },
  ] }));
  const argv = args.map((value) => value === `${root}/manifest.json` ? `${root}/local.json` : value);
  const r = run(['sample-recommend', ...argv, '--input', `${root}/input.json`]);
  expect(r.code).toBe(0); expect(r.err).toBe('');
  const output = JSON.parse(r.out);
  expect(output.input.telemetry[0]).toMatchObject({ source: 'linux-proc-local', status: 'ok',
    intervalMs: 5000, windowKind: 'collector-bracket' });
  expect(output.recommendation.eligible.find((h) => h.hostId === 'personal-a')).toMatchObject({
    environmentId: 'env-personal-a', projectId: 'project-personal-a', telemetry: { status: 'measured' } });
  expect(output.recommendation.stage).toBe('pool-unknown');
  expect(output.recommendation.selected.hostId).toBe('worker-a');
  expect(output.recommendation).toEqual(recommend(output.input, output.evaluatedAt));
}, 15000);


test('collection CLI rejects ambiguous flags and malformed manifest/input before networking', () => {
  for (const [argv, code] of [
    [['sample', ...args, '--json'], 'duplicate-argument'],
    [['sample', ...args.map((v) => v === `${root}/manifest.json` ? `${root}/absent.json` : v)], 'missing-manifest'],
    [['sample', ...args, '--fleet'], 'duplicate-argument'],
    [['sample', '--fleet'], 'missing-argument'],
    [['sample'], 'missing-argument'],
    [['sample-recommend', ...args], 'missing-argument'],
    [['sample-recommend', ...args, '--input', '--json'], 'missing-argument'],
    [['sample', ...args.filter((v, i) => args[i - 1] !== '--config-digest' && v !== '--config-digest')], 'config-digest'],
  ]) {
    const r = run(argv);
    expect(r.code).toBe(1); expect(r.out).toBe(''); expect(JSON.parse(r.err).error.code).toBe(code);
  }
  for (const [name, data, error] of [
    ['bad-manifest', '{', 'manifest-json'],
    ['bad-schema', JSON.stringify({ ...manifest, schemaVersion: 2 }), 'schema-version'],
    ['bad-input', JSON.stringify({ ...input, configDigest: '0'.repeat(64) }), 'config-digest-mismatch'],
    ['bad-snapshot', JSON.stringify({ ...input, configText: input.configText + ' ' }), 'config-snapshot-mismatch'],
  ]) {
    writeFileSync(`${root}/${name}.json`, data);
    const argv = name.startsWith('bad-m') || name === 'bad-schema'
      ? ['sample', ...args.map((v) => v === `${root}/manifest.json` ? `${root}/${name}.json` : v)]
      : ['sample-recommend', ...args, '--input', `${root}/${name}.json`];
    const r = run(argv);
    expect(r.code).toBe(1); expect(r.out).toBe(''); expect(JSON.parse(r.err).error.code).toBe(error);
  }
});


test('collection reuses the C1 account-local config default in a fixture home', () => {
  mkdirSync(`${root}/.config/haoshoku`, { recursive: true, mode: 0o700 });
  writeFileSync(`${root}/.config/haoshoku/fleet-routing.json`, input.configText);
  const argv = args.filter((v, i) => v !== '--config' && args[i - 1] !== '--config');
  const r = run(['sample', ...argv]);
  expect(r.code).toBe(0); expect(r.err).toBe('');
  expect(JSON.parse(r.out).configDigest).toBe(input.configDigest);
});


test.each(['SIGINT', 'SIGTERM'])('CLI %s returns cancelled telemetry and reaps SSH', async (signal) => {
  const dir = `${root}/${signal}`;
  mkdirSync(dir, { mode: 0o700 });
  const ready = `${dir}/ready`;
  // Signal only after the actual SSH child starts, so handler installation is proven.
  writeFileSync(`${dir}/ssh`, `#!${process.execPath}\nawait Bun.write(${JSON.stringify(ready)}, String(process.pid)); setInterval(() => {}, 1000);\n`);
  chmodSync(`${dir}/ssh`, 0o700);
  const child = Bun.spawn([process.execPath, 'skills/axstack/scripts/fleet-route.js', 'sample', ...args], {
    stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, HOME: root, PATH: `${dir}:${process.env.PATH}` },
  });
  let sshPid;
  const deadline = setTimeout(() => child.kill('SIGKILL'), 4000);
  try {
    const until = performance.now() + 2000;
    while (!existsSync(ready) && performance.now() < until) await Bun.sleep(10);
    expect(existsSync(ready)).toBe(true);
    sshPid = Number(readFileSync(ready, 'utf8'));
    child.kill(signal);
    const [code, out, err] = await Promise.all([child.exited,
      new Response(child.stdout).text(), new Response(child.stderr).text()]);
    expect(code).toBe(0);
    expect(err).toBe('');
    expect(JSON.parse(out).telemetry).toEqual([expect.objectContaining({
      hostId: 'worker-a', environmentId: 'env-worker-a', status: 'cancelled',
    })]);
    expect(() => process.kill(sshPid, 0)).toThrow();
  } finally {
    clearTimeout(deadline);
    child.kill('SIGKILL');
    await child.exited;
    if (sshPid) { try { process.kill(sshPid, 'SIGKILL'); } catch {} }
  }
}, 6000);


test('invalid C1 request fails before SSH while the valid control invokes it', () => {
  const dir = `${root}/prevalidate`;
  mkdirSync(dir, { mode: 0o700 });
  const calls = `${dir}/calls`;
  writeFileSync(`${dir}/ssh`, `#!${process.execPath}\nawait Bun.write(${JSON.stringify(calls)}, 'called'); process.exit(255);\n`);
  chmodSync(`${dir}/ssh`, 0o700);
  const runInput = (value) => {
    writeFileSync(`${dir}/input.json`, JSON.stringify(value));
    return Bun.spawnSync([process.execPath, 'skills/axstack/scripts/fleet-route.js',
      'sample-recommend', ...args, '--input', `${dir}/input.json`], {
      stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout: 10000,
      env: { ...process.env, HOME: root, PATH: `${dir}:${process.env.PATH}` },
    });
  };
  expect(runInput(input).exitCode).toBe(0);
  expect(readFileSync(calls, 'utf8')).toBe('called');
  rmSync(calls);
  const invalid = structuredClone(input);
  delete invalid.request.repositoryId;
  const result = runInput(invalid);
  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toBe('');
  expect(JSON.parse(result.stderr.toString()).error.code).toBe('request-schema');
  expect(existsSync(calls)).toBe(false);
});
