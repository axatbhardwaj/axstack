/**
 * E owns probes*, Dockerfile and sidecars.json. Fresh host listeners/addresses,
 * gateways, other containers, tailnet peers and fixed/DNS targets; never cached.
 * @param {{runId:string, networks:import('./launcher-contracts.js').Network[]}} _input
 * @returns {Promise<import('./launcher-contracts.js').Enumeration>} Failed/incomplete enumeration is unknown, never an empty success.
 * @throws {Error} Observation errors retain unknown facts or throw sandboxHold:true.
 */
export async function enumerateTargets(_input) { throw new Error('not implemented'); }

/**
 * Pure expansion for every used container/profile, including proxy bypass;
 * include non-root/empty-caps and capped-filesystem checks in each relevant container.
 * @param {{runId:string, containers:import('./launcher-contracts.js').Container[], networks:import('./launcher-contracts.js').Network[], enumeration:import('./launcher-contracts.js').Enumeration, storage:import('./launcher-contracts.js').StoragePlan}} _input
 * @returns {import('./launcher-contracts.js').Probe[]}
 * @throws {Error} Invalid/stale run identity. Incomplete enumeration remains unknown in plan mode.
 */
export function planProbes(_input) { throw new Error('not implemented'); }

/**
 * Synthetic probes only, before PR commands. Host captures results by probe id;
 * failed, erroring or unknown probes hold. No result reuse, even at the same digest.
 * @param {{plan:import('./launcher-contracts.js').Plan}} _input
 * @returns {Promise<import('./launcher-contracts.js').Term[]>}
 * @throws {Error} sandboxHold:true for unavailable execution or capture.
 */
export async function runProbes(_input) { throw new Error('not implemented'); }
