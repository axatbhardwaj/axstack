#!/usr/bin/env bun
import { readFileSync, realpathSync } from 'node:fs';
import { captureTerms } from './capture-identity.js';

const kinds = ['runtime', 'fixture', 'instruction-contract'];
const text = value => typeof value === 'string' && value.trim().length > 0;
const sha = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const time = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
const rules = {
  fail: 'open, conflicting/invalid disposition, sibling, stale binding, rejected kind, old/reused evidence, invalid/failed capture',
  unknown: 'missing disposition/receipt/decision, unavailable log, incomplete capture, chronology or source coverage',
};
export const help = `Usage: evidence-inspector.js --input PATH [--help]
Read-only, stateless schema-v1 limitation reconciliation. Flags:
  --input PATH  JSON packet with schemaVersion:1, repository, full head/base SHAs,
                items and dispositions. Relative receipt paths resolve beside input.
  --help        Show this schema, rules and effects; reads no packet.
Items: unique stable id, head, base, boundary, changedAt, raisedAt (ISO times),
 acceptedProofKinds (runtime | fixture | instruction-contract), sourceScope
 (tracked+untracked-nonignored | ignored | external), optional expectedExitCode
 (default 0), previousEvidence:[{id,logSha256}] (default []). Keep original item
 IDs, boundaries and prior evidence when supplying a new disposition.
Dispositions: id, head, base, boundary, status: proved | withdrawn-by-reviewer |
 user-accepted-unproven | open. Exactly one per item; none is unknown.
Proved: proof:{id,itemId,kind,observedAt,receipt}. receipt is a capture schema-v1
 object or JSON path. Revalidates captureTerms with packet repository/head/base
 and reads its logPath; never trusts cached terms. New evidence must postdate both
 change and limitation, and cannot reuse a previous ID or log digest. A named
 proof or captured log cannot belong to multiple items. Its kind
 must be accepted by that item. Sibling logs are compared by digest; identical honest logs fail closed. expectedExitCode belongs to the item policy.
Decisions: decision:{itemId,repository,head,base,boundary,role,by,at,reason,reference}.
 role must be reviewer for withdrawal, user for acceptance. These are caller-
 supplied decision records, not authenticated identities or proof of behavior.
 Decision must postdate change and limitation. Acceptance stays explicitly unproven.
Source-dependent proof needs snapshotScope.files=tracked+untracked-nonignored.
 Ignored bytes are never covered by the capture source term. Missing scope stays
 unknown; external boundaries do not rely on source coverage. Timestamps and proof
 kind are caller declarations: capture v1 does not attest chronology or proof kind.
Fail: ${rules.fail}.
Unknown: ${rules.unknown}. Invalid packet/flags are errors.
Effects: reads input, named receipt JSON and captured log files only; stdout JSON
 has one term per item, stable reasonCode, accepted kinds, rules, evidence and
 status counts only. Consumers must read each term's disposition: summary.pass
 includes proved, reviewer-withdrawn and user-accepted-unproven records; it does
 not count proven behaviors. Rebind item head/base to current packet revisions
 while preserving original IDs, boundaries and previousEvidence.
 No writes, subprocesses, network, retained state, dispatch, retry or cleanup.
 Pass measures consistency, not semantic sufficiency. Reviewer owns judgment;
 this cannot grant review/merge authority or an aggregate verdict.
Exit: 0 measured (including fail), 1 input error, 2 incomplete (any unknown).
`;

function readReceipt(receipt, directory) {
  if (typeof receipt !== 'string') return receipt;
  return JSON.parse(readFileSync(receipt.startsWith('/') ? receipt : `${directory}/${receipt}`, 'utf8'));
}

