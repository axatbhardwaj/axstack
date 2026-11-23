const HELP = `Nightly PR triage recipe: bun --no-env-file pr-triage-collect.js OWNER/REPO [OWNER/REPO ...]
  --help  Print this help without I/O beyond stdout.

Read-only: starts gh subprocesses in / and queries github.com with existing gh credentials.
Writes one compact JSON observation to stdout; no files, persistent state, or forge changes.
Paginate own open PR inventory and read details in batches of eight with at most three repositories
in flight. Request budgets are 10 seconds per call, 30 per repository and 90 overall.
Subprocess output is capped at 512 KiB per request.
CI and review decisions are GitHub aggregates. NONE means the pinned head has no reported rollup;
NO_DECISION means GitHub reports no aggregate review decision. Neither grants merge authority.
Review threads beyond the first 100 make the count UNKNOWN. At most two sample links are included.
Staleness uses GitHub updatedAt and a seven-day threshold. Rank actions in the pass thread.
Exit 0: complete observation. Exit 1: invalid input. Exit 2: incomplete, retain observed facts.`;

const UNKNOWN = 'UNKNOWN';
const DAY = 86_400_000;
const CI = ['ERROR', 'EXPECTED', 'FAILURE', 'PENDING', 'SUCCESS'];
const REVIEWS = ['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED'];
const REPO = /^(?!\.{1,2}\/)[A-Za-z0-9_.-]+\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
const fold = (value) => typeof value === 'string' ? value.toLowerCase() : '';
const validNumber = (value) => Number.isSafeInteger(value) && value > 0;
const gap = (reason) => ({ status: 'unknown', reason });

async function gh(args, deadline) {
  const timeout = Math.min(10_000, Math.ceil(deadline - performance.now()));
  if (timeout <= 0) return null;
  try {
    const child = Bun.spawn(['gh', 'api', '--hostname', 'github.com', ...args], {
      cwd: '/', env: { ...process.env, GH_PROMPT_DISABLED: '1' },
      stdin: 'ignore', stdout: 'pipe', stderr: 'ignore', timeout, maxBuffer: 512 * 1024, killSignal: 'SIGKILL',
    });
    const [text, exit] = await Promise.all([child.stdout.text(), child.exited]);
    return { text, exit };
  } catch {
    return null;
  }
}

async function query(repo, fields, deadline) {
  const [owner, name] = repo.split('/').map((segment) => JSON.stringify(segment));
  const document = `query { repository(owner: ${owner}, name: ${name}) { nameWithOwner ${fields} } }`;
  const result = await gh(['graphql', '-f', `query=${document}`], deadline);
  try {
    const response = JSON.parse(result?.text ?? '');
    const errors = response.errors ?? [];
    const data = response.data?.repository;
    if (!Array.isArray(errors) || errors.some((error) => !Array.isArray(error?.path) || !error.path.length) ||
        (result.exit !== 0 && !errors.length) || fold(data?.nameWithOwner) !== fold(repo) ||
        affected(errors, ['repository', 'nameWithOwner'])) return null;
    return { data, errors };
  } catch {
    return null;
  }
}

// A GraphQL error blocks its field and descendants, or the parent's aggregate.
const affected = (errors, path) => errors.some(({ path: source }) =>
  path.slice(0, source.length).every((part, i) => part === source[i]));

async function inventory(repo, login, deadline) {
  const own = [];
  const seen = new Set();
  const cursors = new Set();
  const path = ['repository', 'pullRequests'];
  let cursor = null;
  let total;
  let coverage = { status: 'pass' };
  do {
    const after = cursor === null ? '' : `, after: ${JSON.stringify(cursor)}`;
    const page = await query(repo, `pullRequests(states: OPEN, first: 50${after}, orderBy: {field: CREATED_AT, direction: ASC}) {
      totalCount nodes { number author { login } } pageInfo { hasNextPage endCursor }
    }`, deadline);
    const listing = page?.data.pullRequests;
    if (!Array.isArray(listing?.nodes)) return { own, coverage: gap('inventory page unavailable') };
    if (affected(page.errors, path)) coverage = gap('partial inventory response');
    if (total === undefined) total = listing.totalCount;
    if (!Number.isSafeInteger(total) || total < 0 || total !== listing.totalCount) coverage = gap('inconsistent inventory count');
    for (const [i, pr] of listing.nodes.entries()) {
      if (!validNumber(pr?.number) || !fold(pr?.author?.login) || seen.has(pr.number) ||
          affected(page.errors, [...path, 'nodes', i])) {
        coverage = gap('incomplete or duplicate inventory row');
        continue;
      }
      seen.add(pr.number);
      if (fold(pr.author.login) === login) own.push(pr.number);
    }
    const pageInfo = listing.pageInfo;
    if (affected(page.errors, [...path, 'pageInfo']) || typeof pageInfo?.hasNextPage !== 'boolean') {
      return { own, coverage: gap('pagination state unavailable') };
    }
    if (pageInfo.hasNextPage) {
      cursor = pageInfo.endCursor;
      if (typeof cursor !== 'string' || !cursor || cursors.has(cursor)) return { own, coverage: gap('invalid or repeated cursor') };
      cursors.add(cursor);
    } else cursor = null;
  } while (cursor !== null);
  return { own, coverage: seen.size === total ? coverage : gap('inventory row count mismatch') };
}

