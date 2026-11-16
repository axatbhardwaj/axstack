import { networkDefinitions, networkIdentity } from './network-rules.js';

// Outside Linux's ephemeral range. Only sequential synthetic denial probes bind it.
export const udpProbePort = 20053;

/** Read counters scoped to this run's interfaces and this synthetic source port. */
export async function udpSnapshot(container, runner) {
  const labels = container.Config?.Labels;
  const runId = labels?.['axstack.sandbox.runId'];
  if (labels?.['axstack.sandbox'] !== 'true' || !runId) throw Error('UDP probe owner unknown');
  const names = Object.keys(container.NetworkSettings?.Networks ?? {});
  const interfaces = networkDefinitions(runId, true).filter(n => names.includes(n.name)).map(n => n.interface);
  if (!interfaces.length) throw Error('UDP probe has no owned network interface');
  const result = await runner(['nft', '-j', 'list', 'table', 'inet', 'axstack_sandbox']);
  if (result.exitCode !== 0 || result.timedOut || result.truncated) throw Error('UDP counter readback unavailable');
  const rows = JSON.parse(result.stdout).nftables;
  if (!Array.isArray(rows)) throw Error('UDP counter table incomplete');
  const prefix = `axstack:${networkIdentity(runId)}:`;
  const snapshot = new Map();
  for (const { rule } of rows) {
    if (!rule?.comment?.startsWith(prefix) || !Array.isArray(rule.expr)) continue;
    const scope = rule.expr[0]?.match;
    if (scope?.op !== '==' || scope.left?.meta?.key !== 'iifname' || !interfaces.includes(scope.right)) continue;
    if (!rule.expr.some(e => e.match?.left?.payload?.protocol === 'udp' && e.match.left.payload.field === 'sport' && e.match.op === '==' && e.match.right === udpProbePort) || !('drop' in rule.expr.at(-1))) continue;
    const counters = rule.expr.filter(e => 'counter' in e);
    if (counters.length !== 1 || !Number.isSafeInteger(counters[0].counter?.packets) || counters[0].counter.packets < 0 || snapshot.has(rule.comment)) throw Error('UDP counter facts invalid');
    snapshot.set(rule.comment, { packets: counters[0].counter.packets, interface: scope.right,
      expression: JSON.stringify(rule.expr.map(e => 'counter' in e ? { counter: null } : e)) });
  }
  if (!snapshot.size) throw Error('UDP proof counters absent');
  return snapshot;
}

/** Exactly one sent datagram must increment one unchanged terminal drop rule. */
export function udpDenial(before, after) {
  if (before.size !== after.size) return null;
  const increments = [];
  for (const [id, first] of before) {
    const last = after.get(id);
    if (!last || last.expression !== first.expression || last.interface !== first.interface || last.packets < first.packets) return null;
    if (last.packets !== first.packets) increments.push({ ruleId: id, interface: first.interface, before: first.packets, after: last.packets, sourcePort: udpProbePort });
  }
  return increments.length === 1 && increments[0].after === increments[0].before + 1 ? increments[0] : null;
}