function evaluate(item, dispositions, expected, directory, allDispositions) {
  const outcome = (status, reasonCode, reason, details = null) => ({ status, reasonCode, evidence: { reason, details } });
  if (item.head !== expected.head || item.base !== expected.base) return outcome('fail', 'item-revision-mismatch', 'item head/base is stale');
  if (!text(item.boundary)) return outcome('unknown', 'item-boundary-missing', 'missing item boundary');
  if (dispositions.length === 0) return outcome('unknown', 'disposition-missing', 'missing disposition');
  if (dispositions.length !== 1) return outcome('fail', 'disposition-conflict', 'multiple dispositions');
  const d = dispositions[0];
  if (d.head !== expected.head || d.base !== expected.base) return outcome('fail', 'disposition-revision-mismatch', 'disposition head/base is stale');
  if (d.boundary !== item.boundary) return outcome('fail', 'disposition-boundary-mismatch', 'disposition boundary differs');
  if (d.status === 'open') return outcome('fail', 'limitation-open', 'limitation remains open');
  if (!['proved', 'withdrawn-by-reviewer', 'user-accepted-unproven'].includes(d.status)) return outcome('fail', 'disposition-invalid', 'invalid disposition');
  const decision = d.status !== 'proved';
  const proof = decision ? d.decision : d.proof;
  if (!proof || typeof proof !== 'object') return outcome('unknown', decision ? 'decision-missing' : 'proof-missing', decision ? 'missing decision receipt' : 'missing proof receipt');
  if (proof.itemId !== item.id) return outcome('fail', 'evidence-item-mismatch', 'evidence belongs to another item');
  const at = time(decision ? proof.at : proof.observedAt), changed = time(item.changedAt), raised = time(item.raisedAt);
  if (![at, changed, raised].every(Number.isFinite)) return outcome('unknown', 'chronology-invalid', 'missing/invalid declared chronology');
  if (at <= Math.max(changed, raised)) return outcome('fail', 'evidence-predates-limitation', 'evidence predates change or limitation', { at, changed, raised });
  if (decision) {
    const role = d.status === 'withdrawn-by-reviewer' ? 'reviewer' : 'user';
    if (proof.repository !== expected.repository || proof.head !== expected.head || proof.base !== expected.base || proof.boundary !== item.boundary) return outcome('fail', 'decision-binding-mismatch', 'decision repository/head/base/boundary differs');
    if (proof.role !== role) return outcome('fail', 'decision-role-invalid', 'invalid decision role');
    if (![proof.by, proof.reason, proof.reference].every(text)) return outcome('unknown', 'decision-incomplete', 'incomplete decision receipt');
    return outcome('pass', d.status === 'user-accepted-unproven' ? 'user-accepted-unproven' : 'reviewer-withdrawn', d.status === 'user-accepted-unproven' ? 'recorded user acceptance; behavior remains unproven' : 'recorded reviewer withdrawal', proof);
  }
  if (!Array.isArray(item.acceptedProofKinds) || !item.acceptedProofKinds.length || item.acceptedProofKinds.some(k => !kinds.includes(k))) return outcome('unknown', 'accepted-kinds-invalid', 'missing/invalid accepted proof kinds');
  if (!kinds.includes(proof.kind) || !item.acceptedProofKinds.includes(proof.kind)) return outcome('fail', 'proof-kind-rejected', 'proof kind is not accepted');
  if (!text(proof.id)) return outcome('unknown', 'proof-id-missing', 'missing named evidence ID');
  const siblings = allDispositions.filter(other => other.id !== item.id && other.status === 'proved' && other.proof);
  if (siblings.some(other => other.proof.id === proof.id)) return outcome('fail', 'sibling-proof-reused', 'named proof assigned to another item');
  if (!Array.isArray(item.previousEvidence ?? []) || (item.previousEvidence ?? []).some(p => !p || typeof p !== 'object' || Array.isArray(p))) return outcome('unknown', 'previous-evidence-invalid', 'invalid previous evidence inventory');
  if ((item.previousEvidence ?? []).some(p => p.id === proof.id)) return outcome('fail', 'previous-proof-reused', 'reused evidence without changed disposition');
  let receipt = proof.receipt;
  if (!receipt) return outcome('unknown', 'capture-receipt-missing', 'missing capture receipt');
  try { receipt = readReceipt(receipt, directory); }
  catch (error) { return outcome(error instanceof SyntaxError ? 'fail' : 'unknown', error instanceof SyntaxError ? 'capture-json-invalid' : 'capture-receipt-unavailable', 'invalid or unavailable capture receipt', error.message); }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return outcome('fail', 'capture-receipt-invalid', 'invalid capture receipt');
  const terms = captureTerms(receipt, expected);
  // captureTerms intentionally reports malformed schema as unknown; here it is
  // a supplied invalid receipt, distinct from an unavailable log/capture tail.
  if (terms[0].status === 'unknown') return outcome('fail', 'capture-schema-invalid', 'invalid capture receipt schema', terms);
  if (terms.some(t => t.status === 'fail')) return outcome('fail', 'capture-validation-failed', 'capture validation failed', terms);
  if (terms.some(t => t.status === 'unknown')) return outcome('unknown', 'capture-validation-incomplete', 'capture validation incomplete', terms);
  for (const other of siblings) {
    try {
      const sibling = readReceipt(other.proof.receipt, directory);
      if (sibling?.logSha256 === receipt.logSha256 || (sibling?.logPath && realpathSync(sibling.logPath) === realpathSync(receipt.logPath))) return outcome('fail', 'sibling-log-reused', 'capture log assigned to another item');
    } catch { /* That item's own term reports its unavailable/invalid receipt. */ }
  }
  if ((item.previousEvidence ?? []).some(p => p.logSha256 === receipt.logSha256)) return outcome('fail', 'previous-log-reused', 'reused log evidence without changed disposition');
  if (!Number.isInteger(item.expectedExitCode ?? 0)) return outcome('unknown', 'expected-exit-invalid', 'invalid expected exit code');
  if (receipt.exitCode !== (item.expectedExitCode ?? 0)) return outcome('fail', 'capture-exit-mismatch', 'captured exit differs from item policy', { actual: receipt.exitCode, expected: item.expectedExitCode ?? 0 });
  if (item.sourceScope === 'ignored') return outcome('unknown', 'source-ignored', 'ignored bytes are not bound by source capture');
  if (!['external', 'tracked+untracked-nonignored'].includes(item.sourceScope)) return outcome('unknown', 'source-scope-invalid', 'missing/invalid source scope');
  if (item.sourceScope !== 'external' && receipt.snapshotScope?.files !== 'tracked+untracked-nonignored') return outcome('unknown', 'snapshot-scope-missing', 'capture snapshot scope unavailable');
  return outcome('pass', 'capture-consistent', 'new item-bound capture is consistent; semantic sufficiency requires reviewer judgment', { id: proof.id, kind: proof.kind, declaredObservedAt: proof.observedAt, chronology: 'caller-declared, not capture-attested', terms });
}

