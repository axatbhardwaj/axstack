import { expect, test } from 'bun:test';
import { copyFileSync, writeFileSync } from 'node:fs';
import { usingIsolatedT3 } from '../../skills/axstack/workflows/conformance/isolated.mjs';
import { hash, managerIdentity as identity, workflowName as name } from '../../skills/axstack/workflows/review-manager.mjs';

const t3 = Bun.which('t3');
const skillsDirectory = import.meta.dir.slice(0, -'/tests/workflows'.length) + '/skills/axstack';
const bundle = skillsDirectory + '/workflows/bundles/' + name + '-v1.mjs';
const { quiet } = await Bun.file(import.meta.dir + '/fixtures/review-manager-predecessor.json').json();

test.skipIf(!t3)('isolated T3 loads the bundle, imports continuity, records shadow and pauses a duplicate slot', async () => {
  const scheduledAt = new Date().toISOString();
  await usingIsolatedT3({ t3, defaultLocation: true, beforeStart(server) {
    copyFileSync(bundle, server.workflows + '/' + name + '-v1.mjs');
    const binding = server.root + '/binding.json';
    const config = {
      mode: 'shadow', project: server.project, projectId: quiet.input.inventory.args.projectId,
      projects: [server.project], repository: quiet.input.repository, repositories: [quiet.input.repository],
      progressCopy: server.root + '/progress.md', reapReceipt: server.root + '/reap.json',
      t3, bun: process.execPath, registryTokenFile: server.root + '/token',
      roles: server.root + '/roles.json', skillsDirectory,
    };
    const bytes = JSON.stringify(config);
    writeFileSync(binding, bytes, { mode: 0o600 });
    writeFileSync(config.progressCopy, quiet.progress, { mode: 0o600 });
    writeFileSync(server.base + '/.axstack-workflows.json', JSON.stringify({ workflows: {
      [identity]: { binding, bindingDigest: hash(bytes) },
    } }), { mode: 0o600 });
    writeFileSync(server.root + '/gh', '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    server.env.PATH = server.root + ':' + server.env.PATH;
  } }, async (server) => {
    const first = server.start(name, 'isolated-shadow', { scheduledAt });
    await server.waitFor(first.runId, 'completed');
    const { run, steps } = server.command('workflow', 'show', first.runId, '--json');
    expect(run.result).toMatchObject({ decision: 'shadow-wake', reasons: expect.arrayContaining(['project-coverage:unknown']) });
    expect(steps.some((step) => step.kind === 'agent')).toBe(false);
    expect(await Bun.file(server.root + '/progress.md').text()).toBe(quiet.progress);
    const state = server.command('workflow', 'store', 'list', identity + ':continuity', '--json');
    expect(JSON.stringify(state)).toContain(hash(quiet.progress));
    const duplicate = server.start(name, 'isolated-duplicate', { scheduledAt });
    expect((await server.waitFor(duplicate.runId, 'paused')).detail).toContain('already claimed');
  });
}, 40_000);
