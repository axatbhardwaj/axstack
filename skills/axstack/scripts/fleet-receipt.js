// Saved evidence validator. A pass binds supplied facts; it cannot authenticate them.
import { canonical, record, text, time } from './fleet-config.js';
import { inside, isArtifact } from './fleet-scope.js';
import { inspectNativeFamily } from './fleet-native-receipt.js';

function options(value) {
  if (!Array.isArray(value)) return record(value) ? value : null;
  if (value.some((v) => !text(v?.id) || !['string', 'boolean'].includes(typeof v.value))
    || new Set(value.map((v) => v.id)).size !== value.length) return null;
  return Object.fromEntries(value.map((v) => [v.id, v.value]));
}
const same = (a, b) => a !== undefined && b !== undefined && canonical(a) === canonical(b);
const absolute = (path) => text(path) && path.startsWith('/') && !path.split('/').some((p) => p === '..' || p === '.');

export function inspectFleetReceipt(receipt, expected) {
  const terms = [];
  const term = (code, pass, observed, missing = observed === undefined || observed === null) => {
    terms.push({ code, state: pass ? 'pass' : missing ? 'unknown' : 'fail', evidence: observed ?? null });
  };
  const r = receipt ?? {};
  term('receipt-version', r.schemaVersion === 1, r.schemaVersion);
  const a = expected.attempt;
  const s = expected.recommendation.selected;
  const request = expected.recommendation.request;
  const artifact = isArtifact(request);
  term('receipt-origin', text(a?.origin?.threadId) && a?.origin?.environmentId === expected.recommendation.originEnvironmentId
    && same(r.attempt?.origin, a?.origin), r.attempt?.origin,
  !text(a?.origin?.threadId) || r.attempt?.origin == null);
  term('receipt-attempt', text(a?.key) && text(a?.clientRequestId) && text(a?.origin?.taskId)
    && same(r.attempt, a), r.attempt);
  term('receipt-recommendation', r.recommendationJSON === expected.recommendationJSON, r.recommendationJSON);
  term('receipt-config', r.configDigest === expected.recommendation.configDigest, r.configDigest);
  const status = r.status?.value;
  const submitted = r.submission;
  const thread = r.thread?.value?.thread;
  const remote = s.environmentId !== expected.recommendation.originEnvironmentId;
  const child = (v) => remote ? v?.remoteChild?.threadId : v?.childThreadId;
  const env = (v) => remote ? v?.remoteChild?.environmentId : a?.origin?.environmentId;
  term('receipt-destination', env(status) === s.environmentId && env(submitted) === s.environmentId
    && text(child(status)) && child(status) === child(submitted)
    && r.thread?.environmentId === s.environmentId && thread?.threadId === child(status),
  { submitted: submitted?.remoteChild ?? submitted?.childThreadId,
    status: status?.remoteChild ?? status?.childThreadId, thread: r.thread?.environmentId });
  // T3 0.1.5 persists subagentThreadTitle's exact projection on local children.
  // Full attempt/task/run/marker identity remains independently mandatory.
  const projectedTitle = artifact && !remote && s.versions?.t3 === '0.1.5'
    && text(a?.title) && a.title === a.title.trim() && a.title.length > 72
    && thread?.title === a.title.slice(0, 69) + '...';
  term('receipt-title', text(a?.title) && (thread?.title === a.title || projectedTitle), thread?.title);
  term('receipt-project', thread?.projectId === s.projectId, thread?.projectId);
  for (const [name, tool, environmentId, args] of [
    ['status', 'task_status', a?.origin?.environmentId, { taskId: a?.origin?.taskId }],
    ['thread', 't3_thread_read', s.environmentId, { threadId: child(status) }],
    ['terminal', 't3_thread_wait', s.environmentId, { threadId: child(status), runId: thread?.latestRunId }],
  ]) {
    const read = r[name];
    term('receipt-observation', read?.tool === tool && read?.environmentId === environmentId
      && same(read?.args, args) && time(read?.observedAt) && read.observedAt <= expected.now
      && text(read?.evidence), read);
  }
  term('receipt-origin', status?.taskId === a?.origin?.taskId && submitted?.taskId === a?.origin?.taskId,
    status?.taskId);
  const target = r.requested?.target;
  term('receipt-requested', target?.environmentId === s.environmentId && target?.projectId === s.projectId
    && target?.providerInstanceId === request.providerInstanceId && target?.model === request.model
    && same(options(target?.options), request.options) && r.requested?.runtimeMode === request.runtimeMode,
  r.requested);
  const native = r.nativeFamily === undefined ? null : inspectNativeFamily(r, expected);
  if (native) terms.push(...native.terms);
  const shell = native?.shell;
  const nativeValid = remote && native?.terms.every((t) => t.state === 'pass');
  if (native) term('receipt-effective', shell?.providerInstanceId === request.providerInstanceId
    && shell?.modelSelection?.instanceId === request.providerInstanceId
    && shell?.modelSelection?.model === request.model
    && Array.isArray(shell?.modelSelection?.options)
    && same(options(shell?.modelSelection?.options), request.options)
    && shell?.runtimeMode === request.runtimeMode, shell?.modelSelection);
  const runs = r.thread?.value?.recentRuns;
  // Without the origin result-run ID, only the sole initial run can own its summary.
  const initial = nativeValid && status?.childThreadId === null && submitted?.childThreadId === null
    && status?.childRunId === null && submitted?.childRunId === null
    && status?.latestTerminalRunId === null && thread?.runCount === 1
    && Array.isArray(runs) && runs.length === 1 && runs[0]?.ordinal === 1;
  const effectiveOptions = status?.options === undefined && initial
    ? shell?.modelSelection?.options : status?.options;
  term('receipt-effective', status?.providerInstanceId === request.providerInstanceId
    && status?.model === request.model && thread?.providerInstanceId === request.providerInstanceId
    && thread?.model === request.model && same(options(effectiveOptions), request.options)
    && thread?.runtimeMode === request.runtimeMode, { provider: status?.providerInstanceId,
    model: status?.model, options: effectiveOptions ?? null, runtimeMode: thread?.runtimeMode },
  effectiveOptions == null || thread?.runtimeMode == null);
  const terminal = r.terminal?.value;
  term('receipt-terminal', status?.status === 'completed' && status?.latestTerminalStatus === 'completed'
    && status?.workState === 'result_available' && status?.hasPendingChildRuns === false
    && ['completed', 'idle'].includes(thread?.status) && thread?.activeRunId === null
    && terminal?.status === 'completed' && terminal?.timedOut === false, { status, terminal },
  status?.status == null || status?.workState == null || status?.hasPendingChildRuns == null
    || status?.latestTerminalStatus == null || terminal?.status == null || terminal?.timedOut == null
    || thread?.activeRunId === undefined);
  term('receipt-question', status?.hasPendingQuestion === false && status?.pendingApproval === null
    && thread?.pendingRequestCount === 0, { hasPendingQuestion: status?.hasPendingQuestion,
    pendingApproval: status?.pendingApproval, pendingRequestCount: thread?.pendingRequestCount },
  status?.hasPendingQuestion == null || status?.pendingApproval === undefined || thread?.pendingRequestCount == null);
  const questions = r.questions;
  term('receipt-question', questions?.tool === 't3_pending_request'
    && questions?.environmentId === s.environmentId
    && same(questions?.args, { action: 'list', threadId: child(status) })
    && time(questions?.observedAt) && questions.observedAt <= expected.now
    && text(questions?.evidence) && Array.isArray(questions?.value?.requests)
    && questions.value.requests.length === 0, questions,
  questions == null || questions.value?.requests === undefined);
  const current = thread?.latestRunId;
  const latest = Array.isArray(runs) ? runs.find((v) => v.runId === current) : null;
  term('receipt-run', text(current) && (status?.latestTerminalRunId === current || initial)
    && terminal?.threadId === child(status) && terminal?.runId === current
    && (!terminal?.resultRun || (terminal.resultRun.runId === current && terminal.resultRun.status === 'completed'))
    && (!remote || (r.remoteChild?.environmentId === s.environmentId
      && r.remoteChild?.threadId === child(status) && r.remoteChild?.runId === current))
    && latest?.status === 'completed' && Number.isSafeInteger(latest?.ordinal)
    && runs.every((v) => Number.isSafeInteger(v.ordinal) && v.ordinal <= latest.ordinal),
  { current, originTerminal: status?.latestTerminalRunId, terminal, runs },
  !current || (!status?.latestTerminalRunId && !initial) || !terminal?.runId || !Array.isArray(runs)
    || (remote && !r.remoteChild?.runId));
  const marker = `AXSTACK-DONE key=${a?.key} head=${a?.candidate} report=${r.evidence?.path}`;
  const finalMarker = (value) => {
    if (typeof value !== 'string') return null;
    const lines = value.trim().split('\n');
    const markers = lines.filter((line) => line.startsWith('AXSTACK-'));
    if (markers.length !== 1) return null;
    const trailer = lines.slice(lines.indexOf(markers[0]) + 1);
    return trailer.length === 0 || (trailer.length === 1
      && /^PR https?:\/\/\S+, head [a-f0-9]{7,40}, checks and reviews .+$/.test(trailer[0]))
      ? markers[0] : null;
  };
  const items = r.thread?.value?.items;
  const final = Array.isArray(items) ? items.filter((v) => v.runId === current && v.createdBy === 'agent').at(-1) : null;
  // T3 0.1.5 suppresses latestTerminalSummary when it equals summary.
  // Only the same local result run may use that deduplicated value.
  const localSummary = artifact && !remote && s.versions?.t3 === '0.1.5'
    && status?.latestTerminalSummary === null && text(current)
    && status?.childRunId === current && status?.latestTerminalRunId === current
    && status?.status === 'completed' && status?.summary === final?.text;
  const resultSummary = localSummary ? status.summary : status?.latestTerminalSummary;
  term('receipt-marker', (artifact ? /^[a-f0-9]{64}$/ : /^[a-f0-9]{40}$/).test(a?.candidate ?? '')
    && finalMarker(resultSummary) === marker && finalMarker(final?.text) === marker
    && (!initial || resultSummary === final?.text),
  { origin: resultSummary, destination: final?.text });
  term('receipt-host-path', r.evidence?.hostId === s.hostId && r.evidence?.environmentId === s.environmentId
    && absolute(r.evidence?.path) && finalMarker(resultSummary)?.endsWith(` report=${r.evidence.path}`), r.evidence);
  if (artifact) {
    const scope = request.scope;
    const bytes = r.artifact;
    term('receipt-artifact-scope', a?.base === null && same(r.artifactScope, scope)
      && inside(r.evidence?.path, scope.evidenceRoot), r.artifactScope);
    term('receipt-artifact-bytes', bytes?.sha256 === a?.candidate && inside(bytes?.path, scope.artifactRoot)
      && bytes?.readback?.path === bytes.path && bytes?.readback?.sha256 === bytes.sha256
      && text(bytes?.readback?.evidence), bytes);
    // Shared native children can inherit a parent's non-Git scratch directory.
    // Bind that value to an actual parent read; a path alone proves nothing.
    const parent = r.parent;
    const parentThread = parent?.value?.thread;
    const inherited = !remote && s.versions?.t3 === '0.1.5'
      && parent?.tool === 't3_thread_read' && parent.environmentId === a?.origin?.environmentId
      && same(parent.args, { threadId: a?.origin?.threadId })
      && time(parent.observedAt) && parent.observedAt <= expected.now && text(parent.evidence)
      && parentThread?.threadId === a?.origin?.threadId && parentThread?.projectId === s.projectId
      && thread?.parentThreadId === parentThread?.threadId && thread?.relationshipToParent === 'subagent'
      && absolute(parentThread?.worktreePath) && inside(parentThread.worktreePath, scope.workspaceRoot)
      && thread?.worktreePath === parentThread.worktreePath;
    term('receipt-isolation', r.requested?.isolation === 'shared'
      && (thread?.worktreePath === null || inherited) && r.checkout == null,
    { isolation: r.requested?.isolation, worktreePath: thread?.worktreePath, parent });
  } else if (a?.title?.startsWith('Reviewer: ')) {
    term('receipt-isolation', r.requested?.isolation === 'worktree', r.requested?.isolation);
  }
  if (!artifact && (a?.title?.startsWith('Reviewer: ') || r.checkout != null || thread?.worktreePath != null || r.requested?.isolation === 'worktree')) {
    const c = r.checkout;
    term('receipt-checkout', c?.hostId === s.hostId && c?.environmentId === s.environmentId
      && absolute(c?.path) && c.path === thread?.worktreePath
      && /^[a-f0-9]{40}$/.test(a?.base ?? '') && c?.base === a.base && c?.candidate === a.candidate
      && c?.readback?.hostId === s.hostId && c?.readback?.environmentId === s.environmentId
      && c?.readback?.path === c.path && c?.readback?.base === a.base && c?.readback?.candidate === a.candidate
      && text(c?.readback?.evidence), c);
  }
  return terms;
}