export function inspectEvidence(packet, directory = '.') {
  if (packet?.schemaVersion !== 1 || !text(packet.repository) || !sha(packet.head) || !sha(packet.base)
    || !Array.isArray(packet.items) || !packet.items.length || !Array.isArray(packet.dispositions)) throw Error('schema v1 requires repository, full head/base, nonempty items and dispositions arrays');
  const ids = packet.items.map(item => item?.id);
  if (!ids.every(text) || new Set(ids).size !== ids.length) throw Error('item IDs must be nonempty and unique');
  if (packet.dispositions.some(d => !d || !ids.includes(d.id))) throw Error('disposition references an unknown item');
  const expected = { repository: packet.repository, head: packet.head, base: packet.base };
  const terms = packet.items.map(item => {
    const dispositions = packet.dispositions.filter(d => d.id === item.id);
    return { id: item.id, boundary: item.boundary, disposition: dispositions.length === 1 ? dispositions[0].status : null,
      acceptedProofKinds: item.acceptedProofKinds ?? [], rules, ...evaluate(item, dispositions, expected, directory, packet.dispositions) };
  });
  const summary = { pass: 0, fail: 0, unknown: 0, 'n/a': 0 };
  for (const term of terms) summary[term.status]++;
  return { schemaVersion: 1, terms, summary };
}

export function main(args, io = { stdout: console.log, stderr: console.error }) {
  if (args.includes('--help')) { io.stdout(help); return 0; }
  try {
    if (args.length !== 2 || args[0] !== '--input' || !args[1] || args[1].startsWith('--')) throw Error('expected --input PATH; use --help');
    const path = realpathSync(args[1]);
    const report = inspectEvidence(JSON.parse(readFileSync(path, 'utf8')), path.slice(0, path.lastIndexOf('/')) || '/');
    io.stdout(JSON.stringify(report, null, 2));
    return report.summary.unknown ? 2 : 0;
  } catch (error) { io.stderr(`Evidence inspector: ${error.message}`); return 1; }
}
if (import.meta.main) process.exit(main(process.argv.slice(2)));
