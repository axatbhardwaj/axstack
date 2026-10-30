export const HOSTS = ['io', 'iobook', 'iobox', 'iosatellite', 'axat-vps'];
export const activeRuns = new Set(['queued', 'preparing', 'starting', 'running', 'waiting']);
export const pointer = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:/._#?=&%+@-]{0,1023}$/.test(value);
export const instant = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)
  && Number.isFinite(Date.parse(value));
const threadLink = (value) => typeof value === 'string' && (pointer(value) && value.startsWith('t3-thread://')
  || value.startsWith('<t3-thread://') && value.endsWith('>') && pointer(value.slice(1, -1)));
export const identity = (owner) => owner && HOSTS.includes(owner.host)
  && ['environmentId', 'threadId'].every((key) => pointer(owner[key])) && threadLink(owner.threadLink);
export const sameOwner = (a, b) => identity(a) && identity(b)
  && ['host', 'environmentId', 'threadId', 'threadLink'].every((key) => a[key] === b[key]);
export const sameKey = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === 3 && b.length === 3
  && a.every((value, index) => value === b[index]);
export const validKey = (key) => Array.isArray(key) && key.length === 3 && HOSTS.includes(key[0]) && key.every(pointer);
export const term = (name, state, evidence) => ({ term: name, state, evidence });

export function threadStatus(thread, at) {
  let state = 'unknown';
  if (Number.isInteger(thread.pendingRequests) && thread.pendingRequests > 0) state = 'needs-you';
  else if (activeRuns.has(thread.run)) state = 'working';
  else if (['failed', 'interrupted'].includes(thread.run)) state = 'failed';
  else if ([null, 'completed', 'idle'].includes(thread.run) && thread.pendingRequests === 0) state = 'idle';
  const last = Array.isArray(thread.messages) ? thread.messages.filter((m) => m.role === 'assistant').at(-1) : null;
  return {
    state, lastRun: thread.run ?? null, pendingRequests: thread.pendingRequests ?? null,
    idleHours: instant(thread.updatedAt) ? Math.max(0, Math.round((at - Date.parse(thread.updatedAt)) / 360000) / 10) : null,
    branch: thread.branch ?? null, prs: Array.isArray(thread.prs) ? thread.prs : [],
    lastMessage: typeof last?.text === 'string' ? last.text.replace(/\s+/g, ' ').slice(0, 300) : '',
  };
}

export function normalize(input) {
  if (input?.schemaVersion !== 1 || !instant(input.at) || !instant(input.collectedAt)
    || !Array.isArray(input.hosts)) throw Error('need schemaVersion 1, ISO at/collectedAt and hosts array');
  const budget = input.budget;
  if (!budget || !['maxOwners', 'maxMessages'].every((key) => Number.isInteger(budget[key])
    && budget[key] > 0 && budget[key] <= 1000) || !instant(budget.deadlineAt)) throw Error('invalid finite budget');
  const at = Date.parse(input.at);
  const duration = Date.parse(budget.deadlineAt) - Date.parse(input.collectedAt);
  const inTime = at >= Date.parse(input.collectedAt) && at < Date.parse(budget.deadlineAt)
    && duration > 0 && duration < 1800000;
  const coverage = [];
  const threads = [];
  for (const host of HOSTS) {
    const matches = input.hosts.filter((row) => row.host === host);
    const row = matches.length === 1 ? matches[0] : null;
    const known = row?.reachable === true && row?.paginationComplete === true
      && pointer(row.environmentId) && pointer(row.evidence) && Array.isArray(row.threads);
    coverage.push(term(host, known ? 'pass' : 'unknown', row?.evidence ?? 'missing/unreachable/incomplete inventory'));
    const rows = Array.isArray(row?.threads) ? row.threads : [];
    const counts = new Map();
    for (const thread of rows) counts.set(thread.threadId, (counts.get(thread.threadId) ?? 0) + 1);
    // Observed rows on partial hosts remain visible, but cannot prove recovery readiness.
    for (const thread of rows) {
      if (!inTime || threads.length >= budget.maxOwners) break;
      const owner = { host, environmentId: row.environmentId, threadId: thread.threadId, threadLink: thread.threadLink };
      threads.push({ owner, inventoryKnown: known && counts.get(thread.threadId) === 1, raw: thread, ...threadStatus(thread, at) });
    }
  }
  const observed = input.hosts.reduce((sum, row) => sum + (Array.isArray(row.threads) ? row.threads.length : 0), 0);
  coverage.push(term('pass-budget', inTime && observed <= threads.length ? 'pass' : 'unknown',
    `${threads.length}/${observed} observed rows; deadline ${budget.deadlineAt}`));
  return { at, coverage, threads };
}
