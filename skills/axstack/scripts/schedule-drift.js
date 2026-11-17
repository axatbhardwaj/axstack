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

const QUIET_HELP = `schedule-drift quiet-facts — raw saved-input observations
  bun --no-env-file <installed>/schedule-drift.js quiet-facts --input FILE --continuity FILE [--now ISO]
  --input FILE JSON enclosing raw outputs without projecting or inventing row fields:
    {observedAt,repository:"owner/name",login,reap:{exitCode,dockerAvailable},
     searches:[REVIEW_REQUESTED_ARRAY,INVOLVES_ARRAY],inventory:{args,value},prior:READ_RESPONSE}.
    observedAt is the UTC collection time; repository/login/reap are the existing pass context/results.
    searches are the two gh search prs --limit 1000 JSON arrays exactly as printed:
      number, repository.nameWithOwner, updatedAt, isDraft, author.login; headRefOid when returned.
    Completeness is array length <1000 for BOTH searches; errors/missing arrays are unknown.
    Omitted head OIDs stay unobserved, never synthesized. Compare repository/number/updatedAt
    and only returned OIDs via pr-digest; new/changed fingerprints fail even without an OID.
    inventory is the T29 t3_thread_list {args,value} contract: merged pages, nextCursor:null,
    total matching threads.length; first args include includeSubagents:true and projectId
    (or allProjects:true), cursor absent/0, no statuses/settled/snoozed/titleContains filters.
    Keep native threadId/projectId/parentThreadId/status/settled/latestRunId and currentThreadId.
    prior is ONE raw t3_thread_read of the recorded prior thread, including its thread metadata;
    no other thread reads or caller-derived guard/liveness/completeness fields are required.
    Raw MCP structuredContent or text-content wrappers are also accepted.
    Native preparing/queued/starting/running/waiting are busy regardless of settlement/guards;
    completed/failed/cancelled/interrupted/rolled_back are terminal. Idle has no active run.
    Unknown status is unknown. Descendants come from native parentThreadId relationships.
  --continuity FILE Saved progress.md with Lane state, Open holds, Watermarks, Last pass.
    Lane state: '- threadId: ID' before replacement; '- Active PR jobs and descendants: none'
    or recorded active jobs. Guards use recorded '- ID: held|flagged', '; state:' / '; guard:'
    or '; resume: user decision only' on that exact thread's line, never agent judgment.
    Open holds: '- none' or one line per hold; only '; resume: user decision only' is user-only.
    Pending rows in Lane state/Watermarks/Open holds start with unserved/capacity-deferred/
    INCOMPLETE/re-eligible or use '; status: STATE'. Historical Last pass prose is not pending.
    Watermarks: '- Quiet gate: JSON [repo#number,headRefOid,updatedAt] triples';
    '- Last full pass: UTC ISO'. Missing/malformed continuity stays unknown.
  --now ISO Observation time with timezone; default current UTC; collection age must be 0..300s.
  --help Show flags, input contract, effects and limitations.
No writes, subprocesses, network, T3 calls, database access or persistent state. Run from cwd /.
Facts only; counts, no aggregate verdict or authority. Driver applies quiet/full/hold rules.
Exit: 0 measured (including fail), 1 invalid CLI, 2 incomplete/unknown, including read/JSON failure.
`;

