#!/usr/bin/env bun
import { readFileSync, realpathSync } from 'node:fs';
import { captureTerms, captureVersion, sha256 } from './capture-identity.js';
import { killGroup, runCommand } from './command-capture.js';

export const help = `Usage: check-run.js --repo PATH --repository ORIGIN --head REF --base REF --out DIR [options] -- COMMAND [ARG...]
Capture v${captureVersion}; receipt schema v1. Flags:
  --repo PATH          Git source root (origin URL must match --repository)
  --repository ORIGIN  Exact repository identity, as reported by git remote get-url origin
  --head REF           Resolve to a full commit SHA; must match source HEAD
  --base REF           Resolve to a full base SHA; typed refs are informational only
  --out DIR            Existing owned 0700 receipt directory outside all writable roots
  --cwd PATH           Command cwd (default: --repo)
  --snapshot SHA256    Exact source digest required when dirty; holds print the digest
  --pr URL             Optional PR identity, recorded alongside repository
  --image-digest VALUE Optional sandbox image sha256:<64 hex>; default null
  --writable-root PATH Additional untrusted writable mount; repeat for every mount
  --timeout-ms N       Deadline (default 300000)
  --log-bytes N        Combined stdout/stderr byte cap (default 1048576)
  --help              Show help; runs no child, writes nothing
Effects: reads Git identity/status using local git subprocesses with hooks/fsmonitor
 disabled, and hashes tracked and non-ignored untracked files, modes and
 symlink targets. Ignored untracked files (e.g. node_modules) and .git metadata
 are not bound; ignored-file changes cannot be detected by source comparison.
 The receipt snapshotScope names the ignore sources: .gitignore, .git/info/exclude
 and core.excludesFile (or Git's user-ignore default); local/user excludes widen
 the unbound set. Starts one detached command without a
 shell, with inherited environment, closed stdin, piped stdout/stderr and cwd.
 Creates two exclusive 0600 files (combined .log and schema-v1 .json) in --out;
 creates no directories, overwrites nothing, and retains both files for the caller.
 No container or network isolation is created; the command may use the network,
 spawn descendants and write anywhere its credentials permit. Declare all sandbox
 writable mounts with --writable-root; mount discovery is not performed.
 On exit, timeout, SIGINT, SIGTERM or SIGHUP, SIGKILLs the command's process group, drains
 pipes for up to 200ms, then cancels readers/closes handles. Escaped process groups
 are not contained. SIGKILL of check-run cannot clean up the process group; it
 may remain running without a receipt. A crash may do the same. No filesystem
 cleanup or source restoration is performed. Receipt path placement is not OS
 isolation from malicious commands running with the writer's credentials.
Exit: 0 measured (child may fail), 1 invocation/writer error, 2 hold/incomplete.
 Child exitCode is separate; terms describe capture facts, never proof sufficiency.
 Silence is valid. Timeout/spawn failure/interruption/truncation/incomplete drain
 leave capture unknown; changed source fails source identity. Neither closes a
 proof term that needs the missing evidence. No dispatch, retry, schedule or merge.

R5 read-only modes (no child, writes, network, cleanup or runtime enforcement):
  check-run.js r5-plan --input FILE
  check-run.js r5-trace --plan-receipt FILE --result FILE --repository ORIGIN --head SHA --base SHA
  --input FILE         Before JSON: catalog path, scenario id, version, host,
                       tokenLimit, timeLimitMs, attempt:1, nonce, recordedAt,
                       requested:{provider,model,options}. Limits are positive integers.
  --plan-receipt FILE  Schema-v1 receipt of a captured r5-plan invocation
  --result FILE        After JSON; see references/live-run.md for its fields
  --repository ORIGIN --head SHA --base SHA  Independent full capture identities
These modes read explicit local JSON/catalog/receipt/log files and print per-term
facts and counts. Wrap each mode with ordinary check-run to retain schema-v1
receipts; keep the before receipt before launching the scenario yourself.
The trace binds result bytes to the plan hash and nonce and rechecks capture
identity/log integrity. T3 observations are caller-supplied, never authenticated
by this helper. Missing observations stay unknown. Failed criteria exit 0;
unknown exits 2, invalid invocation/JSON exits 1. No publication verdict.
`;

const text = value => typeof value === 'string' && value.trim().length > 0;
const positive = value => Number.isSafeInteger(value) && value > 0;
const settings = value => value && text(value.provider) && text(value.model)
  && value.options && typeof value.options === 'object' && !Array.isArray(value.options);
