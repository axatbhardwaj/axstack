// These definitions run only on the suite's isolated T3 server.
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { workflow, agent, step, runs, pullRequests, PullRequest } = T3;
const root = process.env.AXSTACK_CONFORMANCE_ROOT;
const binding = JSON.parse(readFileSync(root + '/client-binding.json', 'utf8'));
const runtime = binding.runtime;
const t3 = (args) => run([runtime.t3, ...args.slice(0, 2), '--base-dir', runtime.base, ...args.slice(2)]);
function json(receipt) {
  if (receipt.exit !== 0) return null;
  try {
    return JSON.parse(receipt.out);
  } catch {
    return null;
  }
}

function run([bin, ...args], maxBuffer = 512 * 1024) {
  const started = performance.now();
  // The T3 CLI calls back into this server, which must stay responsive.
  return new Promise((resolve) => {
    const child = execFile(bin, args, { cwd: runtime.project, timeout: 15_000, encoding: 'utf8', maxBuffer },
      (error, stdout, stderr) => {
        const ms = Math.round(performance.now() - started);
        resolve(error ? {
          exit: typeof error.code === 'number' ? error.code : null, ms,
          refused: /head branch was modified|head sha.*(?:match|changed)/i.test(stderr),
        } : { exit: 0, out: stdout.trim(), ms });
      });
    child.stdin?.end();
  });
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
    const focus = expected ? json(yield* Effect.promise(() => t3(['thread', 'show', thread, '--messages', '1', '--json'])))?.thread : null;
    if (expected && (focus?.providerInstanceId !== expected.instanceId || focus?.model !== expected.model)) {
      return { decision: 'hold' };
    }
    const marker = `AXSTACK-WAKE ${name}@1 run ${matches[0].id}`;
    return { decision: 'proceed', text: marker + '\nReply with the exact marker and any T3 sender label visible on this message.' };
  }));
  if (receipt.decision === 'hold') return receipt;
  if (route === 'agent') return yield* agent.try('agent-wake', { thread: { threadId: thread }, brief: receipt.text });
  return yield* step('cli-wake', { returns: Schema.Json }, Effect.promise(async () => {
    const command = await t3(['thread', 'send', thread, receipt.text, '--json']);
    return { exit: command.exit, delivery: json(command)?.delivery ?? null };
  }));
}));

async function paginated(endpoint) {
  const items = [];
  const limit = 20;
  for (let page = 1; page <= limit; page++) {
    const receipt = await run(['gh', 'api', '--include', endpoint + '&page=' + page], 4 * 1024 * 1024);
    if (receipt.exit !== 0) return { coverage: 'unknown', page, reason: 'GitHub CLI request failed' };
    const separator = /\r?\n\r?\n/.exec(receipt.out);
    const headers = separator ? receipt.out.slice(0, separator.index) : '';
    const rows = separator ? json({ exit: 0, out: receipt.out.slice(separator.index + separator[0].length) }) : null;
    if (!/^HTTP\/\d(?:\.\d)? 200\b/.test(headers) || !Array.isArray(rows) || (page > 1 && !rows.length)) {
      return { coverage: 'unknown', page, reason: 'missing or invalid GitHub API page' };
    }
    items.push(...rows);
    const links = headers.split(/\r?\n/).filter((line) => /^link:/i.test(line)).join(',');
    if (!/\brel="next"/i.test(links)) return { coverage: 'complete', items };
    const next = links.match(/<([^>]+)>;\s*rel="next"/i)?.[1];
    const nextPage = next && URL.canParse(next) ? new URL(next).searchParams.get('page') : null;
    if (nextPage !== String(page + 1)) return { coverage: 'unknown', page, reason: 'invalid GitHub API next page' };
  }
  return { coverage: 'unknown', page: limit + 1, reason: 'GitHub API page limit reached' };
}

async function snapshot(repo, number) {
  return json(await run(['gh', 'api', `repos/${repo}/pulls/${number}`]));
}

function completeList(response, key) {
  const items = response?.[key];
  return Array.isArray(items) && response.total_count === items.length ? items : null;
}

function discovery(receipt) {
  return receipt.coverage === 'complete' ? { coverage: receipt.coverage, count: receipt.items.length } : receipt;
}

if (binding.forge?.repo) {
  // Registration is isolated. Configured scratch-project events are observations.
  var opened = workflow('ax-conf-opened', {
    version: 1, payload: PullRequest, triggers: [pullRequests.opened({ project: runtime.project })],
  }, (pr) => Effect.succeed({ number: pr.number }));
}
export { opened };

