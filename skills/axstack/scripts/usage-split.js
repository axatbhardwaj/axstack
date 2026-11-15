#!/usr/bin/env bun
import { Database } from 'bun:sqlite';
import { existsSync, writeFileSync } from 'node:fs';

const HELP = `usage-split — offline cost baseline (R2 fact mode)
  bun usage-split.js --cache FILE --rates FILE --state FILE --prs FILE --start ISO --end ISO [--billed FILE] [--out FILE]
  --cache FILE   Saved usage-scan-cache JSON, version 11; models/sessions/files dictionaries.
                 Rows: [timestampMs, modelIndex, sessionIndex, input, cacheRead, cacheWrite, output, reasoning, requestId].
                 Reasoning is included in output, never added again. Interval is [start,end).
  --rates FILE   Saved model-rates JSON: {document:{exactModelName:{input_cost_per_token,
                 cache_read_input_token_cost, cache_creation_input_token_cost, output_cost_per_token}}}.
  --state FILE   Saved standalone statev2 SQLite (no WAL), or JSON array of provider-thread rows,
                 or {providers:[],threads:[],runs:[]}. Provider rows: thread_id and payload_json
                 with nativeThreadRef.nativeId; normalized {thread,native} also accepted.
                 Optional thread metadata: thread_id,title,lineage,prs (URLs or {url}); runs: thread_id,turns.
                 SQLite reads provider_threads plus optional threads; JSON payload_json metadata accepted.
                 Export titles/lineage/PR links for full role inference. Absent metadata stays unknown.
  --prs FILE     JSON array of ten {url,mergedAt,mergeCommit} identities (40-char SHA).
                 Merge dates must lie in the interval. Supplied identities are not verified online.
  --start ISO    Inclusive timestamp, with timezone.
  --end ISO      Exclusive timestamp, with timezone.
  --billed FILE  Optional {usd,start,end,evidence} for this exact interval; otherwise billed cost unknown.
  --out FILE     Exclusively create this report; existing files are refused. Default: stdout only.
  --help         Show flags, formats, effects and limitations.
Side effects: none by default. --out creates only the caller-named report (also printed to stdout).
No network, dispatch, subprocess, live cache refresh, database sidecar, scheduling or persistent state.
SQLite is deserialized read-only in memory; supply a saved export, not a live database.
Role precedence follows the token-split audit: explicit roles, delegated title, coordinator titles, root driver.
PR links are thread-level associations, not request-level proof; shared work is never divided.
Proxy: exact-name base API rates only, excluding subscription/tier/priority premiums; never a bill.
Exit: 0 measured (including failed terms), 1 invalid input/error, 2 incomplete (unknown terms).
`;
const fields = ['input', 'cacheRead', 'cacheWrite', 'output'];
const rateFields = ['input_cost_per_token', 'cache_read_input_token_cost', 'cache_creation_input_token_cost', 'output_cost_per_token'];
const validNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const validCount = (n) => Number.isSafeInteger(n) && n >= 0;
const sha256 = (bytes) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const add = (a, b) => a === null || b === null ? null : a + b;
const timestamp = (s) => typeof s === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(s) ? Date.parse(s) : NaN;

function decoded(s) {
  for (let n = 0; n < 3; n++) {
    try { const next = decodeURIComponent(s); if (next === s) break; s = next; } catch { break; }
  }
  return s;
}

