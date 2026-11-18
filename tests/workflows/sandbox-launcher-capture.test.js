import { afterEach, expect, spyOn, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { runCommand } from '../../skills/axstack/scripts/command-capture.js';
import { saveReceipt, verifyCapture, recordCapture } from '../../skills/axstack/sandbox/launcher-capture.js';
import { execute } from '../../skills/axstack/sandbox/launcher-host.js';
import { bindCheckoutOrigin } from '../../skills/axstack/sandbox/launcher-source.js';
import { createLauncher } from '../../skills/axstack/sandbox/launcher.js';
import { inspectEvidence } from '../../skills/axstack/scripts/evidence-inspector.js';
import { fixture, pass, planners } from './sandbox-launcher-fixture.js';

const roots = [];
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });
function captureCheckout(origin = 'https://example.invalid/repo.git') {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-capture-`); chmodSync(root, 0o700); roots.push(root);
  const repo = `${root}/repo`, evidence = `${root}/evidence`; mkdirSync(repo); mkdirSync(evidence, { mode: 0o700 });
  const git = (...args) => {
    const r = Bun.spawnSync(['git', '-C', repo, '-c', 'core.hooksPath=/dev/null', ...args], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: `${root}/gitconfig` } });
    if (r.exitCode) throw Error(r.stderr.toString()); return r.stdout.toString().trim();
  };
  writeFileSync(`${root}/gitconfig`, ''); git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid'); git('remote', 'add', 'origin', origin);
  writeFileSync(`${repo}/source`, 'synthetic fixture'); git('add', '.'); git('commit', '-qm', 'fixture');
  const input = fixture(); input.request = { ...input.request, repo, head: git('rev-parse', 'HEAD'), base: git('rev-parse', 'HEAD') };
  return { root, git, input, evidence };
}
async function captured() {
  const { input, evidence } = captureCheckout(), { repo } = input.request;
  const p = createLauncher(planners()).plan(input);
  const binding = { ...p.request, tool: { name: 'axstack-sandbox', version: '1.0.0' }, sandboxImageDigest: p.containers.find(c => c.role === 'test').image.split('@')[1] };
  // Real W3-1 capture of harmless synthetic host code. No Docker command is run.
  const step = await runCommand([], { evidence }, 'synthetic', p.request.testArgv, repo, { PATH: process.env.PATH }, { logBytes: 1024, timeoutMs: 1000 }, { active: null, signal: null }, [process.execPath, '-e', 'process.stdout.write("fixture")'], binding);
  return { p, step };
}

async function captureWithFixtureDocker(plan, evidence, active) {
  const spawn = Bun.spawn;
  const docker = spyOn(Bun, 'spawn').mockImplementation((argv, options) => {
    const container = Array.isArray(argv) && argv[0] === 'docker' && argv[1] === 'exec'
      && plan.containers.find(entry => entry.id === argv[6] && ['fetch', 'test'].includes(entry.role));
    if (!container) throw Error('unexpected fixture process');
    return spawn([process.execPath, '--no-env-file', '-e', 'process.stdout.write(process.argv[1])', `fixture ${container.role}`], options);
  });
  try { return await recordCapture(plan, evidence, active, async () => {}); }
  finally { docker.mockRestore(); }
}

test('peer inspector requires the exact bound origin of a verified launcher capture', async () => {
  const authorized = 'https://github.com/example-org/fixture-project';
  const origin = 'git@github.com:example-org/fixture-project.git';
  const { root, git, input, evidence } = captureCheckout(origin);
  git('commit', '--allow-empty', '-qm', 'fixture head');
  const pins = { head: git('rev-parse', 'HEAD'), base: input.request.base };
  input.request = { ...input.request, ...pins, repository: authorized, sidecarIds: [], fetchArgv: ['fixture-fetch'], testArgv: ['fixture-test'] };
  input.request = await bindCheckoutOrigin(input.request, execute);
  input.assets.ownedDir = `${root}/sandbox`;
  input.assets.policy.receiptMaxBytes = 4 * 1024 ** 2;
  const noop = async () => {};
  const launcher = createLauncher({ ...planners(), loadAssets: async () => input.assets, observeHost: async () => input.host,
    currentOwner: async () => input.owner, records: async () => [], withAdmission: async fn => fn(),
    savePlan: async plan => JSON.stringify(plan), prepareStorage: async () => ({ loopDevice: '/dev/loop7', terms: [pass('storage')] }),
    exportSource: async plan => { mkdirSync(plan.sourceExport.path, { recursive: true }); }, inspectImages: async () => ({ [input.assets.workloadImage]: [] }),
    installNetwork: async () => [pass('network')], execute: async () => ({ exitCode: 0 }), inspectMounts: async () => [pass('mounts')],
    enumerateTargets: async () => input.enumeration, runProbes: async ({ plan }) => plan.probes.map(probe => pass(probe.id)),
    engineVersion: async () => 'fixture', recordCapture: captureWithFixtureDocker, saveReceipt,
    removeContainer: noop, containersGone: async () => true, cleanupNetwork: async () => [pass('network-clean')],
    cleanupStorage: async () => [pass('storage-clean')], removeRecord: noop, onSignal: () => noop, setDeadline: () => noop,
  });
  const plan = launcher.plan(input);
  expect(plan.request).toMatchObject({ ...pins, repository: origin });
  const envelope = await launcher.run({ plan, evidenceDir: evidence });
  const capture = await Bun.file(envelope.capture.receiptPath).json();
  expect(capture).toMatchObject({ repository: origin, requested: pins });
  expect(await Bun.file(capture.logPath).text()).toBe('fixture test');

  const packet = { schemaVersion: 1, ...pins, repository: plan.request.repository, items: [], dispositions: [],
    review: { mode: 'peer', localTests: true, sandboxReceipt: `${plan.runId}-sandbox.json` } };
  expect(inspectEvidence(packet, evidence).terms[0]).toMatchObject({ id: 'peer-sandbox', status: 'pass', reasonCode: 'sandbox-consistent',
    evidence: { testExecution: { status: 'pass', exitCode: 0, assertions: 'unknown', receiptSha256: envelope.capture.receiptSha256 } } });
  expect(inspectEvidence({ ...packet, repository: authorized }, evidence).terms[0]).toMatchObject({ id: 'peer-sandbox', status: 'fail',
    reasonCode: 'sandbox-validation-failed', evidence: { reason: 'capture identity/log/source differs', testExecution: { exitCode: null } } });
});

test('a capture of another spawn argv cannot attest the planned container command', async () => {
  const { p, step } = await captured();
  await expect(Promise.resolve().then(() => verifyCapture(step.receiptPath, p, p.request.testArgv))).rejects.toMatchObject({ sandboxHold: true });
});
test('host capture reference hashes exact retained bytes; changed log or image identity holds', async () => {
  const { p, step } = await captured();
  const c = p.containers.find(c => c.role === 'test');
  // Fixture wire bytes model the Docker execution receipt, without running Docker.
  step.spawnArgv = ['docker', 'exec', '--user', p.policy.user, '--workdir', '/work', c.id, '/bin/sh', '-c', 'cp -R /source/. /work/ && chmod -R u+w /work && cd /work && exec "$@"', 'axstack', ...p.request.testArgv];
  const bytes = `${JSON.stringify(step)}\n\n`;
  writeFileSync(step.receiptPath, bytes);
  const reference = verifyCapture(step.receiptPath, p, p.request.testArgv);
  expect(reference.receiptSha256).toBe(new Bun.CryptoHasher('sha256').update(readFileSync(step.receiptPath)).digest('hex'));
  writeFileSync(step.logPath, 'tampered');
  expect(() => verifyCapture(step.receiptPath, p, p.request.testArgv)).toThrow();
});

async function boundCapture() {
  const { p, step } = await captured(), c = p.containers.find(c => c.role === 'test');
  step.kind = 'sandbox-test';
  step.spawnArgv = ['docker', 'exec', '--user', p.policy.user, '--workdir', '/work', c.id, '/bin/sh', '-c', 'cp -R /source/. /work/ && chmod -R u+w /work && cd /work && exec "$@"', 'axstack', ...p.request.testArgv];
  writeFileSync(step.receiptPath, `${JSON.stringify(step)}\n`);
  return { p, step };
}
test('capture logical argv must match the requested command even when actual spawn argv matches', async () => {
  const { p, step } = await boundCapture(); step.argv = ['another-command'];
  writeFileSync(step.receiptPath, JSON.stringify(step));
  expect(() => verifyCapture(step.receiptPath, p, p.request.testArgv)).toThrow();
});

test('capture cwd must match the canonical source root', async () => {
  const { p, step } = await boundCapture(); step.cwd = '/another-source';
  writeFileSync(step.receiptPath, JSON.stringify(step));
  expect(() => verifyCapture(step.receiptPath, p, p.request.testArgv)).toThrow();
});

test('capture sandbox digest must match the effective workload image', async () => {
  const { p, step } = await boundCapture(); step.sandboxImageDigest = `sha256:${'0'.repeat(64)}`;
  writeFileSync(step.receiptPath, JSON.stringify(step));
  expect(() => verifyCapture(step.receiptPath, p, p.request.testArgv)).toThrow();
});

test('capture tool version must match the launcher capture adapter', async () => {
  const { p, step } = await boundCapture(); step.tool.version = 'another-version';
  writeFileSync(step.receiptPath, JSON.stringify(step));
  expect(() => verifyCapture(step.receiptPath, p, p.request.testArgv)).toThrow();
});

test('sandbox envelope is rejected before writing beyond the receipt directory cap', async () => {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-envelope-`); chmodSync(root, 0o700); roots.push(root);
  const p = createLauncher(planners()).plan(fixture()); p.policy.receiptMaxBytes = 1;
  await expect(saveReceipt({ schemaVersion: 1 }, root, p)).rejects.toMatchObject({ sandboxHold: true });
  expect(readdirSync(root)).toEqual([]);
});

