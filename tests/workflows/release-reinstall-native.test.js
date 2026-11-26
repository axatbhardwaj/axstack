import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { usingIsolatedT3 } from '../../skills/axstack/workflows/conformance/isolated.mjs';
import { fakeFleet, targets, workflow } from './release-reinstall-fixture.js';

const t3 = Bun.which('t3');
const workflows = new URL('../../skills/axstack/workflows/', import.meta.url).pathname;
const evidence = Bun.env.AXSTACK_C11_REPLAY_EVIDENCE;

test.skipIf(!t3 || process.platform !== 'linux')('native release workflow installs, verifies, pauses and resumes against fake hosts', async () => {
  let fixture;
  const build = Bun.spawnSync([process.execPath, 'build', 'entries/' + workflow + '.mjs', '--target=node', '--format=esm'],
    { cwd: workflows });
  expect(build.exitCode).toBe(0);
  const bundle = build.stdout;
  const packed = Bun.env.AXSTACK_C11_PACKED_BUNDLE;
  if (packed) expect(bundle).toEqual(readFileSync(packed));
  await usingIsolatedT3({
    t3, defaultLocation: true,
    beforeStart(server) {
      fixture = fakeFleet(server, packed ? readFileSync(packed) : bundle);
    },
  }, async (server) => {
    const show = (id) => server.command('workflow', 'show', id, '--json');
    const finish = async (run, status, label) => {
      let shown;
      try {
        await server.waitFor(run.runId, status);
      } catch {
        // The assertion below includes the journal and command observations.
      } finally {
        shown = show(run.runId);
        if (evidence) writeFileSync(evidence + '/' + label + '.json', JSON.stringify(shown, null, 2));
      }
      expect(shown.run.status, JSON.stringify({ detail: shown.run.detail, events: fixture.events() })).toBe(status);
      expect(shown.steps.filter((step) => step.kind === 'agent')).toEqual([]);
      return shown.run;
    };
    const start = (key, version = 'v1.2.3') => server.start(workflow, key, { version });
    const hold = async (key, detail, version) => {
      const run = await finish(start(key, version), 'paused', key);
      expect(run.detail).toContain(detail);
      expect(fixture.writes()).toEqual([]);
      return run;
    };

    fixture.registry({ unavailable: 2 });
    const first = start('v1.2.3');
    const success = await finish(first, 'completed', 'all-five');
    expect(Object.keys(success.result.hosts).sort()).toEqual([...targets].sort());
    for (const host of targets) {
      expect(success.result.hosts[host]).toMatchObject({
        version: 'v1.2.3', packageVersion: 'v1.2.3', packageSkills: 'present',
        defaultSync: { active: 'active', enabled: 'enabled' },
        singleServer: { active: 'active', enabled: 'enabled' },
      });
      expect(fixture.writes().filter((line) => line === host + ' reinstall 1.2.3')).toHaveLength(1);
    }
    expect(fixture.events().filter((line) => line.startsWith('tarball ')).slice(0, 3))
      .toEqual(['tarball unavailable', 'tarball unavailable', 'tarball available']);
    expect(fixture.writes()).toContain('axat-vps claude clean');
    expect(fixture.writes()).toContain('axat-vps codex clean');
    expect(fixture.writes()).toContain('axat-vps opencode clean --no-claude-settings');
    expect(fixture.writes()).toContain('axat-vps bun-global axstack@1.2.3');
    expect(fixture.writes()).toContain('io opencode clean --no-claude-settings');
    expect(start('v1.2.3').runId).toBe(first.runId);
    fixture.clearEvents();
    const rerun = start('v1.2.3-2');
    expect(rerun.runId).not.toBe(first.runId);
    expect((await finish(rerun, 'completed', 'same-payload-new-key')).result.version).toBe('v1.2.3');
    expect(fixture.writes()).toEqual([]);

    await hold('malformed-payload', 'release payload', 'v1.2.3-2');
    fixture.registry({ latest: 'v1.2.4' });
    await hold('old-registry', 'older than npm latest');
    fixture.registry({ latest: 'invalid' });
    await hold('invalid-latest', 'registry latest');
    fixture.registry({ invalidMetadata: true });
    await hold('invalid-metadata', 'tarball metadata');
    fixture.registry({ unavailable: 100 });
    const waiting = await hold('late-tarball', 'tarball not fetchable');
    fixture.registry({});
    server.command('workflow', 'resume', waiting.runId, '--json');
    await finish(waiting, 'completed', 'tarball-resumed');

    fixture.changeBinding({ digest: '0'.repeat(64) });
    await hold('binding-digest', 'private binding');
    fixture.changeBinding({ scriptDigest: '0'.repeat(64) });
    await hold('script-digest', 'private binding');
    fixture.changeBinding({ missingHost: true });
    await hold('binding-host', 'private binding');
    fixture.changeBinding({ wrongLocalHostname: true });
    await hold('local-host', 'local execution host');
    fixture.changeBinding({});

    fixture.host('iobook', { offline: true });
    const partial = await hold('offline', 'outstanding hosts: iobook');
    fixture.host('iobook', {});
    server.command('workflow', 'resume', partial.runId, '--json');
    await finish(partial, 'completed', 'offline-resumed');
    fixture.host('iobook', { version: '1.2.4' });
    await hold('newer-host', 'iobook=installed release is newer');
    fixture.host('iobook', { malformed: true });
    await hold('malformed-host', 'iobook=host evidence unknown');
    fixture.host('iobook', { timerUnknown: 'axstack-default-sync.timer' });
    await hold('unknown-timer', 'iobook=host evidence unknown');
    fixture.host('iobook', { malformedPackage: true });
    await hold('unknown-package', 'iobook=host evidence unknown');
    fixture.host('iobook', { newerOnApply: true, version: '1.2.2' });
    await hold('moved-before-write', 'iobook=installed release is newer');

    fixture.host('iobook', { version: '1.2.2', unknownAfter: true });
    const ambiguous = start('lost-reply');
    expect((await finish(ambiguous, 'paused', 'lost-reply')).detail).toContain('iobook=prior write needs readback');
    expect(fixture.writes().filter((line) => line === 'iobook reinstall 1.2.3')).toHaveLength(1);
    fixture.clearEvents();
    await hold('parallel-release', 'iobook=host already claimed');
    fixture.host('iobook', {});
    server.command('workflow', 'resume', ambiguous.runId, '--json');
    await finish(ambiguous, 'completed', 'lost-reply-resumed');
    expect(fixture.writes()).toEqual([]);

    fixture.host('iobook', { version: '1.2.2', delay: 2500 });
    const concurrent = start('first-writer');
    const deadline = Date.now() + 10_000;
    while (!fixture.writes().includes('iobook reinstall 1.2.3') && Date.now() < deadline) await Bun.sleep(25);
    expect(fixture.writes()).toContain('iobook reinstall 1.2.3');
    const competitor = start('first-writer-2');
    const blocked = await finish(competitor, 'paused', 'concurrent-loser');
    expect(blocked.detail).toContain('iobook=host already claimed');
    await finish(concurrent, 'completed', 'concurrent-winner');
    expect(fixture.writes().filter((line) => line === 'iobook reinstall 1.2.3')).toHaveLength(1);
  });
}, 180_000);
