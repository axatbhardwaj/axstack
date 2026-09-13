// Runtime pin: the test harness must spawn the CURRENT executing Bun
// binary, not whichever `bun` PATH resolves. Otherwise a CI matrix job can
// assert one runtime's version while actually launching another (observed:
// parent 1.4.2 vs PATH-resolved system 1.3.14).
import { expect, test } from 'bun:test';
import { BUN_BIN } from './helpers.js';

test('harness binary is the executing runtime, not PATH-resolved', () => {
  expect(BUN_BIN).toBe(process.execPath);
});

test('spawned harness reports the executing runtime version', () => {
  const result = Bun.spawnSync([BUN_BIN, '-e', 'console.log(Bun.version)'], {
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 10000,
  });
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString().trim()).toBe(Bun.version);
});
