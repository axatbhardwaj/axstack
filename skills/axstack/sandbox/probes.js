import { execute, hold } from './probes-exec.js';

const helper = `${import.meta.dir}/probes-check.js`;
const required = ['addresses', 'listeners', 'docker-networks', 'docker-containers', 'tailnet'];
const validRun = (runId) => { if (typeof runId !== 'string' || !/^[a-zA-Z0-9][\w.-]{0,100}$/.test(runId)) throw Error('invalid run identity'); };
const strip = (address) => address.replace(/\/\d+$/, '').replace(/%[^%]+$/, '');

/** Injectable command boundary; defaults execute only trusted host observers/probes. */
export function createProbeTools({ runner = execute } = {}) {
  /** @param {{runId:string,networks:import('./launcher-contracts.js').Network[]}} input */
  async function enumerateTargets({ runId, networks }) {
    validRun(runId);
    if (!Array.isArray(networks)) throw Error('networks must be an array');
    const terms = [], targets = [];
    const add = (kind, address, port, protocol, evidence, prefix = kind) => {
      if (typeof address !== 'string' || !address || (/\s/.test(address) || address.includes(String.fromCharCode(0)))) throw Error('invalid observed address');
      if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) throw Error('invalid observed port');
      const id = `${prefix}:${address}:${port ?? '-'}:${protocol}`;
      if (!targets.some((t) => t.id === id)) targets.push({ id, kind, address, port, protocol, evidence: [evidence] });
    };
    async function observe(id, argv, parse) {
      try {
        const result = await runner(argv);
        if (result.exitCode !== 0 || result.timedOut || result.truncated) throw Error(`observer exit ${result.exitCode}`);
        await parse(result.stdout);
        terms.push({ id, status: 'pass', evidence: [JSON.stringify(argv), result.stdout] });
      } catch (error) { terms.push({ id, status: 'unknown', evidence: [JSON.stringify(argv), String(error)] }); }
    }
    let addresses = [];
    const hostZones = new Map();
    await observe('addresses', ['ip', '-j', 'address', 'show'], (out) => {
      const rows = JSON.parse(out);
      if (!Array.isArray(rows) || !rows.length) throw Error('missing host interfaces');
      addresses = rows.flatMap((row) => {
        if (row.ifname) { hostZones.set(String(row.ifindex), row.ifname); hostZones.set(row.ifname, row.ifname); }
        if (!Array.isArray(row.addr_info)) throw Error('missing interface addresses');
        return row.addr_info.filter((a) => ['inet', 'inet6'].includes(a.family)).map((a) => {
          if (a.family === 'inet6' && a.scope === 'link' && !row.ifname) throw Error('host link-local zone missing');
          return strip(a.local) + (a.family === 'inet6' && a.scope === 'link' ? `%${row.ifname}` : '');
        });
      });
      if (!addresses.length) throw Error('missing host addresses');
      for (const address of addresses) add('host-address', address, null, 'icmp', JSON.stringify({ observer: 'ip address show', address }));
    });
    await observe('listeners', ['ss', '-H', '-lntu'], (out) => {
      for (const row of out.trim().split('\n').filter(Boolean)) {
        const fields = row.trim().split(/\s+/), protocol = fields[0];
        const local = fields[4]?.match(/^(.*):(\d+)$/);
        if (!['tcp', 'udp'].includes(protocol) || !local) throw Error(`unparsed listener: ${row}`);
        const raw = local[1].replace(/^\[|\]$/g, ''), zone = raw.split('%')[1];
        if (zone && !hostZones.has(zone)) throw Error('listener zone unknown');
        const address = strip(raw) + (zone ? `%${hostZones.get(zone)}` : ''), port = Number(local[2]);
        const wildcard = ['*', '0.0.0.0', '::'].includes(address);
        const bound = wildcard ? addresses : [address];
        if (!bound.length) throw Error('wildcard listener without addresses');
        for (const host of bound) add('host-listener', host, port, protocol, row);
      }
    });
    let ids = [], inspected = [], containerIds = [];
    await observe('docker-networks', ['docker', 'network', 'ls', '--no-trunc', '--format', '{{.ID}}'], async (out) => {
      ids = out.trim().split(/\s+/).filter(Boolean).sort();
      if (!ids.length || ids.some((id) => !/^[a-f0-9]{12,64}$/.test(id))) throw Error('missing/invalid Docker networks');
      const result = await runner(['docker', 'network', 'inspect', ...ids]);
      if (result.exitCode !== 0 || result.timedOut || result.truncated) throw Error('network inspect failed');
      inspected = JSON.parse(result.stdout);
      if (inspected.length !== ids.length || new Set(inspected.map((n) => n.Id)).size !== ids.length) throw Error('incomplete network inspect');
      for (const net of inspected) {
        const addressless = (net.Driver === 'host' && net.Name === 'host' || net.Driver === 'null' && net.Name === 'none') && net.IPAM?.Config === null;
        if (!ids.includes(net.Id) || !net.IPAM || !addressless && !Array.isArray(net.IPAM.Config) || !net.Containers) throw Error('incomplete Docker network');
        for (const config of net.IPAM.Config ?? []) if (config.Gateway) add('gateway', strip(config.Gateway), null, 'icmp', JSON.stringify({ networkId: net.Id, name: net.Name, ...config }));
        const own = networks.some((n) => n.id === net.Id || n.name === net.Name);
        for (const [id, container] of Object.entries(net.Containers)) {
          containerIds.push(id);
          for (const field of ['IPv4Address', 'IPv6Address']) if (container[field]) {
            add(own ? 'fixed' : 'other-container', strip(container[field]), null, 'icmp', JSON.stringify({ networkId: net.Id, name: net.Name, containerId: id, ...container }), own ? `container|${container.Name}` : 'other-container');
          }
        }
      }
      if (networks.some((n) => !inspected.some((live) => n.id === live.Id || n.name === live.Name))) throw Error('run network missing');
      const after = await runner(['docker', 'network', 'ls', '--no-trunc', '--format', '{{.ID}}']);
      if (after.exitCode !== 0 || after.timedOut || after.truncated || JSON.stringify(after.stdout.trim().split(/\s+/).filter(Boolean).sort()) !== JSON.stringify(ids)) throw Error('Docker networks changed during enumeration');
    });
    containerIds = [...new Set(containerIds)].sort();
    const sidecars = await Bun.file(new URL('./sidecars.json', import.meta.url)).json();
    await observe('docker-containers', ['docker', 'ps', '--no-trunc', '--format', '{{.ID}}'], async (out) => {
      const running = out.trim().split(/\s+/).filter(Boolean).sort();
      if (running.some((id) => !/^[a-f0-9]{12,64}$/.test(id))) throw Error('invalid running container identity');
      const requested = [...new Set([...containerIds, ...running])].sort();
      if (!requested.length) return;
      const result = await runner(['docker', 'inspect', '--type', 'container', ...requested]);
      if (result.exitCode !== 0 || result.timedOut || result.truncated) throw Error('container inspect failed');
      const rows = JSON.parse(result.stdout);
      if (rows.length !== requested.length || new Set(rows.map((c) => c.Id)).size !== requested.length) throw Error('incomplete container inspect');
      for (const c of rows) {
        if (!requested.includes(c.Id) || !c.NetworkSettings?.Networks || !c.Config) throw Error('incomplete container facts');
        if (!Object.keys(c.NetworkSettings.Networks).length && !['none', 'host'].includes(c.HostConfig?.NetworkMode)) throw Error('container network mode unknown');
        for (const [name, net] of Object.entries(c.NetworkSettings.Networks)) {
          const snapshot = inspected.find((n) => n.Name === name);
          if (!snapshot?.Containers[c.Id]) throw Error('container membership changed');
          for (const [key, value] of [['IPAddress', 'IPv4Address'], ['GlobalIPv6Address', 'IPv6Address']]) {
            if ((net[key] || '') !== strip(snapshot.Containers[c.Id][value] || '')) throw Error('container address changed');
          }
          if (!networks.some((n) => n.profile === 'service' && n.name === name)) continue;
          if (!sidecars.images.some((image) => image.image === c.Config.Image)) continue;
          if (!c.State?.Running || !Number.isInteger(c.State.Pid) || c.State.Pid < 2) throw Error('sidecar not running');
          const sockets = await runner(['nsenter', '--target', String(c.State.Pid), '--net', '--', 'ss', '-H', '-lntu']);
          if (sockets.exitCode !== 0 || sockets.timedOut || sockets.truncated) throw Error('sidecar listener enumeration unavailable');
          let found = false;
          for (const line of sockets.stdout.trim().split('\n').filter(Boolean)) {
            const fields = line.trim().split(/\s+/), local = fields[4]?.match(/^(.*):(\d+)$/);
            if (!local || !['tcp', 'udp'].includes(fields[0])) throw Error('unparsed sidecar listener');
            // Inventoried sidecars provide TCP services. UDP UNCONN rows here
            // include outbound DNS/telemetry clients, not declared UDP services.
            if (fields[0] === 'udp') continue;
            const bind = strip(local[1].replace(/^\[|\]$/g, ''));
            for (const address of [net.IPAddress, net.GlobalIPv6Address].filter(Boolean)) {
              if (bind !== address && bind !== '*' && bind !== (address.includes(':') ? '::' : '0.0.0.0')) continue;
              add('fixed', address, Number(local[2]), fields[0], sockets.stdout, `service|${c.Name.replace(/^\//, '')}`);
              found = true;
            }
          }
          if (!found) throw Error(`sidecar has no reachable listener: ${c.Name}`);
        }
      }
    });
    await observe('tailnet', ['tailscale', 'status', '--json'], (out) => {
      const data = JSON.parse(out);
      if (data.BackendState !== 'Running' || !data.Self?.DNSName || !data.Peer || data.Health?.length) throw Error('incomplete/unhealthy tailnet');
      for (const peer of [data.Self, ...Object.values(data.Peer)]) {
        if (!Array.isArray(peer.TailscaleIPs) || !peer.TailscaleIPs.length) throw Error('peer without addresses');
        for (const address of peer.TailscaleIPs) add('tailnet', address, null, 'icmp', JSON.stringify({ dnsName: peer.DNSName, address }));
      }
      for (const protocol of ['tcp', 'udp']) {
        add('dns', data.Self.DNSName, 53, protocol, JSON.stringify({ dnsName: data.Self.DNSName, resolver: '100.100.100.100' }), 'tailnet-dns');
        add('dns', data.Self.DNSName, 53, protocol, JSON.stringify({ dnsName: data.Self.DNSName, resolver: '127.0.0.11' }), 'tailnet-dns-stub');
      }
    });
    for (const address of ['1.1.1.1', '2606:4700:4700::1111', '169.254.169.254', 'fd00:ec2::254', '127.0.0.1', '::1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '100.64.0.1', 'fc00::1', 'fe80::1']) add('fixed', address, 443, 'tcp', 'W3-4 fixed destinations', 'direct');
    add('fixed', 'example.com', 443, 'tcp', 'W3-4 arbitrary HTTPS', 'arbitrary-https');
    add('fixed', 'dl.google.com', 443, 'tcp', 'Inventoried allowed root redirects to www.google.com outside the frozen allowlist', 'redirect');
    for (const protocol of ['tcp', 'udp']) {
      add('dns', 'example.com', 53, protocol, 'W3-4 external DNS', 'external-dns');
      add('dns', 'example.com', 53, protocol, 'W3-4 embedded DNS', 'external-dns-stub');
    }
    for (const address of ['169.254.169.254', 'fd00:ec2::254']) add('fixed', address, 80, 'tcp', 'W3-4 metadata HTTP', 'direct');
    const inventory = await Bun.file(new URL('./inventory.json', import.meta.url)).json();
    for (const address of inventory.registryAllowlist) add('fixed', address, 443, 'tcp', 'inventory.json#/registryAllowlist', 'registry');
    return { runId, terms, targets: targets.sort((a, b) => a.id.localeCompare(b.id)) };
  }

  // Synchronous wire-data expansion: no command or observer is executed here.
  function planProbes({ runId, containers, networks, enumeration, storage }) {
    validRun(runId);
    if (enumeration?.runId !== runId) throw Error('stale enumeration run identity');
    if (!containers.length || new Set(containers.map((c) => c.id)).size !== containers.length) throw Error('missing/duplicate containers');
    const probes = [], proxy = containers.find((c) => c.role === 'proxy');
    const add = (container, position, expected, targetIds, args) => probes.push({ id: String(probes.length), containerId: container.id, position, expected, targetIds, argv: [process.execPath, helper, ...args] });
    for (const c of containers) {
      if (c.networkIds.some((id) => !networks.some((n) => n.id === id))) throw Error('unknown container network');
      const position = c.role === 'proxy' ? 'proxy-bypassed' : c.networkIds.length === 0 ? 'none' : c.networkIds.some((id) => networks.find((n) => n.id === id)?.profile === 'service') ? 'service' : 'fetch';
      add(c, position, 'non-root-empty-caps', [], ['identity', c.id]);
      for (const target of enumeration.targets) {
        if (target.id.startsWith('container|')) continue;
        if (target.id.startsWith('redirect:') && position !== 'fetch') continue;
        const registry = target.id.startsWith('registry:'), service = target.id.startsWith('service|');
        const publicTarget = ['1.1.1.1', '2606:4700:4700::1111', 'example.com'].includes(target.address) || registry;
        const allowed = (registry && position === 'fetch') || (service && position === 'service') || (position === 'proxy-bypassed' && publicTarget && !target.id.startsWith('tailnet-dns'));
        const redirect = target.id.startsWith('redirect:');
        const viaProxy = position === 'fetch' && (registry || redirect || target.id.startsWith('arbitrary-https:'));
        if (viaProxy && !proxy) throw Error('fetch proxy missing');
        const endpoint = [target.kind, target.address, target.port, target.protocol, ...(target.kind === 'dns' ? [target.id] : redirect ? [null, true] : service ? [null, false, true] : [])];
        const args = ['network', c.id, allowed ? 'allow' : 'deny', JSON.stringify(endpoint), ...(viaProxy ? [proxy.id] : [])];
        add(c, position, allowed ? 'allow' : 'deny', [target.id], args);
      }
      const mounting = storage.volumeName && c.argv?.some(arg => arg.split(',').some(part => part === `source=${storage.volumeName}` || part === `src=${storage.volumeName}`));
      const templates = storage.checks.filter(step => step.containerId === null);
      const checks = storage.checks.filter(step => step.containerId === c.id);
      if (mounting && templates.length) {
        if (!['non-root', 'filesystem', 'total-size'].every(id => templates.some(step => step.id === id))) throw Error(`missing capped filesystem check for ${c.id}`);
        checks.push({ argv: [process.execPath, `${import.meta.dir}/probes-storage.js`, JSON.stringify(storage), c.id] });
      }
      if (mounting && !checks.length) throw Error(`missing capped filesystem check for ${c.id}`);
      for (const check of checks) {
        // D owns exact type/total-size verification and its non-root container argv.
        probes.push({ id: String(probes.length), containerId: c.id, position, expected: 'capped-filesystem', targetIds: [], argv: [...check.argv] });
      }
    }
    return probes;
  }

  /** @param {{plan:import('./launcher-contracts.js').Plan,onPlan?:(plan:import('./launcher-contracts.js').Plan)=>Promise<void>}} input
   * The trusted launcher callback persists the final fresh target set before probes.
   * Failed persistence or any failed/unknown observation throws a sandbox hold.
   */
  async function runProbes({ plan, onPlan }) {
    validRun(plan.runId);
    const original = planProbes(plan);
    if (!original.length || JSON.stringify(original) !== JSON.stringify(plan.probes)) throw hold('probe plan incomplete or changed', []);
    const fresh = await enumerateTargets({ runId: plan.runId, networks: plan.networks });
    const incomplete = required.some((id) => !fresh.terms.some((t) => t.id === id && t.status === 'pass'));
    if (incomplete || fresh.terms.some((t) => t.status !== 'pass')) throw hold('incomplete target enumeration', fresh.terms);
    const identity = (e) => JSON.stringify(e.targets.map(({ evidence: _e, ...t }) => t).sort((a, b) => a.id.localeCompare(b.id)));
    if (plan.enumeration?.runId !== plan.runId || !onPlan && identity(fresh) !== identity(plan.enumeration)) throw hold('target enumeration changed; replan this run', fresh.terms);
    const canonical = planProbes({ ...plan, enumeration: fresh });
    // The launcher persists this exact fresh target set before any socket probe.
    // Standalone callers without that binding still hold on changed targets.
    if (onPlan) { plan.enumeration = fresh; plan.probes = canonical; await onPlan(plan); }
    const results = new Array(canonical.length), serial = [], parallel = [];
    const targets = new Map(fresh.targets.map(t => [t.id, t]));
    canonical.forEach((probe, i) => {
      const target = targets.get(probe.targetIds[0]);
      // All reserved-source-port UDP proofs share one lane, including containers
      // that share a bridge. Other trusted clients use at most fifteen lanes.
      (probe.expected === 'deny' && target?.protocol === 'udp' && target.kind !== 'dns' ? serial : parallel).push(i);
    });
    let failed;
    async function probeAt(i) {
      const probe = canonical[i];
      let term;
      try {
        const r = await runner(probe.argv);
        const reported = probe.expected === 'capped-filesystem' ? (r.exitCode === 0 ? 'pass' : 'fail') : JSON.parse(r.stdout).status;
        const status = r.timedOut || r.truncated ? 'unknown' : reported === 'unknown' ? 'unknown' : r.exitCode !== 0 ? 'fail' : reported;
        term = { id: probe.id, status: ['pass', 'fail', 'unknown'].includes(status) ? status : 'unknown', evidence: [JSON.stringify(r)] };
      } catch (error) { term = { id: probe.id, status: 'unknown', evidence: [String(error)] }; }
      results[i] = term;
      if (term.status !== 'pass' && !failed) failed = term;
    }
    async function lane(queue) {
      while (!failed && queue.length) await probeAt(queue.shift());
    }
    await Promise.all([lane(serial), ...Array.from({ length: Math.min(15, parallel.length) }, () => lane(parallel))]);
    if (failed) throw hold(`probe ${failed.id} ${failed.status}`, [...results.filter(t => t && t !== failed), failed]);
    return results;
  }
  return { enumerateTargets, planProbes, runProbes };
}

export const { enumerateTargets, planProbes, runProbes } = createProbeTools();
