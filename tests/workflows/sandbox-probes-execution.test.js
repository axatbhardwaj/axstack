import { expect, test } from 'bun:test';
import { createProbeTools } from '../../skills/axstack/sandbox/probes.js';

const own = { id: 'a'.repeat(64), name: 'run-service', profile: 'service' };
const rows = [
  { Id: own.id, Name: own.name, IPAM: { Config: [{ Gateway: '172.30.0.1' }] }, Containers: {} },
  { Id: 'b'.repeat(64), Name: 'unrelated', IPAM: { Config: [{ Gateway: '172.31.0.1' }] }, Containers: { ['c'.repeat(64)]: { Name: 'outside', IPv4Address: '172.31.0.2/16', IPv6Address: 'fd12::2/64' } } },
];
const live = [{ Id: 'c'.repeat(64), Name: '/outside', Config: {}, NetworkSettings: { Networks: { unrelated: { IPAddress: '172.31.0.2', GlobalIPv6Address: 'fd12::2' } } } }];
function fixture({ failure, probe = { exitCode: 0, stdout: '{"status":"pass"}' } } = {}) {
  const calls = [];
  const runner = async (argv) => {
    calls.push(argv);
    if (failure?.(argv)) throw Error('injected observer failure');
    const result = (data) => ({ exitCode: 0, stdout: typeof data === 'string' ? data : JSON.stringify(data) });
    if (argv[0] === 'ip') return result([{ addr_info: [{ family: 'inet', local: '100.64.0.10' }, { family: 'inet6', local: 'fd7a::10' }] }]);
    if (argv[0] === 'ss') return result('tcp LISTEN 0 128 0.0.0.0:8317 0.0.0.0:*\nudp UNCONN 0 0 [::]:53 [::]:*\n');
    if (argv[0] === 'tailscale') return result({ BackendState: 'Running', Self: { DNSName: 'axat-vps.test.ts.net.', TailscaleIPs: ['100.64.0.10'] }, Peer: { peer: { TailscaleIPs: ['100.64.0.11', 'fd7a::11'] } } });
    if (argv[1] === 'network' && argv[2] === 'ls') return result(rows.map((r) => r.Id).join('\n'));
    if (argv[1] === 'network') return result(rows);
    if (argv[1] === 'ps') return result(live.map((r) => r.Id).join('\n'));
    if (argv[1] === 'inspect') return result(live);
    return probe;
  };
  return { calls, runner, ...createProbeTools({ runner }) };
}
async function planned(tools) {
  const enumeration = await tools.enumerateTargets({ runId: 'run', networks: [own] });
  const plan = { runId: 'run', networks: [own], containers: [{ id: 'test', role: 'test', networkIds: [] }], enumeration, storage: { checks: [] } };
  return { ...plan, probes: tools.planProbes(plan) };
}

test('runtime enumeration expands listeners, gateways, foreign IPv4/IPv6 and tailnet peers', async () => {
  const tools = fixture(), first = await planned(tools);
  expect(first.enumeration.terms.every((t) => t.status === 'pass')).toBe(true);
  for (const [kind, address, port] of [['host-listener', '100.64.0.10', 8317], ['host-listener', 'fd7a::10', 53], ['gateway', '172.30.0.1', null], ['other-container', 'fd12::2', null], ['tailnet', '100.64.0.11', null]]) {
    expect(first.enumeration.targets.some((t) => t.kind === kind && t.address === address && t.port === port)).toBe(true);
  }
  await tools.enumerateTargets({ runId: 'second', networks: [own] });
  expect(tools.calls.filter((a) => a[0] === 'ss')).toHaveLength(2);
});

test('unavailable and malformed observers stay unknown and prevent any probe execution', async () => {
  for (const observer of ['ip', 'ss', 'tailscale', 'docker']) {
    const tools = fixture({ failure: (a) => a[0] === observer });
    const plan = await planned(tools);
    expect(plan.enumeration.terms.some((t) => t.status === 'unknown')).toBe(true);
    try { await tools.runProbes({ plan }); throw Error('expected hold'); } catch (e) { expect(e.sandboxHold).toBe(true); }
    expect(tools.calls.some((a) => a.includes('identity'))).toBe(false);
  }
});

test('failed, erroring and unknown probes hold with host-captured terms', async () => {
  for (const probe of [{ exitCode: 1, stdout: '' }, { exitCode: 0, stdout: '{"status":"unknown"}' }, { exitCode: 0, stdout: 'not json' }, { exitCode: 0, stdout: '{"status":"pass"}', timedOut: true }]) {
    const tools = fixture({ probe }), plan = await planned(tools);
    try { await tools.runProbes({ plan }); throw Error('expected hold'); } catch (e) { expect(e.sandboxHold).toBe(true); expect(e.terms.at(-1).status).not.toBe('pass'); }
  }
});

