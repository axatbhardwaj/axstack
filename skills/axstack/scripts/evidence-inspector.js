#!/usr/bin/env bun
import { readFileSync, realpathSync } from 'node:fs';
import { captureTerms, sha256 } from './capture-identity.js';
import { validate } from '../sandbox/launcher-policy.js';

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
Optional review:{mode:peer|authored, localTests:boolean, sandboxReceipt:<envelope
 object or JSON path>, limitation, hold}. Review consumers must supply it even
 with no limitations (items/dispositions may then be empty). Authored yields n/a.
 Peer local test claims without an envelope fail; unavailable/held sandbox without
 a test claim is unknown with limitation/hold retained. The peer-sandbox term
 revalidates the envelope schema, containment/cleanup terms, capture digest,
 repository/head/base, log/source identity and sandbox tool/test/image binding.
 This measures receipt consistency, not authenticated isolation or test success.
 Capture cwd is not checked: the envelope lacks an expected source path.
 Peer evidence.testExecution separately reports a revalidated sandbox command
 exit, through the exact launcher wrapper for the pinned repository/head/base.
 It includes the exit code, capture receipt digest and digest of JSON argv,
 not raw argv or log contents. A recorded nonzero fetch exit is a setup exit;
 a test wrapper's exit alone does not distinguish setup from test failure.
 Capture v1 cannot attest assertions: log prose and exit codes do not establish
 assertion coverage or outcome. Unverified exits and command digests stay null;
 hold and limitation are caller-supplied and retained. This nested fact does not
 change the peer-sandbox status, summary counts, CLI exit or review authority.
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

function sandboxCommandMatches(capture, envelope, role) {
  if (!Array.isArray(capture.argv) || !text(capture.argv[0]) || !Array.isArray(capture.spawnArgv)) return false;
  const expected = ['docker', 'exec', '--user', envelope.effectivePolicy.user, '--workdir', '/work',
    `${envelope.runId}-${role}`, '/bin/sh', '-c', 'cp -R /source/. /work/ && chmod -R u+w /work && cd /work && exec "$@"',
    'axstack', ...capture.argv];
  return capture.spawnArgv.length === expected.length && expected.every((arg, index) => arg === capture.spawnArgv[index]);
}

function peerSandbox(review, expected, directory) {
  if (review?.mode === 'authored') return { id: 'peer-sandbox', status: 'n/a', reasonCode: 'authored-local-checks', evidence: {} };
  const limitation = review?.limitation ?? null, hold = review?.hold ?? null;
  const execution = (status, reasonCode, observed = {}) => ({ status, reasonCode, exitCode: null,
    argvSha256: null, receiptSha256: null, assertions: 'unknown', limitation, hold, ...observed });
  const gap = reasonCode => execution('unknown', hold ? 'sandbox-execution-held' : reasonCode);
  const result = (status, reasonCode, evidence = {}, testExecution = execution(status, reasonCode)) =>
    ({ id: 'peer-sandbox', status, reasonCode, evidence: { ...evidence, testExecution } });
  if (review?.mode !== 'peer' || typeof review.localTests !== 'boolean') return result('unknown', 'review-mode-missing');
  if (!review.sandboxReceipt) return review.localTests
    ? result('fail', 'sandbox-receipt-missing', {}, gap('sandbox-receipt-missing'))
    : result('unknown', 'sandbox-unavailable', { limitation, hold }, gap('sandbox-unavailable'));
  try {
    const envelope = readReceipt(review.sandboxReceipt, directory);
    validate('receipt', envelope);
    if ([...envelope.terms, ...envelope.probeResults].some(t => !['pass', 'n/a'].includes(t.status))) throw Error('containment/cleanup incomplete');
    const path = envelope.capture.receiptPath;
    const bytes = readFileSync(path.startsWith('/') ? path : `${directory}/${path}`);
    if (sha256(bytes) !== envelope.capture.receiptSha256) throw Error('capture digest differs');
    const capture = JSON.parse(bytes.toString()), terms = captureTerms(capture, expected);
    if (terms.some(t => t.status === 'fail')) throw Error('capture identity/log/source differs');
    const sandboxBound = capture.tool?.name === 'axstack-sandbox' && capture.tool.version === '1.0.0'
      && envelope.imageDigests.includes(capture.sandboxImageDigest);
    const incomplete = terms.some(t => t.status === 'unknown');
    const observed = (status, reasonCode) => execution(status, reasonCode, { exitCode: capture.exitCode,
      argvSha256: sha256(JSON.stringify(capture.argv)), receiptSha256: envelope.capture.receiptSha256 });
    if (!sandboxBound || capture.kind !== 'sandbox-test' || capture.spawnArgv?.[0] !== 'docker'
      || capture.spawnArgv?.[1] !== 'exec' || !capture.spawnArgv.includes(`${envelope.runId}-test`)) {
      if (sandboxBound && capture.kind === 'sandbox-fetch' && sandboxCommandMatches(capture, envelope, 'fetch')) {
        const details = { reason: 'capture is not the sandbox test' };
        if (incomplete) return result('fail', 'sandbox-validation-failed', details, gap('sandbox-capture-incomplete'));
        if (capture.exitCode !== 0) return result('fail', 'sandbox-validation-failed', details, observed('fail', 'setup-exit-nonzero'));
      }
      throw Error('capture is not the sandbox test');
    }
    if (incomplete) return result('unknown', 'sandbox-capture-incomplete', { terms }, gap('sandbox-capture-incomplete'));
    const testExecution = !sandboxCommandMatches(capture, envelope, 'test')
      ? execution('fail', 'sandbox-command-binding-mismatch')
      : capture.exitCode === 0 ? observed('pass', 'test-exit-zero') : observed('fail', 'test-exit-nonzero');
    return result('pass', 'sandbox-consistent', { capture: envelope.capture, terms, exitCode: capture.exitCode }, testExecution);
  } catch (error) {
    const unavailable = error.code === 'ENOENT' || error.code === 'EACCES';
    const reasonCode = unavailable ? 'sandbox-receipt-unavailable' : 'sandbox-validation-failed';
    return result(unavailable && !review.localTests ? 'unknown' : 'fail', reasonCode, { reason: error.message },
      unavailable ? gap(reasonCode) : undefined);
  }
}

export function inspectEvidence(packet, directory = '.') {
  if (packet?.schemaVersion !== 1 || !text(packet.repository) || !sha(packet.head) || !sha(packet.base)
    || !Array.isArray(packet.items) || (!packet.items.length && !packet.review) || !Array.isArray(packet.dispositions)) throw Error('schema v1 requires repository, full head/base, items and dispositions arrays (nonempty items unless review supplied)');
  const ids = packet.items.map(item => item?.id);
  if (!ids.every(text) || new Set(ids).size !== ids.length) throw Error('item IDs must be nonempty and unique');
  if (packet.dispositions.some(d => !d || !ids.includes(d.id))) throw Error('disposition references an unknown item');
  const expected = { repository: packet.repository, head: packet.head, base: packet.base };
  const terms = packet.items.map(item => {
    const dispositions = packet.dispositions.filter(d => d.id === item.id);
    return { id: item.id, boundary: item.boundary, disposition: dispositions.length === 1 ? dispositions[0].status : null,
      acceptedProofKinds: item.acceptedProofKinds ?? [], rules, ...evaluate(item, dispositions, expected, directory, packet.dispositions) };
  });
  if (packet.review) terms.push(peerSandbox(packet.review, expected, directory));
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
