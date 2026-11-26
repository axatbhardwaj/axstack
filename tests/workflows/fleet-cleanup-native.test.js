import { expect, test } from 'bun:test';
import { copyFileSync } from 'node:fs';
import { usingIsolatedT3 } from '../../skills/axstack/workflows/conformance/isolated.mjs';
import { scheduledAt, workflow } from './fleet-cleanup-fixture.js';

const t3 = Bun.which('t3');
const filename = workflow + '-v1.mjs';

test.skipIf(!t3)('isolated T3 loads MIG-9 and pauses on a missing private binding', async () => {
  await usingIsolatedT3({
    t3,
    defaultLocation: true,
    beforeStart(server) {
      copyFileSync(import.meta.dir + '/../../skills/axstack/workflows/bundles/' + filename, server.workflows + '/' + filename);
    },
  }, async (server) => {
    const started = server.start(workflow, 'inventory-preflight', { scheduledAt });
    const paused = await server.waitFor(started.runId, 'paused');
    expect(paused.detail).toContain('private binding is missing');
    const { steps } = server.command('workflow', 'show', started.runId, '--json');
    expect(steps.some((step) => step.kind === 'agent')).toBe(false);
  });
}, 30_000);