// Order is intentional: identical to the audited measure.ts classifier.
function classify(t) {
  const title = (t.title ?? '').toLowerCase(), id = decoded(t.thread_id).toLowerCase(), text = `${title} ${id}`;
  const role = text.match(/axstack-(?:author|reviewer|review|verifier|verify|diligence|readiness|advisor|adviser|escalation|auditor|owner|research|explainer|explore|scout|judge|brainstorm)[a-z0-9-]*/)?.[0] ?? null;
  const delegated = t.lineage?.relationshipToParent === 'subagent' || t.thread_id.startsWith('thread:delegated-task:');
  const result = (cls, type) => ({ class: cls, type, role });
  if (t.unmatched) return result('other', 'Unmapped transcripts');
  if (/axstack-author\b/.test(role ?? '')) return result('authoring', 'Authors');
  if (/axstack-owner\b/.test(role ?? '')) return result('orchestration overhead', 'PR owners');
  if (/axstack-(verifier|verify|diligence|readiness)\b/.test(role ?? '') || /axstack-reviewer[^: ]*verif/.test(role ?? '')) return result('verification', 'Verification / diligence');
  if (/axstack-review(?:er)?\b/.test(role ?? '') || /axstack-explainer-review\b/.test(role ?? '')) return result('review', 'Reviewers');
  if (/axstack-(advisor|adviser|escalation)\b/.test(role ?? '')) return result('orchestration overhead', 'Advisers / escalation');
  if (/axstack-auditor\b/.test(role ?? '')) return result('other', 'Audits');
  if (/axstack-(research|explore|scout)\b/.test(role ?? '')) return result('other', 'Research / exploration');
  if (/axstack-explainer\b/.test(role ?? '')) return result('other', 'Explainers');
  if (/collector/.test(title)) return result('orchestration overhead', 'Fleet collectors');
  if (/axstack review manager|review manager pass/.test(title)) return result('orchestration overhead', 'Review-manager passes');
  if (delegated && /review-mgr.*owner/.test(id)) return result('orchestration overhead', 'PR owners');
  if ((delegated && /\b(author|implement)\b/.test(title)) || /^(worker|author):/.test(title)) return result('authoring', 'Authors');
  if (delegated && /\b(verif|uiv|readiness|pentest|test[- :]|diligence)/.test(`${title} ${id.split('delegate-task:').pop()}`)) return result('verification', 'Verification / diligence');
  if ((delegated && /\b(review|rev[- :])/.test(title)) || /^reviewer:/.test(title)) return result('review', 'Reviewers');
  if (delegated && /\b(adviser|advisor|escalation)\b/.test(title)) return result('orchestration overhead', 'Advisers / escalation');
  if (/settle|settlement|close.?out|cleanup/.test(title)) return result('orchestration overhead', 'Settlement / cleanup');
  if (/watch|babysit|monitor.*pr|run[- ]wake/.test(title)) return result('orchestration overhead', 'Watches / PR monitoring');
  if (/review github and linear activity|^voa$|scheduled|schedule|periodic|status sweep|automation/.test(title)) return result('orchestration overhead', 'Schedules / status sweeps');
  if (!t.title && !role) return result('other', 'Unknown metadata');
  if (!role && !/^(researcher|subagent):/.test(title) && !delegated) return result('orchestration overhead', 'Drivers (mixed work)');
  if (delegated && /research|scout/.test(title)) return result('other', 'Research / exploration');
  return result('other', 'Other role / unresolved');
}

function readState(bytes) {
  if (bytes.subarray(0, 16).toString() !== 'SQLite format 3\0') {
    const saved = JSON.parse(bytes.toString());
    return Array.isArray(saved) ? { providers: saved, threads: saved, runs: [] } : saved;
  }
  // Deserialization cannot create journals, WAL/SHM files or mutate the saved DB.
  const db = Database.deserialize(bytes, { readonly: true });
  try {
    const table = (name) => db.query('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=?').get(name);
    return {
      providers: db.query('SELECT thread_id,payload_json FROM orchestration_v2_projection_provider_threads').all(),
      threads: table('orchestration_v2_projection_threads')
        ? db.query('SELECT thread_id,title,payload_json FROM orchestration_v2_projection_threads').all() : [],
      runs: [],
    };
  } finally { db.close(); }
}

const payload = (row) => typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json ?? {};
const prUrl = (p) => typeof p === 'string' ? p : p?.url;
const meter = () => ({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0, tokens: 0, observedTokens: 0,
  records: 0, knownRateProxyUsd: 0, unpricedTokens: 0 });
function accumulate(target, source) {
  for (const key of Object.keys(meter())) target[key] = add(target[key], source[key]);
}

