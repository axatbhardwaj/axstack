import { expect, test } from 'bun:test';
import { dockerObservers } from '../../skills/axstack/sandbox/launcher-docker.js';
import { createLauncher } from '../../skills/axstack/sandbox/launcher.js';
import { fixture, planners } from './sandbox-launcher-fixture.js';

function harness() {
  const p = createLauncher(planners()).plan(fixture());
  let absent = false, foreign = false, mount = null;
  const events = [];
  const execute = async argv => {
    events.push(argv);
    if (argv[1] === 'rm') { absent = true; return { exitCode: 0, stdout: '', stderr: '' }; }
    if (absent) return { exitCode: 1, stdout: '', stderr: 'Error: No such container: r1-test' };
    const labels = Object.fromEntries(Object.entries(p.owner).map(([k, v]) => [`axstack.sandbox.${k}`, String(v)]));
    labels['axstack.sandbox'] = foreign ? 'false' : 'true';
    return { exitCode: 0, stdout: JSON.stringify([{ Config: { Labels: labels }, Mounts: mount ?? [] }]), stderr: '' };
  };
  return { p, events, observers: dockerObservers(execute), foreign: () => { foreign = true; }, mounts: m => { mount = m; } };
}
test('two reapers treat missing containers as success and never remove foreign names', async () => {
  const h = harness(), c = h.p.containers[0];
  await Promise.all([h.observers.removeContainer(h.p.owner, c), h.observers.removeContainer(h.p.owner, c)]);
  expect(await h.observers.containersGone(h.p)).toBe(true);
  const other = harness(); other.foreign();
  await expect(other.observers.removeContainer(other.p.owner, c)).rejects.toMatchObject({ sandboxHold: true });
  expect(other.events.some(a => a[1] === 'rm')).toBe(false);
});
test('unexpected image-created volume mounts hold instead of using uncapped host disk', async () => {
  const h = harness(); h.mounts([{ Type: 'volume', Name: 'anonymous', Destination: '/data' }]);
  await expect(h.observers.inspectMounts(h.p)).rejects.toMatchObject({ sandboxHold: true });
});
test('missing expected tmpfs and dependency mounts cannot pass effective mount readback', async () => {
  const h = harness();
  await expect(h.observers.inspectMounts(h.p)).rejects.toMatchObject({ sandboxHold: true });
});