test('a failed fresh D filesystem check prevents capture from spawning any PR command', async () => {
  const { p, step } = await captured();
  const evidence = step.receiptPath.slice(0, step.receiptPath.lastIndexOf('/'));
  p.policy.receiptMaxBytes = 4 * 1024 ** 2;
  let checked = false;
  await expect(recordCapture(p, evidence, () => { if (!checked) throw Error('capture phase reached before storage check'); }, async () => { checked = true; throw Object.assign(Error('synthetic changed filesystem'), { sandboxHold: true }); })).rejects.toThrow('synthetic changed filesystem');
  expect(checked).toBe(true);
});

test('capture reserves the existing full plan once while keeping the fixed receipt cap', async () => {
  const { p, step } = await captured();
  const evidence = step.receiptPath.slice(0, step.receiptPath.lastIndexOf('/'));
  p.policy.receiptMaxBytes = 4 * 1024 ** 2;
  p.enumeration.terms.push({ id: 'fleet-observations', status: 'pass', evidence: ['x'.repeat(1100000)] });
  writeFileSync(`${evidence}/effective-plan.json`, JSON.stringify(p));
  await expect(recordCapture(p, evidence, () => { throw Error('must check storage first'); }, async () => { throw Error('storage gate reached'); })).rejects.toThrow('storage gate reached');
});
