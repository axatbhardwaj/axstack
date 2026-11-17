#!/usr/bin/env bun
import { readFileSync } from 'node:fs';

const HELP = `pr-fresh — review event observations (R2 fact mode)
Run from trusted cwd / with bun --no-env-file <installed-script> and explicit:
  --repo OWNER/NAME --pr N --head SHA --base SHA --base-ref NAME --phase admission|submission
  --repo, --pr    Expected repository and PR identity (also required with saved input).
  --head, --base  Pinned full commit SHAs; --base-ref pins the base branch identity.
  --phase        Select review.admission or review.submission in the policy artifact.
  --policy FILE  Default: installed ../references/schedule-policy.json (W2-1).
                 Supported version:1 review phase: {status:"known",headAgeThresholdSeconds:N,
                 clockSemantics:"head-commit-committed-date",pendingCheckTreatment:"defer"|"allow"}.
                 N is a nonnegative integer, inclusive. This clock is commit age, NOT push/settle age.
                 Unknown/unrecorded/unsupported policy stays unknown; no inferred defaults.
  --input FILE   Saved gh api graphql response; no network. Saved bytes prove no live freshness.
  --now ISO      Timezone-qualified comparison time; default current UTC.
  --help         Show flags, effects and limitations.
Without --input, one read-only gh api graphql query observes the PR and head checks.
No writes, persistent state, retries, dispatch, submission, merge, scheduling or authority.
API/permission/pagination gaps are unknown; unobserved checks never imply success.
pendingChecks passes iff no observed pending checks; checksSuccessful measures terminal checks.
The driver applies the recorded policy and discard/hold rules, before dispatch and submission.
Stdout: per-term pass/fail/unknown/n/a with evidence and counts only, no aggregate verdict.
Exit: 0 measured (including failed facts), 1 invalid CLI/error, 2 incomplete (unknown facts).
`;
const time = (s) => typeof s === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(s) ? Date.parse(s) : NaN;
const sha = (s) => typeof s === 'string' && /^[a-f0-9]{40}$/.test(s);
function options(argv) {
  const args = { '--policy': `${import.meta.dir}/../references/schedule-policy.json`, '--now': new Date().toISOString() };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    if (!['--repo', '--pr', '--head', '--base', '--base-ref', '--phase', '--policy', '--input', '--now'].includes(key) ||
        !value || value.startsWith('--') || seen.has(key)) throw Error(`invalid argument: ${key}`);
    args[key] = value;
    seen.add(key);
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(args['--repo'] ?? '') || !/^[1-9]\d*$/.test(args['--pr'] ?? '') ||
      !Number.isSafeInteger(Number(args['--pr'])) || !sha(args['--head']) || !sha(args['--base']) ||
      !args['--base-ref'] || !['admission', 'submission'].includes(args['--phase']) || !Number.isFinite(time(args['--now']))) {
    throw Error('expected repo, PR, full head/base SHAs, base-ref, phase and timezone-qualified now; see --help');
  }
  return args;
}
function observe(args) {
  if (args['--input']) return JSON.parse(readFileSync(args['--input'], 'utf8'));
  const [owner, name] = args['--repo'].split('/');
  const query = `query { repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}) {
    nameWithOwner pullRequest(number:${args['--pr']}) {
      number state isDraft merged headRefOid baseRefOid baseRefName
      commits(last:1) { nodes { commit { oid committedDate statusCheckRollup {
        contexts(first:100) { pageInfo { hasNextPage } nodes {
          __typename ... on CheckRun { name status conclusion } ... on StatusContext { context state }
        } }
      } } } }
    }
  } }`;
  const r = Bun.spawnSync(['gh', 'api', 'graphql', '-f', `query=${query}`], { cwd: '/', stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode !== 0) throw Error('gh api unavailable or failed');
  return JSON.parse(r.stdout.toString());
}
function report(args) {
  const terms = [];
  const add = (id, status, evidence) => terms.push({ id, status, evidence });
  let policy, policySha256 = null, response, observationError;
  try {
    const bytes = readFileSync(args['--policy']);
    policySha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
    policy = JSON.parse(bytes.toString());
  } catch { /* Unavailable policy does not erase independently observed PR facts. */ }
  const phase = policy?.review?.[args['--phase']];
  const knownPolicy = policy?.version === 1 && phase?.status === 'known' &&
    Number.isSafeInteger(phase.headAgeThresholdSeconds) && phase.headAgeThresholdSeconds >= 0 &&
    phase.clockSemantics === 'head-commit-committed-date' && ['defer', 'allow'].includes(phase.pendingCheckTreatment);
  add('policy', knownPolicy ? 'pass' : 'unknown', { phase: args['--phase'], sha256: policySha256,
    recorded: phase ?? null, reason: knownPolicy ? 'supported recorded policy' : 'absent, malformed, unknown or unsupported policy' });
  try { response = observe(args); } catch { observationError = 'saved input or gh api unavailable/malformed'; }
  const repository = response?.data?.repository;
  const pr = !response?.errors?.length && repository?.nameWithOwner?.toLowerCase() === args['--repo'].toLowerCase() &&
    repository?.pullRequest?.number === Number(args['--pr']) ? repository.pullRequest : null;
  const fact = (id, known, passes, evidence) => add(id, !pr || !known ? 'unknown' : passes ? 'pass' : 'fail',
    pr ? evidence : { reason: observationError ?? 'incomplete API response or identity mismatch' });
  fact('open', ['OPEN', 'CLOSED', 'MERGED'].includes(pr?.state), pr?.state === 'OPEN', { state: pr?.state });
  fact('nonDraft', typeof pr?.isDraft === 'boolean', pr?.isDraft === false, { isDraft: pr?.isDraft });
  fact('unmerged', typeof pr?.merged === 'boolean', pr?.merged === false, { merged: pr?.merged });
  fact('pinnedHead', sha(pr?.headRefOid), pr?.headRefOid === args['--head'], { expected: args['--head'], observed: pr?.headRefOid });
  fact('baseUnchanged', sha(pr?.baseRefOid) && typeof pr?.baseRefName === 'string',
    pr?.baseRefOid === args['--base'] && pr?.baseRefName === args['--base-ref'],
    { expected: { sha: args['--base'], ref: args['--base-ref'] }, observed: { sha: pr?.baseRefOid, ref: pr?.baseRefName } });
  const commits = pr?.commits?.nodes;
  const commit = Array.isArray(commits) && commits.length === 1 && commits[0]?.commit?.oid === pr.headRefOid ? commits[0].commit : null;
  const age = (time(args['--now']) - time(commit?.committedDate)) / 1000;
  fact('headAge', knownPolicy && Number.isFinite(age) && age >= 0, age >= phase?.headAgeThresholdSeconds,
    { committedDate: commit?.committedDate, ageSeconds: Number.isFinite(age) ? age : null,
      thresholdSeconds: knownPolicy ? phase.headAgeThresholdSeconds : null, clock: 'head-commit-committed-date' });
  const rollup = commit?.statusCheckRollup;
  const connection = rollup?.contexts;
  const checks = rollup === null ? [] : connection?.pageInfo?.hasNextPage === false && Array.isArray(connection.nodes) ? connection.nodes : null;
  const pending = [], failed = [], unknown = [], terminal = [];
  for (const c of checks ?? []) {
    const name = c?.name ?? c?.context ?? '(unnamed)';
    if (c?.__typename === 'CheckRun' && ['QUEUED', 'IN_PROGRESS', 'WAITING', 'PENDING', 'REQUESTED'].includes(c.status) ||
        c?.__typename === 'StatusContext' && c.state === 'PENDING') pending.push(name);
    else if (c?.__typename === 'CheckRun' && c.status === 'COMPLETED' &&
        ['SUCCESS', 'NEUTRAL', 'SKIPPED', 'FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STALE', 'STARTUP_FAILURE'].includes(c.conclusion)) {
      terminal.push(name);
      if (!['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(c.conclusion)) failed.push(name);
    } else if (c?.__typename === 'StatusContext' && ['SUCCESS', 'FAILURE', 'ERROR'].includes(c.state)) {
      terminal.push(name);
      if (c.state !== 'SUCCESS') failed.push(name);
    } else unknown.push(name);
  }
  const evidence = { pending, failed, unknown, terminal, complete: checks !== null && unknown.length === 0 };
  fact('pendingChecks', evidence.complete, pending.length === 0, evidence);
  if (pr && evidence.complete && !terminal.length) add('checksSuccessful', 'n/a', evidence);
  else fact('checksSuccessful', evidence.complete, failed.length === 0, evidence);
  const counts = { pass: 0, fail: 0, unknown: 0, 'n/a': 0 };
  for (const t of terms) counts[t.status]++;
  return { version: 1, repo: args['--repo'], pr: Number(args['--pr']), phase: args['--phase'],
    source: args['--input'] ? 'saved' : 'gh api graphql', comparedAt: args['--now'], terms, counts };
}
try {
  if (process.argv.slice(2).length === 1 && process.argv[2] === '--help') console.log(HELP);
  else {
    const result = report(options(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.counts.unknown ? 2 : 0;
  }
} catch (error) {
  console.error(`pr-fresh: ${error.message}`);
  process.exitCode = 1;
}
