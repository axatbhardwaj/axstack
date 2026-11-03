// Exercise the real probe as a child: CI must fail closed on a missing cache,
// while an offline local run reports its skip. No test-only production hook.
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

for (const ci of [true, false]) {
  test(`missing npm cache ${ci ? 'fails in CI' : 'skips locally with a reason'}`, () => {
    const sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-publish-ci-`);
    const home = join(sandbox, 'home');
    mkdirSync(home);
    try {
      const result = Bun.spawnSync([process.execPath, 'run', 'test', 'tests/installer/publish-token.test.js'], {
        cwd: join(import.meta.dir, '../..'),
        env: { PATH: process.env.PATH, HOME: home, TMPDIR: sandbox, ...(ci ? { CI: 'true' } : {}) },
        stdout: 'pipe', stderr: 'pipe',
      });
      const output = result.stdout.toString() + result.stderr.toString();
      if (ci) {
        expect(result.exitCode, output).not.toBe(0);
        expect(output).not.toMatch(/^\(skip\)/m);
      } else {
        expect(result.exitCode, output).toBe(0);
        expect(output).toMatch(/SKIP.*npm@12\.0\.2.*not cached offline/i);
      }
    } finally {
      rmSync(sandbox, { recursive: true });
    }
  });
}
