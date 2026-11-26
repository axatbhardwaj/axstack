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
    base: { repo: { full_name: 'axatbhardwaj/axstack' }, sha: base },
    title: input.title ?? 'Bump actions/checkout from 6 to 7.0.0',
    body: input.body ?? null,
    changed_files: 1,
    commits: 1,
  };
  const path = input.filename ?? file;
  let reads = 0;
  const files = [
    {
      filename: path,
      sha: blob,
      status: input.oldFilename ? 'renamed' : 'modified',
      ...(input.oldFilename ? { previous_filename: input.oldFilename } : {}),
    },
  ];
  const workflow = (ref) => `jobs:
  lint:
    steps:
      - uses: actions/checkout@${ref}
`;
  const checks = input.checks ?? [
    {
      id: 1,
      head_sha: selected,
      status: input.checkStatus ?? 'completed',
      conclusion: input.conclusion ?? 'success',
    },
  ];
  const runs = input.runs ?? [{ id: 1, name: 'ci', head_sha: input.runHead ?? selected }];
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
        return ok([{ sha: selected, commit: { message: input.commit ?? 'Update action' } }]);
      case repo + '/compare/' + base + '...' + selected:
        return ok({ merge_base_commit: { sha: mergeBase } });
      case repo + '/contents/' + path:
        return ok({
          type: 'file',
          encoding: 'base64',
          sha: blob,
          content: btoa(workflow(parameters.get('ref') === mergeBase ? 'v6' : (input.pin ?? release))),
        });
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
