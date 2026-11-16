import { expect, test } from 'bun:test';
import { inspectIdentity, classifyConnection } from '../../skills/axstack/sandbox/probes-check.js';
import { planProbes } from '../../skills/axstack/sandbox/probes.js';

const status = 'Uid:\t1000\t1000\t1000\t1000\nCapInh:\t0000000000000000\nCapPrm:\t0000000000000000\nCapEff:\t0000000000000000\nCapBnd:\t0000000000000000\nCapAmb:\t0000000000000000\nNoNewPrivs:\t1\n';

test('live process identity requires all user IDs non-root and every capability set empty', () => {
  expect(inspectIdentity([status]).status).toBe('pass');
  for (const field of ['CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb']) {
    expect(inspectIdentity([status.replace(`${field}:\t0000000000000000`, `${field}:\t0000000000000001`)]).status).toBe('fail');
    expect(inspectIdentity([status.replace(new RegExp(`${field}:.*\\n`), '')]).status).toBe('unknown');
  }
  expect(inspectIdentity([status, status.replace('1000\t1000\t1000\t1000', '1000\t0\t1000\t1000')]).status).toBe('fail');
  expect(inspectIdentity([]).status).toBe('unknown');
  expect(inspectIdentity([status.replace('NoNewPrivs:\t1', 'NoNewPrivs:\t0')]).status).toBe('fail');
});

test('connection observations distinguish denial, unexpected reachability and observer errors', () => {
  const target = { protocol: 'tcp', kind: 'fixed' };
  expect(classifyConnection({ exitCode: 0, stdout: '{"remote_ip":"100.64.0.1"}' }, target, 'deny').status).toBe('fail');
  expect(classifyConnection({ exitCode: 7, stdout: '{"remote_ip":""}' }, target, 'deny').status).toBe('pass');
  expect(classifyConnection({ exitCode: 28, stdout: '{"remote_ip":"100.64.0.1"}' }, target, 'deny').status).toBe('fail');
  expect(classifyConnection({ exitCode: 127, stdout: '' }, target, 'deny').status).toBe('unknown');
  expect(classifyConnection({ exitCode: 5, stdout: '' }, target, 'deny').status).toBe('unknown');
  expect(classifyConnection({ exitCode: 0, stdout: ';; no servers could be reached' }, { protocol: 'udp', kind: 'host-listener' }, 'deny').status).toBe('unknown');
  expect(classifyConnection({ exitCode: 0, stdout: '{"remote_ip":"1.1.1.1","http_code":200}' }, target, 'allow').status).toBe('pass');
});

test('every dependency-volume mounting container must have a capped filesystem check', () => {
  const input = { runId: 'r', networks: [], containers: [{ id: 'test', role: 'test', networkIds: [], argv: ['docker', 'run', '--mount', 'type=volume,source=r-deps,target=/dependencies'] }], enumeration: { runId: 'r', terms: [], targets: [] }, storage: { volumeName: 'r-deps', checks: [] } };
  expect(() => planProbes(input)).toThrow(/filesystem check/i);
});

test('service TCP reachability does not require a sidecar to speak HTTP, and public DNS NXDOMAIN cannot resolve a tailnet name', () => {
  expect(classifyConnection({ exitCode: 35, stdout: '{"remote_ip":"172.30.0.2","http_code":0}' }, { id: 'service|db:172.30.0.2:5432:tcp', kind: 'fixed', protocol: 'tcp' }, 'allow').status).toBe('pass');
  expect(classifyConnection({ exitCode: 0, stdout: ';; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 1\n;; flags: qr; QUERY: 1, ANSWER: 0, AUTHORITY: 1' }, { id: 'tailnet-dns-stub:axat-vps.test:53:udp', kind: 'dns', protocol: 'udp' }, 'deny').status).toBe('pass');
});

test('ICMP results use echo outcomes rather than a TCP curl response', () => {
  const target = { protocol: 'icmp', kind: 'host-address' };
  expect(classifyConnection({ exitCode: 0, stdout: '1 packets transmitted, 1 received' }, target, 'deny').status).toBe('fail');
  expect(classifyConnection({ exitCode: 1, stdout: '1 packets transmitted, 0 received' }, target, 'deny').status).toBe('pass');
  expect(classifyConnection({ exitCode: 2, stdout: '', stderr: 'socket: Operation not permitted' }, target, 'deny').status).toBe('unknown');
});

test('host loopback targets are distinguished from the container own loopback namespace', () => {
  const target = { address: '127.0.0.1', protocol: 'icmp', kind: 'host-address' };
  expect(classifyConnection({ hostNetworkNamespace: 'net:[1]', containerNetworkNamespace: 'net:[2]' }, target, 'deny').status).toBe('pass');
  expect(classifyConnection({ hostNetworkNamespace: 'net:[1]', containerNetworkNamespace: 'net:[1]' }, target, 'deny').status).toBe('fail');
  expect(classifyConnection({}, target, 'deny').status).toBe('unknown');
});