test('a successful run repeats every probe rather than reusing results', async () => {
  const tools = fixture(), plan = await planned(tools);
  expect((await tools.runProbes({ plan })).length).toBe(plan.probes.length);
  expect((await tools.runProbes({ plan })).length).toBe(plan.probes.length);
  expect(tools.calls.filter((a) => a.includes('identity'))).toHaveLength(2);
});

test('a truncated plan cannot omit denial probes', async () => {
  const tools = fixture(), plan = await planned(tools);
  plan.probes.pop();
  await expect(tools.runProbes({ plan })).rejects.toMatchObject({ sandboxHold: true });
});


test('service allow probes enumerate live listening ports rather than image EXPOSE metadata', async () => {
  const image = (await Bun.file(new URL('../../skills/axstack/sandbox/sidecars.json', import.meta.url)).json()).images.find((i) => i.id === 'nginx').image;
  const base = fixture(), ownRows = structuredClone(rows), ownLive = structuredClone(live);
  const id = 'd'.repeat(64);
  ownRows[0].Containers[id] = { Name: 'run-nginx', IPv4Address: '172.30.0.2/24', IPv6Address: '' };
  ownLive.push({ Id: id, Name: '/run-nginx', Config: { Image: image, ExposedPorts: { '80/tcp': {} } }, State: { Running: true, Pid: 1234 }, NetworkSettings: { Networks: { [own.name]: { IPAddress: '172.30.0.2', GlobalIPv6Address: '' } } } });
  const runner = async (argv) => {
    const reply = (data) => ({ exitCode: 0, stdout: typeof data === 'string' ? data : JSON.stringify(data) });
    if (argv[0] === 'nsenter') return reply('tcp LISTEN 0 128 0.0.0.0:8080 0.0.0.0:*\n');
    if (argv[1] === 'network' && argv[2] === 'inspect') return reply(ownRows);
    if (argv[1] === 'inspect') return reply(ownLive);
    if (argv[1] === 'ps') return reply(ownLive.map((c) => c.Id).join('\n'));
    return base.runner(argv);
  };
  const tools = createProbeTools({ runner });
  const observed = await tools.enumerateTargets({ runId: 'run', networks: [own] });
  expect(observed.terms.every((t) => t.status === 'pass')).toBe(true);
  expect(observed.targets.some((t) => t.id.startsWith('service|run-nginx:') && t.port === 8080)).toBe(true);
  expect(observed.targets.some((t) => t.id.startsWith('service|run-nginx:') && t.port === 80)).toBe(false);
});

test('DNS probes cover the embedded Docker resolver over TCP and UDP for external and tailnet names', async () => {
  const { enumeration } = await planned(fixture());
  for (const prefix of ['external-dns-stub:', 'tailnet-dns-stub:']) for (const protocol of ['tcp', 'udp']) {
    expect(enumeration.targets.some((t) => t.id.startsWith(prefix) && t.protocol === protocol)).toBe(true);
  }
  expect(enumeration.targets.some((t) => t.address === '169.254.169.254' && t.port === 80)).toBe(true);
});

test('an observer hold remains unknown in the host receipt rather than being relabelled as failed containment', async () => {
  const tools = fixture({ probe: { exitCode: 2, stdout: '{"status":"unknown","evidence":["missing observer"]}' } });
  const plan = await planned(tools);
  try { await tools.runProbes({ plan }); throw Error('expected hold'); } catch (e) {
    expect(e.sandboxHold).toBe(true);
    expect(e.terms.at(-1).status).toBe('unknown');
  }
});

test('running containers with network none are explicitly inspected without inventing missing addresses', async () => {
  const base = fixture(), id = 'e'.repeat(64);
  const isolated = { Id: id, Name: '/run-none', Config: {}, HostConfig: { NetworkMode: 'none' }, NetworkSettings: { Networks: {} } };
  const runner = async (argv) => {
    if (argv[1] === 'ps') return { exitCode: 0, stdout: [...live.map((c) => c.Id), id].join('\n') };
    if (argv[1] === 'inspect') {
      expect(argv).toContain(id);
      return { exitCode: 0, stdout: JSON.stringify([...live, isolated]) };
    }
    return base.runner(argv);
  };
  const result = await createProbeTools({ runner }).enumerateTargets({ runId: 'run', networks: [own] });
  expect(result.terms.find((t) => t.id === 'docker-containers').status).toBe('pass');
});
