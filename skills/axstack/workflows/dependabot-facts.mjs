import { githubObject, githubPages } from './dependabot-pages.mjs';
import { changedRefs, isSha, pinFacts } from './dependabot-pins.mjs';

export const repository = 'axatbhardwaj/axstack';
const root = 'repos/' + repository;
const terms = ['author', 'branch', 'paths', 'claims', 'releaseTags', 'pins', 'ci', 'checks', 'head'];
export const numberId = (value) => Number.isSafeInteger(value) && value > 0;
const inside = (value) => typeof value === 'string' && value.startsWith('.github/workflows/') &&
  value.split('/').every((part) => part && part !== '.' && part !== '..' && !/[\\\0]/.test(part));
const status = (value) => value ? 'pass' : 'fail';


async function ciFacts(request, head) {
  const id = (item) => numberId(item?.id) ? item.id : null;
  const [runs, checks, statuses] = await Promise.all([
    githubPages(request, root + '/actions/workflows/ci.yml/runs', { head_sha: head }, 'workflow_runs', id),
    githubPages(request, `${root}/commits/${head}/check-runs`, { filter: 'all' }, 'check_runs', id),
    githubPages(request, `${root}/commits/${head}/statuses`, {}, null, id),
  ]);
  const ci = runs && runs.every((run) => run.head_sha === head && run.name === 'ci') ? status(runs.length) : 'unknown';
  const known = checks && statuses && checks.every((item) => item.head_sha === head &&
    typeof item.status === 'string' && (item.status !== 'completed' || typeof item.conclusion === 'string')) &&
    statuses.every((item) => typeof item.state === 'string');
  const green = known && (checks.length + statuses.length) > 0 &&
    checks.every((item) => item.status === 'completed' && item.conclusion === 'success') &&
    statuses.every((item) => item.state === 'success');
  return { ci, checks: known ? status(green) : 'unknown' };
}

async function workflowFiles(request, parseYaml, pr, files) {
  const base = pr.base?.sha;
  const head = pr.head.sha;
  if (!isSha(base)) return null;
  const comparison = await githubObject(request, `${root}/compare/${base}...${head}`);
  const ancestor = comparison?.merge_base_commit?.sha;
  if (!isSha(ancestor)) return null;
  return changedRefs(files, async (file, side) => {
    const path = file.split('/').map(encodeURIComponent).join('/');
    const content = await githubObject(request, `${root}/contents/${path}?ref=${side === 'base' ? ancestor : head}`);
    const expected = side === 'head' ? files.find(({ filename }) => filename === file)?.sha : null;
    if (content?.type !== 'file' || content.encoding !== 'base64' || !isSha(content.sha) ||
        (side === 'head' && content.sha !== expected) || typeof content.content !== 'string') return null;
    try {
      const bytes = Uint8Array.from(atob(content.content.replace(/\s/g, '')), (char) => char.charCodeAt(0));
      return await parseYaml(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      return null;
    }
  });
}

async function pullFacts(request, parseYaml, listed) {
  const { number, head: { sha: head } } = listed;
  const facts = Object.fromEntries(terms.map((term) => [term, 'unknown']));
  const result = { number, head, facts };
  const endpoint = `${root}/pulls/${number}`;
  const pr = await githubObject(request, endpoint);
  if (!pr || pr.number !== number || pr.base?.repo?.full_name !== repository ||
      typeof pr.state !== 'string' || !isSha(pr.head?.sha)) return result;
  facts.head = status(pr.state === 'open' && pr.head.sha === head);
  if (isSha(pr.base?.sha)) result.base = pr.base.sha;
  if (typeof pr.user?.login === 'string') facts.author = status(pr.user.login === 'dependabot[bot]');
  if (typeof pr.head.ref === 'string') facts.branch = status(/^dependabot\/github_actions\/.+/.test(pr.head.ref));
  if ([facts.author, facts.branch, facts.head].some((term) => term !== 'pass')) return result;

  const files = await githubPages(request, endpoint + '/files', {}, null, (row) => row?.filename);
  if (files?.length && files.length === pr.changed_files) {
    const hasCompleteNames = files.every((row) => typeof row.filename === 'string' && typeof row.status === 'string' &&
      (row.status !== 'renamed' || typeof row.previous_filename === 'string'));
    if (hasCompleteNames) {
      facts.paths = status(files.every((row) => inside(row.filename) &&
        (!Object.hasOwn(row, 'previous_filename') || inside(row.previous_filename))));
    }
  }
  if (facts.paths !== 'pass') return result;

  const commits = await githubPages(request, endpoint + '/commits', {}, null, (row) => isSha(row?.sha) ? row.sha : null);
  const changed = await workflowFiles(request, parseYaml, pr, files);
  if (changed && commits?.length && commits.length === pr.commits && commits.at(-1).sha === head &&
      commits.every((row) => typeof row.commit?.message === 'string') && typeof pr.title === 'string' &&
      (pr.body === null || typeof pr.body === 'string')) {
    Object.assign(facts, await pinFacts(request, changed, [pr.title, pr.body ?? '', ...commits.map((row) => row.commit.message)]));
  }
  Object.assign(facts, await ciFacts(request, head));
  const current = await githubObject(request, endpoint);
  if (current?.number !== number || !isSha(current.head?.sha) || !isSha(current.base?.sha) ||
      current.base?.repo?.full_name !== repository || typeof current.state !== 'string') {
    facts.head = 'unknown';
  } else {
    facts.head = status(current.state === 'open' && current.head.sha === head &&
      current.head.ref === pr.head.ref && current.base.sha === pr.base.sha &&
      current.title === pr.title && current.body === pr.body && current.user?.login === pr.user?.login);
  }
  return result;
}

export async function scanPulls(request, parseYaml = (source) => Bun.YAML.parse(source)) {
  const safeRequest = async (path) => {
    try {
      return await request(path);
    } catch {
      return null;
    }
  };
  const listed = await githubPages(safeRequest, root + '/pulls', { state: 'open' }, null,
    (row) => numberId(row?.number) && isSha(row.head?.sha) && row.state === 'open' ? row.number : null);
  if (!listed) return { discovery: 'unknown', pulls: [] };
  const pulls = [];
  for (const row of listed) pulls.push(await pullFacts(safeRequest, parseYaml, row));
  return { discovery: 'pass', pulls };
}
