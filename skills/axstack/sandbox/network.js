/**
 * C owns network* and proxy-config.json. Pure plan: one shared owned nft table;
 * every rule matches only this run's interfaces; no base policy changes.
 * @param {{runId:string, host:import('./launcher-contracts.js').HostFacts, proxy:import('./launcher-contracts.js').ProxyConfig, registryAllowlist:string[], sidecarIds:string[]}} _input
 * @returns {import('./launcher-contracts.js').NetworkPlan}
 * @throws {Error} Invalid config; sandboxHold:true for incomplete address facts.
 */
export function planNetwork(_input) { throw new Error('not implemented'); }

/**
 * Create run networks and install/check all rules before any container starts.
 * @param {{owner:import('./launcher-contracts.js').Owner, plan:import('./launcher-contracts.js').NetworkPlan}} _input
 * @returns {Promise<import('./launcher-contracts.js').Term[]>}
 * @throws {Error} sandboxHold:true on failed/unknown installation or readback.
 */
export async function installNetwork(_input) { throw new Error('not implemented'); }

/**
 * Check rules still present, verify containers gone, remove only this run's rules/networks.
 * Independently verify absence; a caller assertion of removal is insufficient.
 * @param {{owner:import('./launcher-contracts.js').Owner, plan:import('./launcher-contracts.js').NetworkPlan}} _input
 * @returns {Promise<import('./launcher-contracts.js').Term[]>}
 * @throws {Error} sandboxHold:true for live containers or cleanup uncertainty.
 */
export async function cleanupNetwork(_input) { throw new Error('not implemented'); }
