import { expect, test } from 'bun:test';

const launcher = `${import.meta.dir}/../../skills/axstack/sandbox/launcher.js`;
test('help discloses owned resources, per-run probes and the caller timeout', () => {
  const result = Bun.spawnSync([process.execPath, launcher, '--help']);
  expect(result.exitCode).toBe(0);
  const text = result.stdout.toString();
  for (const word of ['plan', 'run', 'reap', 'image file', 'loop device', 'volume', '/var/lib/axstack/sandbox', 'per-run', '910', 'SIGINT', 'SIGHUP', 'exit 2']) expect(text).toContain(word);
});

test('unknown CLI options fail instead of silently doing nothing', () => {
  const result = Bun.spawnSync([process.execPath, launcher, 'run', '--privileged']);
  expect(result.exitCode).toBe(1);
});
