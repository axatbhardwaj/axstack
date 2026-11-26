import catalog from './catalog.json';
import { journalPolicy, journalRegistration } from './health-journal.mjs';
import { dueSlot, object, runChecks, runInventory, term, timestamp, word } from './health-runs.mjs';
import { CONFORMANCE_SUITE, matchesWorkflowConformance, supportsWorkflowT3, validateWorkflowManifest } from './workflow-contract.mjs';

function manifestEntries(manifest) {
  try {
    return Object.keys(validateWorkflowManifest(manifest).workflows);
  } catch {
    return null;
  }
}

function registryIndex(snapshot) {
  if (!Array.isArray(snapshot?.workflows)) return null;
  const registered = new Set();
  for (const row of snapshot.workflows) {
    if (!word(row?.name) || !Number.isSafeInteger(row.version) || row.version < 1) return null;
    const key = row.name + '@' + row.version;
    if (registered.has(key)) return null;
    registered.add(key);
  }
  return registered;
}

function definitionCheck(registered, identity, runs, fallback, reachable) {
  if (registered) return registered.has(identity)
    ? term('pass', 'exact version present in native registry')
    : term('fail', 'exact version absent from native registry');
  const retired = runs?.find((run) => run.endedAt === null && run.retired === true);
  if (retired) return term('fail', { runId: retired.runId, reason: 'native run version is retired' });
  const current = runs?.find((run) => run.endedAt === null && run.retired === false);
  if (current) return term('pass', { runId: current.runId, reason: 'active native run is registered' });
  return fallback ?? term('unknown', reachable ? 'native registry and exact-version trigger or load-probe evidence unavailable' : 'host unreachable');
}

function loaderCheck(problem, reachable) {
  if (!reachable || !(problem === null || word(problem))) return term('unknown', 'native workflow registry loader diagnostics unavailable');
  return problem === null ? term('pass', 'native loader reports no problems') : term('fail', problem);
}

const semver = (value) => typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value);

function conformanceCheck(t3, receipt, reachable) {
  if (!reachable || !semver(t3?.serverVersion) || !semver(t3.cliVersion) || !word(t3.environment)) {
    return term('unknown', 'current T3 versions or environment unavailable');
  }
  const version = t3.serverVersion;
  if (version !== t3.cliVersion || !supportsWorkflowT3(version)) {
    return term('fail', { version, cliVersion: t3.cliVersion, reason: 'T3 CLI and server must agree at the workflow version floor' });
  }
  if (!object(receipt) || !semver(receipt.version) || !word(receipt.environment) ||
      !Number.isSafeInteger(receipt.suite) || !['pass', 'fail', 'unknown'].includes(receipt.status)) {
    return term('unknown', { version, reason: 'conformance receipt unavailable or unreadable' });
  }
  const evidence = { version, receiptVersion: receipt.version, receiptSuite: receipt.suite, receiptStatus: receipt.status };
  if (matchesWorkflowConformance(receipt, version, t3.environment)) return term('pass', evidence);
  if (receipt.version !== version || receipt.environment !== t3.environment || receipt.suite !== CONFORMANCE_SUITE) {
    return term('fail', { ...evidence, reason: 'receipt is for a different version, environment or suite' });
  }
  return term(receipt.status, evidence);
}

function workflowHealth(host, identity, inventory, registered, now, localCatalog) {
  const [name, rawVersion] = identity.split('@');
  const version = Number(rawVersion);
  const binding = object(host.policies) && Object.hasOwn(host.policies, identity) ? host.policies[identity] : null;
  const policy = journalPolicy(binding, host.journal, name, version);
  const known = object(localCatalog) && Object.hasOwn(localCatalog, name) && Number.isSafeInteger(localCatalog[name]);
  const exactRuns = inventory.runs?.filter((run) => run.workflow === name && run.version === version);
  const superseded = registered && [...registered].some((key) => key.startsWith(name + '@') && Number(key.split('@')[1]) > version);
  const slot = host.reachable === true ? dueSlot(policy, now, superseded) : term('unknown', 'host unreachable');
  const fallback = journalRegistration(host, name, version, policy, slot, now);
  return { name, version, checks: {
    catalog: known && localCatalog[name] >= version
      ? term('pass', { catalogVersion: localCatalog[name] })
      : term('unknown', 'owned version absent from supplied catalog'),
    definitionLoaded: definitionCheck(registered, identity, exactRuns, fallback, host.reachable === true),
    dueSlot: slot,
    ...runChecks(exactRuns, inventory.complete, host, policy, now),
  } };
}

function hostHealth(host, now) {
  const reachable = host.reachable === true;
  const identities = manifestEntries(host.manifest);
  const inventory = runInventory(host);
  const registered = reachable ? registryIndex(host.registry) : null;
  const conformance = conformanceCheck(host.t3, host.conformance, reachable);
  const workflows = (identities ?? []).sort().map((identity) => workflowHealth(host, identity, inventory, registered, now,
    Object.hasOwn(host, 'catalog') ? host.catalog : catalog));
  return {
    host: host.host,
    source: word(host.evidence) ? host.evidence : null,
    checks: {
      ownership: reachable && identities ? term('pass', { owned: identities.length })
        : term('unknown', reachable ? 'manifest unavailable or unreadable' : 'host unreachable'),
      inventory: inventory.complete.running && inventory.complete.waiting && inventory.complete.paused
        ? term('pass', { runs: inventory.runs.length })
        : term('unknown', reachable ? 'T3 active run inventory is incomplete' : 'host unreachable'),
      loader: loaderCheck(host.registry?.definition?.problem, reachable),
      conformance,
    },
    holds: conformance.status === 'pass' ? [] : ['new-activations'],
    workflows,
  };
}

export async function runWorkflowHealth(path) {
  if (!path) throw new Error('health requires --input <observations.json|->');
  const input = await (path === '-' ? Bun.stdin : Bun.file(path)).json();
  const now = timestamp(input?.at);
  if (!Number.isFinite(now) || !Array.isArray(input?.hosts) || !input.hosts.every((row) => word(row?.host)) ||
      new Set(input.hosts.map((row) => row.host)).size !== input.hosts.length) {
    throw new Error('health requires a zoned observation time and a unique explicit host list');
  }
  const hosts = input.hosts.map((host) => hostHealth(host, now));
  console.log(JSON.stringify({ at: input.at, hosts }, null, 2));
  const incomplete = (checks) => Object.values(checks).some((check) => check.status === 'unknown');
  if (hosts.some((row) => row.holds.length || incomplete(row.checks) ||
      row.workflows.some((workflow) => incomplete(workflow.checks)))) process.exitCode = 2;
}
