import { expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';

test('usage fixture teardown leaves no temporary folders after its process exits', () => {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/usage-cleanup-`);
  try {
    const result = Bun.spawnSync([process.execPath, 'test', `${import.meta.dir}/usage-split.test.js`,
      '--test-name-pattern', 'fixture pins'], {
      env: { ...process.env, TMPDIR: root }, stdout: 'pipe', stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toMatch(/\b1 pass\b/);
    expect(readdirSync(root)).toEqual([]);
  } finally {
    rmSync(root, { recursive: true });
  }
});