function measure(cache, rates, state, prs, start, end, term) {
  const threads = new Map();
  for (const row of state.threads ?? []) {
    const p = payload(row), id = row.thread_id ?? row.thread;
    if (typeof id !== 'string') continue;
    const prior = threads.get(id);
    threads.set(id, { ...p, ...row, thread_id: id, lineage: row.lineage ?? p.lineage,
      prs: row.prs ?? [p.linkedPullRequest, p.branchPullRequest, ...p.pullRequests ?? []].filter(Boolean),
      turns: prior?.turns ?? 0, usage: prior?.usage ?? meter() });
  }
  const native = new Map();
  for (const row of state.providers ?? []) {
    const id = row.thread_id ?? row.thread, session = row.native ?? payload(row).nativeThreadRef?.nativeId;
    if (typeof id !== 'string' || typeof session !== 'string') continue;
    const ids = native.get(session) ?? new Set(); ids.add(id); native.set(session, ids);
    if (!threads.has(id)) threads.set(id, { thread_id: id, turns: 0, usage: meter(), prs: [] });
  }
  for (const run of state.runs ?? []) {
    const t = threads.get(run.thread_id);
    if (t && validCount(run.turns)) t.turns += run.turns;
  }
  const totals = meter(), seen = new Set();
  let duplicatesRemoved = 0, ambiguousRecords = 0, invalidRecords = 0, missingComponents = 0, unpricedRecords = 0, maxTs = null;
  for (const v of Object.values(cache.files)) {
    if (!Array.isArray(v?.r)) { invalidRecords++; continue; }
    for (const row of v.r) {
      if (!Array.isArray(row) || !validNumber(row[0])) { invalidRecords++; continue; }
      if (row[0] < start || row[0] >= end) continue;
      const session = cache.sessions[row[2]], model = cache.models[row[1]];
      const key = JSON.stringify([v.p, session, row[8] || row[0], row[1], ...row.slice(3, 8)]);
      if (seen.has(key)) { duplicatesRemoved++; continue; }
      seen.add(key); maxTs = Math.max(maxTs ?? row[0], row[0]);
      const ids = typeof session === 'string' ? native.get(session) : null;
      if (ids?.size > 1) {
        ambiguousRecords++;
        for (const candidate of ids) threads.get(candidate).uncertainUsage = true;
      }
      const id = ids?.size === 1 ? [...ids][0] : `UNMAPPED:${v.p}:${session ?? key}`;
      if (!threads.has(id)) threads.set(id, { thread_id: id, unmatched: true, turns: 0, usage: meter(), prs: [] });
      const usage = meter(), parts = fields.map((_, i) => validCount(row[i + 3]) ? row[i + 3] : null);
      for (let i = 0; i < fields.length; i++) usage[fields[i]] = parts[i];
      usage.tokens = parts.reduce(add, 0); usage.observedTokens = parts.reduce((n, x) => n + (x ?? 0), 0); usage.records = 1;
      if (usage.tokens === null) missingComponents++;
      const rate = rates.document?.[model];
      const priced = usage.tokens !== null && rate && validNumber(rate.input_cost_per_token) && validNumber(rate.output_cost_per_token)
        && parts.every((n, i) => n === 0 || validNumber(rate[rateFields[i]]));
      if (priced) usage.knownRateProxyUsd = parts.reduce((sum, n, i) => sum + n * (rate[rateFields[i]] ?? 0), 0);
      else { usage.unpricedTokens = usage.tokens; unpricedRecords++; }
      accumulate(totals, usage); accumulate(threads.get(id).usage, usage);
    }
  }
  const classes = new Map(), roleMapping = [], shared = [], unattributed = [], exclusive = new Map(), perPrShared = new Map();
  const attribution = { exclusiveTokens: 0, sharedTokens: 0, unattributedTokens: 0, unmatchedTokens: 0 };
  let missingUsageThreads = 0, unknownMetadata = 0;
  for (const t of threads.values()) {
    if (!t.turns && !t.usage.records && !t.uncertainUsage) continue;
    const role = classify(t), missing = !t.usage.records;
    const row = { threadId: t.thread_id, ...role, tokens: missing || t.uncertainUsage ? null : t.usage.tokens,
      observedTokens: t.usage.observedTokens, turns: t.turns, records: t.usage.records };
    roleMapping.push(row);
    if (missing) missingUsageThreads++;
    if (role.type === 'Unknown metadata') unknownMetadata++;
    const cls = classes.get(role.class) ?? { class: role.class, ...meter(), threads: 0, turns: 0, unmatchedSessions: 0, missingUsageThreads: 0 };
    cls.threads += t.unmatched ? 0 : 1; cls.unmatchedSessions += t.unmatched ? 1 : 0;
    cls.turns += t.turns; cls.missingUsageThreads += missing ? 1 : 0;
    accumulate(cls, t.usage); classes.set(role.class, cls);
    const links = [...new Set((t.prs ?? []).map(prUrl).filter(Boolean))];
    if (t.unmatched) attribution.unmatchedTokens = add(attribution.unmatchedTokens, row.tokens);
    if (links.length > 1) {
      shared.push({ ...row, prs: links }); attribution.sharedTokens = add(attribution.sharedTokens, row.tokens);
      for (const link of links) perPrShared.set(link, add(perPrShared.has(link) ? perPrShared.get(link) : 0, row.tokens));
    } else if (links.length === 1 && prs.some((p) => p.url === links[0])) {
      exclusive.set(links[0], add(exclusive.has(links[0]) ? exclusive.get(links[0]) : 0, row.tokens));
      attribution.exclusiveTokens = add(attribution.exclusiveTokens, row.tokens);
    } else {
      unattributed.push({ ...row, prs: links }); attribution.unattributedTokens = add(attribution.unattributedTokens, row.tokens);
    }
  }
  term('token-components', missingComponents || invalidRecords ? 'unknown' : 'pass', { missingComponents, invalidRecords, formula: fields.join(' + '), reasoningIncludedInOutput: true });
  term('native-join', ambiguousRecords ? 'unknown' : 'pass', { ambiguousRecords, unmatchedTokens: attribution.unmatchedTokens });
  term('usage-coverage', missingUsageThreads ? 'unknown' : 'pass', { missingUsageThreads, note: 'Class tokens count observed cache records only; missing-thread tokens remain null.' });
  term('role-mapping', unknownMetadata ? 'unknown' : 'pass', { unknownMetadata, method: 'audit role precedence; inferred roles; root drivers contain mixed work' });
  term('rates', unpricedRecords ? 'unknown' : 'pass', { unpricedRecords, unpricedTokens: totals.unpricedTokens, method: 'exact model name, base per-token rates; premiums unknown' });
  term('attribution', unattributed.length ? 'unknown' : shared.length ? 'n/a' : 'pass', { ...attribution, note: 'Thread associations only; shared work is reported without allocation.' });
  const prReports = prs.map((pr, i) => {
    const hasData = exclusive.has(pr.url) || perPrShared.has(pr.url), empty = !totals.records && !missingUsageThreads;
    const ex = hasData || empty ? exclusive.has(pr.url) ? exclusive.get(pr.url) : 0 : null;
    const sh = hasData || empty ? perPrShared.has(pr.url) ? perPrShared.get(pr.url) : 0 : null;
    const observed = add(ex, sh), fraction = observed ? ex / observed : null;
    term(`pr:${i + 1}`, empty ? 'n/a' : !hasData || observed === null ? 'unknown' : 'pass', { url: pr.url, exclusiveTokens: ex, sharedTokens: sh, exclusiveFraction: fraction, denominator: 'only observed tokens linked to this PR; total real PR cost unknown' });
    return { ...pr, exclusiveTokens: ex, sharedTokens: sh, observedTokens: observed, exclusiveFraction: fraction };
  });
  return { totals, classes: [...classes.values()].sort((a, b) => b.observedTokens - a.observedTokens), roleMapping,
    shared, unattributed, attribution, prs: prReports, duplicatesRemoved, ambiguousRecords,
    maxUsageTimestamp: maxTs === null ? null : new Date(maxTs).toISOString() };
}

