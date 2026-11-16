// A fake host syscall boundary, not a firewall implementation. Rule AST parsing
// is verified separately against independent changed/removed JSON observations.
export function fakeNetworkHost(plans) {
  const commands = [], networks = new Map(), rules = new Map();
  const chains = [];
  let table = false, handle = 1;
  const ok = data => ({ exitCode: 0, stdout: typeof data === 'string' ? data : JSON.stringify(data), stderr: '' });
  async function runner(argv) {
    commands.push(argv);
    if (argv[0] === 'docker') {
      if (argv[1] === 'ps') return ok('');
      if (argv[1] !== 'network') throw Error(`Unexpected Docker command ${argv}`);
      if (argv[2] === 'ls') {
        const filter = argv[argv.indexOf('--filter') + 1].slice(6, -1);
        return ok(networks.has(filter) ? filter : '');
      }
      const name = argv.at(-1);
      if (argv[2] === 'inspect') return ok([networks.get(name)]);
      if (argv[2] === 'rm') { networks.delete(name); return ok(name); }
      if (argv[2] === 'create') {
        const network = plans.flatMap(p => p.networks).find(n => n.name === name);
        const runId = argv.find(a => a.startsWith('axstack.sandbox.runId=')).split('=')[1];
        networks.set(name, { Name: name, Driver: 'bridge', Internal: argv.includes('--internal'), EnableIPv6: true,
          Labels: { 'axstack.sandbox': 'true', 'axstack.sandbox.runId': runId }, Options: { 'com.docker.network.bridge.name': network.interface },
          IPAM: { Config: network.subnets.map(Subnet => ({ Subnet: Subnet.includes(':') ? `${new URL(`http://[${Subnet.split('/')[0]}]`).hostname.slice(1, -1)}/64` : Subnet })) }, Containers: {} });
        return ok(name);
      }
    }
    if (argv[0] === 'nft') {
      if (argv.includes('tables')) return ok({ nftables: table ? [{ table: { family: 'inet', name: 'axstack_sandbox' } }] : [] });
      if (argv[1] === '-j') {
        if (!table) return { exitCode: 1, stdout: '', stderr: 'No such file or directory' };
        return ok({ nftables: [...chains.map(chain => ({ chain })), ...[...rules.values()].map(rule => ({ rule }))] });
      }
      if (argv[1] === 'add' && argv[2] === 'table') { table = true; return ok(''); }
      if (argv[4] !== 'axstack_sandbox') throw Error(`Foreign firewall mutation ${argv}`);
      if (argv[1] === 'add' && argv[2] === 'chain') { chains.push({ name: argv[5], hook: argv[5], type: 'filter', prio: -10, policy: 'accept' }); return ok(''); }
      if (argv[1] === 'add' && argv[2] === 'rule') {
        const rule = plans.flatMap(p => p.rules).find(r => JSON.stringify(r.installArgv) === JSON.stringify(argv));
        if (!rule) throw Error('Unknown rule installation');
        const observed = { ...JSON.parse(rule.checkArgv.at(-1)), handle: handle++ };
        rules.set(observed.handle, observed); return ok('');
      }
      if (argv[1] === 'delete' && argv[2] === 'rule') { rules.delete(Number(argv.at(-1))); return ok(''); }
    }
    throw Error(`Unexpected command ${argv}`);
  }
  return { runner, commands, networks, rules, chains };
}
