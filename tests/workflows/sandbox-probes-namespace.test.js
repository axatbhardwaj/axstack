import { expect, test } from 'bun:test';
import { createProbeChecker } from '../../skills/axstack/sandbox/probes-check.js';

function fixture() {
  const calls = [];
  const container = { State: { Running: true, Pid: 1234 }, NetworkSettings: { Networks: { fetch: { IPAddress: '172.30.0.2' } } } };
  const runner = async (argv) => {
    calls.push(argv);
    if (argv[0] === 'docker') return { exitCode: 0, stdout: JSON.stringify([container]) };
    if (argv.includes('dig')) return { exitCode: 0, stdout: '93.184.216.34\n' };
    if (argv.includes('ping')) return { exitCode: 1, stdout: '1 packets transmitted, 0 received' };
    if (argv.includes('curl')) return { exitCode: 0, stdout: '{"remote_ip":"93.184.216.34","http_code":200}' };
    throw Error('unexpected command');
  };
  return { calls, ...createProbeChecker({ runner, readText: async () => '1234 (sleep) S 0 0 0', readNamespace: async (path) => path.includes('self') ? 'net:[1]' : 'net:[2]', readProxyConfig: async () => ({ resolverIpv4: '9.9.9.9', port: 3128 }) }) };
}

test('proxy bypass resolves via the fixed public resolver and passes literal DNS answers to curl', async () => {
  const tools = fixture();
  const result = await tools.network('proxy', 'allow', { id: 'registry:registry.npmjs.org', kind: 'fixed', address: 'registry.npmjs.org', port: 443, protocol: 'tcp' });
  expect(result.status).toBe('pass');
  const dig = tools.calls.find((a) => a.includes('dig'));
  expect(dig).toContain('@9.9.9.9');
  const curl = tools.calls.find((a) => a.includes('curl'));
  expect(curl).toContain('--resolve');
  expect(curl).toContain('registry.npmjs.org:443:93.184.216.34');
  for (const command of [dig, curl]) {
    expect(command.slice(0, 5)).toEqual(['nsenter', '--target', '1234', '--net', '--']);
    expect(command).toContain('--bounding-set=-all');
    expect(command).toContain('--no-new-privs');
    expect(command).toContain('--reuid=65534');
  }
});

test('ICMP uses ping in the run container namespace and loopback uses distinct namespace evidence', async () => {
  const tools = fixture();
  expect((await tools.network('test', 'deny', { id: 'gateway', kind: 'gateway', address: '172.30.0.1', protocol: 'icmp', port: null })).status).toBe('pass');
  expect(tools.calls.some((a) => a.includes('ping') && a.at(-1) === '172.30.0.1')).toBe(true);
  tools.calls.length = 0;
  expect((await tools.network('test', 'deny', { id: 'host-loopback', kind: 'host-address', address: '127.0.0.1', protocol: 'icmp', port: null })).status).toBe('pass');
  expect(tools.calls.some((a) => a.includes('ping') || a.includes('curl'))).toBe(false);
});

test('explicit public DNS probes use the same fixed resolver as proxy destination resolution', async () => {
  const tools = fixture();
  await tools.network('proxy', 'allow', { id: 'external-dns:example.com:53:udp', kind: 'dns', address: 'example.com', protocol: 'udp', port: 53 });
  expect(tools.calls.find(a => a.includes('dig'))).toContain('@9.9.9.9');
});


test('curl socket failures and proxy denials produce parseable proof with zero HTTP codes', async () => {
  const container = { State: { Running: true, Pid: 1234 }, NetworkSettings: { Networks: { fetch: { IPAddress: '172.30.0.2' } } } };
  for (const [connect, exitCode] of [['000', 7], ['403', 56]]) {
    const runner = async (argv) => {
      if (argv[0] === 'docker') return { exitCode: 0, stdout: JSON.stringify([container]) };
      const format = argv[argv.indexOf('--write-out') + 1];
      return { exitCode, stdout: format.replace('%{remote_ip}', '').replace('%{http_connect}', connect).replace('%{http_code}', '000') };
    };
    const checker = createProbeChecker({ runner, readText: async () => '1234 (sleep) S 0 0 0' });
    const result = await checker.network('fetch', 'deny', { kind: 'fixed', address: '10.0.0.1', port: 443, protocol: 'tcp' });
    expect(result.status).toBe('pass');
    expect(JSON.parse(JSON.parse(result.evidence[0]).stdout).http_code).toBe('000');
  }
});

test('registry socket proofs stop at the first response and explicit redirect proofs follow the chain', async () => {
  const tools = fixture();
  await tools.network('proxy', 'allow', { kind: 'fixed', address: 'registry.npmjs.org', port: 443, protocol: 'tcp' });
  expect(tools.calls.find(a => a.includes('curl'))).not.toContain('--location');
  tools.calls.length = 0;
  await tools.network('fetch', 'deny', { kind: 'fixed', address: 'dl.google.com', port: 443, protocol: 'tcp', redirect: true });
  expect(tools.calls.find(a => a.includes('curl'))).toContain('--location');
});

test('host link-local endpoints retain their zone and prove off-link separation without testing another interface', async () => {
  for (const scope of ['outside0', 'owned0']) {
    const calls = [];
    const container = { State: { Running: true, Pid: 1234 }, NetworkSettings: { Networks: { fetch: { GlobalIPv6Address: 'fd73::2' } } } };
    const checker = createProbeChecker({ readText: async () => 'stable process', readNamespace: async path => path.includes('self') ? 'net:[1]' : 'net:[2]', runner: async argv => {
      calls.push(argv);
      if (argv[0] === 'docker') return { exitCode: 0, stdout: JSON.stringify(argv[1] === 'network' ? [{ Name: 'fetch', Driver: 'bridge', Options: { 'com.docker.network.bridge.name': 'owned0' } }] : [container]) };
      if (argv.includes('ip')) return { exitCode: 0, stdout: JSON.stringify([{ ifname: 'eth0', addr_info: [{ local: 'fd73::2' }] }]) };
      return { exitCode: 0, stdout: '{"remote_ip":"fe80::1","http_code":"200"}' };
    } });
    const result = await checker.network('fetch', 'deny', { kind: 'host-listener', address: `fe80::1%${scope}`, port: 443, protocol: 'tcp' });
    expect(result.status).toBe(scope === 'outside0' ? 'pass' : 'fail');
    const curl = calls.find(a => a.includes('curl'));
    if (scope === 'outside0') expect(curl).toBeUndefined();
    else expect(curl.at(-1)).toContain('[fe80::1%25eth0]');
  }
});

test('declared plain TCP services use a positive socket handshake without assuming TLS or HTTP', async () => {
  const calls = [], container = { State: { Running: true, Pid: 1234 }, NetworkSettings: { Networks: {} } };
  const checker = createProbeChecker({ readText: async () => 'stable process', runner: async argv => {
    calls.push(argv);
    if (argv[0] === 'docker') return { exitCode: 0, stdout: JSON.stringify([container]) };
    return { exitCode: 0, stdout: '{"tcpConnected":true,"peerAddress":"172.30.0.2"}' };
  } });
  expect((await checker.network('test', 'allow', { kind: 'fixed', address: '172.30.0.2', port: 5432, protocol: 'tcp', service: true })).status).toBe('pass');
  expect(calls.some(a => a.includes('curl'))).toBe(false);
  expect(calls.some(a => a.includes('--eval') && a.includes('172.30.0.2'))).toBe(true);
});
