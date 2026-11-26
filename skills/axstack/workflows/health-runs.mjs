const ACTIVE = new Set(['running', 'waiting', 'paused']);
const TERMINAL = new Set(['completed', 'stopped', 'skipped', 'cancelled']);
const STEP_KINDS = new Set(['step', 'agent', 'ask', 'sleep', 'wait']);
const INTENTIONAL_WAIT = new Set(['ask', 'sleep', 'wait']);
const NATIVE_LIST_LIMIT = 500;

export const word = (value) => typeof value === 'string' && value.trim().length > 0;
export const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const timestamp = (value) => typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)
  ? Date.parse(value) : NaN;
export const term = (status, evidence) => ({ status, evidence });

const duration = (value) => Number.isSafeInteger(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER / 4;
const active = (run) => ACTIVE.has(run.status);

function runList(runs) {
  if (!Array.isArray(runs)) return null;
  const seen = new Set();
  for (const run of runs) {
    if (!word(run?.workflow) || !Number.isSafeInteger(run.version) || run.version < 1 ||
        !word(run.runId) || seen.has(run.runId) || (!active(run) && !TERMINAL.has(run.status))) return null;
    seen.add(run.runId);
  }
  return runs;
}

export function runInventory(host) {
  const complete = {};
  if (host.reachable !== true) return { runs: null, complete };
  if (!Object.hasOwn(host, 'activeRuns')) {
    const runs = runList(host.runs);
    for (const status of ACTIVE) complete[status] = Boolean(runs && runs.length < NATIVE_LIST_LIMIT);
    return { runs, complete };
  }
  const rows = [];
  for (const status of ACTIVE) {
    const page = runList(host.activeRuns?.[status]);
    const valid = page && page.every((run) => run.status === status);
    complete[status] = Boolean(valid && page.length < NATIVE_LIST_LIMIT);
    if (valid) rows.push(...page);
  }
  const runs = runList(rows);
  // A repeated ID across status pages changed state during collection.
  return { runs, complete: runs ? complete : {} };
}

export function dueSlot(policy, now, superseded) {
  if (policy?.kind === 'on-demand' || superseded) return term('n/a', 'version has no active schedule');
  const first = timestamp(policy?.firstDueAt);
  if (policy?.kind !== 'scheduled' || !duration(policy.intervalMs) || !Number.isFinite(first)) {
    return term('unknown', 'missing or invalid schedule binding');
  }
  if (now < first) return term('n/a', { firstDueAt: policy.firstDueAt });
  const slots = policy.slots;
  const seen = new Set();
  let latest;
  if (Array.isArray(slots)) {
    for (const slot of slots) {
      const due = timestamp(slot?.scheduledAt);
      const started = slot && Object.hasOwn(slot, 'startedAt') ? timestamp(slot.startedAt) : due;
      if (!word(slot?.runId) || seen.has(slot.runId) || !Number.isFinite(due) || due < first || due > now ||
          !Number.isFinite(started) || started < due || started > now) {
        return term('unknown', 'invalid scheduled-run provenance');
      }
      seen.add(slot.runId);
      if (!latest || due > timestamp(latest.scheduledAt)) latest = slot;
    }
  }
  const cutoff = now - 2 * policy.intervalMs;
  if (latest && timestamp(latest.scheduledAt) >= cutoff) {
    return term('pass', { runId: latest.runId, scheduledAt: latest.scheduledAt, ...latest.startedAt && { startedAt: latest.startedAt } });
  }
  if (first > cutoff) return term('n/a', { firstDueAt: policy.firstDueAt, reason: 'initial two-interval window' });
  if (!Array.isArray(slots) || policy.slotsComplete !== true) {
    return term('unknown', policy.triggerId ? 'T3 workflow_runs export is missing or incomplete' : 'scheduled-run provenance is incomplete');
  }
  return term('fail', { cutoff: new Date(cutoff).toISOString(), lastDueAt: latest?.scheduledAt ?? null });
}

function currentSteps(run, shows, now) {
  const show = object(shows) && Object.hasOwn(shows, run.runId) ? shows[run.runId] : null;
  const detail = show?.run;
  if (detail?.runId !== run.runId || detail.workflow !== run.workflow || detail.version !== run.version ||
      detail.status !== run.status || detail.startedAt !== run.startedAt ||
      detail.updatedAt !== run.updatedAt || detail.retired !== run.retired || !Array.isArray(show.steps)) return null;
  for (const step of show.steps) {
    const start = timestamp(step?.startedAt);
    if (!STEP_KINDS.has(step?.kind) || !Number.isFinite(start) || start < timestamp(run.startedAt) || start > now) return null;
    if (step.status === 'running' && step.endedAt === null) continue;
    const end = timestamp(step.endedAt);
    if (!['completed', 'failed'].includes(step.status) || !Number.isFinite(end) || end < start || end > now) return null;
  }
  return show.steps;
}

function agentFact(run, step, agents) {
  if (!word(step.threadId) || !(step.environmentId === null || word(step.environmentId)) || !Array.isArray(agents)) return null;
  const matches = agents.filter((record) => record?.runId === run.runId && record.threadId === step.threadId &&
    record.environmentId === step.environmentId && record.startedAt === step.startedAt);
  return matches.length === 1 && word(matches[0].evidence) ? matches[0] : null;
}

function inspectRun(run, host, policy, now) {
  const start = timestamp(run.startedAt);
  const updated = timestamp(run.updatedAt);
  const clockKnown = Number.isFinite(start) && start <= now;
  const steps = currentSteps(run, host.shows, now);
  const agentSteps = steps?.filter((step) => step.kind === 'agent' && step.status === 'running') ?? [];
  const agents = agentSteps.map((step) => agentFact(run, step, host.agents));
  const wedged = agents.find((fact) => fact?.status === 'wedged');
  if (wedged) return { runId: run.runId, stale: 'agent wedged', threadId: wedged.threadId, agentEvidence: wedged.evidence, progress: 'fail' };

  const scheduled = policy?.kind === 'scheduled' && duration(policy.intervalMs);
  if (scheduled && clockKnown && now - start > 4 * policy.intervalMs) {
    return { runId: run.runId, stale: 'older than four slot intervals', startedAt: run.startedAt };
  }

  let progress = 'unknown';
  let stale;
  if (run.status === 'paused' || run.retired === true) {
    progress = 'fail';
  } else if (steps && clockKnown && updated >= start && updated <= now) {
    if (run.status === 'waiting' && steps.some((step) => step.status === 'running' && INTENTIONAL_WAIT.has(step.kind))) {
      progress = 'pass';
    } else if (policy?.kind === 'on-demand' && duration(policy.progressTimeoutMs)) {
      const last = Math.max(updated, ...steps.map((step) => timestamp(step.endedAt ?? step.startedAt)));
      if (now - last <= policy.progressTimeoutMs) {
        progress = 'pass';
      } else if (run.status === 'running') {
        progress = 'fail';
        stale = 'no observed progress within the bound';
      }
    }
  }
  const staleUnknown = !steps || !clockKnown || agents.some((fact) => fact?.status !== 'healthy') ||
    (!scheduled && (policy?.kind !== 'on-demand' || (run.status !== 'paused' && progress === 'unknown')));
  return { runId: run.runId, stale, staleUnknown, progress };
}

export function runChecks(runs, complete, host, policy, now) {
  const unavailable = term('unknown', 'T3 active run inventory is incomplete');
  const notInvoked = term('n/a', 'version is scheduled');
  if (!runs) return {
    pausedRuns: unavailable, staleRuns: unavailable, invokedProgress: policy?.kind === 'scheduled' ? notInvoked : unavailable,
  };

  const open = runs.filter(active);
  const paused = open.filter((run) => run.status === 'paused').map(({ runId, startedAt }) => ({ runId, startedAt }));
  const checked = open.map((run) => inspectRun(run, host, policy, now));
  const stale = checked.filter((run) => run.stale).map(({ progress, ...run }) => run);
  const unclear = checked.filter((run) => run.staleUnknown).map(({ runId }) => runId);
  const allActive = [...ACTIVE].every((status) => complete[status]);
  return {
    pausedRuns: paused.length ? term('fail', paused) : complete.paused ? term('pass', 'no paused runs') : unavailable,
    staleRuns: stale.length ? term('fail', stale) : unclear.length
      ? term('unknown', { runIds: unclear, reason: 'incomplete run detail, policy or agent evidence' })
      : allActive ? term('pass', 'no stale active runs') : unavailable,
    invokedProgress: policy?.kind === 'scheduled' ? notInvoked : progressCheck(checked, policy, allActive),
  };
}

function progressCheck(checked, policy, allActive) {
  if (policy?.kind !== 'on-demand') return term('unknown', 'missing workflow trigger binding');
  const failed = checked.filter((run) => run.progress === 'fail').map(({ runId }) => runId);
  const unknown = checked.filter((run) => run.progress === 'unknown').map(({ runId }) => runId);
  if (failed.length) return term('fail', { runIds: failed, reason: 'paused, retired, wedged or overdue' });
  if (unknown.length) return term('unknown', { runIds: unknown, reason: 'progress evidence incomplete' });
  if (!allActive) return term('unknown', 'T3 active run inventory is incomplete');
  if (!checked.length) return term('n/a', 'no active invocations');
  return term('pass', { runIds: checked.map(({ runId }) => runId), reason: 'recent progress or a native wait' });
}
