import inventory from './inventory.json';
import config from './proxy-config.json';
import { ipAddress } from './network-address.js';
import { networkRules, networkIdentity, networkDefinitions } from './network-rules.js';
import { createNetworkRuntime } from './network-runtime.js';
export { proxyArgv } from './proxy-command.js';

/**
 * C owns network* and proxy-config.json. Pure plan: one shared owned nft table;
 * every rule matches only this run's interfaces; no base policy changes.
 * @param {{runId:string, host:import('./launcher-contracts.js').HostFacts, proxy:import('./launcher-contracts.js').ProxyConfig, registryAllowlist:string[], sidecarIds:string[]}} _input
 * @returns {import('./launcher-contracts.js').NetworkPlan}
 * @throws {Error} Invalid config; sandboxHold:true for incomplete address facts.
 */
export function planNetwork(_input) {
  const { runId, host, proxy, registryAllowlist, sidecarIds } = _input;
  const hash = networkIdentity(runId);
  if (!host?.addresses?.length) throw Object.assign(Error('Incomplete host address facts'), { sandboxHold: true });
  const addresses = [...new Set(host.addresses.map(address => ipAddress(address).text))].sort();
  if (!Array.isArray(registryAllowlist) || JSON.stringify([...registryAllowlist].sort()) !== JSON.stringify([...inventory.registryAllowlist].sort())) throw Error('Registry list must match inventory');
  if (JSON.stringify(Object.keys(proxy ?? {}).sort()) !== JSON.stringify(Object.keys(config).sort()) || Object.keys(config).some(k => proxy[k] !== config[k])) throw Error('Invalid fixed proxy config');
  if (!Array.isArray(sidecarIds) || sidecarIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id))) throw Error('Invalid sidecar IDs');
  const networks = networkDefinitions(runId, sidecarIds.length > 0);
  return { networks, rules: networkRules(networks, addresses, proxy, hash), proxy: { image: proxy.image,
    networkIds: networks.filter(n => n.profile !== 'service').map(n => n.id),
    environment: [
      { name: 'AXSTACK_PROXY_ALLOWLIST', value: JSON.stringify(inventory.registryAllowlist) },
      { name: 'AXSTACK_PROXY_RESOLVERS', value: JSON.stringify([config.resolverIpv4, config.resolverIpv6]) },
      { name: 'AXSTACK_PROXY_HOST_ADDRESSES', value: JSON.stringify(addresses) },
      { name: 'AXSTACK_PROXY_PORT', value: String(config.port) },
    ] } };
}

/**
 * Create run networks and install/check all rules before any container starts.
 * @param {{owner:import('./launcher-contracts.js').Owner, plan:import('./launcher-contracts.js').NetworkPlan}} _input
 * @returns {Promise<import('./launcher-contracts.js').Term[]>}
 * @throws {Error} sandboxHold:true on failed/unknown installation or readback.
 */
export async function installNetwork(_input) { return createNetworkRuntime().installNetwork(_input); }

/**
 * Check rules still present, verify containers gone, remove only this run's rules/networks.
 * Independently verify absence; a caller assertion of removal is insufficient.
 * @param {{owner:import('./launcher-contracts.js').Owner, plan:import('./launcher-contracts.js').NetworkPlan}} _input
 * @returns {Promise<import('./launcher-contracts.js').Term[]>}
 * @throws {Error} sandboxHold:true for live containers or cleanup uncertainty.
 */
export async function cleanupNetwork(_input) { return createNetworkRuntime().cleanupNetwork(_input); }
