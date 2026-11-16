/**
 * B owns launcher*. Planning is stateless and allowed on any host; run/reap are
 * axat-vps-only. Assets/facts are trusted launcher observations, never PR inputs.
 * @param {import('./launcher-contracts.js').PlanInput} _input
 * @returns {import('./launcher-contracts.js').Plan} Exact argv, rules, storage, probes and caps; terms may hold execution.
 * @throws {Error} Invalid input; sandboxHold:true for incomplete/unsafe prerequisites.
 */
export function plan(_input) { throw new Error('not implemented'); }

/**
 * Revalidate identity/policy/caps and perform fresh enumeration + probes before PR code.
 * Host W3-1 capture owns receipt/log writes outside all untrusted writable roots.
 * @param {{plan:import('./launcher-contracts.js').Plan, evidenceDir:string}} _input
 * @returns {Promise<import('./launcher-contracts.js').Receipt>}
 * @throws {Error} sandboxHold:true on any failed/unknown gate or cleanup uncertainty.
 */
export async function run(_input) { throw new Error('not implemented'); }

/**
 * Reap only labelled non-live runs. Unreadable PID/start/boot identity holds;
 * already-removed objects succeed. Never remove a rule before its containers.
 * @param {{assets:import('./launcher-contracts.js').Assets, host:import('./launcher-contracts.js').HostFacts}} _input
 * @returns {Promise<import('./launcher-contracts.js').Term[]>} Per-resource cleanup facts, no aggregate verdict.
 * @throws {Error} sandboxHold:true on wrong host, unreadable liveness or leftover owned state.
 */
export async function reap(_input) { throw new Error('not implemented'); }
