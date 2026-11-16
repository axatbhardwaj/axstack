# Sandbox interface v1

This is the shared B–E implementation boundary. Int owns this document,
`launcher-contracts.js`, `launcher-contract.schema.json` and the contract test;
packages keep these interfaces stable and return conflicts to Int.

## Ownership and composition

| Package | Module / assets | API |
| --- | --- | --- |
| B | `launcher.js`, `launcher-host.json`, `launcher-host-budget.json`, `launcher-policy.json` | `plan(input)`, `run(input)`, `reap(input)` |
| C | `network.js`, `proxy-config.json` and proxy implementation/config assets | `planNetwork(input)`, `installNetwork(input)`, `cleanupNetwork(input)` |
| D | `storage.js` | `planStorage(input)`, `prepareStorage(input)`, `cleanupStorage(input)` |
| E | `probes.js`, `Dockerfile`, `sidecars.json` | `enumerateTargets(input)`, `planProbes(input)`, `runProbes(input)` |

JSDoc input/output types are in `launcher-contracts.js`; the draft-2020-12 JSON
schema's `$defs` define the wire formats. Each API takes one object; planning
functions are synchronous/pure, observation and writer functions return promises.
Extra private exports are allowed. B composes C's `NetworkPlan`, D's `StoragePlan`
and E's `Probe[]` into `Plan`, constructing the fixed-policy argv for **every**
container, including the proxy, sidecars and synthetic probe containers.

`Plan` includes requested repository/head/base, source export, ownership,
explicit argv arrays (executable first, no shell), all rules, ordered storage
steps/checks/cleanup, enumeration, probes, per-container caps and host totals.
Network creation/removal argv live on each network; every rule carries install,
readback and removal argv plus its run-owned interface scope. C owns any required
shared table/chain setup internally; it never changes a base-chain policy.
D returns the observed loop-device path from preparation; B binds any dependent
storage commands after attachment and records those observations as facts.

Plan works on every host, using supplied observations; missing observations
produce `unknown` terms, never execution permission. B run refreshes host facts,
image configs and enumeration, then materializes and records the effective plan
before any untrusted command. Probes use that run's own containers and networks.
E refreshes enumeration once more immediately before probing. B supplies an
optional trusted `onPlan(plan)` callback to `runProbes({ plan, onPlan })` to save
that exact fresh plan before sockets run; without it, changed targets hold.
Probe IDs are local to their enclosing run plan. The private network-client argv
encodes `[kind, address, port, protocol, optionalDnsId, optionalRedirect, optionalService]`; full
endpoint provenance remains in the enumeration. Host IPv6 link-local addresses
retain their interface zone, which maps to the container link or proves fresh
namespace/bridge separation. Silent UDP alone never passes: denial needs one
reserved-source-port datagram and one unchanged run-owned drop-counter increment,
or fresh kernel no-route observations before and after the attempt.
Every required gate must pass; a failed/erroring/unknown probe or incomplete
enumeration holds. Plans and probe results are never reusable execution permits.

## File formats and fixed assets

Paths below are relative to this directory, resolved from `import.meta.url`,
never the caller's cwd. B/C/E populate the fixed packaged assets.
Missing/null identity, budget, policy or image pins hold execution.

- `launcher-host.json` → `$defs.hostBinding`: literal hostname `axat-vps` **and**
  SHA-256 of trimmed `/etc/machine-id` UTF-8 bytes. Compare both to fresh local
  observations before any run/reap mutation. No hostname-only trust or guessed hash.
- `launcher-host-budget.json` → `$defs.hostBudget`: inventory date, two-run
  memory/disk budgets and host reserves, all bytes. B counts every container's
  memory, tmpfs outside memory caps, preallocated dependency image, retained logs,
  source export, host capture **and receipt directory**. Two complete runs must
  fit the recorded budgets; free capacity below one run plus reserves holds.
- `launcher-policy.json` → `$defs.launchPolicy`: fixed non-root uid:gid, literal
  environment pairs, workload/proxy/sidecar caps, storage/inode/output caps,
  wall-time, grace and fixed maximum including grace. These are trusted package
  assets, never caller/PR overrides. Memory swap equals memory; every declared
  image VOLUME gets an exact-path, uid/mode-correct capped tmpfs from runtime
  image inspection. Schema shape alone does not prove these semantic checks.
- `proxy-config.json` → `$defs.proxyConfig`: digest-pinned image, fixed public
  IPv4/IPv6 resolvers and proxy port. The only registry list is
  `inventory.json#/registryAllowlist`; no duplicate/wildcard/caller allowlist.
- `sidecars.json` → `$defs.sidecars`: fixed IDs, digest-pinned images, fixed argv
  and declared-volume tmpfs expectations. E populates the inventoried services;
  B independently reads image config at run time and holds on any unmatched
  volume-type mount. A PR may request only existing IDs, never image names.

B owns host admission serialization through concurrency count and D's loop
attachment. Owner labels bind `axstack.sandbox`, run ID, PID, Linux
`/proc/<pid>/stat` field 22 start ticks and `/proc/sys/kernel/random/boot_id`.
Unreadable identity is treated as live and holds; the driver must resolve it,
never detach or reap by PID alone. The owned directory comes from fixed launcher
configuration, outside source and evidence writable roots. D retains one further
free/allocatable loop, verifies detach readback before image deletion, and never
uses autoclear. Already-removed objects are success for concurrent reapers.

## Capture and error contract

`$defs.receipt` is a sandbox envelope referencing a host-written W3-1 capture v1
receipt by absolute path and SHA-256 of its exact bytes. `planSha256` hashes the
exact effective plan JSON bytes retained beside it. No JSON reserialization for
hash verification. The container cannot write either receipt or its parent.

B uses `../scripts/command-capture.js` with `../scripts/capture-identity.js`;
`capture.schemaVersion` is 1. The referenced capture must match the plan's
repository, requested head/base, source before/after, argv/cwd, tool version,
sandbox image digest and log hash. Preserve the real capture's snapshot scope
(`tracked+untracked-nonignored`); it does not replace B's tracked-only export.
Capture's child exit is separate from proof sufficiency; timeout, interruption,
truncation, spawn failure or missing identity cannot close a required proof.
Probe terms, effective policy, engine version and all image digests stay in the
host-owned sandbox envelope. The reference is not permission to trust a file.

Implementations throw ordinary `Error` for malformed input/I/O (CLI exit 1),
or `Error` with `sandboxHold:true` for failed/unknown containment, wrong host,
concurrency or cleanup uncertainty (exit 2). Success/facts exit 0; child exit is
recorded separately. No aggregate authority verdict. Run/reap help must disclose
all side effects and the caller timeout must exceed fixed wall-time plus grace.
