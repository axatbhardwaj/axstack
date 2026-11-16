#!/usr/bin/env bun
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';

// A private root avoids counting unrelated processes' files in shared /tmp.
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/axstack-suite-`);
try {
  const child = Bun.spawn([process.execPath,
    `${import.meta.dir}/../skills/axstack/scripts/test-repository.js`, ...process.argv.slice(2)], {
    env: { ...process.env, TMPDIR: root },
    stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
  });
  const status = await child.exited;
  const leftovers = readdirSync(root);
  console.log(`Fixture leak check: ${leftovers.length} leftover entries in suite TMPDIR`);
  if (leftovers.length) console.error(leftovers.sort().join('\n'));
  process.exitCode = status || (leftovers.length ? 1 : 0);
} finally {
  // Remove only this runner's exact root, including leftovers after failure.
  rmSync(root, { recursive: true, force: true });
}
