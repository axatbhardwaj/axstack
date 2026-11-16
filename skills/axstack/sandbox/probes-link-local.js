/** Resolve a host link-local zone against fresh Docker bridge attachments.
 * An address on an unattached link is a different endpoint, like host loopback.
 * Missing bridge/namespace facts hold; attached links still get socket probes.
 */
export async function scopeLinkLocal(target, container, runner, readNamespace, prefix) {
  if (!/^fe[89ab][0-9a-f]:/i.test(target.address)) return { target };
  const match = /^(.*)%([\w.-]+)$/.exec(target.address);
  if (!match) throw Error('host link-local zone unavailable');
  const [host, current] = await Promise.all([readNamespace('/proc/self/ns/net'), readNamespace(`/proc/${container.State.Pid}/ns/net`)]);
  if (!/^net:\[\d+\]$/.test(host) || !/^net:\[\d+\]$/.test(current) || host === current) throw Error('host link-local namespace separation unavailable');
  const names = Object.keys(container.NetworkSettings.Networks);
  const result = await runner(['docker', 'network', 'inspect', ...names]);
  if (result.exitCode !== 0 || result.timedOut || result.truncated) throw Error('link-local bridge observation failed');
  const networks = JSON.parse(result.stdout);
  if (networks.length !== names.length || new Set(networks.map(n => n.Name)).size !== names.length) throw Error('incomplete link-local bridge observation');
  for (const n of networks) if (!names.includes(n.Name) || n.Driver !== 'bridge' && !(n.Driver === 'null' && n.Name === 'none') || n.Driver === 'bridge' && !n.Options?.['com.docker.network.bridge.name']) throw Error('unknown link-local network attachment');
  const attached = networks.find(n => n.Options?.['com.docker.network.bridge.name'] === match[2]);
  if (!attached) return { separated: true, evidence: [JSON.stringify({ hostZone: match[2], hostNamespace: host, containerNamespace: current, attachedBridges: networks.map(n => n.Options?.['com.docker.network.bridge.name'] ?? 'none') })] };
  const addresses = await runner([...prefix, 'ip', '-j', 'address', 'show']);
  if (addresses.exitCode !== 0 || addresses.timedOut || addresses.truncated) throw Error('container IPv6 interface observation failed');
  const local = container.NetworkSettings.Networks[attached.Name].GlobalIPv6Address;
  const links = JSON.parse(addresses.stdout).filter(link => link.addr_info?.some(a => a.local === local));
  if (!local || links.length !== 1 || !/^[\w.-]+$/.test(links[0].ifname)) throw Error('ambiguous container link-local zone');
  return { target: { ...target, address: `${match[1]}%${links[0].ifname}` } };
}
