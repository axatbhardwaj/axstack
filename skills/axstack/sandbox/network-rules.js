import { deniedV4, deniedV6, ipAddress } from './network-address.js';

export function networkIdentity(runId) {
  if (typeof runId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(runId)) throw Error('Invalid run ID');
  return new Bun.CryptoHasher('sha256').update(runId).digest('hex').slice(0, 12);
}

export function networkDefinitions(runId, service) {
  const hash = networkIdentity(runId);
  const subnetSlot = Number.parseInt(hash.slice(0, 4), 16) % 16384;
  /** @type {import('./launcher-contracts.js').Network['profile'][]} */
  const profiles = service ? ['fetch', 'service', 'egress'] : ['fetch', 'egress'];
  return profiles.map((profile, index) => {
    const id = `axstack-${hash}-${profile}`;
    const iface = `ax${hash}${profile[0]}`;
    const slot = subnetSlot * 3 + index;
    const subnets = [`10.${64 + (slot >> 8)}.${slot & 255}.0/24`, `${ipAddress(`fd73:${hash.slice(0, 4)}:${hash.slice(4, 8)}:${index}::`).text}/64`];
    const internal = profile !== 'egress';
    return { id, name: id, interface: iface, profile, internal, subnets,
      createArgv: ['docker', 'network', 'create', '--driver', 'bridge', '--ipv6', ...(internal ? ['--internal'] : []),
        '--subnet', subnets[0], '--subnet', subnets[1], '--opt', `com.docker.network.bridge.name=${iface}`,
        '--label', 'axstack.sandbox=true', '--label', `axstack.sandbox.runId=${runId}`, id],
      removeArgv: ['docker', 'network', 'rm', id] };
  });
}

const match = (left, right, op = '==') => ({ match: { op, left, right } });
const destination = (family, address, op = '==') => {
  const [base, bits] = address.split('/');
  return match({ payload: { protocol: family, field: 'daddr' } }, bits ? { prefix: { addr: base, len: Number(bits) } } : base, op);
};

export function networkRules(networks, addresses, proxy, hash) {
  /** @type {import('./launcher-contracts.js').Rule[]} */
  const rules = [];
  function rawRule(network, chain, tokens, expr, direction = 'iifname') {
    const id = `axstack:${hash}:${rules.length}`;
    const expression = [direction, JSON.stringify(network.interface), ...tokens];
    const nftExpr = [match({ meta: { key: direction } }, network.interface), ...expr];
    const descriptor = JSON.stringify({ chain, comment: id, expr: nftExpr });
    rules.push({ id, family: 'inet', table: 'axstack_sandbox', chain, interfaces: [network.interface], expression,
      installArgv: ['nft', 'add', 'rule', 'inet', 'axstack_sandbox', chain, ...expression, 'comment', JSON.stringify(id)],
      checkArgv: [process.execPath, `${import.meta.dir}/network-firewall.js`, 'check', descriptor],
      removeArgv: [process.execPath, `${import.meta.dir}/network-firewall.js`, 'remove', descriptor] });
  }
  function rule(network, chain, tokens, expr, direction = 'iifname') {
    if (direction === 'iifname' && tokens.at(-1) === 'drop') {
      rawRule(network, chain, ['udp', 'sport', '20053', ...tokens.slice(0, -1), 'counter', 'drop'],
        [match({ payload: { protocol: 'udp', field: 'sport' } }, 20053), ...expr.slice(0, -1), { counter: null }, { drop: null }]);
    }
    rawRule(network, chain, tokens, expr, direction);
  }
  for (const network of networks) {
    // Link-local kernel neighbour discovery is required before IPv6 data can
    // reach the host-input drop. It exposes no host data socket or routed path.
    rule(network, 'input', ['icmpv6', 'type', '{ nd-neighbor-solicit, nd-neighbor-advert }', 'ip6', 'hoplimit', '255', 'return'],
      [match({ payload: { protocol: 'icmpv6', field: 'type' } }, { set: ['nd-neighbor-solicit', 'nd-neighbor-advert'] }), match({ payload: { protocol: 'ip6', field: 'hoplimit' } }, 255), { return: null }]);
    rule(network, 'input', ['drop'], [{ drop: null }]);
    // No unsolicited traffic into a run, even if an unrelated Docker rule accepts it.
    rule(network, 'forward', ['iifname', '!=', JSON.stringify(network.interface), 'ct', 'state', '!=', '{ established, related }', 'drop'],
      [match({ meta: { key: 'iifname' } }, network.interface, '!='), match({ ct: { key: 'state' } }, { set: ['established', 'related'] }, '!='), { drop: null }], 'oifname');
    if (network.internal) {
      rule(network, 'forward', ['oifname', '!=', JSON.stringify(network.interface), 'drop'],
        [match({ meta: { key: 'oifname' } }, network.interface, '!='), { drop: null }]);
      for (const [index, family] of ['ip', 'ip6'].entries()) {
        rule(network, 'forward', [family, 'daddr', '!=', network.subnets[index], 'drop'],
          [destination(family, network.subnets[index], '!='), { drop: null }]);
      }
      continue;
    }
    for (const address of [...new Set([...deniedV4, ...deniedV6, ...addresses])]) {
      const family = ipAddress(address.split('/')[0]).version === 4 ? 'ip' : 'ip6';
      rule(network, 'forward', [family, 'daddr', address, 'drop'], [destination(family, address), { drop: null }]);
    }
    rule(network, 'forward', ['ip6', 'daddr', '!=', '2000::/3', 'drop'], [destination('ip6', '2000::/3', '!='), { drop: null }]);
    for (const resolver of [proxy.resolverIpv4, proxy.resolverIpv6]) {
      const family = ipAddress(resolver).version === 4 ? 'ip' : 'ip6';
      for (const protocol of ['udp', 'tcp']) rule(network, 'forward', [family, 'daddr', resolver, protocol, 'dport', '53', 'return'],
        [destination(family, resolver), match({ payload: { protocol, field: 'dport' } }, 53), { return: null }]);
    }
    rule(network, 'forward', ['tcp', 'dport', '{ 80, 443 }', 'return'],
      [match({ payload: { protocol: 'tcp', field: 'dport' } }, { set: [80, 443] }), { return: null }]);
    rule(network, 'forward', ['drop'], [{ drop: null }]);
  }
  return rules;
}
