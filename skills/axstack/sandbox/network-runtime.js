import { commandRunner, createFirewall, hold } from './network-firewall.js';
import { networkDefinitions, networkIdentity } from './network-rules.js';

export function createNetworkRuntime({ runner = commandRunner } = {}) {
  const firewall = createFirewall({ runner });
  /** @returns {import('./launcher-contracts.js').Term} */
  const pass = (id, evidence) => ({ id, status: 'pass', evidence });
  function validate(owner, plan) {
    if (owner?.label !== 'axstack.sandbox' || !owner.runId || !Number.isSafeInteger(owner.pid) || owner.pid < 1 || !owner.startTimeTicks || !owner.bootId) throw Error('Invalid network owner');
    const hash = networkIdentity(owner.runId);
    if (!plan?.networks?.length || !plan?.rules?.length) throw hold('Incomplete network plan');
    const expected = networkDefinitions(owner.runId, plan.networks.some(n => n.profile === 'service'));
    if (JSON.stringify(plan.networks) !== JSON.stringify(expected)) throw hold('Network ownership/argv mismatch');
    for (const rule of plan.rules) {
      if (rule.table !== 'axstack_sandbox' || rule.family !== 'inet' || !rule.id.startsWith(`axstack:${hash}:`) || !['input', 'forward'].includes(rule.chain) || !['iifname', 'oifname'].includes(rule.expression[0]) || !plan.networks.some(n => JSON.stringify(n.interface) === rule.expression[1])) throw hold('Unscoped firewall rule');
      if (JSON.stringify(rule.installArgv) !== JSON.stringify(['nft', 'add', 'rule', 'inet', 'axstack_sandbox', rule.chain, ...rule.expression, 'comment', JSON.stringify(rule.id)])) throw hold('Changed rule installation argv');
      const wanted = descriptor(rule);
      const first = wanted.expr?.[0]?.match;
      if (first?.op !== '==' || first?.left?.meta?.key !== rule.expression[0] || JSON.stringify(first?.right) !== rule.expression[1]) throw hold('Unscoped rule readback/removal descriptor');
    }
  }
  function descriptor(rule) {
    const wanted = JSON.parse(rule.checkArgv.at(-1));
    if (wanted.comment !== rule.id || wanted.chain !== rule.chain) throw hold('Rule descriptor mismatch');
    return wanted;
  }
  async function inspect(network) {
    const result = await runner(['docker', 'network', 'ls', '--filter', `name=^${network.name}$`, '--format', '{{.Name}}']);
    if (result.exitCode !== 0) throw hold('Cannot enumerate Docker networks');
    if (!result.stdout.trim()) return null;
    const inspected = await runner(['docker', 'network', 'inspect', network.name]);
    if (inspected.exitCode !== 0) throw hold(`Cannot inspect network ${network.name}`);
    try { const data = JSON.parse(inspected.stdout); if (!Array.isArray(data) || data.length !== 1) throw Error(); return data[0]; }
    catch { throw hold('Malformed network inspection'); }
  }
  function owned(network, actual, owner) {
    if (actual.Name !== network.name || actual.Labels?.['axstack.sandbox'] !== 'true' || actual.Labels?.['axstack.sandbox.runId'] !== owner.runId || actual.Options?.['com.docker.network.bridge.name'] !== network.interface) throw hold(`Foreign network ${network.name}`);
  }
  async function assertContainersGone(owner) {
    const result = await runner(['docker', 'ps', '-a', '--quiet', '--filter', 'label=axstack.sandbox=true', '--filter', `label=axstack.sandbox.runId=${owner.runId}`]);
    if (result.exitCode !== 0 || result.stdout.trim()) throw hold('Owned containers not independently confirmed gone');
  }
  async function installNetwork({ owner, plan }) {
    validate(owner, plan);
    await assertContainersGone(owner);
    await firewall.ensureTable();
    const terms = [];
    for (const network of plan.networks) {
      if (await inspect(network)) throw hold(`Run network already exists: ${network.name}`);
      const created = await runner(network.createArgv);
      if (created.exitCode !== 0) throw hold(`Network creation failed: ${network.name}`);
      const actual = await inspect(network);
      if (!actual) throw hold(`Network missing after creation: ${network.name}`);
      owned(network, actual, owner);
      const subnets = (actual.IPAM?.Config ?? []).map(item => item.Subnet).sort();
      if (actual.Driver !== 'bridge' || actual.Internal !== network.internal || actual.EnableIPv6 !== true || JSON.stringify(subnets) !== JSON.stringify([...network.subnets].sort()) || Object.keys(actual.Containers ?? {}).length) throw hold(`Unexpected network policy: ${network.name}`);
      terms.push(pass(`network:${network.id}`, [JSON.stringify(actual)]));
    }
    for (const rule of plan.rules) {
      const installed = await runner(rule.installArgv);
      if (installed.exitCode !== 0 || !await firewall.check(descriptor(rule))) throw hold(`Rule installation/readback failed: ${rule.id}`);
      terms.push(pass(`rule:${rule.id}`, [JSON.stringify(rule.expression)]));
    }
    await firewall.checkChains();
    for (const rule of plan.rules) if (!await firewall.check(descriptor(rule))) throw hold(`Rule disappeared before admission: ${rule.id}`);
    return terms;
  }
  async function cleanupNetwork({ owner, plan }) {
    validate(owner, plan);
    await assertContainersGone(owner);
    const existing = [];
    for (const network of plan.networks) {
      const actual = await inspect(network);
      if (actual) {
        owned(network, actual, owner);
        if (Object.keys(actual.Containers ?? {}).length) throw hold(`Attached containers remain: ${network.name}`);
        existing.push(network);
      }
    }
    // Enumeration proves absence; failed/changed readback is never absence.
    const listed = await runner(['nft', '-j', 'list', 'tables']);
    if (listed.exitCode !== 0) throw hold('Cannot enumerate firewall tables during cleanup');
    let tables;
    try { tables = JSON.parse(listed.stdout).nftables; if (!Array.isArray(tables)) throw Error(); }
    catch { throw hold('Malformed cleanup table enumeration'); }
    const present = tables.some(item => item.table?.family === 'inet' && item.table?.name === 'axstack_sandbox');
    const snapshot = present ? await firewall.checkChains({ allowAbsent: true }) : [];
    // A failed install can leave any prefix. Validate every surviving rule
    // before mutations, while independently proving all containers are gone.
    if (present) for (const rule of plan.rules) {
      if (!await firewall.check(descriptor(rule), { allowAbsent: true })) throw hold(`Changed rule at cleanup: ${rule.id}`);
    }
    await assertContainersGone(owner);
    const terms = [pass('containers-gone', ['Docker lists no running or stopped owned container']), pass('cleanup-rules-readback', [JSON.stringify(snapshot)])];
    // Networks disappear first while the firewall is still protecting their interfaces.
    for (const network of existing) {
      await runner(network.removeArgv);
      if (await inspect(network)) throw hold(`Network remains: ${network.name}`);
      terms.push(pass(`removed:${network.id}`, ['Docker network absence confirmed']));
    }
    await assertContainersGone(owner);
    for (const rule of present ? plan.rules : []) {
      await firewall.remove(descriptor(rule));
      terms.push(pass(`removed:${rule.id}`, ['Rule handle absence confirmed']));
    }
    return terms;
  }
  return { installNetwork, cleanupNetwork };
}
