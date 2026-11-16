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