async function main(argv) {
  if (argv.includes('--help')) { console.log(HELP); return 0; }
  const flags = {}, allowed = ['cache', 'rates', 'state', 'prs', 'start', 'end', 'billed', 'out'];
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].slice(2), value = argv[i + 1];
    if (!argv[i].startsWith('--') || !allowed.includes(key) || !value || value.startsWith('--')) throw Error(`Invalid flag/value: ${argv[i]}`);
    flags[key] = value;
  }
  for (const key of allowed.slice(0, 6)) if (!flags[key]) throw Error(`Required --${key}; see --help`);
  const start = timestamp(flags.start), end = timestamp(flags.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw Error('Require valid --start < --end with timezone');
  const interval = { start: new Date(start).toISOString(), end: new Date(end).toISOString(), endExclusive: true };
  const terms = [], inputs = {}, data = {};
  const term = (id, status, evidence) => terms.push({ id, status, evidence: [evidence] });
  for (const key of ['cache', 'rates', 'state', 'prs', 'billed']) {
    if (!flags[key]) continue;
    try {
      const bytes = Buffer.from(await Bun.file(flags[key]).arrayBuffer());
      inputs[key] = { path: flags[key], bytes: bytes.length, sha256: sha256(bytes) };
      if (key === 'state' && (existsSync(`${flags[key]}-wal`) || existsSync(`${flags[key]}-shm`))) {
        term('input:state', 'unknown', 'Require standalone saved SQLite, without WAL/SHM sidecars'); continue;
      }
      data[key] = key === 'state' ? readState(bytes) : JSON.parse(bytes.toString());
      term(`input:${key}`, 'pass', inputs[key]);
    } catch (error) {
      if (['ENOENT', 'EACCES', 'EPERM', 'EBUSY'].includes(error.code)) term(`input:${key}`, 'unknown', { path: flags[key], error: error.code });
      else throw error;
    }
  }
  const snapshot = { inputs, sha256: sha256(JSON.stringify({ interval, inputs: Object.entries(inputs).map(([k, v]) => [k, v.sha256]) })) };
  const report = { interval, snapshot, terms, billedCost: null };
  if (['cache', 'rates', 'state', 'prs'].every((key) => Object.hasOwn(data, key))) {
    if (!Array.isArray(data.prs)) throw Error('--prs must contain an array');
    const identities = data.prs.every((p) => p && /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(p.url)
      && /^[a-f0-9]{40}$/i.test(p.mergeCommit) && timestamp(p.mergedAt) >= start && timestamp(p.mergedAt) < end);
    term('merged-prs', data.prs.length === 10 && new Set(data.prs.map((p) => p?.url)).size === 10 && identities ? 'pass' : 'fail',
      { identities: data.prs, source: 'caller-supplied merged PR snapshot; no online verification' });
    const supported = data.cache?.version === 11 && Array.isArray(data.cache.models) && Array.isArray(data.cache.sessions)
      && data.cache.files && typeof data.cache.files === 'object' && !Array.isArray(data.cache.files);
    const stateSupported = Array.isArray(data.state?.providers) && ['threads', 'runs'].every((key) =>
      data.state[key] === undefined || Array.isArray(data.state[key]));
    const ratesSupported = data.rates?.document && typeof data.rates.document === 'object' && !Array.isArray(data.rates.document);
    term('cache-format', supported ? 'pass' : 'unknown', { version: data.cache?.version ?? null, supportedVersions: [11] });
    term('state-format', stateSupported ? 'pass' : 'unknown', 'Require exported provider rows with optional thread metadata and aggregate turns');
    term('rates-format', ratesSupported ? 'pass' : 'unknown', 'Require a saved model-rates document keyed by exact model name');
    if (supported && stateSupported && ratesSupported) Object.assign(report,
      measure(data.cache, data.rates, data.state, data.prs.filter(Boolean), start, end, term));
  }
  if (data.billed && validNumber(data.billed.usd) && timestamp(data.billed.start) === start
    && timestamp(data.billed.end) === end && typeof data.billed.evidence === 'string' && data.billed.evidence.trim()) {
    report.billedCost = data.billed; term('billed-cost', 'pass', data.billed);
  } else term('billed-cost', 'unknown', 'No matching interval statement supplied; list-price proxy is not billed spend');
  report.summary = Object.fromEntries(['pass', 'fail', 'unknown', 'n/a'].map((status) => [status, terms.filter((t) => t.status === status).length]));
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (flags.out) writeFileSync(flags.out, output, { flag: 'wx', mode: 0o600 });
  process.stdout.write(output);
  return report.summary.unknown ? 2 : 0;
}

try { process.exitCode = await main(process.argv.slice(2)); }
catch (error) { console.error(`usage-split: ${error.message}`); process.exitCode = 1; }
