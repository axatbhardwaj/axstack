import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { runCommand } from '../../skills/axstack/scripts/command-capture.js';
import { verifyCapture } from '../../skills/axstack/sandbox/launcher-capture.js';
import { createLauncher } from '../../skills/axstack/sandbox/launcher.js';
import { fixture, planners } from './sandbox-launcher-fixture.js';

const roots = [];
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });
async function captured() {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-capture-`); chmodSync(root, 0o700); roots.push(root);
  const repo = `${root}/repo`, evidence = `${root}/evidence`; mkdirSync(repo); mkdirSync(evidence, { mode: 0o700 });
  const git = (...args) => {
    const r = Bun.spawnSync(['git', '-C', repo, ...args], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: `${root}/gitconfig` } });
    if (r.exitCode) throw Error(r.stderr.toString()); return r.stdout.toString().trim();
  };
  writeFileSync(`${root}/gitconfig`, ''); git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid'); git('remote', 'add', 'origin', 'https://example.invalid/repo.git');
  writeFileSync(`${repo}/source`, 'synthetic fixture'); git('add', '.'); git('commit', '-qm', 'fixture');
  const input = fixture(); input.request = { ...input.request, repo, head: git('rev-parse', 'HEAD'), base: git('rev-parse', 'HEAD') };
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
