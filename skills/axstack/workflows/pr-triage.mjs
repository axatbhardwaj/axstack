export const NAME = 'axstack-pr-triage';
export const VERSION = 1;
export const IDENTITY = `${NAME}@${VERSION}`;
export const DAILY_TIME = '02:00';
const TRIGGER_KEY = `trigger:${NAME}/daily:${DAILY_TIME}:all:`;

export function slotOwner(scheduledAt, runs, now) {
  const due = Date.parse(scheduledAt);
  if (!Number.isFinite(due) || scheduledAt !== new Date(due).toISOString() || due > now || now - due > 600_000) return null;
  const active = runs.filter(({ status }) => ['running', 'waiting', 'paused'].includes(status));
  const run = active[0];
  if (active.length !== 1 || run.status !== 'running' || run.key !== TRIGGER_KEY + scheduledAt ||
      !/^[a-f0-9]{32}$/.test(run.id)) return null;
  return run.id;
}

export function triageFacts(repos, report) {
  const rows = Array.isArray(report?.repositories) ? report.repositories : [];
  const repositories = repos.map((repo) => {
    const matches = rows.filter((row) => row?.repo === repo);
    const row = matches[0];
    return matches.length === 1 && Array.isArray(row.prs) && ['pass', 'unknown'].includes(row.coverage?.status)
      ? row : { repo, coverage: { status: 'unknown', reason: 'collector observation unavailable' }, prs: [] };
  });
  const partial = repositories.some(({ coverage, prs }) => coverage.status === 'unknown' ||
    prs.some((pr) => Object.values(pr).includes('UNKNOWN')));
  return {
    decision: partial ? 'partial' : repositories.some(({ prs }) => prs.length) ? 'normal' : 'quiet',
    facts: { login: report?.login ?? 'UNKNOWN', repositories },
  };
}

export function sameReportBinding(expected, observed) {
  const model = observed?.model;
  return observed?.runtimeMode === expected.runtimeMode && model?.instanceId === expected.model.instanceId &&
    model.model === expected.model.model && Array.isArray(model.options) &&
    model.options.length === expected.model.options.length && expected.model.options.every(({ id, value }) =>
      model.options.some((option) => option?.id === id && option.value === value));
}
