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
                 Driver: recorded age < N defers; age >= N meets the age term. defer waits on
                 pending checks; allow adds no pending gate. Unknown applicable gating terms hold.
                 status:"unknown" with all three gate fields null is unrecorded, with no gate.
                 policy.evidence.unrecorded distinguishes it from malformed/unavailable policy.
                 Both report unknown; the driver ignores non-event terms only for unrecorded phases.
  --input FILE   Saved gh api graphql response; no network. Saved bytes prove no live freshness.
  --now ISO      Timezone-qualified comparison time; default current UTC.
  --help         Show flags, effects and limitations.
Offline publication reconciliation (not a phase or gate):
  --repo OWNER/NAME --pr N --head SHA --receipt FILE
  FILE: {version:1,reviewId,submission,immediateReadback,laterReadback?}.
  Use the original numeric review ID and trusted saved GitHub response metadata.
  Originals need id, pull_request_url, commit_id, state and body ending in the exact
  verdict marker; only that marker is read from the body. Later uses ID, PR and commit only.
  Omit laterReadback to skip comparison, or set null for a missing observation.
  No network, policy lookup or clock. Original consistency cannot prove capture order,
  current GitHub state, review quality or reviewer time. Later drift never rewrites it.
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
  const args = { '--policy': `${import.meta.dir}/../references/schedule-policy.json` };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    if (!['--repo', '--pr', '--head', '--base', '--base-ref', '--phase', '--policy', '--input', '--now', '--receipt'].includes(key) ||
        !value || value.startsWith('--') || seen.has(key)) throw Error(`invalid argument: ${key}`);
    args[key] = value;
    seen.add(key);
  }
  const identity = /^[\w.-]+\/[\w.-]+$/.test(args['--repo'] ?? '') && /^[1-9]\d*$/.test(args['--pr'] ?? '') &&
    Number.isSafeInteger(Number(args['--pr'])) && sha(args['--head']);
  if (args['--receipt']) {
    if (!identity || [...seen].some((key) => !['--repo', '--pr', '--head', '--receipt'].includes(key))) {
      throw Error('expected only repo, PR, full head SHA and receipt file; see --help');
    }
    return args;
  }
  args['--now'] ??= new Date().toISOString();
  if (!identity || !sha(args['--base']) ||
      !args['--base-ref'] || !['admission', 'submission'].includes(args['--phase']) || !Number.isFinite(time(args['--now']))) {
    throw Error('expected repo, PR, full head/base SHAs, base-ref, phase and timezone-qualified now; see --help');
  }
  return args;
}

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value) => Number.isSafeInteger(value) && value > 0;
const reviewStates = ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING'];
function markerHead(body) {
  if (body == null) return null;
  if (typeof body !== 'string') return '';
  const lines = body.replace(/(?:\r?\n)+$/, '').split(/\r?\n/);
  const candidates = lines.filter((line) => line.trimStart().startsWith('<!-- axstack-automation verdict'));
  if (!candidates.length) return null;
  if (candidates.length !== 1 || candidates[0] !== lines.at(-1)) return '';
  return /^<!-- axstack-automation verdict head=([a-f0-9]{40}) -->$/.exec(candidates[0])?.[1] ?? '';
}

function receiptTerm(id) {
  const evidence = { missing: [], malformed: [], conflicts: [] };
  const check = (field, value, valid, expected = value) => {
    if (value == null) evidence.missing.push(field);
    else if (!valid(value)) evidence.malformed.push(field);
    else {
      if (value !== expected) evidence.conflicts.push(field);
      return value;
    }
  };
  const result = (details = {}, status = evidence.conflicts.length ? 'fail' :
    evidence.missing.length || evidence.malformed.length ? 'unknown' : 'pass') =>
    ({ id, status, evidence: { ...evidence, ...details } });
  return { evidence, check, result };
}

