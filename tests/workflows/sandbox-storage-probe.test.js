import { expect, test } from 'bun:test';
import { checkFilesystem } from '../../skills/axstack/sandbox/probes-storage.js';
import { planStorage, storageLabels } from '../../skills/axstack/sandbox/storage-plan.js';

const owner = { label: 'axstack.sandbox', runId: 'check-fs', pid: 42, startTimeTicks: '123', bootId: 'boot-1' };
const policy = { user: '1000:1000', dependencyBytes: 128 * 1024 ** 2, dependencyInodes: 1024 };
const storage = planStorage({ runId: owner.runId, ownedDir: '/var/lib/axstack/sandbox', policy });
const record = { owner, user: policy.user, imageFile: storage.imageFile, volumeName: storage.volumeName, bytes: storage.bytes, inodes: storage.inodes };
const ids = ['a'.repeat(12), 'b'.repeat(12)];
const rows = ids.map((Id, i) => ({ Id, Name: `/check-fs-${i ? 'test' : 'fetch'}`, State: { Running: true }, Config: { Labels: storageLabels(owner) } }));
function harness(containers = rows) {
  const calls = [];
  return { calls, options: { read: async () => JSON.stringify(record),
    runner: async argv => ({ exitCode: 0, stdout: argv[1] === 'ps' ? ids.join('\n') : JSON.stringify(containers), stderr: '' }),
    check: async input => { calls.push(input); return input.containerIds.map(id => ({ id, status: 'pass', evidence: ['semantic ext4 check'] })); },
  } };
}

test('filesystem probe checks both fetch and test using fresh Docker IDs and D immutable plan', async () => {
  const h = harness();
  expect((await checkFilesystem({ storage, containerId: 'check-fs-test' }, h.options)).status).toBe('pass');
  expect(h.calls).toEqual([{ owner, policy, plan: storage, containerIds: ids }]);
});

test('filesystem probe never execs a foreign, stopped, omitted or replaced mounting container', async () => {
  const changed = structuredClone(rows); changed[0].Config.Labels['axstack.sandbox.bootId'] = 'foreign';
  const stopped = structuredClone(rows); stopped[0].State.Running = false;
  for (const containers of [changed, stopped, rows.slice(1), [rows[0], { ...rows[1], Name: '/replaced' }]]) {
    const h = harness(containers);
    await expect(checkFilesystem({ storage, containerId: 'check-fs-test' }, h.options)).rejects.toThrow();
    expect(h.calls).toEqual([]);
  }
});
