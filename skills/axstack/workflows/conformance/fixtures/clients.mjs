// These definitions run only on the suite's isolated T3 server.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { workflow, agent, step, runs, pullRequests, PullRequest } = T3;
const root = process.env.AXSTACK_CONFORMANCE_ROOT;
const binding = JSON.parse(readFileSync(root + '/client-binding.json', 'utf8'));
const runtime = binding.runtime;
const t3 = (args) => run([runtime.t3, ...args.slice(0, 2), '--base-dir', runtime.base, ...args.slice(2)]);
const json = (receipt) => receipt.exit === 0 ? JSON.parse(receipt.out) : null;

function run([bin, ...args]) {
  const started = performance.now();
  try {
    const out = execFileSync(bin, args, { cwd: runtime.project, timeout: 15_000, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 512 * 1024 }).trim();
    return { exit: 0, out, ms: Math.round(performance.now() - started) };
  } catch (error) {
    return { exit: error.status ?? null, ms: Math.round(performance.now() - started),
      refused: /head branch was modified|head sha.*(?:match|changed)/i.test(String(error.stderr ?? '')) };
  }
}

const name = 'ax-conf-wake';
const model = Schema.Struct({
  instanceId: Schema.String, model: Schema.String,
  options: Schema.optional(Schema.Array(Schema.Struct({ id: Schema.String, value: Schema.String }))),
});
export const typed = workflow('ax-conf-typed', {
  version: 1, resumeAfter: [], payload: Schema.Struct({ model, worktree: Schema.String, recover: Schema.Boolean }),
}, (input) => agent('typed-reply', {
  project: runtime.project, title: 'Axstack conformance typed result', model: input.model,
  runtimeMode: 'full-access', workspace: { type: 'existing_worktree', worktreePath: input.worktree },
  returns: Schema.Struct({ marker: Schema.Literal('AXSTACK-CONFORMANCE') }),
  brief: (input.recover ? 'Run sleep 30 in the foreground before submitting the result. ' : '') +
    'Keep files unchanged. Submit exactly {"marker":"AXSTACK-CONFORMANCE"} using t3_submit_output, then end the turn.',
}));

export const wake = workflow(name, {
  version: 1, resumeAfter: [], payload: Schema.Struct({
    key: Schema.String, route: Schema.Literals(['agent', 'cli']), thread: Schema.String,
    expected: Schema.optional(model),
  }),
}, ({ key, route, thread, expected }) => Effect.gen(function* () {
  const receipt = yield* step('binding', { returns: Schema.Json }, Effect.gen(function* () {
    const selected = (yield* runs({ workflow: name, keyPrefix: key })).filter((run) => run.key === key);
    // The runtime may omit key from run listings; the caller supplies a unique prefix.
    const matches = selected.length ? selected : yield* runs({ workflow: name, keyPrefix: key });
    if (matches.length !== 1) throw new Error('expected one conformance run');
    const focus = expected ? json(t3(['thread', 'show', thread, '--messages', '1', '--json']))?.thread : null;
    if (expected && (focus?.providerInstanceId !== expected.instanceId || focus?.model !== expected.model)) {
      return { decision: 'hold' };
    }
    const marker = `AXSTACK-WAKE ${name}@1 run ${matches[0].id}`;
    return { decision: 'proceed', text: marker + '\nReply with the exact marker and any T3 sender label visible on this message.' };
  }));
  if (receipt.decision === 'hold') return receipt;
  if (route === 'agent') return yield* agent.try('agent-wake', { thread: { threadId: thread }, brief: receipt.text });
  return yield* step('cli-wake', { returns: Schema.Json }, Effect.sync(() => {
    const command = t3(['thread', 'send', thread, receipt.text, '--json']);
    return { exit: command.exit, delivery: json(command)?.delivery };
  }));
}));

function paginated(endpoint) {
  const result = run(['gh', 'api', '--paginate', '--slurp', endpoint]);
  const pages = json(result);
  return Array.isArray(pages) && pages.every(Array.isArray) ? pages.flat() : null;
}

function snapshot(repo, number) {
  return json(run(['gh', 'api', `repos/${repo}/pulls/${number}`]));
}

