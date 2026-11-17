#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { compareQuietPRs } from './pr-digest.js';

const HELP = `schedule-drift — canonical schedule comparison (R2 fact mode)
  quiet-facts --help  Saved-input review-manager observations (separate fact mode).
  bun schedule-drift.js --export FILE --bindings FILE [--prompts DIR] [--now ISO] [--max-age-seconds N]
  --export FILE   Saved JSON: {version:1,host,exportedAt,complete:true,tasks:[{scheduledTaskId,
                  projectId,prompt,schedule,enabled}]}. Export every relevant project; never use a live database.
  --bindings FILE Private JSON: {host,schedules:[{promptFile,scheduledTaskId,projectId,enabled,schedule,
                  values:{HOST_TOKEN:"literal value"}}]}. Declare all three packaged prompt filenames exactly once.
                  For intentional host exclusions use {promptFile,absent:true,scheduledTaskId?:expectedId}.
                  Fresh complete matching-host coverage yields n/a; any matching declared task ID fails.
                  Without a task ID, absent:true is an explicit host-scope declaration, not identity discovery.
                  Values substitute only explicit {{HOST_TOKEN}} placeholders.
                  Prompt comparison ignores trailing LF characters only; all other whitespace remains exact.
                  A live prompt containing any unfilled {{HOST_ prefix fails, even if bound bytes match.
                  Schedule is the exact host declaration; review-manager additionally requires interval 1800000.
  --prompts DIR   Directory containing the three packaged prompt files; default: installed ../references.
  --now ISO       Observation time with timezone; default: current UTC. Saved times prove no live delivery.
  --max-age-seconds N Maximum export age, inclusive; positive integer, default 300. Future exports are unknown.
  --help         Show flags, schema, effects and limitations.
No writes, subprocesses, network, database access, schedule mutations or persistent state.
Stdout reports per-term pass/fail/unknown/n/a with evidence and counts only; no aggregate verdict or authority.
Exports and bindings stay private. Output contains hashes and filenames, never prompts, IDs or host values.
Missing, malformed, unavailable, stale or incomplete evidence is unknown; no comparison passes without fresh coverage.
Exit: 0 measured (including failed facts), 1 invalid CLI/error, 2 incomplete (unknown facts).
`;
const files = ['review-manager-prompt.md', 'pr-triage-nightly.md', 'test-audit-weekly.md'];
const sha256 = (bytes) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const time = (value) => typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonempty = (v) => typeof v === 'string' && v.length > 0;
const ordered = (value) => Array.isArray(value) ? value.map(ordered) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])])) : value;
const equal = (a, b) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));

function options(argv) {
  const args = { '--prompts': `${import.meta.dir}/../references`, '--now': new Date().toISOString(), '--max-age-seconds': '300' };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!['--export', '--bindings', '--prompts', '--now', '--max-age-seconds'].includes(key) || !argv[i + 1] || seen.has(key)) {
      throw new Error(`invalid argument: ${key}`);
    }
    seen.add(key);
    args[key] = argv[i + 1];
  }
  if (!args['--export'] || !args['--bindings'] || !Number.isFinite(time(args['--now'])) ||
      !/^[1-9]\d*$/.test(args['--max-age-seconds']) || !Number.isSafeInteger(Number(args['--max-age-seconds']))) {
    throw new Error('expected --export, --bindings, timezone-qualified --now and positive --max-age-seconds');
  }
  return args;
}

