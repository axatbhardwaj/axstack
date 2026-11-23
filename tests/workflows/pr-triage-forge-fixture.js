import { appendFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const mode = process.env.TRIAGE_TEST_MODE;
const log = (call) => appendFileSync(process.env.TRIAGE_TEST_TRACE, `${JSON.stringify(call)}\n`);
const reply = (data, errors, exit = 0) => {
  console.log(JSON.stringify({ data: { repository: data }, errors, ignored: 'UNTRUSTED_RAW_FORGE_TEXT'.repeat(2_000) }));
  process.exitCode = exit;
};
const connection = (nodes, next = null) => ({
  nodes, totalCount: nodes.length + Number(next !== null), pageInfo: { hasNextPage: next !== null, endCursor: next },
});
const inventory = (number, login = 'Axat') => ({ number, author: { login } });
const head = 'a'.repeat(40);
const commentLink = (repo, number, id) => `https://github.com/${repo}/pull/${number}#discussion_r${id}`;

function detail(repo, number) {
  const week = 604_800_000;
  const age = { 1: week + 60_000, 2: week - 60_000 }[number] ?? 86_400_000;
  const updatedAt = new Date(Date.now() - age).toISOString();
  const pr = {
    ...inventory(number, number === 6 ? 'other' : 'Axat'),
    state: 'OPEN', headRefOid: head, updatedAt: number === 5 ? 'tomorrow' : updatedAt,
    isDraft: number === 3, mergeable: number === 1 ? 'CONFLICTING' : number === 3 ? 'UNKNOWN' : 'MERGEABLE',
    reviewDecision: number === 1 ? 'CHANGES_REQUESTED' : number === 3 ? null : 'APPROVED',
    reviewThreads: connection(number === 1 ? [
      { isResolved: true, comments: { nodes: [{ url: commentLink(repo, number, 10) }] } },
      ...[11, 12, 13].map((id) => ({ isResolved: false, comments: { nodes: [{ url: commentLink(repo, number, id) }] } })),
    ] : [], number === 2 ? 'thread-next' : null),
    commits: { nodes: [{ commit: {
      oid: number === 4 ? 'b'.repeat(40) : head,
      statusCheckRollup: number === 3 ? null : { state: { 1: 'FAILURE', 2: 'PENDING', 5: 'NEW_ENUM' }[number] ?? 'SUCCESS' },
    } }] },
  };
  return number === 15 ? null : pr;
}

if (argv.includes('user')) {
  log({ login: true });
  if (mode === 'no-login') process.exitCode = 1;
  else console.log('axat');
} else {
  const query = argv.find((arg) => arg.startsWith('query=')) ?? '';
  const [, owner, name] = /repository\(owner:\s*"([^"]+)",\s*name:\s*"([^"]+)"\)/.exec(query) ?? [];
  const repo = `${owner}/${name}`;
  const cursor = /after:\s*"([^"]+)"/.exec(query)?.[1] ?? null;
  const raw = /\b(?:body|title|message|description)\b/.test(query);
  const selections = [...query.matchAll(/(pr\d+):\s*pullRequest\(number:\s*(\d+)\)/g)];
  if (selections.length) {
    log({ repo, details: selections.map(([, , number]) => Number(number)), raw });
    const errors = selections.filter(([, , number]) => number === '2').map(([, alias]) => ({
      path: ['repository', alias, 'reviewDecision'], message: 'UNTRUSTED_RAW_FORGE_TEXT',
    }));
    reply({ nameWithOwner: repo, ...Object.fromEntries(selections.map(([, alias, number]) => [alias, detail(repo, Number(number))])) },
      errors, errors.length ? 1 : 0);
  } else {
    log({ repo, cursor, raw });
    if (repo === 'two/project' || cursor === 'partial-next') reply(null, [{ message: 'UNTRUSTED_RAW_FORGE_TEXT' }], 1);
    else if (repo === 'one/project') {
      const list = cursor ? [7, 8, 9, 10, 11, 12].map((number) => inventory(number)) :
        [inventory(1), inventory(99, 'peer'), ...[2, 3, 4, 5, 6].map((number) => inventory(number))];
      reply({ nameWithOwner: repo, pullRequests: { ...connection(list, cursor ? null : 'one-next'), totalCount: 13 } });
    } else {
      const list = { 'three/project': [inventory(15)], 'four/project': [inventory(16)] }[repo] ?? [];
      const next = repo === 'four/project' ? 'partial-next' : null;
      reply({ nameWithOwner: repo, pullRequests: { ...connection(list, next), totalCount: list.length + Number(Boolean(next)) } });
    }
  }
}
