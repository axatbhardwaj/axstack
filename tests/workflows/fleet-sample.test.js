import { expect, test } from 'bun:test';
import { parseProc, pressure } from '../../skills/axstack/scripts/fleet-proc.js';
import { validateManifest, sampleOptions } from '../../skills/axstack/scripts/fleet-sample-manifest.js';

const proc = (cpu = '100 0 50 800 50 0 0 0 20 0', available = 800) =>
  `cpu  ${cpu}\ncpu0 1 2 3 4\n---AXSTACK-MEM---\nMemTotal: 1000 kB\nMemAvailable: ${available} kB\n`;
const hosts = [{ id: 'host-a', environmentId: 'environment-a' }];
const manifest = () => ({ schemaVersion: 1, hosts: [{ hostId: 'host-a', environmentId: 'environment-a', transport: 'local' }] });
const first = proc();
const second = proc('150 0 70 870 60 0 0 50 60 0', 600);

test('Linux arithmetic includes steal, excludes guest double counting, averages RAM and retains latest', () => {
  const p = pressure(parseProc(first), parseProc(second));
  expect(p).toEqual({ cpuBp: 6000, ramBp: 3000, ramLatestBp: 4000 });
});

test('valid manifest joins distinct host and environment identities', () => {
  expect(validateManifest(manifest(), hosts)).toEqual(manifest());
});

test('malformed kernel facts have exact reasons beside a valid positive control', () => {
  expect(parseProc(first)).toBeTruthy();
  for (const value of [null, first + 'x'.repeat(65536), first.replace('cpu  ', 'cpu0 '), first.replace('100 0', '-1 0'),
    first.replace('100 0', '9007199254740992 0'), first.replace('MemAvailable: 800', 'MemAvailable: 1001'),
    first.replace('MemTotal: 1000', 'MemTotal: 0'), first.replace(' kB', ' MB'), first.replace('100 0 50 800 50 0 0 0 20 0', '100 0'),
    first.replace('100 0 50 800 50 0 0 0 20 0', '100 0 50 800 50 0 0 0 20 0 0'),
    first.replace('cpu0', 'cpu'), first.replace('---AXSTACK-MEM---', 'wrong'),
    first.replace('MemTotal: 1000', 'MemTotal: 2000') + 'MemTotal: 1000 kB\n',
    first + 'MemAvailable: 800 kB\n', first.replace('MemAvailable: 800 kB\n', '')]) {
    expect(() => parseProc(value)).toThrow(/^malformed$/);
  }
  expect(() => pressure(parseProc(first), parseProc(first))).toThrow('inconsistent-counters');
  expect(() => pressure(parseProc(second), parseProc(first))).toThrow(/^inconsistent-counters$/);
  expect(() => pressure(parseProc(first), parseProc(second.replace('MemTotal: 1000', 'MemTotal: 2000')))).toThrow(/^inconsistent-counters$/);
  expect(pressure(parseProc(proc()), parseProc(proc('101 0 50 801 50 0 0 1 20 0'))).cpuBp).toBe(6667);
});

test('manifest rejects each invalid boundary independently', () => {
  const ssh = { schemaVersion: 1, hosts: [{ hostId: 'host-a', environmentId: 'environment-a',
    transport: 'ssh', destination: 'sample-worker', user: 'fixture_user' }] };
  expect(validateManifest(ssh, hosts)).toEqual(ssh);
  const cases = [
    [{ ...ssh, schemaVersion: 2 }, 'schema-version: manifest'],
    [{ ...ssh, extra: true }, 'manifest-schema'],
    [{ ...ssh, hosts: [] }, 'manifest-schema'],
    [{ ...ssh, hosts: null }, 'manifest-schema'], [{ ...ssh, hosts: Array(65).fill(ssh.hosts[0]) }, 'manifest-schema'],
    [{ ...ssh, hosts: [null] }, 'manifest-schema'],
    [{ ...ssh, hosts: [ssh.hosts[0], ssh.hosts[0]] }, 'manifest-duplicate'],
    [{ ...ssh, hosts: [ssh.hosts[0], manifest().hosts[0]] }, 'manifest-duplicate'],
    ...[['hostId', 'environment-a', 'manifest-host'], ['environmentId', 'host-a', 'manifest-host'],
      ['transport', 'agent', 'manifest-transport'], ['destination', '-oProxyCommand=x', 'manifest-destination'],
      ['destination', 'host;id', 'manifest-destination'], ['destination', 'user@host', 'manifest-destination'],
      ['destination', 'host.example.com', 'manifest-destination'], ['destination', '123', 'manifest-destination'], ['user', 'root;id', 'manifest-user'],
      ['identityFile', '/secret', 'manifest-schema']].map(([key, value, error]) =>
      [{ ...ssh, hosts: [{ ...ssh.hosts[0], [key]: value }] }, error]),
    [{ ...manifest(), hosts: [{ ...manifest().hosts[0], destination: 'sample-worker' }] }, 'manifest-schema'],
  ];
  for (const [m, error] of cases) expect(() => validateManifest(m, hosts)).toThrow(new RegExp(`^${error}$`));
  const other = { id: 'host-b', environmentId: 'environment-b' };
  for (const transport of ['local', 'ssh']) {
    const first = transport === 'local' ? manifest().hosts[0] : ssh.hosts[0];
    const duplicate = { ...first, hostId: other.id, environmentId: other.environmentId };
    expect(() => validateManifest({ schemaVersion: 1, hosts: [first, duplicate] }, [...hosts, other])).toThrow(/^manifest-duplicate$/);
  }
});

test('interval and timeout are bounded configuration errors', () => {
  expect(sampleOptions()).toEqual({ intervalMs: 5000, timeoutMs: 10000 });
  expect(sampleOptions({ intervalMs: 60000, timeoutMs: 120000 })).toEqual({ intervalMs: 60000, timeoutMs: 120000 });
  for (const [options, error] of [
    [{ intervalMs: 4999, timeoutMs: 10000 }, 'sample-interval'],
    [{ intervalMs: 60001, timeoutMs: 100000 }, 'sample-interval'],
    [{ intervalMs: 5000.1, timeoutMs: 10000 }, 'sample-interval'],
    [{ intervalMs: 5000, timeoutMs: 5999 }, 'sample-timeout'],
    [{ intervalMs: 5000, timeoutMs: 120001 }, 'sample-timeout'],
    [{ intervalMs: 5000, timeoutMs: 6000.1 }, 'sample-timeout'],
  ]) expect(() => sampleOptions(options)).toThrow(new RegExp(`^${error}$`));
});