function compare(args) {
  const terms = [];
  const term = (id, status, evidence) => terms.push({ id, status, evidence });
  let source, bindings, exportSha256 = null, bindingsSha256 = null;
  try {
    const bytes = readFileSync(args['--export']);
    exportSha256 = sha256(bytes);
    source = JSON.parse(bytes.toString());
    const declared = readFileSync(args['--bindings']);
    bindingsSha256 = sha256(declared);
    bindings = JSON.parse(declared.toString());
  } catch { /* A missing or malformed saved export/binding is unavailable evidence. */ }
  const age = (time(args['--now']) - time(source?.exportedAt)) / 1000;
  const fresh = source?.version === 1 && source.complete === true && nonempty(source.host) &&
    Array.isArray(source.tasks) && Number.isFinite(age) && age >= 0 && age <= Number(args['--max-age-seconds']);
  const declared = object(bindings) && nonempty(bindings.host) && Array.isArray(bindings.schedules);
  term('export', fresh ? 'pass' : 'unknown', fresh ? `complete export; age ${age}s; sha256 ${exportSha256}` : 'unavailable, incomplete, malformed, stale or future export');
  term('host', !fresh || !declared ? 'unknown' : source.host === bindings.host ? 'pass' : 'fail', 'export host compared with private declared host');
  for (const file of files) {
    const rows = declared ? bindings.schedules.filter((b) => b?.promptFile === file) : [];
    const binding = rows.length === 1 ? rows[0] : null;
    const tasks = fresh && nonempty(binding?.scheduledTaskId)
      ? source.tasks.filter((t) => t?.scheduledTaskId === binding.scheduledTaskId) : [];
    const task = tasks.length === 1 ? tasks[0] : null;
    if (binding?.absent === true) {
      const status = !fresh || source.host !== bindings.host ? 'unknown' : tasks.length ? 'fail' : 'n/a';
      for (const suffix of ['binding', 'prompt', 'cadence', 'enabled']) {
        term(`${file}.${suffix}`, status, 'explicit host exclusion; fresh complete matching-host export required; any declared task ID must be absent');
      }
      continue;
    }
    const usable = fresh && declared && rows.length === 1 && task !== null;
    const fact = (suffix, known, matches, evidence) => term(`${file}.${suffix}`,
      !usable || !known ? 'unknown' : matches ? 'pass' : 'fail', evidence);
    fact('binding', nonempty(binding?.projectId) && nonempty(task?.projectId),
      task?.projectId === binding?.projectId, 'exact schedule ID and project binding; missing or duplicate identities are unknown');
    let expected = null, packagedSha256 = null;
    try {
      const bytes = readFileSync(`${args['--prompts']}/${file}`);
      packagedSha256 = sha256(bytes);
      expected = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      expected = expected.replace(/\{\{(HOST_[A-Z_]+)\}\}/g, (_, key) => {
        if (!object(binding?.values) || typeof binding.values[key] !== 'string') throw new Error('unbound host token');
        return binding.values[key];
      });
    } catch { expected = null; }
    const unfilled = nonempty(task?.prompt) && task.prompt.includes('{{HOST_');
    fact('prompt', nonempty(task?.prompt) && (unfilled || expected !== null),
      !unfilled && expected !== null && nonempty(task?.prompt) && expected.replace(/\n+$/, '') === task.prompt.replace(/\n+$/, ''),
      `live host tokens must be filled; exact UTF-8 bytes after declared host-token substitution, excluding trailing LF; packaged sha256 ${packagedSha256 ?? 'unavailable'}`);
    const scheduleKnown = validSchedule(binding?.schedule) && validSchedule(task?.schedule);
    const canonical = file !== files[0] || equal(binding?.schedule, { type: 'interval', everyMs: 1800000 });
    fact('cadence', scheduleKnown, canonical && equal(task?.schedule, binding?.schedule), 'exact declared schedule; review-manager interval fixed at 1800000ms');
    fact('enabled', typeof binding?.enabled === 'boolean' && typeof task?.enabled === 'boolean',
      task?.enabled === binding?.enabled, 'enabled state compared with private declaration');
  }
  const counts = Object.fromEntries(['pass', 'fail', 'unknown', 'n/a'].map((s) => [s, terms.filter((t) => t.status === s).length]));
  return { version: 1, observedAt: args['--now'], exportSha256, bindingsSha256, terms, counts };
}

function validSchedule(s) {
  if (!object(s)) return false;
  if (s.type === 'interval') return Number.isSafeInteger(s.everyMs) && s.everyMs > 0;
  if (s.type !== 'fixed_time' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s.timeOfDay)) return false;
  return s.weekdays === undefined || s.weekdays === null || Array.isArray(s.weekdays) && s.weekdays.length > 0 &&
    s.weekdays.every((d) => Number.isSafeInteger(d) && d >= 0 && d <= 6);
}

