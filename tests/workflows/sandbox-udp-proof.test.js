import { expect, test } from 'bun:test';
import { createProbeChecker } from '../../skills/axstack/sandbox/probes-check.js';
import { planNetwork } from '../../skills/axstack/sandbox/network.js';
import { createFirewall } from '../../skills/axstack/sandbox/network-firewall.js';
import { networkIdentity, networkDefinitions } from '../../skills/axstack/sandbox/network-rules.js';

const runId = 'udp-proof', iface = networkDefinitions(runId, false)[0].interface;
const target = { id: 'udp-host', kind: 'host-listener', address: '100.64.0.1', port: 41641, protocol: 'udp' };
const expression = [{ match: { op: '==', left: { meta: { key: 'iifname' } }, right: iface } }, { match: { op: '==', left: { payload: { protocol: 'udp', field: 'sport' } }, right: 20053 } }, { counter: null }, { drop: null }];
const descriptor = { chain: 'input', comment: `axstack:${networkIdentity(runId)}:0`, expr: expression };
const table = packets => ({ nftables: [{ rule: { ...descriptor, handle: 11, expr: expression.map(e => 'counter' in e ? { counter: { packets, bytes: packets * 64 } } : e) } }] });

test('C plans scoped UDP probe counters without weakening ordinary drops', async () => {
  const proxy = await Bun.file(new URL('../../skills/axstack/sandbox/proxy-config.json', import.meta.url)).json();
  const inventory = await Bun.file(new URL('../../skills/axstack/sandbox/inventory.json', import.meta.url)).json();
  const p = planNetwork({ runId, host: { addresses: ['100.64.0.1'], terms: [{ status: 'pass' }] }, proxy, registryAllowlist: inventory.registryAllowlist, sidecarIds: [] });
  const counters = p.rules.filter(r => r.expression.includes('counter'));
  expect(counters.length).toBeGreaterThan(0);
  expect(counters.every(r => r.expression.includes('20053') && r.expression.at(-1) === 'drop')).toBe(true);
  expect(p.rules.some(r => r.expression.length === 3 && r.expression.at(-1) === 'drop')).toBe(true);
});

test('firewall readback accepts changing counter values while still checking the drop expression', async () => {
  const firewall = createFirewall({ runner: async () => ({ exitCode: 0, stdout: JSON.stringify(table(7)), stderr: '' }) });
  expect(await firewall.check(descriptor)).toBe(true);
  expect(await firewall.check({ ...descriptor, expr: [...expression.slice(0, -1), { accept: null }] })).toBe(false);
});

function checker(after = 1, options = {}) {
  const events = [];
  let snapshots = 0;
  const container = { State: { Running: true, Pid: 123 }, Config: { Labels: { 'axstack.sandbox': 'true', 'axstack.sandbox.runId': runId } }, NetworkSettings: { Networks: { [networkDefinitions(runId, false)[0].name]: {} } } };
  const runner = async argv => {
    events.push(argv);
    if (argv[0] === 'docker') return { exitCode: 0, stdout: JSON.stringify([container]), stderr: '' };
    if (argv[0] === 'nft') {
      snapshots++;
      return { exitCode: 0, stdout: JSON.stringify(snapshots === 1 ? table(0) : options.missing ? { nftables: [] } : table(after)), stderr: '' };
    }
    return { exitCode: 9, stdout: ';; no servers could be reached', stderr: '', ...options.result };
  };
  return { events, run: () => createProbeChecker({ runner, readText: async () => '123 (probe) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20' }).network('udp-proof-fetch', 'deny', target) };
}

test('a silent UDP packet is denied only with a fresh owned drop-counter increment for its reserved source port', async () => {
  const c = checker();
  const result = await c.run();
  expect(result.status).toBe('pass');
  expect(c.events.filter(argv => argv[0] === 'nft').length).toBe(2);
  const send = c.events.find(argv => argv.includes('dig'));
  expect(send).toContain('-b');
  expect(send).toContain('0.0.0.0#20053');
});

test('missing, unchanged, noisy counters and observer failures cannot turn silent UDP into proof', async () => {
  for (const c of [checker(0), checker(2), checker(1, { missing: true }), checker(1, { result: { timedOut: true } })]) expect((await c.run()).status).toBe('unknown');
  expect((await checker(1, { result: { exitCode: 0, stdout: 'status: REFUSED' } }).run()).status).toBe('fail');
});

test('UDP in network-none uses positive kernel no-route readback and never mistakes command failure for denial', async () => {
  for (const unreachable of [true, false]) {
    let lookups = 0;
    const container = { State: { Running: true, Pid: 123 }, Config: { Labels: { 'axstack.sandbox': 'true', 'axstack.sandbox.runId': runId } }, HostConfig: { NetworkMode: 'none' }, NetworkSettings: { Networks: { none: {} } } };
    const checker = createProbeChecker({ readText: async () => 'stable process stat', runner: async argv => {
      if (argv[0] === 'docker') return { exitCode: 0, stdout: JSON.stringify([container]), stderr: '' };
      if (argv.includes('ip')) { lookups++; return { exitCode: 2, stdout: '', stderr: unreachable ? 'RTNETLINK answers: Network is unreachable' : 'ip: command unavailable' }; }
      if (argv.includes('nft')) return { exitCode: 1, stdout: '', stderr: 'no table' };
      return { exitCode: 9, stdout: ';; no servers could be reached', stderr: '' };
    } });
    let result;
    try { result = await checker.network('udp-proof-test', 'deny', target); }
    catch { result = { status: 'unknown' }; }
    expect(result.status).toBe(unreachable ? 'pass' : 'unknown');
    if (unreachable) expect(lookups).toBe(2);
  }
});