function reconcileReceipt(args) {
  const repo = args['--repo'], pr = Number(args['--pr']), head = args['--head'];
  const expectedUrl = `https://api.github.com/repos/${repo.toLowerCase()}/pulls/${pr}`;
  const validUrl = (value) => typeof value === 'string' &&
    /^https:\/\/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+\/pulls\/[1-9]\d*$/.test(value);
  const publication = receiptTerm('publication');
  const later = receiptTerm('laterReviewCommit');
  let bytes, receipt, readError;
  try { bytes = readFileSync(args['--receipt'], 'utf8'); }
  catch (error) { readError = error.code === 'ENOENT' ? 'missing' : 'unreadable'; }
  if (!readError) {
    try { receipt = JSON.parse(bytes); } catch { readError = 'malformed'; }
    if (!record(receipt)) readError = 'malformed';
  }
  if (readError === 'missing' || readError === 'malformed') publication.evidence[readError].push('receipt');
  const supported = !readError && publication.check('version', receipt.version, (value) => value === 1);
  const reviewId = supported ? publication.check('reviewId', receipt.reviewId, validId) : undefined;
  const readback = (term, field, commitId, original = false) => {
    const review = term.check(field, receipt[field], record);
    if (!review) return;
    const id = term.check(`${field}.id`, review.id, validId, reviewId);
    const url = review.pull_request_url;
    term.check(`${field}.pull_request_url`, validUrl(url) ? url.toLowerCase() : url, validUrl, expectedUrl);
    const commit = term.check(`${field}.commit_id`, review.commit_id, sha, commitId);
    if (!original) return { id, commitId: commit };
    const marker = term.check(`${field}.marker`, markerHead(review.body), sha, head);
    const state = term.check(`${field}.state`, review.state, (value) => reviewStates.includes(value));
    if (state && !['APPROVED', 'CHANGES_REQUESTED'].includes(state)) term.evidence.conflicts.push(`${field}.state`);
    return { id, commitId: commit, markerHead: marker, state };
  };
  const submission = supported ? readback(publication, 'submission', head, true) : undefined;
  const immediateReadback = supported ? readback(publication, 'immediateReadback', head, true) : undefined;
  if (submission?.state && immediateReadback?.state && submission.state !== immediateReadback.state &&
      !publication.evidence.conflicts.includes('immediateReadback.state')) {
    publication.evidence.conflicts.push('immediateReadback.state');
  }
  const original = readError === 'unreadable' ? publication.result({ reason: readError }, 'unknown') :
    publication.result({ reviewId, state: submission?.state, submission, immediateReadback });
  let comparison = later.result({ reason: 'not requested' }, 'n/a');
  if (supported && Object.hasOwn(receipt, 'laterReadback')) {
    if (original.status !== 'pass') comparison = later.result({ reason: 'original not established' }, 'unknown');
    else {
      const details = readback(later, 'laterReadback', undefined);
      comparison = later.result(details);
      if (comparison.status === 'pass' && details?.commitId !== head) {
        comparison = later.result({ ...details, reason: 'drift' }, 'fail');
      }
    }
  }
  const terms = [original, comparison];
  const counts = { pass: 0, fail: 0, unknown: 0, 'n/a': 0 };
  for (const term of terms) counts[term.status]++;
  return { version: 1, source: 'saved receipt', repo, pr, head, terms, counts };
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
  const unrecorded = policy?.version === 1 && phase?.status === 'unknown' &&
    phase.headAgeThresholdSeconds === null && phase.clockSemantics === null && phase.pendingCheckTreatment === null;
  add('policy', knownPolicy ? 'pass' : 'unknown', { phase: args['--phase'], sha256: policySha256,
    recorded: phase ?? null, unrecorded, malformed: !knownPolicy && !unrecorded,
    reason: knownPolicy ? 'supported recorded policy' : unrecorded ? 'unrecorded phase; no gate' : 'absent, unreadable, malformed or unsupported policy' });
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
        c?.__typename === 'StatusContext' && ['PENDING', 'EXPECTED'].includes(c.state)) pending.push(name);
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
    const args = options(process.argv.slice(2));
    const result = args['--receipt'] ? reconcileReceipt(args) : report(args);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.counts.unknown ? 2 : 0;
  }
} catch (error) {
  console.error(`pr-fresh: ${error.message}`);
  process.exitCode = 1;
}