export const forge = workflow('ax-conf-forge', { version: 1, payload: Schema.Null }, () =>
  step('forge-facts', { returns: Schema.Json }, Effect.promise(async () => {
    const { repo, absentRepo, cases } = binding.forge;
    const pulls = (name) => paginated(`repos/${name}/pulls?state=open&per_page=100`);
    const observed = await pulls(repo);
    const absent = await pulls(absentRepo);
    const facts = {};
    for (const [scenario, expected] of Object.entries(cases)) {
      const pr = await snapshot(repo, expected.number);
      if (!pr || pr.state !== 'open') {
        facts[scenario] = { unknown: ['pull'] };
        continue;
      }
      const head = typeof pr.head?.sha === 'string' && pr.head.sha ? pr.head.sha : null;
      const base = typeof pr.base?.ref === 'string' && pr.base.ref ? pr.base.ref : null;
      const unknown = [];
      if (head === null) unknown.push('head');
      if (base === null) unknown.push('base');
      if (unknown.length) {
        facts[scenario] = { head, base, unknown };
        continue;
      }
      const endpoint = `repos/${repo}/commits/${head}`;
      const checks = json(await run(['gh', 'api', `${endpoint}/check-runs?per_page=100`]));
      const statuses = json(await run(['gh', 'api', `${endpoint}/status?per_page=100`]));
      const factsForPull = {
        base, head, status: typeof statuses?.state === 'string' ? statuses.state : 'unknown',
        checks: completeList(checks, 'check_runs'), statuses: completeList(statuses, 'statuses'), lateReview: null, unknown,
      };
      if (factsForPull.status === 'unknown') unknown.push('status');
      if (factsForPull.checks === null) unknown.push('checks');
      if (factsForPull.statuses === null) unknown.push('statuses');
      if (scenario === 'lateReview') {
        const greenAt = Date.parse(expected.greenAt);
        const comments = await paginated(`repos/${repo}/pulls/${expected.number}/comments?per_page=100`);
        const dates = comments.items?.map((comment) => Date.parse(comment?.created_at));
        if (Number.isFinite(greenAt) && dates?.every(Number.isFinite)) {
          factsForPull.lateReview = dates.some((createdAt) => createdAt > greenAt);
        } else {
          unknown.push('lateReview');
        }
      }
      facts[scenario] = factsForPull;
    }
    const visible = observed.coverage === 'complete';
    const missing = absent.coverage === 'unknown';
    return { visible, missing, combined: visible && !missing ? 'complete' : 'unknown',
      discovery: { [repo]: discovery(observed), [absentRepo]: discovery(absent) }, facts };
  })));

export const processes = workflow('ax-conf-processes', { version: 1, payload: Schema.Null }, () =>
  step('processes-and-facts', { returns: Schema.Json }, Effect.promise(async () => {
    const thread = readFileSync(root + '/owner-id', 'utf8');
    const { ssh, forge } = binding;
    const projects = [runtime.project, root + '/other-project'];
    const timed = {
      gh: await run(['gh', 'api', `repos/${forge.repo}`]),
      git: await run(['git', 'worktree', 'list', '--porcelain']),
      ssh: await run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UpdateHostKeys=no', '-i', ssh.identity, '-o', 'UserKnownHostsFile=' + ssh.knownHosts, '--', ssh.host, 'hostname']),
      helper: await run([runtime.bun, root + '/process-helper.mjs', root + '/owner-id']),
      threadShow: await t3(['thread', 'show', thread, '--messages', '1', '--json']),
    };
    const inventory = await Promise.all(projects.map((project) => t3(['thread', 'list', '--project', project, '--json'])));
    return {
      exits: Object.fromEntries(Object.entries(timed).map(([key, value]) => [key, value.exit])),
      ms: [...Object.values(timed), ...inventory].map((value) => value.ms),
      coverage: inventory.every((entry) => entry.exit === 0), projectSetCoverage: 'unknown',
    };
  })));

export const pin = workflow('ax-conf-pin', { version: 1, payload: Schema.Null }, () =>
  step('head-pin-refusal', { returns: Schema.Json }, Effect.promise(async () => {
    const { repo, cases } = binding.forge;
    const number = cases.failingStatus.number;
    const before = await snapshot(repo, number);
    if (!before || before.state !== 'open' || before.merged || !/^[a-f0-9]{40}$/.test(before.head?.sha)) {
      return { refused: false };
    }
    const sentinel = Array.from(crypto.getRandomValues(new Uint8Array(20)),
      (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (sentinel === before.head.sha) return { refused: false };
    const attempt = await run(['gh', 'pr', 'merge', String(number), '--repo', repo, '--merge', '--match-head-commit', sentinel]);
    const after = await snapshot(repo, number);
    return { refused: attempt.exit !== 0 && attempt.refused && after?.state === 'open' && after.head?.sha === before.head.sha };
  })));
