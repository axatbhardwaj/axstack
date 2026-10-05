import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { ARCHIFY_PIN } from '../../src/archify-pin.js';

// Optional host acceptance, never a download: provision the exact pin before
// running tests, then set AXSTACK_ARCHIFY_HOME to its checkout root.
const copy = Bun.env.AXSTACK_ARCHIFY_HOME;
const chrome = Bun.env.ARCHIFY_CHROME ? Bun.which(Bun.env.ARCHIFY_CHROME) :
  ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']
    .map((name) => Bun.which(name)).find(Boolean);
const types = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle'];
const examples = {
  architecture: 'web-app', workflow: 'agent-tool-call', sequence: 'cache-miss-request',
  dataflow: 'product-analytics', lifecycle: 'agent-run',
};
const git = (...args) => Bun.spawnSync(['git', '-C', copy, ...args], { stdout: 'pipe', stderr: 'pipe' });
const unavailable = !copy || !existsSync(`${copy}/archify/bin/archify.mjs`)
  ? 'pinned copy absent; set AXSTACK_ARCHIFY_HOME' : !chrome ? 'Chrome absent; set ARCHIFY_CHROME' : null;

if (unavailable) {
  for (const type of types) test.skip(`archify finalize ${type}: ${unavailable}`, () => {});
} else {
  const head = git('rev-parse', 'HEAD');
  const before = git('status', '--porcelain', '--ignored');
  test('archify smoke binds the exact pin and an initially clean copy', () => {
    expect(head.exitCode).toBe(0);
    expect(head.stdout.toString().trim()).toBe(ARCHIFY_PIN.sha);
    expect(before.exitCode).toBe(0);
    expect(before.stdout.toString().trim()).toBe('');
  });

  // Bun 1.3.14 has no per-test runtime skip. Run the real CLI before registering
  // each result so an unavailable browser is reported as skip, never pass.
  for (const type of types) {
    if (head.exitCode !== 0 || head.stdout.toString().trim() !== ARCHIFY_PIN.sha ||
        before.exitCode !== 0 || before.stdout.toString().trim()) {
      test.skip(`archify finalize ${type}: copy is not clean at the pin`, () => {});
      continue;
    }
    const dir = mkdtempSync(`${Bun.env.TMPDIR || '/tmp'}/axstack-archify-smoke-`);
    let receipt;
    let stdout = '';
    let stderr = '';
    let artifactHash;
    let error;
    let after;
    try {
      const example = `${copy}/archify/examples/${examples[type]}.${type}.json`;
      writeFileSync(`${dir}/ir.json`, readFileSync(example));
      const result = Bun.spawnSync([
        'bun', `${copy}/archify/bin/archify.mjs`, 'finalize', type,
        `${dir}/ir.json`, `${dir}/out.html`, '--quality', 'showcase', '--json',
        '--out-dir', dir, '--repo-root', copy,
      ], {
        env: { ...Bun.env, ARCHIFY_UPDATE_CHECK_DISABLED: '1', ARCHIFY_CHROME: chrome },
        stdout: 'pipe', stderr: 'pipe', timeout: 60000,
      });
      stdout = result.stdout.toString();
      stderr = result.stderr.toString();
      const summary = JSON.parse(stdout);
      receipt = JSON.parse(readFileSync(summary.evidence.receipt, 'utf8'));
      if (existsSync(`${dir}/out.html`)) {
        artifactHash = new Bun.CryptoHasher('sha256').update(readFileSync(`${dir}/out.html`)).digest('hex');
      }
    } catch (failure) {
      error = failure.message;
    } finally {
      after = git('status', '--porcelain', '--ignored');
      rmSync(dir, { recursive: true });
    }
    console.info(`archify smoke ${type} (${examples[type]}): ${receipt?.status ?? 'no receipt'}\n${stdout}\n${stderr}`);
    // Only environment diagnostics skip. Layout or schema failures remain red.
    const browserFailure = receipt?.failedStage === 'browser-check' &&
      receipt.diagnostics?.some((item) => /^viewer\/(?:chrome-unavailable|chrome-startup-timeout)$/.test(item.code) ||
        item.code === 'viewer/browser-check-runtime' &&
        /Chrome DevTools .*?(?:process exit|spawn|pipe)|Chrome closed with|Chrome process: (?:exit code|signal)|sandbox|EPIPE|spawn.*ENOENT/i
          .test(item.evidence?.reason ?? ''));
    const skip = receipt?.status === 'skipped' || browserFailure;
    test(`archify ${type} leaves the pinned copy clean`, () => {
      expect(after.exitCode).toBe(0);
      expect(after.stdout.toString().trim()).toBe('');
    });
    const name = `archify finalize ${type}${skip ? ': skipped, browser unavailable or inspection failed' : ''}`;
    (skip ? test.skip : test)(name, () => {
      expect(error, `${stdout}\n${stderr}`).toBeUndefined();
      expect(receipt?.status, stdout).toBe('pass');
      expect(receipt.artifact.sha256).toBe(artifactHash);
    });
  }
}
