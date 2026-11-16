/**
 * Shared interface v1. JSON wire shapes are authoritative in launcher-contract.schema.json.
 * B–E may add private helpers; changes to these shared signatures belong to Int.
 * All functions currently throw Error('not implemented'), with no side effects.
 * Implementations: invalid input/I/O errors throw Error (CLI exit 1); failed/unknown
 * containment throws Error with sandboxHold:true (CLI exit 2), before untrusted code.
 * Fact results use Term; they never grant review, merge or execution authority.
 * @typedef {{id:string, status:'pass'|'fail'|'unknown'|'n/a', evidence:string[]}} Term
 * @typedef {{label:'axstack.sandbox', runId:string, pid:number, startTimeTicks:string, bootId:string}} Owner
 * @typedef {{schemaVersion:1, hostname:'axat-vps', machineIdSha256:string}} HostBinding
 * @typedef {{schemaVersion:1, host:'axat-vps', inventoryDate:string, maxConcurrent:2, memoryBudgetBytes:number, diskBudgetBytes:number, reserveMemoryBytes:number, reserveDiskBytes:number}} HostBudget
 * @typedef {{cpus:number, memoryBytes:number, memorySwapBytes:number, pids:number, logMaxBytes:number, logMaxFiles:1, logDriver:'local', restart:'no'}} ContainerCaps
 * @typedef {{name:string, value:string}} Environment
 * @typedef {{path:string, bytes:number, uid:number, gid:number, mode:string, noexec:boolean}} Tmpfs
 * @typedef {{schemaVersion:1, user:string, environment:Environment[], workloadCaps:ContainerCaps, proxyCaps:ContainerCaps, sidecarCaps:ContainerCaps, writableBytes:number, dependencyBytes:number, dependencyInodes:number, sourceMaxBytes:number, captureMaxBytes:number, receiptMaxBytes:number, wallTimeSeconds:number, graceSeconds:number, maxWallTimeSeconds:number}} LaunchPolicy
 * @typedef {{schemaVersion:1, image:string, allowlistFile:'inventory.json', allowlistPointer:'/registryAllowlist', resolverIpv4:string, resolverIpv6:string, port:number}} ProxyConfig
 * @typedef {{id:string, image:string, argv:string[], declaredVolumes:Tmpfs[]}} Sidecar
 * @typedef {{schemaVersion:1, images:Sidecar[]}} Sidecars
 * @typedef {{id:string, name:string, interface:string, profile:'fetch'|'service'|'egress', internal:boolean, subnets:string[], createArgv:string[], removeArgv:string[]}} Network
 * @typedef {{id:string, family:'inet', table:'axstack_sandbox', chain:string, interfaces:string[], expression:string[], installArgv:string[], checkArgv:string[], removeArgv:string[]}} Rule
 * @typedef {{networks:Network[], rules:Rule[], proxy:{image:string, networkIds:string[], environment:Environment[]}}} NetworkPlan
 * @typedef {{id:string, role:'fetch'|'test'|'proxy'|'sidecar'|'probe', image:string, networkIds:string[], argv:string[], caps:ContainerCaps, tmpfs:Tmpfs[]}} Container
 * @typedef {{id:string, phase:'prepare'|'check'|'cleanup', executor:'host'|'container', containerId:string|null, argv:string[], path:string}} Step
 * @typedef {{imageFile:string, volumeName:string, filesystem:'ext4', bytes:number, inodes:number, mountOptions:['nosuid','nodev'], keepFreeLoops:1, autoclear:false, steps:Step[], checks:Step[], cleanup:Step[]}} StoragePlan
 * @typedef {{id:string, kind:'host-listener'|'host-address'|'gateway'|'other-container'|'tailnet'|'fixed'|'dns', address:string, port:number|null, protocol:'tcp'|'udp'|'icmp', evidence:string[]}} Target
 * @typedef {{runId:string, terms:Term[], targets:Target[]}} Enumeration
 * @typedef {{id:string, containerId:string, position:'fetch'|'none'|'service'|'proxy-bypassed', targetIds:string[], argv:string[], expected:'deny'|'allow'|'non-root-empty-caps'|'capped-filesystem'}} Probe
 * @typedef {{maxConcurrent:2, perRunMemoryBytes:number, perRunDiskBytes:number, sourceMaxBytes:number, captureMaxBytes:number, receiptMaxBytes:number, wallTimeSeconds:number, graceSeconds:number}} Caps
 * @typedef {{repo:string, repository:string, head:string, base:string, pr:string|null, fetchArgv:string[], testArgv:string[], sidecarIds:string[]}} Request
 * @typedef {{schemaVersion:1, runId:string, owner:Owner, request:Request, hostBinding:HostBinding, hostBudget:HostBudget, policy:LaunchPolicy, sourceExport:{path:string, commit:string, maxBytes:number}, containers:Container[], networks:Network[], rules:Rule[], storage:StoragePlan, enumeration:Enumeration, probes:Probe[], caps:Caps, terms:Term[]}} Plan
 * @typedef {{schemaVersion:1, runId:string, planSha256:string, owner:Owner, hostBinding:HostBinding, engineVersion:string, imageDigests:string[], effectivePolicy:LaunchPolicy, probeResults:Term[], terms:Term[], capture:{schemaVersion:1, receiptPath:string, receiptSha256:string}}} Receipt
 * @typedef {{hostBinding:HostBinding, hostBudget:HostBudget, policy:LaunchPolicy, proxy:ProxyConfig, sidecars:Sidecars, workloadImage:string, registryAllowlist:string[], ownedDir:string}} Assets
 * @typedef {{hostname:string, machineIdSha256:string, freeMemoryBytes:number, freeDiskBytes:number, addresses:string[], terms:Term[]}} HostFacts
 * @typedef {{runId:string, owner:Owner, request:Request, assets:Assets, host:HostFacts, enumeration:Enumeration}} PlanInput
 */
export {};
