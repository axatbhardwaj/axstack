export const NAME = 'axstack-watch-backstops';
export const VERSION = 1;
export const IDENTITY = NAME + '@' + VERSION;
export const COALESCE_MS = 5000;
export const CHECK_MS = 300_000;

const intervals = { watch: 3_600_000, writer: CHECK_MS, recovery: CHECK_MS, autopilot: 3_600_000 };
const states = ['active', 'parked', 'user-stopped', 'complete'];
export const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_:-]{0,159}$/.test(value);
const label = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value);
const timestamp = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)
  ? Date.parse(value) : NaN;

function validModel(model) {
  return label(model?.instanceId) && label(model.model) && Array.isArray(model.options) &&
    model.options.every((option) => label(option?.id) && (typeof option.value === 'boolean' || label(option.value))) &&
    new Set(model.options.map(({ id }) => id)).size === model.options.length;
}

export function sameBinding(expected, observed) {
  return expected?.projectId === observed?.projectId && expected?.runtimeMode === observed?.runtimeMode &&
    validModel(expected?.model) && validModel(observed?.model) &&
    expected.model.instanceId === observed.model.instanceId && expected.model.model === observed.model.model &&
    expected.model.options.length === observed.model.options.length && expected.model.options.every(({ id, value }) =>
      observed.model.options.some((item) => item.id === id && item.value === value));
}

export function ownerReceipt(input, ownerId, now) {
  if (input?.ownerId !== ownerId || !states.includes(input.state) ||
      !Number.isFinite(timestamp(input.capturedAt)) || timestamp(input.capturedAt) > now ||
      !label(input.binding?.projectId) || !label(input.binding.runtimeMode) || !validModel(input.binding.model) ||
      !input.timers || !Object.keys(intervals).every((timer) =>
        input.timers[timer] === null || Number.isFinite(timestamp(input.timers[timer])))) return null;
  const dueAt = {};
  for (const timer of Object.keys(intervals)) {
    if (input.timers[timer] !== null) dueAt[timer] = timestamp(input.timers[timer]);
  }
  return { state: input.state, binding: input.binding, dueAt };
}

export function ownerState(ownerId, binding, view, projection, ending = false) {
  const thread = view?.thread;
  if (thread?.threadId !== ownerId) return { hold: 'native owner evidence is missing or mismatched' };
  if (thread.archived === true) return { hold: 'owner is archived' };
  if (!ending && (thread.snoozed === true || thread.pendingRequestCount > 0)) return { hold: 'owner is protected or awaiting user input' };
  if (thread.archived !== false || typeof thread.snoozed !== 'boolean' ||
      !Number.isSafeInteger(thread.pendingRequestCount) || thread.pendingRequestCount < 0) {
    return { hold: 'native owner state is unknown' };
  }
  const observed = projection?.thread;
  const model = observed?.modelSelection;
  if (observed?.id !== ownerId || observed.archivedAt !== null || observed.deletedAt !== null ||
      thread.projectId !== observed.projectId || thread.model !== model?.model ||
      thread.providerInstanceId !== model?.instanceId ||
      thread.runtimeMode !== observed.runtimeMode || !sameBinding(binding, {
        projectId: observed.projectId, model: { ...model, options: model?.options === undefined ? [] : model.options },
        runtimeMode: observed.runtimeMode,
      })) return { hold: 'effective owner binding is unknown or mismatched' };
  const runsKnown = Array.isArray(projection.runs);
  if (!ending && runsKnown && projection.runs.some((run) => run?.status === 'queued' && run.queueHeld === true)) {
    return { hold: 'owner is protected by a held queue' };
  }
  const statusKnown = ['idle', 'completed', 'running', 'starting', 'waiting', 'queued', 'preparing',
    'interrupted', 'failed', 'cancelled', 'rolled_back'].includes(thread.status);
  const gaps = [];
  if (!statusKnown) gaps.push('native owner status is unknown');
  if (!runsKnown) gaps.push('native owner run coverage is unavailable');
  return { status: statusKnown ? thread.status : 'unknown', gaps };
}

export function timerPlan(receipt, consumed, now) {
  if (receipt.state !== 'active') return { stop: receipt.state };
  const deadlines = Object.entries(receipt.dueAt).map(([timer, at]) =>
    [timer, Math.max(at, (consumed[timer] ?? -Infinity) + intervals[timer])]);
  if (!deadlines.length) return { stop: 'no-timers' };
  const due = deadlines.filter(([, at]) => at <= now);
  if (!due.length) return { waitMs: Math.min(CHECK_MS, Math.min(...deadlines.map(([, at]) => at)) - now) };
  const handled = due.map(([timer, at]) => [timer, at + Math.floor((now - at) / intervals[timer]) * intervals[timer]]);
  return { due: handled.map(([timer]) => timer), consumed: { ...consumed, ...Object.fromEntries(handled) },
    since: Math.min(...handled.map(([, at]) => at)) - COALESCE_MS };
}

export function activity(messages, ownerId, since, now) {
  if (!Array.isArray(messages) || messages.some((message) =>
    !message || typeof message.id !== 'string' || !Number.isFinite(timestamp(message.createdAt)))) {
    return { decision: 'wake', activity: 'unknown', gap: 'native PR message coverage is unavailable' };
  }
  const native = messages.find((message) => message.threadId === ownerId && message.createdBy === 'agent' && message.creationSource === 'server' &&
    message.id.startsWith('message:pr-watch:') && message.notification?.source?.kind === 'monitor' &&
    message.notification.source.pullRequest && timestamp(message.createdAt) >= since && timestamp(message.createdAt) <= now);
  return native
    ? { decision: 'native', activity: 'pass', eventId: native.id }
    : { decision: 'wake', activity: 'fail' };
}
