import { expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { createLauncher } from '../../skills/axstack/sandbox/launcher.js';
import { withAdmission } from '../../skills/axstack/sandbox/launcher-host.js';
import { fixture } from './sandbox-launcher-fixture.js';

test('concurrent reapers serialize and both observe successful cleanup', async () => {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/sandbox-reapers-`);
  chmodSync(dir, 0o700);
  const input = fixture();
  let entered, release;
  const locked = new Promise(resolve => { entered = resolve; });
  const resume = new Promise(resolve => { release = resolve; });
  let reads = 0;
  const launcher = createLauncher({
    loadAssets: async () => input.assets,
    observeHost: async () => input.host,
    withAdmission: (fn, _directory, wait) => withAdmission(fn, dir, wait),
    records: async () => {
      if (++reads === 1) { entered(); await resume; }
      return [];
    },
  });
  try {
    const first = launcher.reap(input);
    await locked;
    const results = Promise.allSettled([first, launcher.reap(input)]);
    await Bun.sleep(100);
    release();
    expect((await results).map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(reads).toBe(2);
  } finally { release(); rmSync(dir, { recursive: true, force: true }); }
});