const detailFields = `number state author { login } headRefOid updatedAt isDraft mergeable reviewDecision
  commits(last: 1) { nodes { commit { oid statusCheckRollup { state } } } }
  reviewThreads(first: 100) { totalCount pageInfo { hasNextPage } nodes { isResolved comments(first: 1) { nodes { url } } } }`;

function threads(connection, url) {
  const nodes = connection?.nodes;
  if (connection?.pageInfo?.hasNextPage !== false || !Array.isArray(nodes) ||
      nodes.length !== connection.totalCount ||
      nodes.some((node) => typeof node?.isResolved !== 'boolean')) return { unresolvedThreads: UNKNOWN };
  const unresolved = nodes.filter((node) => !node.isResolved);
  const links = new Set();
  for (const thread of unresolved) {
    const link = thread.comments?.nodes?.[0]?.url;
    const anchor = typeof link === 'string' && link.match(/#discussion_r\d+$/)?.[0];
    if (anchor && fold(link) === fold(`${url}${anchor}`)) links.add(`${url}${anchor}`);
    if (links.size === 2) break;
  }
  return { unresolvedThreads: unresolved.length, ...(links.size ? { threadLinks: [...links] } : {}) };
}

function summarize(repo, number, response, login) {
  const url = `https://github.com/${repo}/pull/${number}`;
  const alias = `pr${number}`;
  const pr = response?.data[alias];
  const reliable = (field) => !affected(response.errors, ['repository', alias, field]);
  const known = pr?.number === number && pr.state === 'OPEN' && fold(pr.author?.login) === login &&
    ['number', 'state', 'author'].every(reliable);
  const field = (name) => known && reliable(name) ? pr[name] : undefined;
  const oid = field('headRefOid');
  const head = typeof oid === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(oid) ? oid : UNKNOWN;
  const commits = field('commits')?.nodes;
  const commit = commits?.length === 1 ? commits[0]?.commit : null;
  const rollup = head !== UNKNOWN && commit?.oid === head ? commit.statusCheckRollup : undefined;
  const ci = rollup === null ? 'NONE' : CI.includes(rollup?.state) ? rollup.state : UNKNOWN;
  const decision = field('reviewDecision');
  const reviews = decision === null ? 'NO_DECISION' : REVIEWS.includes(decision) ? decision : UNKNOWN;
  const merge = field('mergeable');
  const mergeable = ['MERGEABLE', 'CONFLICTING'].includes(merge) ? merge : UNKNOWN;
  const updated = field('updatedAt');
  const age = typeof updated === 'string' && /^\d{4}-\d\d-\d\dT.*Z$/.test(updated) ? Date.now() - Date.parse(updated) : NaN;
  const stale = age >= 0 ? age >= 7 * DAY : UNKNOWN;
  const draft = field('isDraft');
  return { number, url, head, ci, reviews, mergeable, ...threads(field('reviewThreads'), url),
    updatedAt: stale === UNKNOWN ? UNKNOWN : updated, stale, draft: typeof draft === 'boolean' ? draft : UNKNOWN,
    ...(['ERROR', 'FAILURE', 'PENDING', 'EXPECTED'].includes(ci) ? { checksUrl: `${url}/checks` } : {}),
  };
}

async function details(repo, numbers, login, deadline) {
  const prs = [];
  for (let i = 0; i < numbers.length; i += 8) {
    const batch = numbers.slice(i, i + 8);
    const fields = batch.map((number) => `pr${number}: pullRequest(number: ${number}) { ${detailFields} }`).join('\n');
    const response = await query(repo, fields, deadline);
    for (const number of batch) prs.push(summarize(repo, number, response, login));
  }
  return prs;
}

async function inParallel(items, operation) {
  let index = 0;
  const result = [];
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      result[i] = await operation(items[i]);
    }
  }));
  return result;
}

async function collect(repos) {
  const deadline = performance.now() + 90_000;
  const identity = await gh(['user', '--jq', '.login'], deadline);
  const login = identity?.text.trim();
  if (identity?.exit !== 0 || !/^[A-Za-z0-9-]+$/.test(login ?? '')) return {
    login: UNKNOWN, repositories: repos.map((repo) => ({ repo, coverage: gap('forge identity unavailable'), prs: [] })),
  };
  const repositories = await inParallel(repos, async (repo) => {
    const repoDeadline = Math.min(deadline, performance.now() + 30_000);
    const { own, coverage } = await inventory(repo, fold(login), repoDeadline);
    return { repo, coverage, prs: await details(repo, own, fold(login), repoDeadline) };
  });
  return { login, repositories };
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') console.log(HELP);
else if (!args.length || args.some((repo) => !REPO.test(repo)) || new Set(args.map(fold)).size !== args.length) {
  console.error('Expected a unique list of GitHub OWNER/REPO arguments. See --help.');
  process.exitCode = 1;
} else {
  const report = await collect(args);
  console.log(JSON.stringify(report));
  if (report.repositories.some(({ coverage, prs }) => coverage.status === 'unknown' ||
      prs.some((pr) => Object.values(pr).includes(UNKNOWN)))) process.exitCode = 2;
}