const QUIET_HELP = `schedule-drift quiet-facts — in-turn saved-input observations
  bun --no-env-file <installed>/schedule-drift.js quiet-facts --input FILE --continuity FILE [--now ISO]
  --input FILE Saved JSON v1 envelope (agent collects all pages and readbacks):
    {version:1,observedAt,repository:"owner/name",project:{projectId,repository},lane:{environmentId,projectId,laneId},selfThreadId,login,
     reap:{exitCode,dockerAvailable},searches:[{query,pages:[{page,total_count,incomplete_results,items}]}],
     heads:[{repository,number,headRefOid}],inventory:{complete:true,pages:[{threads,nextCursor:null}]},readbacks:[thread]}
    Obtain login with gh api user. Include both queries review-requested:@me and involves:@me; pages numbered from 1, max 100 items each.
    Each item has repository.nameWithOwner, number, author.login, state, isDraft, updatedAt.
    Inventory pages carry cursor and nextCursor; first cursor omitted/null, final nextCursor:null.
    Thread-list/readback projection: {threadId,environmentId,projectId,laneId,settled,
      latestRun:{status},descendantIds:[],guards:{held,flagged,ownedWatch,pendingReceipt,wedged,stalledOwner,protected}}.
    Run status: completed/failed/cancelled/interrupted or running/queued/pending/usage-limited.
    Preserve exact native IDs; retain every descendant recursively. Missing fields/calls are unknown, never guessed.
  --continuity FILE Saved progress.md with Lane state, Open holds, Watermarks, Last pass sections.
    Lane state: '- threadId: ID' (prior identity before replacing it), '- Active PR jobs and descendants: none'.
    Watermarks: '- Quiet gate: JSON array of [repo#number,headRefOid,updatedAt] triples',
    '- Last full pass: UTC ISO'. Open holds: '- none' or one line per hold with 'resume: user decision only'
    for a user-only hold; any other hold remains pending. Unstructured/ambiguous evidence stays unknown.
  --now ISO Observation time, timezone required; default current UTC. Collection age must be 0..300 seconds.
  --help Show this schema, flags, effects and limitations.
No writes, subprocesses, network, T3 calls, database access or persistent state. Run from trusted cwd /.
Facts only: pass means observed condition, fail means measured contrary condition, unknown means incomplete.
Driver applies quiet/full/hold rules; facts grant no admission or settlement authority. Counts only, no verdict.
Exit: 0 measured (including fail), 1 invalid CLI, 2 incomplete/unknown. Read/JSON failures are unknown.
`;
const guardKeys = ['held', 'flagged', 'ownedWatch', 'pendingReceipt', 'wedged', 'stalledOwner', 'protected'];
const terminalRuns = ['completed', 'failed', 'cancelled', 'interrupted'];
const activeRuns = ['running', 'queued', 'pending', 'usage-limited'];
const repoName = (v) => typeof v === 'string' && /^[\w.-]+\/[\w.-]+$/.test(v);
const section = (text, name) => text.match(new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))?.[1];
function quietOptions(argv) {
  const args = { '--now': new Date().toISOString() }, seen = new Set();
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--input', '--continuity', '--now'].includes(argv[i]) || !argv[i + 1] || seen.has(argv[i])) throw Error('invalid quiet-facts argument');
    seen.add(argv[i]); args[argv[i]] = argv[i + 1];
  }
  if (!args['--input'] || !args['--continuity'] || !Number.isFinite(time(args['--now']))) throw Error('expected --input, --continuity and timezone-qualified --now');
  return args;
}
function quietFacts(args) {
  const terms = [], term = (id, status, evidence) => terms.push({ id, status, evidence });
  let input, continuity = '', inputSha256 = null, continuitySha256 = null;
  try { const bytes = readFileSync(args['--input']); inputSha256 = sha256(bytes); input = JSON.parse(bytes.toString()); } catch { /* unknown input */ }
  try { const bytes = readFileSync(args['--continuity']); continuitySha256 = sha256(bytes); continuity = bytes.toString(); } catch { /* unknown continuity */ }
  const age = (time(args['--now']) - time(input?.observedAt)) / 1000;
  const fresh = input?.version === 1 && Number.isFinite(age) && age >= 0 && age <= 300;
  term('observations', fresh ? 'pass' : 'unknown', { ageSeconds: Number.isFinite(age) ? age : null, inputSha256 });
  const sections = Object.fromEntries(['Lane state', 'Open holds', 'Watermarks', 'Last pass'].map(name => [name, section(continuity, name)]));
  const continuityKnown = Object.values(sections).every(nonempty);
  term('continuity', continuityKnown ? 'pass' : 'unknown', { continuitySha256, sections: Object.keys(sections).filter(key => nonempty(sections[key])) });
  const lane = input?.lane, laneKeys = ['environmentId', 'projectId', 'laneId'];
  const declaredIdentity = fresh && repoName(input?.repository) && laneKeys.every(key => nonempty(lane?.[key])) && nonempty(input?.selfThreadId);
  const projectKnown = repoName(input?.project?.repository) && nonempty(input?.project?.projectId);
  const identity = declaredIdentity && projectKnown && input.project.repository === input.repository && input.project.projectId === lane.projectId;
  term('identity', !declaredIdentity || !projectKnown ? 'unknown' : identity ? 'pass' : 'fail',
    { repository: input?.repository ?? null, project: input?.project ?? null, lane: lane ?? null });
  const reap = input?.reap;
  term('reap', !reap || !Number.isInteger(reap.exitCode) || typeof reap.dockerAvailable !== 'boolean' ? 'unknown' :
    reap.exitCode === 0 && reap.dockerAvailable ? 'pass' : 'fail', reap ?? 'no saved reap observation');

  let discovery = fresh && nonempty(input?.login) && Array.isArray(input?.searches) && input.searches.length === 2;
  const prs = new Map();
  for (const query of ['review-requested:@me', 'involves:@me']) {
    const searches = input?.searches?.filter?.(s => s?.query === query) ?? [];
    const search = searches.length === 1 ? searches[0] : null;
    const pages = search?.pages;
    if (!Array.isArray(pages) || !pages.length || search.error) { discovery = false; continue; }
    const count = pages[0]?.total_count;
    const items = pages.flatMap(page => Array.isArray(page?.items) ? page.items : []);
    const numbers = new Set();
    if (!Number.isSafeInteger(count) || count < 0 || count >= 1000 || items.length !== count ||
      pages.some((page, i) => page?.page !== i + 1 || page.total_count !== count || page.incomplete_results !== false ||
        page.error || !Array.isArray(page.items) || page.items.length > 100 || (i < pages.length - 1 && page.items.length !== 100))) discovery = false;
    for (const pr of items) {
      const repository = pr?.repository?.nameWithOwner, key = `${repository}#${pr?.number}`;
      if (!repoName(repository) || !Number.isSafeInteger(pr?.number) || pr.number < 1 || !nonempty(pr.author?.login) ||
          !['open', 'closed', 'merged'].includes(pr.state?.toLowerCase()) || typeof pr.isDraft !== 'boolean' || numbers.has(key)) {
        discovery = false; continue;
      }
      numbers.add(key);
      if (pr.author.login.toLowerCase() === input?.login?.toLowerCase() || pr.isDraft || pr.state.toLowerCase() !== 'open') continue;
      const heads = input?.heads?.filter?.(h => h?.repository === repository && h?.number === pr.number) ?? [];
      const head = heads.length === 1 ? heads[0]?.headRefOid : null;
      if (!/^[a-f0-9]{40,64}$/.test(head ?? '') || !Number.isFinite(time(pr.updatedAt)) || time(pr.updatedAt) > time(args['--now'])) discovery = false;
      const row = [key, head, pr.updatedAt];
      if (prs.has(key) && !equal(prs.get(key), row)) discovery = false;
      prs.set(key, row);
    }
  }
  term('discovery', discovery ? 'pass' : 'unknown', { eligible: prs.size, queries: input?.searches?.length ?? 0, complete: !!discovery });
  let previous;
  try { previous = JSON.parse(sections.Watermarks?.match(/^- Quiet gate: (.+)$/m)?.[1]); } catch { /* unknown watermark */ }
  const comparison = compareQuietPRs(previous, [...prs.values()]);
  term('pr-list', discovery && continuityKnown ? comparison.status : 'unknown', comparison.evidence);
  const fullTime = time(sections.Watermarks?.match(/^- Last full pass: (.+)$/m)?.[1]);
  const elapsed = time(args['--now']) - fullTime;
  term('full-pass-age', !continuityKnown || !Number.isFinite(elapsed) ? 'unknown' : elapsed >= 0 && elapsed < 14400000 ? 'pass' : 'fail',
    { ageSeconds: Number.isFinite(elapsed) ? elapsed / 1000 : null });

  const pages = input?.inventory?.pages;
  const rows = Array.isArray(pages) ? pages.flatMap(p => Array.isArray(p?.threads) ? p.threads : []) : [];
  const ids = rows.map(t => t?.threadId);
  const readbacks = Array.isArray(input?.readbacks) ? input.readbacks : [];
  const inventoryKnown = identity && input?.inventory?.complete === true && Array.isArray(pages) && pages.length > 0 &&
    pages.every((p, i) => Array.isArray(p?.threads) && !p.error &&
      (i === 0 ? p.cursor == null : nonempty(p.cursor) && p.cursor === pages[i - 1].nextCursor) &&
      (i === pages.length - 1 ? p.nextCursor === null : nonempty(p.nextCursor))) &&
    ids.every(nonempty) && new Set(ids).size === ids.length && ids.includes(input?.selfThreadId);
  const bound = t => t && laneKeys.every(key => t[key] === lane?.[key]);
  const coverage = inventoryKnown && rows.every(bound) && readbacks.length === rows.length && rows.every(t =>
    readbacks.filter(r => r?.threadId === t.threadId && bound(r)).length === 1);
  const priorIds = [...(sections['Lane state'] ?? '').matchAll(/^- threadId: (\S+)$/gm)].map(m => m[1]);
  const prior = priorIds.length === 1 && priorIds[0] !== input?.selfThreadId ? readbacks.find(t => t?.threadId === priorIds[0]) : null;

  const knownThread = t => typeof t?.settled === 'boolean' && [...terminalRuns, ...activeRuns].includes(t.latestRun?.status) &&
    Array.isArray(t.descendantIds) && t.descendantIds.every(id => ids.includes(id) && id !== t.threadId) &&
    guardKeys.every(key => typeof t.guards?.[key] === 'boolean');
  const threadsKnown = coverage && readbacks.every(knownThread);
  term('ownership', threadsKnown && continuityKnown && bound(prior) ? 'pass' : 'unknown', { completeInventory: !!inventoryKnown, listed: rows.length, readbacks: readbacks.length });
  term('thread-readbacks', threadsKnown ? 'pass' : 'unknown', { threadIds: ids, descendants: readbacks.flatMap(t => t?.descendantIds ?? []) });
  const priorKnown = threadsKnown && prior && knownThread(prior);
  const guarded = priorKnown && guardKeys.some(key => prior.guards[key]);
  const terminal = t => t.settled && terminalRuns.includes(t.latestRun.status);
  term('prior-pass', !priorKnown ? 'unknown' : terminal(prior) || guarded ? 'pass' : 'fail',
    { threadId: priorIds[0] ?? null, settled: prior?.settled ?? null, guards: prior?.guards ?? null });
  const busy = threadsKnown ? readbacks.filter(t => t.threadId !== input.selfThreadId && t.threadId !== prior?.threadId && !terminal(t)).map(t => t.threadId) : [];
  term('lane-idle', !threadsKnown ? 'unknown' : busy.length ? 'fail' : 'pass', { nonterminalThreadIds: busy });
  const holds = sections['Open holds']?.trim().split('\n').filter(nonempty);
  const holdKnown = holds?.length && holds.every(line => /^- (?:none|.+; resume: .+)$/i.test(line));
  const pending = /\b(unserved|capacity-deferred|INCOMPLETE|re-eligible)\b/i.test(continuity) ||
    !/^- Active PR jobs and descendants: none$/m.test(sections['Lane state'] ?? '') ||
    holds?.some(line => !/^- none$/i.test(line) && !/; resume: user decision only$/i.test(line));
  term('pending-work', !continuityKnown || !holdKnown ? 'unknown' : pending ? 'fail' : 'pass', { holds: holds ?? null, pending: !!pending });
  const counts = Object.fromEntries(['pass', 'fail', 'unknown', 'n/a'].map(s => [s, terms.filter(t => t.status === s).length]));
  return { version: 1, observedAt: args['--now'], terms, counts };
}

try {
  if (process.argv[2] === 'quiet-facts') {
    if (process.argv.length === 4 && process.argv[3] === '--help') console.log(QUIET_HELP);
    else {
      const report = quietFacts(quietOptions(process.argv.slice(3)));
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.counts.unknown ? 2 : 0;
    }
  }
  else if (process.argv.slice(2).length === 1 && process.argv[2] === '--help') console.log(HELP);
  else {
    const report = compare(options(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.counts.unknown ? 2 : 0;
  }
} catch (error) {
  console.error(`schedule-drift: ${error.message}`);
  process.exitCode = 1;
}
