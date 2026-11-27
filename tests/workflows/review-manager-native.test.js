import { expect, test } from 'bun:test';
import { copyFileSync, writeFileSync } from 'node:fs';
import { usingIsolatedT3 } from '../../skills/axstack/workflows/conformance/isolated.mjs';
import { hash, managerIdentity as identity, version, workflowName as name } from '../../skills/axstack/workflows/review-manager.mjs';

const t3 = Bun.which('t3');
const skillsDirectory = import.meta.dir.slice(0, -'/tests/workflows'.length) + '/skills/axstack';
const bundle = skillsDirectory + `/workflows/bundles/${name}-v${version}.mjs`;
const { quiet } = await Bun.file(import.meta.dir + '/fixtures/review-manager-predecessor.json').json();

test.skipIf(!t3).each(['shadow', 'report'])('isolated T3 completes %s, imports continuity and pauses a duplicate slot', async (mode) => {
  const scheduledAt = new Date().toISOString();
  await usingIsolatedT3({ t3, defaultLocation: true, beforeStart(server) {
    copyFileSync(bundle, server.workflows + `/${name}-v${version}.mjs`);
    const binding = server.root + '/binding.json';
    const config = {
      mode, project: server.project, projectId: quiet.input.inventory.args.projectId,
      projects: [server.project], repository: quiet.input.repository, repositories: [quiet.input.repository],
      progressCopy: server.root + '/progress.md', reapReceipt: server.root + '/reap.json',
      t3, bun: process.execPath, skillsDirectory,
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
    const first = server.start(name, 'isolated-' + mode, { scheduledAt });
    await server.waitFor(first.runId, 'completed');
    const { run, steps } = server.command('workflow', 'show', first.runId, '--json');
    expect(run.result.decision).toBe(mode === 'shadow' ? 'shadow-wake' : 'reported');
    expect(run.result.reasons).toContain('project-coverage:unknown');
    if (mode === 'shadow') expect(run.result).not.toHaveProperty('report');
    else expect(run.result.report).toMatchObject({
      runId: first.runId, coverage: { projects: 'unknown', discovery: 'unknown' },
      continuity: { sourceSha: hash(quiet.progress) }, holds: { count: 0, flagged: [] },
      reap: { status: 'unknown', exitCode: null, dockerAvailable: null },
    });
    expect(steps.some((step) => step.kind === 'agent')).toBe(false);
    expect(await Bun.file(server.root + '/progress.md').text()).toBe(quiet.progress);
    const state = server.command('workflow', 'store', 'list', identity + ':continuity', '--json');
    expect(JSON.stringify(state)).toContain(hash(quiet.progress));
    const duplicate = server.start(name, 'isolated-duplicate', { scheduledAt });
    expect((await server.waitFor(duplicate.runId, 'paused')).detail).toContain('already claimed');
    if (mode === 'report') {
      const nextAt = new Date(Date.parse(scheduledAt) + 1_800_000).toISOString();
      const next = server.start(name, 'isolated-next-report', { scheduledAt: nextAt });
      const completed = await server.waitFor(next.runId, 'completed');
      expect(completed.result.report.runId).toBe(next.runId);
      const store = server.command('workflow', 'store', 'list', identity, '--json');
      expect(JSON.stringify(store)).not.toMatch(/last-report|reply-watermarks/);
    }
  });
}, 40_000);


test.skipIf(!t3)('isolated T3 pauses active binding mismatch and edited mode before agent admission', async () => {
  const scheduledAt = new Date().toISOString();
  await usingIsolatedT3({ t3, defaultLocation: true, beforeStart(server) {
    copyFileSync(bundle, server.workflows + `/${name}-v${version}.mjs`);
    const binding = server.root + '/binding.json';
    const config = {
      mode: 'active', project: server.project, projectId: quiet.input.inventory.args.projectId,
      projects: [server.project], repository: quiet.input.repository, repositories: [quiet.input.repository],
      progressCopy: server.root + '/progress.md', worktreeRoot: server.root + '/checkouts',
      registryTokenFile: server.root + '/absent-token', operationalLimits: 'fixture limits',
      nativeSeat: { runtimeMode: 'full-access', model: { instanceId: 'codex', model: 'gpt-6.2-sol',
        options: [{ id: 'reasoningEffort', value: 'high' }] } },
      t3, bun: process.execPath, skillsDirectory,
    };
    const bytes = JSON.stringify(config);
    writeFileSync(binding, bytes, { mode: 0o600 });
    writeFileSync(config.progressCopy, quiet.progress, { mode: 0o600 });
    writeFileSync(server.base + '/.axstack-workflows.json', JSON.stringify({ workflows: {
      [identity]: { binding, bindingDigest: hash(bytes) },
    } }), { mode: 0o600 });
    for (const tool of ['gh', 'docker']) {
      writeFileSync(server.root + '/' + tool, '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    }
    server.env.PATH = server.root + ':' + server.env.PATH;
  } }, async (server) => {
    const first = server.start(name, 'isolated-active', { scheduledAt });
    expect((await server.waitFor(first.runId, 'paused')).detail).toContain('binding or detached workspace mismatched');
    const steps = server.command('workflow', 'show', first.runId, '--json').steps;
    expect(steps.find((step) => step.name === 'sandbox-reap')?.result).toEqual({ exitCode: 1, dockerAvailable: false });
    expect(steps.some((step) => step.kind === 'agent')).toBe(false);
    expect(JSON.stringify(steps)).not.toContain('fixture limits');
    const store = server.command('workflow', 'store', 'list', identity, '--json');
    expect(JSON.stringify(store)).not.toContain(':continuity');
    expect(await Bun.file(server.root + '/progress.md').text()).toBe(quiet.progress);
    const duplicate = server.start(name, 'isolated-active-duplicate', { scheduledAt });
    expect((await server.waitFor(duplicate.runId, 'paused')).detail).toContain('already claimed');

    const file = server.root + '/binding.json';
    const config = await Bun.file(file).json();
    writeFileSync(file, JSON.stringify({ ...config, mode: 'report' }));
    const nextAt = new Date(Date.parse(scheduledAt) + 1_800_000).toISOString();
    const edited = server.start(name, 'isolated-active-edited-mode', { scheduledAt: nextAt });
    expect((await server.waitFor(edited.runId, 'paused')).detail).toContain('binding is missing, invalid, or changed');
    const editedSteps = server.command('workflow', 'show', edited.runId, '--json').steps;
    expect(editedSteps.map((step) => step.name)).toEqual(['claim-slot', 'binding']);
  });
}, 40_000);