const timestamp = value => typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const term = (id, ok, evidence) => ({ id, status: ok === null ? 'unknown' : ok ? 'pass' : 'fail', evidence });
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
function r5Plan(input) {
  const bytes = readFileSync(input.catalog);
  const catalog = JSON.parse(bytes.toString());
  const matches = catalog.cases?.filter(c => c.id === input.scenario) ?? [];
  const scenario = matches.length === 1 ? matches[0] : null;
  return { schemaVersion: 1, kind: 'r5-plan', version: input.version, host: input.host,
    tokenLimit: input.tokenLimit, timeLimitMs: input.timeLimitMs, attempt: input.attempt,
    nonce: input.nonce, recordedAt: input.recordedAt, requested: input.requested,
    catalog: { path: realpathSync(input.catalog), sha256: sha256(bytes) },
    scenario: scenario ? { id: scenario.id, title: scenario.title, input: scenario.input } : null,
    terms: [
      term('scenario', Boolean(scenario?.input && text(scenario.title)), { catalog: input.catalog, id: input.scenario, matches: matches.length }),
      term('installation', text(input.version) && text(input.host), { version: input.version, host: input.host, basis: 'caller declaration; verify installed release before launch' }),
      term('limits', positive(input.tokenLimit) && positive(input.timeLimitMs) && input.attempt === 1,
        { tokenLimit: input.tokenLimit, timeLimitMs: input.timeLimitMs, attempt: input.attempt, enforcement: 'agent/runtime, not this helper' }),
      term('settings', Boolean(settings(input.requested)), input.requested ?? null),
      term('freshness', text(input.nonce) && input.nonce.length >= 16 && timestamp(input.recordedAt), { nonce: input.nonce, recordedAt: input.recordedAt }),
    ] };
}
function r5Trace(flags) {
  const receiptBytes = readFileSync(flags['plan-receipt']);
  const receipt = JSON.parse(receiptBytes.toString());
  const planBytes = readFileSync(receipt.logPath), before = JSON.parse(planBytes.toString());
  const resultBytes = readFileSync(flags.result), after = JSON.parse(resultBytes.toString());
  const unavailable = after.outcome === 'unavailable';
  const elapsed = timestamp(after.startedAt) && timestamp(after.finishedAt) ? Date.parse(after.finishedAt) - Date.parse(after.startedAt) : null;
  const terms = [
    ...captureTerms(receipt, { repository: flags.repository, head: flags.head, base: flags.base }).map(t => ({ ...t, id: `plan-${t.id}` })),
    term('plan-kind', before.schemaVersion === 1 && before.kind === 'r5-plan' && receipt.exitCode === 0
      && receipt.tool?.name === 'check-run' && receipt.argv?.length === 5
      && receipt.argv[1].endsWith('/check-run.js') && receipt.argv[2] === 'r5-plan' && receipt.argv[3] === '--input',
      { kind: before.kind, exitCode: receipt.exitCode, argv: receipt.argv }),
    ...(Array.isArray(before.terms) ? before.terms.map(t => ({ ...t, id: `before-${t.id}` })) : [term('before', null, 'missing plan terms')]),
    term('installation', after.version === before.version && after.host === before.host,
      { planned: { version: before.version, host: before.host }, observed: { version: after.version, host: after.host }, basis: 'caller-supplied T3 observations' }),
    term('settings', !settings(after.effective) || !settings(after.requested) ? null : equal(after.requested, before.requested) && equal(after.effective, before.requested),
      { requested: before.requested, observedRequested: after.requested ?? null, effective: after.effective ?? null }),
    term('terminal', !text(after.threadId) || !text(after.runId) ? null : ['completed', 'failed', 'budget-exhausted', 'cancelled'].includes(after.outcome),
      { outcome: after.outcome, threadId: after.threadId ?? null, runId: after.runId ?? null }),
    term('stale-result', after.planSha256 === sha256(planBytes) && after.nonce === before.nonce && after.attempt === 1
      && (unavailable || (typeof after.output === 'string' && after.output.split(/\r?\n/).includes(`nonce: ${before.nonce}`))),
      { planSha256: sha256(planBytes), observedPlanSha256: after.planSha256, nonce: after.nonce, attempt: after.attempt, nonceEchoRequired: !unavailable }),
    term('tokens', !Number.isSafeInteger(after.tokensUsed) || after.tokensUsed < 0 ? null : after.tokensUsed <= before.tokenLimit,
      { used: after.tokensUsed ?? null, limit: before.tokenLimit }),
    term('time', elapsed === null || !timestamp(before.recordedAt) ? null : Date.parse(after.startedAt) >= Date.parse(before.recordedAt) && elapsed >= 0 && elapsed <= before.timeLimitMs,
      { recordedAt: before.recordedAt, startedAt: after.startedAt ?? null, finishedAt: after.finishedAt ?? null, elapsedMs: elapsed, limitMs: before.timeLimitMs }),
    term('scenario-outcome', unavailable ? null : after.outcome === 'completed', { outcome: after.outcome, reason: after.reason ?? null }),
  ];
  return { schemaVersion: 1, kind: 'r5-trace',
    planReceipt: { path: realpathSync(flags['plan-receipt']), sha256: sha256(receiptBytes) },
    result: { path: realpathSync(flags.result), sha256: sha256(resultBytes) }, before, after, terms };
}
function r5Main(args, io) {
  try {
    const [mode, ...rest] = args;
    const required = mode === 'r5-plan' ? ['input'] : ['plan-receipt', 'result', 'repository', 'head', 'base'];
    /** @type {Record<string, string>} */
    const flags = {};
    for (let i = 0; i < rest.length; i += 2) {
      const key = rest[i].slice(2);
      if (!rest[i].startsWith('--') || !required.includes(key) || key in flags || !rest[i + 1]) throw Error(`invalid flag: ${rest[i]}`);
      flags[key] = rest[i + 1];
    }
    for (const key of required) if (!flags[key]) throw Error(`--${key} required`);
    const report = mode === 'r5-plan' ? r5Plan(readJSON(flags.input)) : r5Trace(flags);
    report.counts = Object.fromEntries(['pass', 'fail', 'unknown', 'n/a'].map(status => [status, report.terms.filter(t => t.status === status).length]));
    io.stdout(JSON.stringify(report, null, 2));
    return report.terms.some(t => t.status === 'unknown') ? 2 : 0;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      io.stdout(JSON.stringify({ terms: [term('input', null, error.message)], counts: { pass: 0, fail: 0, unknown: 1, 'n/a': 0 } }, null, 2));
      return 2;
    }
    io.stderr(error.message); return 1;
  }
}