if (binding.forge?.repo) {
  // Registration is isolated. Configured scratch-project events are observations.
  var opened = workflow('ax-conf-opened', {
    version: 1, payload: PullRequest, triggers: [pullRequests.opened({ project: runtime.project })],
  }, (pr) => Effect.succeed({ number: pr.number }));
}
export { opened };

export const forge = workflow('ax-conf-forge', { version: 1, payload: Schema.Null }, () =>
  step('forge-facts', { returns: Schema.Json }, Effect.sync(() => {
    const { repo, absentRepo, cases } = binding.forge;
    const pulls = (name) => paginated(`repos/${name}/pulls?state=open&per_page=100`);
    const visible = pulls(repo);
    const missing = pulls(absentRepo);
    const facts = {};
    for (const [scenario, expected] of Object.entries(cases)) {
      const pr = snapshot(repo, expected.number);
      if (!pr || pr.state !== 'open') {
        facts[scenario] = null;
        continue;
      }
      const endpoint = `repos/${repo}/commits/${pr.head.sha}`;
      const checks = json(run(['gh', 'api', `${endpoint}/check-runs?per_page=100`]));
      const statuses = json(run(['gh', 'api', `${endpoint}/status?per_page=100`]));
      const comments = paginated(`repos/${repo}/pulls/${expected.number}/comments?per_page=100`);
      facts[scenario] = {
        base: pr.base.ref, head: pr.head.sha, status: statuses?.state,
        checks: checks?.total_count === checks?.check_runs?.length ? checks?.check_runs : null,
        statuses: statuses?.total_count === statuses?.statuses?.length ? statuses?.statuses : null,
        lateReview: comments?.some((comment) => Date.parse(comment.created_at) > Date.parse(expected.greenAt)),
      };
    }
    return { visible: visible !== null, missing: missing === null, combined: visible && missing ? 'complete' : 'unknown', facts };
  })));

export const processes = workflow('ax-conf-processes', { version: 1, payload: Schema.Null }, () =>
  step('processes-and-facts', { returns: Schema.Json }, Effect.sync(() => {
    const thread = readFileSync(root + '/owner-id', 'utf8');
    const { ssh, forge } = binding;
    const projects = [runtime.project, root + '/other-project'];
    const timed = {
      gh: run(['gh', 'api', `repos/${forge.repo}`]),
      git: run(['git', 'worktree', 'list', '--porcelain']),
      ssh: run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UpdateHostKeys=no', '-i', ssh.identity, '-o', 'UserKnownHostsFile=' + ssh.knownHosts, '--', ssh.host, 'hostname']),
      helper: run([runtime.bun, root + '/process-helper.mjs', root + '/owner-id']),
      threadShow: t3(['thread', 'show', thread, '--messages', '1', '--json']),
    };
    const inventory = projects.map((project) => t3(['thread', 'list', '--project', project, '--json']));
    return {
      exits: Object.fromEntries(Object.entries(timed).map(([key, value]) => [key, value.exit])),
      ms: [...Object.values(timed), ...inventory].map((value) => value.ms),
      coverage: inventory.every((entry) => entry.exit === 0), projectSetCoverage: 'unknown',
    };
  })));

export const pin = workflow('ax-conf-pin', { version: 1, payload: Schema.Null }, () =>
  step('head-pin-refusal', { returns: Schema.Json }, Effect.sync(() => {
    const { repo, cases } = binding.forge;
    const number = cases.failingStatus.number;
    const before = snapshot(repo, number);
    if (!before || before.state !== 'open' || before.merged || !/^[a-f0-9]{40}$/.test(before.head?.sha)) {
      return { refused: false };
    }
    const sentinel = Array.from(crypto.getRandomValues(new Uint8Array(20)),
      (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (sentinel === before.head.sha) return { refused: false };
    const attempt = run(['gh', 'pr', 'merge', String(number), '--repo', repo, '--merge', '--match-head-commit', sentinel]);
    const after = snapshot(repo, number);
    return { refused: attempt.exit !== 0 && attempt.refused && after?.state === 'open' && after.head.sha === before.head.sha };
  })));
