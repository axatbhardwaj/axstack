/**
 * D owns storage*. Plan preallocation/ext4/explicit inodes/loop(no autoclear)/
 * labelled local volume; no launcher-side host mount or uncapped fallback.
 * @param {{runId:string, ownedDir:string, policy:import('./launcher-contracts.js').LaunchPolicy}} _input
 * @returns {import('./launcher-contracts.js').StoragePlan} Ordered argv and per-container filesystem checks.
 * @throws {Error} Invalid run/path/policy.
 */
export function planStorage(_input) { throw new Error('not implemented'); }

/**
 * Caller holds B's host-wide admission lock through concurrency check + attach.
 * Check one further free/allocatable loop, preallocate, format for policy uid/gid.
 * @param {{owner:import('./launcher-contracts.js').Owner, plan:import('./launcher-contracts.js').StoragePlan, policy:import('./launcher-contracts.js').LaunchPolicy}} _input
 * @returns {Promise<{loopDevice:string, terms:import('./launcher-contracts.js').Term[]}>} Observed device belongs only to plan.imageFile.
 * @throws {Error} sandboxHold:true for unavailable prerequisites, budget or loop uncertainty.
 */
export async function prepareStorage(_input) { throw new Error('not implemented'); }

/**
 * Verify containers gone -> volume gone -> detach matching backing file -> readback
 * -> delete owned image. Recover attach-before-volume and reboot-without-loop cases.
 * @param {{owner:import('./launcher-contracts.js').Owner, plan:import('./launcher-contracts.js').StoragePlan}} _input
 * @returns {Promise<import('./launcher-contracts.js').Term[]>}
 * @throws {Error} sandboxHold:true for busy detach/readback/ownership uncertainty.
 */
export async function cleanupStorage(_input) { throw new Error('not implemented'); }
