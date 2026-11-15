#!/usr/bin/env bun
import { readFileSync } from 'node:fs';

const HELP = `schedule-drift — canonical schedule comparison (R2 fact mode)
  bun schedule-drift.js --export FILE --bindings FILE [--prompts DIR] [--now ISO] [--max-age-seconds N]
  --export FILE   Saved JSON: {version:1,host,exportedAt,complete:true,tasks:[{scheduledTaskId,
                  projectId,prompt,schedule,enabled}]}. Export every relevant project; never use a live database.
  --bindings FILE Private JSON: {host,schedules:[{promptFile,scheduledTaskId,projectId,enabled,schedule,
                  values:{HOST_TOKEN:"literal value"}}]}. Declare all three packaged prompt filenames exactly once.
                  For intentional host exclusions use {promptFile,absent:true,scheduledTaskId?:expectedId}.
                  Fresh complete matching-host coverage yields n/a; any matching declared task ID fails.
                  Without a task ID, absent:true is an explicit host-scope declaration, not identity discovery.
                  Values substitute only explicit {{HOST_TOKEN}} placeholders. No implicit trim or normalization.
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
    fact('prompt', expected !== null && nonempty(task?.prompt), expected === task?.prompt,
      `exact UTF-8 bytes after declared host-token substitution; packaged sha256 ${packagedSha256 ?? 'unavailable'}`);
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

try {
  if (process.argv.slice(2).length === 1 && process.argv[2] === '--help') console.log(HELP);
  else {
    const report = compare(options(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.counts.unknown ? 2 : 0;
  }
} catch (error) {
  console.error(`schedule-drift: ${error.message}`);
  process.exitCode = 1;
}