export async function main(args, io = { stdout: console.log, stderr: console.error }) {
  if (args.length === 1 && args[0] === '--help') { io.stdout(help); return 0; }
  if (['r5-plan', 'r5-trace'].includes(args[0])) return r5Main(args, io);
  /** @type {Record<string, string>} */
  const flags = {};
  const writableRoots = [];
  const allowed = new Set(['repo', 'repository', 'head', 'base', 'out', 'cwd', 'snapshot', 'pr', 'image-digest', 'timeout-ms', 'log-bytes', 'writable-root']);
  let argv;
  try {
    const separator = args.indexOf('--');
    if (separator < 0 || separator === args.length - 1) throw Error('command required after --');
    argv = args.slice(separator + 1);
    for (let i = 0; i < separator; i += 2) {
      const key = args[i].slice(2), value = args[i + 1];
      if (!args[i].startsWith('--') || !allowed.has(key) || !value || i + 1 >= separator || (key !== 'writable-root' && key in flags)) throw Error(`invalid flag: ${args[i]}`);
      if (key === 'writable-root') writableRoots.push(value);
      else flags[key] = value;
    }
    for (const key of ['repo', 'repository', 'head', 'base', 'out']) if (!flags[key]) throw Error(`--${key} required`);
    for (const key of ['timeout-ms', 'log-bytes']) if (flags[key] && (!/^[1-9]\d*$/.test(flags[key]) || !Number.isSafeInteger(Number(flags[key])) || Number(flags[key]) > 2147483647)) throw Error(`invalid --${key}`);
  } catch (error) { io.stderr(error.message); return 1; }
  const state = { active: null, signal: null };
  const interrupt = (signal) => { state.signal = signal; if (state.active) killGroup(state.active); };
  const sigint = () => interrupt('SIGINT'), sigterm = () => interrupt('SIGTERM'), sighup = () => interrupt('SIGHUP');
  process.on('SIGINT', sigint);
  process.on('SIGTERM', sigterm);
  process.on('SIGHUP', sighup);
  try {
    const repo = realpathSync(flags.repo), cwd = realpathSync(flags.cwd ?? flags.repo);
    const binding = { tool: { name: 'check-run', version: captureVersion }, repo, repository: flags.repository, head: flags.head, base: flags.base,
      snapshot: flags.snapshot, pr: flags.pr, sandboxImageDigest: flags['image-digest'] ?? null, writableRoots };
    const step = await runCommand([], { evidence: flags.out }, 'check', argv, cwd, process.env,
      { timeoutMs: Number(flags['timeout-ms'] ?? 300000), logBytes: Number(flags['log-bytes'] ?? 1048576) }, state, argv, binding);
    io.stdout(JSON.stringify(step, null, 2));
    return step.terms.some(t => t.status === 'fail' || t.status === 'unknown') ? 2 : 0;
  } catch (error) { io.stderr(error.message); return error.captureHold ? 2 : 1; }
  finally { process.off('SIGINT', sigint); process.off('SIGTERM', sigterm); process.off('SIGHUP', sighup); }
}
if (import.meta.main) process.exit(await main(process.argv.slice(2)));
