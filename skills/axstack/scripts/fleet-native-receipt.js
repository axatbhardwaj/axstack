// T3 0.1.5 remote status omits options and a result-run ID. Never synthesize them.
import { canonical, text, time } from './fleet-config.js';

export function inspectNativeFamily(receipt, expected) {
  const r = receipt;
  const n = r.nativeFamily;
  const s = expected.recommendation.selected;
  const a = expected.attempt;
  const child = r.status?.value?.remoteChild?.threadId;
  const current = r.thread?.value?.thread?.latestRunId;
  const terms = [];
  const term = (pass, evidence) => terms.push({ code: 'receipt-native-family',
    state: pass ? 'pass' : evidence == null ? 'unknown' : 'fail', evidence: evidence ?? null });
  term(n?.tool === 'orchestration.getThreadFamily' && n?.transport === 't3-native-rpc'
    && n?.environmentId === s.environmentId && n?.serverVersion === '0.1.5'
    && s.versions?.t3 === n.serverVersion && canonical(n?.args) === canonical({ threadId: child })
    && time(n?.observedAt) && n.observedAt <= expected.now
    && n.observedAt >= r.thread?.observedAt && n.observedAt >= r.terminal?.observedAt
    && text(n?.evidence), n);
  const rows = n?.value?.threads;
  const matches = Array.isArray(rows) ? rows.filter((v) => v?.id === child) : [];
  term(time(n?.value?.snapshotSequence) && Array.isArray(rows)
    && rows.every((v) => text(v?.id)) && new Set(rows.map((v) => v.id)).size === rows.length
    && matches.length === 1, n?.value);
  const shell = matches[0];
  term(shell?.id === child && shell?.projectId === s.projectId && shell?.title === a?.title
    && shell?.latestRunId === current && text(current)
    && shell?.delegatedFrom?.environmentId === a?.origin?.environmentId
    && shell?.delegatedFrom?.threadId === a?.origin?.threadId, shell);
  term(shell?.status === 'completed' && Array.isArray(rows)
    && rows.every((v) => ['completed', 'idle'].includes(v?.status) && v?.activeRunId === null
      && Array.isArray(v?.pendingBackgroundTasks) && v.pendingBackgroundTasks.length === 0
      && v?.pendingRuntimeRequest === null && v?.pendingGuestMessageCount === 0), rows);
  return { terms, shell };
}
