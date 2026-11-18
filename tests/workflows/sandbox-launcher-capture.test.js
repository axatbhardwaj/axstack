import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { runCommand } from '../../skills/axstack/scripts/command-capture.js';
import { saveReceipt, verifyCapture, recordCapture } from '../../skills/axstack/sandbox/launcher-capture.js';
import { createLauncher } from '../../skills/axstack/sandbox/launcher.js';
import { bindCheckoutOrigin } from '../../skills/axstack/sandbox/launcher-source.js';
import { inspectEvidence } from '../../skills/axstack/scripts/evidence-inspector.js';
import { fixture, pass, planners } from './sandbox-launcher-fixture.js';

const roots = [];
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });
async function captured(pinGithub = false) {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-capture-`); chmodSync(root, 0o700); roots.push(root);
  const repo = `${root}/repo`, evidence = `${root}/evidence`; mkdirSync(repo); mkdirSync(evidence, { mode: 0o700 });
  const git = (...args) => {
    const r = Bun.spawnSync(['git', '-C', repo, ...args], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: `${root}/gitconfig` } });
    if (r.exitCode) throw Error(r.stderr.toString()); return r.stdout.toString().trim();
  };
  writeFileSync(`${root}/gitconfig`, ''); git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid'); git('remote', 'add', 'origin', 'https://example.invalid/repo.git');
  writeFileSync(`${repo}/source`, 'synthetic fixture'); git('add', '.'); git('commit', '-qm', 'fixture');
  const input = fixture(); input.request = { ...input.request, repo, head: git('rev-parse', 'HEAD'), base: git('rev-parse', 'HEAD') };
  if (pinGithub) {
    git('remote', 'set-url', 'origin', 'git@github.com:example/fixture.git');
    input.request.repository = 'https://github.com/example/fixture';
    input.request = await bindCheckoutOrigin(input.request, async argv => {
      const result = Bun.spawnSync(argv);
      return { exitCode: result.exitCode, stdout: result.stdout.toString() };
    });
  }
  const p = createLauncher(planners()).plan(input);
  const binding = { ...p.request, tool: { name: 'axstack-sandbox', version: '1.0.0' }, sandboxImageDigest: p.containers.find(c => c.role === 'test').image.split('@')[1] };
  // Real W3-1 capture of harmless synthetic host code. No Docker command is run.
  const step = await runCommand([], { evidence }, 'synthetic', p.request.testArgv, repo, { PATH: process.env.PATH }, { logBytes: 1024, timeoutMs: 1000 }, { active: null, signal: null }, [process.execPath, '-e', 'process.stdout.write("fixture")'], binding);
  return { p, step };
}
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

async function boundCapture(pinGithub = false) {
  const { p, step } = await captured(pinGithub), c = p.containers.find(c => c.role === 'test');
  step.kind = 'sandbox-test';
  step.spawnArgv = ['docker', 'exec', '--user', p.policy.user, '--workdir', '/work', c.id, '/bin/sh', '-c', 'cp -R /source/. /work/ && chmod -R u+w /work && cd /work && exec "$@"', 'axstack', ...p.request.testArgv];
  writeFileSync(step.receiptPath, `${JSON.stringify(step)}\n`);
  return { p, step };
}
test('inspection uses the validated plan identity, not the original HTTPS spelling', async () => {
  const { p, step } = await boundCapture(true);
  const { repository, head, base } = p.request;
  const sandboxReceipt = { schemaVersion: 1, runId: p.runId, owner: p.owner, hostBinding: p.hostBinding,
    engineVersion: 'fixture', planSha256: 'a'.repeat(64), imageDigests: [step.sandboxImageDigest], effectivePolicy: p.policy,
    probeResults: [pass('probe')], terms: [pass('cleanup')],
    capture: verifyCapture(step.receiptPath, p, p.request.testArgv) };
  const packet = { schemaVersion: 1, repository, head, base, items: [], dispositions: [],
    review: { mode: 'peer', localTests: true, sandboxReceipt } };
  expect(repository).toBe('git@github.com:example/fixture.git');
  expect(inspectEvidence(packet).terms[0]).toMatchObject({ status: 'pass', evidence: { testExecution: { reasonCode: 'test-exit-zero' } } });
  expect(inspectEvidence({ ...packet, repository: 'https://github.com/example/fixture' }).terms[0].status).toBe('fail');
});
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
