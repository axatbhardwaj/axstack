import { expect, test } from 'bun:test';
import inventory from '../../skills/axstack/sandbox/inventory.json';
import { planNetwork } from '../../skills/axstack/sandbox/network.js';

import proxy from '../../skills/axstack/sandbox/proxy-config.json';
const input = { runId: 'network-ci', host: { addresses: ['127.0.0.1', '203.0.114.17', '2a01:4f8::17'], terms: [] }, proxy, registryAllowlist: inventory.registryAllowlist, sidecarIds: ['postgres-16'] };

test('fetch and service are internal, only the proxy joins egress, and every drop is interface scoped', () => {
  const plan = planNetwork(input);
  expect(plan.networks.map(n => [n.profile, n.internal])).toEqual([['fetch', true], ['service', true], ['egress', false]]);
  expect(plan.proxy.networkIds).toEqual([plan.networks[0].id, plan.networks[2].id]);
  expect(plan.rules.length).toBeGreaterThan(10);
  for (const rule of plan.rules) {
    expect(rule.table).toBe('axstack_sandbox');
    expect(['iifname', 'oifname']).toContain(rule.expression[0]);
    expect(plan.networks.map(n => n.interface)).toContain(JSON.parse(rule.expression[1]));
    expect(rule.interfaces).toEqual([JSON.parse(rule.expression[1])]);
    expect(rule.installArgv.slice(0, 5)).toEqual(['nft', 'add', 'rule', 'inet', 'axstack_sandbox']);
    expect(rule.installArgv).not.toContain('policy');
    expect(rule.removeArgv).not.toContain('flush');
  }
  for (const address of input.host.addresses) expect(plan.rules.some(r => r.expression.includes(address))).toBe(true);
  expect(planNetwork({ ...input, runId: 'concurrent' }).networks.every(n => !plan.networks.some(p => p.interface === n.interface))).toBe(true);
});

// A packet model independent of the rule builder: an early drop wins even if
// Docker/iptables-nft later accepts; return leaves the host's policy in control.
function verdict(plan, chain, packet) {
  const ipNumber = text => {
    if (!text.includes(':')) return text.split('.').reduce((v, part) => v * 256n + BigInt(part), 0n);
    const [left, right] = new URL(`http://[${text}]`).hostname.slice(1, -1).split('::');
    const start = left ? left.split(':') : [], end = right ? right.split(':') : [];
    const words = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill('0'), ...end];
    return words.reduce((v, word) => v * 65536n + BigInt(`0x${word}`), 0n);
  };
  for (const rule of plan.rules.filter(r => r.chain === chain)) {
    const expressions = JSON.parse(rule.checkArgv.at(-1)).expr;
    let matches = true;
    for (const expr of expressions) {
      if (expr.match) {
        const { left, right, op } = expr.match;
        const field = left.meta?.key ?? left.ct?.key ?? left.payload?.field;
        if (left.payload && (left.payload.protocol === 'ip' || left.payload.protocol === 'ip6') && packet.family !== left.payload.protocol) { matches = false; break; }
        if (left.payload && ['tcp', 'udp', 'icmpv6'].includes(left.payload.protocol) && packet.protocol !== left.payload.protocol) { matches = false; break; }
        let equal;
        if (right.prefix) {
          const shift = BigInt((packet.family === 'ip' ? 32 : 128) - right.prefix.len);
          equal = ipNumber(packet[field]) >> shift === ipNumber(right.prefix.addr) >> shift;
        } else equal = right.set ? right.set.includes(packet[field]) : right === packet[field];
        if (op === '!=' ? equal : !equal) { matches = false; break; }
      } else if (matches) return 'drop' in expr ? 'drop' : 'continue';
    }
  }
  return 'continue';
}

test('packet paths permit same-run fetch and sidecar traffic but deny host, private, tailnet and cross-network traffic', () => {
  const plan = planNetwork(input);
  const [fetch, service, egress] = plan.networks;
  const packet = { family: 'ip', protocol: 'tcp', state: 'new', iifname: fetch.interface, oifname: fetch.interface, daddr: fetch.subnets[0].replace('0/24', '2'), dport: 3128 };
  expect(verdict(plan, 'forward', packet)).toBe('continue');
  expect(verdict(plan, 'forward', { ...packet, iifname: service.interface, oifname: service.interface, daddr: service.subnets[0].replace('0/24', '2'), dport: 5432 })).toBe('continue');
  expect(verdict(plan, 'input', packet)).toBe('drop');
  expect(verdict(plan, 'forward', { ...packet, oifname: egress.interface })).toBe('drop');
  for (const address of ['127.0.0.1', '10.0.0.1', '100.100.100.100', '169.254.169.254', '172.17.0.2', '192.168.0.1', '203.0.114.17']) {
    expect(verdict(plan, 'forward', { ...packet, iifname: egress.interface, oifname: 'eth0', daddr: address, dport: 443 })).toBe('drop');
  }
  expect(verdict(plan, 'forward', { ...packet, iifname: egress.interface, oifname: 'eth0', daddr: '104.16.26.34', dport: 443 })).toBe('continue');
  for (const address of ['::1', 'fd7a:115c:a1e0::1', 'fe80::1', '::ffff:7f00:1', '2a01:4f8::17']) {
    expect(verdict(plan, 'forward', { ...packet, family: 'ip6', iifname: egress.interface, oifname: 'eth0', daddr: address, dport: 443 })).toBe('drop');
  }
  expect(verdict(plan, 'forward', { ...packet, iifname: 'unrelated0', oifname: 'unrelated1' })).toBe('continue');
});

test('unknown host addresses hold; caller registry additions and mutable proxy configuration are rejected', () => {
  expect(() => planNetwork({ ...input, host: { addresses: [], terms: [] } })).toThrow('address');
  expect(() => planNetwork({ ...input, registryAllowlist: [...input.registryAllowlist, 'evil.example'] })).toThrow('inventory');
  expect(() => planNetwork({ ...input, proxy: { ...proxy, resolverIpv4: '100.100.100.100' } })).toThrow('proxy');
  expect(() => planNetwork({ ...input, runId: '../other' })).toThrow('run');
});

test('IPv6 neighbour discovery can resolve only on owned interfaces while every host data socket stays dropped', () => {
  const plan = planNetwork(input), iface = plan.networks[0].interface;
  const packet = { family: 'ip6', protocol: 'icmpv6', iifname: iface, type: 'nd-neighbor-solicit', hoplimit: 255 };
  expect(verdict(plan, 'input', packet)).toBe('continue');
  expect(verdict(plan, 'input', { ...packet, type: 'nd-neighbor-advert' })).toBe('continue');
  expect(verdict(plan, 'input', { ...packet, hoplimit: 254 })).toBe('drop');
  expect(verdict(plan, 'input', { ...packet, type: 'echo-request' })).toBe('drop');
  for (const protocol of ['tcp', 'udp']) expect(verdict(plan, 'input', { ...packet, protocol, type: undefined, dport: 8317 })).toBe('drop');
});
