// Read-only inventory function. The scoped adapter supplies the two native T3 reads.
export async function collectInventory({ listLinks, listThreads, localHost, pageSize = 8, maxPages = 2, timeoutMs = 20_000 }) {
  const bounded = (value, max) => Number.isSafeInteger(value) && value > 0 && value <= max;
  if (!bounded(pageSize, 20) || !bounded(maxPages, 10) || !bounded(timeoutMs, 60_000)) {
    throw new RangeError('Invalid VOA inventory bounds');
  }

  const hosts = ['io', 'iobook', 'iobox', 'iosatellite', 'axat-vps'];
  const clock = Date.now();
  const deadlineAt = clock + timeoutMs;
  const deadline = Symbol('deadline');
  let timer;
  const expired = new Promise((resolve) => {
    timer = setTimeout(() => resolve(deadline), timeoutMs);
  });
  const read = async (call, args) => {
    if (Date.now() >= deadlineAt) return deadline;
    try {
      const reply = await Promise.race([expired, call(args)]);
      if (reply === deadline || Date.now() >= deadlineAt) return deadline;
      return reply?.isError ? null : reply?.structuredContent ?? null;
    } catch {
      return null;
    }
  };

  const string = (value) => typeof value === 'string' && value ? value : null;
  const bool = (value) => typeof value === 'boolean' ? value : null;
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  const active = ['preparing', 'starting', 'running'];
  const stopped = ['idle', 'completed', 'interrupted', 'cancelled'];
  const failed = ['failed', 'rolled_back'];
  const statuses = [...active, ...stopped, ...failed, 'waiting', 'queued'];

  function project(row) {
    const { threadId, title, status, updatedAt, settled, snoozed,
      snoozedUntil, blockedOnThreadWait, pendingBackgroundTasks, pendingRequestCount, pullRequests, linkedPullRequest } = row;
    const link = string(row.link);
    const updated = Date.parse(updatedAt);
    const tasks = Array.isArray(pendingBackgroundTasks) ? pendingBackgroundTasks.map((task) => ({
      taskId: string(task?.taskId), kind: string(task?.kind),
      ...(string(task?.childThreadId) && { childThreadId: task.childThreadId }),
      ...(task?.awaited === true && { awaited: true }),
    })) : null;
    const prs = [...new Set([...(Array.isArray(pullRequests) ? pullRequests : []), linkedPullRequest]
      .map((pr) => string(pr?.url)).filter(Boolean))];
    const flags = [];
    if (status === 'waiting' || blockedOnThreadWait === true) flags.push('waiting');
    if (failed.includes(status)) flags.push('failed-run');
    if (status === 'queued') flags.push('queued-run');
    if (settled === false && stopped.includes(status)) flags.push('unsettled-idle');
    if (active.includes(status) && clock - updated >= 7_200_000) flags.push('stale-run');
    if (tasks?.length) flags.push('background-task');
    if (count(pendingRequestCount) && pendingRequestCount > 0) flags.push('pending-request');
    if (!statuses.includes(status) || !Number.isFinite(updated) || tasks === null ||
        [settled, snoozed, blockedOnThreadWait].some((value) => bool(value) === null)) flags.push('activity-unknown');
    if (!Array.isArray(pullRequests)) flags.push('pr-links-unknown');

    return {
      threadId, link, ...(!link?.startsWith(`[${title}](`) && { title: string(title) }),
      status: string(status), updatedAt: string(updatedAt),
      settled: bool(settled), snoozed: bool(snoozed), blockedOnThreadWait: bool(blockedOnThreadWait),
      ...(string(snoozedUntil) && { snoozedUntil }),
      ...(count(pendingRequestCount) && { pendingRequestCount }),
      ...(tasks?.length && { tasks }), prs, flags,
    };
  }

  async function scan(host, environmentId, gap) {
    const result = { host, environmentId, coverage: 'unknown', total: null, nextCursor: null, gaps: [], threads: [] };
    if (gap) {
      result.gaps.push(gap);
      return result;
    }

    const seen = new Set();
    const gaps = new Set();
    let pages = 0;
    let countStable = true;
    while (pages < maxPages) {
      const cursor = result.nextCursor;
      const page = await read(listThreads, { environmentId, allProjects: true, includeSubagents: false, settled: false, limit: pageSize,
        ...(cursor !== null && { cursor }) });
      if (!Array.isArray(page?.threads)) {
        gaps.add(page === deadline ? 'deadline' : 'page-error');
        break;
      }

      if (!count(page.total)) {
        countStable = false;
        gaps.add('total-invalid');
      } else if (pages > 0 && result.total !== page.total) {
        countStable = false;
        gaps.add('inventory-changed');
      }
      result.total = countStable ? page.total : null;
      pages += 1;

      if (page.threads.length > pageSize) gaps.add('page-oversize');
      for (const row of page.threads.slice(0, pageSize)) {
        if (!string(row?.threadId)) {
          gaps.add('missing-thread-id');
          continue;
        }
        if (seen.has(row.threadId)) {
          gaps.add('duplicate-thread');
          continue;
        }
        seen.add(row.threadId);
        const thread = project(row);
        if (!thread.link) gaps.add('missing-link');
        result.threads.push(thread);
      }

      result.nextCursor = null;
      if (page.nextCursor === null) {
        if (countStable && seen.size !== result.total) gaps.add('total-mismatch');
        break;
      }
      if (!count(page.nextCursor) || page.nextCursor <= (cursor ?? 0) || !page.threads.length) {
        gaps.add('cursor-invalid');
        break;
      }
      result.nextCursor = page.nextCursor;
      if (pages === maxPages) gaps.add('page-limit');
    }

    result.gaps = [...gaps];
    if (pages) result.coverage = gaps.size ? 'partial' : 'complete';
    return result;
  }

  try {
    const discovery = await read(listLinks, {});
    const localId = string(discovery?.environmentId);
    const links = Array.isArray(discovery?.links) ? discovery.links : [];
    return await Promise.all(hosts.map((host) => {
      if (discovery === deadline) return scan(host, null, 'deadline');
      if (host === localHost) return scan(host, localId, localId ? null : 'local-identity-unknown');
      const matches = links.filter((link) => link?.label === host);
      const id = matches.length === 1 ? string(matches[0].environmentId) : null;
      if (matches.length > 1 || (id && (id === localId || links.some((link) =>
        link?.label !== host && link?.environmentId === id)))) return scan(host, null, 'link-ambiguous');
      if (!id) return scan(host, null, 'link-unknown');
      const status = matches[0].status;
      if (status === 'reachable') return scan(host, id, null);
      return scan(host, id, ['unreachable', 'expired'].includes(status) ? status : 'link-status-unknown');
    }));
  } finally {
    clearTimeout(timer);
  }
}