const terminalRuns = ['completed', 'failed', 'cancelled', 'interrupted', 'rolled_back'];
const activeRuns = ['preparing', 'queued', 'starting', 'running', 'waiting'];
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
// Preserve tool outputs: unwrap MCP packaging, never project caller-invented row fields.
function nativeValue(value) {
  if (value?.isError) return null;
  if (value?.structuredContent) return value.structuredContent;
  if (Array.isArray(value?.content)) {
    try { return JSON.parse(value.content.find(item => item.type === 'text')?.text); } catch { return null; }
  }
  return value;
}
function rawQuietFacts(args, input, continuity, inputSha256, continuitySha256) {
  const terms = [], term = (id, status, evidence) => terms.push({ id, status, evidence });
  const age = (time(args['--now']) - time(input.observedAt)) / 1000;
  const fresh = Number.isFinite(age) && age >= 0 && age <= 300;
  term('observations', fresh ? 'pass' : 'unknown', { ageSeconds: Number.isFinite(age) ? age : null, inputSha256 });
  const sections = Object.fromEntries(['Lane state', 'Open holds', 'Watermarks', 'Last pass'].map(name => [name, section(continuity, name)]));
  const continuityKnown = Object.values(sections).every(nonempty);
  term('continuity', continuityKnown ? 'pass' : 'unknown', { continuitySha256 });
  const snapshot = input.inventory, call = snapshot?.args, value = nativeValue(snapshot?.value), rows = value?.threads;
  const byId = new Map();
  let complete = fresh && call && Array.isArray(rows) && !snapshot.isError && !value.isError && !value.truncated && !value.hasMore &&
    value.nextCursor === null && value.total === rows.length && call.includeSubagents === true &&
    (call.cursor === undefined || call.cursor === 0) && !['statuses', 'settled', 'snoozed', 'titleContains'].some(key => Object.hasOwn(call, key));
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!nonempty(row?.threadId) || !nonempty(row?.projectId) || byId.has(row.threadId) ||
      !(row.parentThreadId === null || nonempty(row.parentThreadId)) || row.parentThreadId === row.threadId) { complete = false; continue; }
    byId.set(row.threadId, row);
  }
  for (const row of byId.values()) {
    const seen = new Set([row.threadId]); let parent = row.parentThreadId;
    while (byId.has(parent)) {
      if (seen.has(parent)) { complete = false; break; }
      seen.add(parent); parent = byId.get(parent).parentThreadId;
    }
  }
  const self = byId.get(value?.currentThreadId), projectId = self?.projectId;
  const scoped = complete && self && (call.allProjects === true || nonempty(call.projectId) && call.projectId === projectId &&
    [...byId.values()].every(row => row.projectId === projectId));
  const identity = !!scoped && repoName(input.repository);
  term('identity', identity ? 'pass' : 'unknown', { repository: input.repository ?? null, projectId: projectId ?? null, selfThreadId: self?.threadId ?? null });
  const reap = input.reap;
  term('reap', !Number.isInteger(reap?.exitCode) || typeof reap?.dockerAvailable !== 'boolean' ? 'unknown' :
    reap.exitCode === 0 && reap.dockerAvailable ? 'pass' : 'fail', reap ?? 'no saved reap result');
  let discovery = fresh && nonempty(input.login) && Array.isArray(input.searches) && input.searches.length === 2;
  const prs = new Map();
  for (const raw of Array.isArray(input.searches) ? input.searches : []) {
    const found = nativeValue(raw), seen = new Set();
    if (!Array.isArray(found) || found.length >= 1000) { discovery = false; continue; }
    for (const pr of found) {
      const repository = pr?.repository?.nameWithOwner, key = `${repository}#${pr?.number}`;
      if (!repoName(repository) || !Number.isSafeInteger(pr?.number) || pr.number < 1 || seen.has(key) ||
        !nonempty(pr.author?.login) || typeof pr.isDraft !== 'boolean' || !Number.isFinite(time(pr.updatedAt)) ||
        time(pr.updatedAt) > time(args['--now']) || pr.headRefOid !== undefined && !/^[a-f0-9]{40,64}$/.test(pr.headRefOid)) {
        discovery = false; continue;
      }
      seen.add(key);
      if (pr.author.login.toLowerCase() === input.login?.toLowerCase?.() || pr.isDraft || pr.state && pr.state.toLowerCase() !== 'open') continue;
      const row = [key, pr.headRefOid ?? null, pr.updatedAt];
      if (prs.has(key) && !equal(prs.get(key), row)) discovery = false;
      prs.set(key, row);
    }
  }
  term('discovery', discovery ? 'pass' : 'unknown', { eligible: prs.size, resultCounts: input.searches?.map?.(r => nativeValue(r)?.length ?? null) ?? [] });
  let previous;
  try { previous = JSON.parse(sections.Watermarks?.match(/^- Quiet gate: (.+)$/m)?.[1]); } catch { /* unknown watermark */ }
  const comparison = compareQuietPRs(previous, [...prs.values()], { optionalHeads: true });
  term('pr-list', discovery && continuityKnown ? comparison.status : 'unknown', comparison.evidence);
  const elapsed = time(args['--now']) - time(sections.Watermarks?.match(/^- Last full pass: (.+)$/m)?.[1]);
  term('full-pass-age', !continuityKnown || !Number.isFinite(elapsed) ? 'unknown' : elapsed >= 0 && elapsed < 14400000 ? 'pass' : 'fail',
    { ageSeconds: Number.isFinite(elapsed) ? elapsed / 1000 : null });
  const priorIds = [...(sections['Lane state'] ?? '').matchAll(/^- threadId: (\S+)$/gm)].map(m => m[1]);
  const read = nativeValue(input.prior?.value ?? input.prior), prior = read?.thread;
  const knownStatus = row => row && [...terminalRuns, ...activeRuns, 'idle'].includes(row.status);
  const priorKnown = identity && priorIds.length === 1 && prior?.threadId === priorIds[0] && prior.threadId !== self.threadId &&
    prior.projectId === projectId && typeof prior.settled === 'boolean' && knownStatus(prior);
  const laneIds = new Set([...byId.values()].filter(row => row.projectId === projectId).map(row => row.threadId));
  // allProjects snapshots may contain cross-project descendants of this lane.
  let added;
  do {
    added = false;
    for (const row of byId.values()) if (laneIds.has(row.parentThreadId) && !laneIds.has(row.threadId)) { laneIds.add(row.threadId); added = true; }
  } while (added);
  const laneRows = [...laneIds].map(id => byId.get(id));
  const laneKnown = identity && laneRows.every(knownStatus);
  const threadsKnown = laneKnown && priorKnown;
  const descendants = laneRows.filter(row => laneIds.has(row.parentThreadId)).map(row => row.threadId);
  term('thread-readbacks', threadsKnown ? 'pass' : 'unknown', { listed: laneRows.length, descendantThreadIds: descendants, priorThreadId: prior?.threadId ?? null, priorReads: prior ? 1 : 0 });
  term('ownership', threadsKnown && continuityKnown ? 'pass' : 'unknown', { completeInventory: !!scoped, projectId: projectId ?? null, total: value?.total ?? null });
  const holds = sections['Open holds']?.trim().split('\n').filter(nonempty) ?? [];
  const holdKnown = holds.length > 0 && holds.every(line => /^- .+/.test(line));
  const priorLines = [...(sections['Lane state'] ?? '').split('\n'), ...holds].filter(line =>
    priorIds[0] && line.split(/[^\w-]+/).includes(priorIds[0]));
  const guarded = priorLines.some(line => /(?:^- \S+:\s*|;\s*(?:state|guard):\s*)(?:held|flagged|owned watch|pending receipt|wedged|stalled owner|protected)\b|;\s*resume: user decision only$/i.test(line));
  const terminal = row => terminalRuns.includes(row.status);
  term('prior-pass', !priorKnown || !continuityKnown || !holdKnown ? 'unknown' : prior.settled || terminal(prior) && guarded ? 'pass' : 'fail',
    { threadId: prior?.threadId ?? null, status: prior?.status ?? null, settled: prior?.settled ?? null, recordedGuard: guarded });
  const nonterminal = row => !terminal(row) && row.status !== 'idle';
  const busy = [...laneRows, ...(priorKnown ? [prior] : [])].filter(row => row.threadId !== self?.threadId && nonterminal(row)).map(row => row.threadId);
  term('lane-idle', !laneKnown ? 'unknown' : busy.length ? 'fail' : 'pass', { nonterminalThreadIds: [...new Set(busy)] });
  const recorded = [sections['Lane state'], sections.Watermarks, sections['Open holds']].filter(Boolean).join('\n');
  const event = /^- (?:unserved|capacity-deferred|INCOMPLETE|re-eligible)\b|;\s*status:\s*(?:unserved|capacity-deferred|INCOMPLETE|re-eligible)\b/gm;
  const jobs = sections['Lane state']?.match(/^- Active PR jobs and descendants: (.+)$/m)?.[1];
  const pending = event.test(recorded) || jobs !== 'none' || holds.some(line =>
    !/^- none$/i.test(line) && !/; resume: user decision only$/i.test(line));
  term('pending-work', !continuityKnown || !holdKnown || !nonempty(jobs) ? 'unknown' : pending ? 'fail' : 'pass',
    { activeJobs: jobs ?? null, holds, pending });
  const counts = Object.fromEntries(['pass', 'fail', 'unknown', 'n/a'].map(s => [s, terms.filter(t => t.status === s).length]));
  return { version: 2, observedAt: args['--now'], terms, counts };
}

function quietFacts(args) {
  let input, continuity = '', inputSha256 = null, continuitySha256 = null;
  try { const bytes = readFileSync(args['--input']); inputSha256 = sha256(bytes); input = JSON.parse(bytes.toString()); } catch { /* unknown input */ }
  try { const bytes = readFileSync(args['--continuity']); continuitySha256 = sha256(bytes); continuity = bytes.toString(); } catch { /* unknown continuity */ }
  return rawQuietFacts(args, input ?? {}, continuity, inputSha256, continuitySha256);
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
