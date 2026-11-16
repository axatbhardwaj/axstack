import inventory from './inventory.json';
import config from './proxy-config.json';
import { ipAddress, publicDestination } from './network-address.js';

export async function authorizeTunnel({ authority, resolve, hostAddresses }) {
  if (typeof authority !== 'string' || !/^[a-z0-9.-]+:443$/.test(authority)) throw Error('Denied CONNECT authority');
  const hostname = authority.slice(0, -4);
  if (!inventory.registryAllowlist.includes(hostname)) throw Error('Registry not allowlisted');
  const addresses = await resolve(hostname);
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(address => !publicDestination(address, hostAddresses))) throw Error('Non-public or host destination denied');
  return { hostname, addresses: [...new Set(addresses.map(address => ipAddress(address).text))] };
}

export function proxyEnvironment(environment) {
  const allowlist = JSON.parse(environment.AXSTACK_PROXY_ALLOWLIST);
  const resolvers = JSON.parse(environment.AXSTACK_PROXY_RESOLVERS);
  const hostAddresses = JSON.parse(environment.AXSTACK_PROXY_HOST_ADDRESSES);
  if (JSON.stringify(allowlist) !== JSON.stringify(inventory.registryAllowlist) || JSON.stringify(resolvers) !== JSON.stringify([config.resolverIpv4, config.resolverIpv6]) || environment.AXSTACK_PROXY_PORT !== String(config.port)) throw Error('Changed fixed proxy environment');
  if (!Array.isArray(hostAddresses) || !hostAddresses.length) throw Error('Missing host address facts');
  hostAddresses.forEach(ipAddress);
  return { resolvers, hostAddresses, port: config.port };
}
