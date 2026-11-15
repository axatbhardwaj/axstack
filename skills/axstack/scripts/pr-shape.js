import { gitArgv } from './git-argv.js';
import { existsSync, readFileSync } from 'node:fs';

const lockfiles = ['bun.lock', 'bun.lockb', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock'];
const help = `Usage: bun scripts/pr-shape.js --base <ref> --head <ref>
Example: bun scripts/pr-shape.js --base main --head HEAD

--base  Required actual PR base (parent branch for a stacked child)
--head  Required candidate commit or branch
--source Optional source ref for the read-only sync term; no source means n/a
--help  Show flags, example, bucket definitions and exit codes

Read-only Git; writes nothing, retains no state. Prints a bounded JSON summary:
input refs and resolved SHAs, merge-base, full additions/deletions, rename and
binary counts, and overlapping lockfile/generated buckets, with status and
reproducing argv plus calculation instructions. No path inventory is emitted.
Lockfiles match these exact basenames at any depth: ${lockfiles.join(', ')}.
Generated means linguist-generated set or true in .gitattributes at the head;
uses the destination path for renames. Unset, false and unspecified are excluded.
Ignores system/global attributes; local info/attributes causes an unknown bucket.
Never subtract buckets; formatter-only changes require manual disclosure.
Sync reports B <= H AND (H <= S OR (B <= S AND H tree == S tree)).
Ancestor exit 1 means fail; other Git errors or missing source objects mean unknown.
No term grants authority. No cohesion or approval verdict.
Exit codes: 0 measured (including failed terms), 1 input/Git error,
2 incomplete (unknown sync, no merge-base or unavailable committed-attribute evidence).
`;

function optionsFrom(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!['--base', '--head', '--source'].includes(flag)) throw new Error(`unexpected argument ${flag}; use --help`);
    const value = argv[i + 1];
    if (!value || value.startsWith('-')) throw new Error(`missing ref; pass ${flag} <commit-or-branch>`);
    if (flag in options) throw new Error(`duplicate ${flag}; pass it once`);
    options[flag] = value;
  }
  for (const flag of ['--base', '--head']) {
    if (!options[flag]) throw new Error(`missing ref; pass ${flag} <commit-or-branch>`);
  }
  return options;
}

const command = (...args) => gitArgv('-c', 'core.attributesFile=/dev/null', ...args);
function run(argv, input) {
  const result = Bun.spawnSync(argv, { stdin: input === undefined ? 'ignore' : new TextEncoder().encode(input),
    stdout: 'pipe', stderr: 'pipe', env: { ...process.env, GIT_ATTR_NOSYSTEM: '1' } });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function syncTerm(inputs, gitCommand) {
  const evidence = { base: inputs.base, head: inputs.head, source: null, commands: [] };
  if (!inputs.sourceRef) return { status: 'n/a', evidence: { ...evidence, reason: 'no --source supplied' } };
  const query = (...args) => {
    const argv = gitCommand(...args);
    evidence.commands.push(argv);
    return run(argv);
  };
  const result = (status, reason) => ({ status, evidence: { ...evidence, reason } });
  const source = query('rev-parse', '--verify', '--end-of-options', `${inputs.sourceRef}^{commit}`);
  if (source.code) return result('unknown', source.stderr.trim());
  inputs.source = evidence.source = source.stdout.trim();
  const ancestor = (a, b) => query('merge-base', '--is-ancestor', a, b).code;
  const baseHead = ancestor(inputs.base, inputs.head);
  if (baseHead !== 0) return result(baseHead === 1 ? 'fail' : 'unknown', 'base ancestor of head');
  const headSource = ancestor(inputs.head, inputs.source);
  if (headSource === 0) return result('pass', 'base <= head <= source');
  if (headSource !== 1) return result('unknown', 'head/source ancestry unavailable');
  const baseSource = ancestor(inputs.base, inputs.source);
  if (baseSource !== 0) return result(baseSource === 1 ? 'fail' : 'unknown', 'base ancestor of source');
  const headTree = query('rev-parse', '--verify', `${inputs.head}^{tree}`);
  const sourceTree = query('rev-parse', '--verify', `${inputs.source}^{tree}`);
  if (headTree.code || sourceTree.code) return result('unknown', 'tree objects unavailable');
  evidence.headTree = headTree.stdout.trim();
  evidence.sourceTree = sourceTree.stdout.trim();
  return result(evidence.headTree === evidence.sourceTree ? 'pass' : 'fail', 'base <= source and equal head/source trees');
}

function numstat(text) {
  const tokens = text.split('\0');
  const rows = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const firstTab = tokens[i].indexOf('\t'), secondTab = tokens[i].indexOf('\t', firstTab + 1);
    const added = tokens[i].slice(0, firstTab), deleted = tokens[i].slice(firstTab + 1, secondTab);
    let path = tokens[i].slice(secondTab + 1);
    const renamed = path === '';
    if (renamed) { i++; path = tokens[++i]; } // -z rename: empty path, old path, new path.
    rows.push({ path, renamed, binary: added === '-', additions: added === '-' ? 0 : Number(added),
      deletions: deleted === '-' ? 0 : Number(deleted) });
  }
  return rows;
}

function summarize(rows, evidence) {
  return { status: 'pass', files: rows.length,
    additions: rows.reduce((sum, row) => sum + row.additions, 0),
    deletions: rows.reduce((sum, row) => sum + row.deletions, 0),
    renames: rows.filter((row) => row.renamed).length,
    binaries: rows.filter((row) => row.binary).length,
    evidence: { ...evidence, calculations: {
      files: 'count selected numstat records', additions: 'sum numeric column 1 of selected records',
      deletions: 'sum numeric column 2 of selected records',
      renames: 'count selected -z records with empty path followed by old/new NUL paths',
      binaries: 'count selected records with - in both numeric columns (no estimated lines)',
    } } };
}

const proofFields = { files: 'Files', additions: 'Lines added', deletions: 'Lines removed',
  commits: 'Commits', head: 'Head SHA', base: 'Base SHA' };
const proofHelp = `Usage: bun scripts/pr-shape.js --proof --base <ref> --head <ref> [--body <path>]
       bun scripts/pr-shape.js --proof --pr <number> --repo <owner/repo> [--body <path>]

--proof Render/check PR Proof facts (separate from the unchanged shape mode)
--base  Actual current PR base ref, resolved with read-only Git
--head  Current candidate ref, resolved with read-only Git
--body  Optional UTF-8 PR body file to check; never modified
--pr    Positive PR number; read-only gh api fetches current facts and body
--repo  Explicit owner/repo for --pr; cannot combine --pr with --base/--head
--help  Show this mode's flags, output and exit codes

JSON: block (Markdown or null if facts unavailable), terms (each status, value,
evidence including reproducing commands, separate child exit codes/errors,
and stated body values when checked).
Git counts use the merge-base diff (-M numstat; binary lines count as zero),
and commits reachable from head but not base. PR mode reads REST pull facts,
including numeric commits (no truncated commit-list pagination), then resolves
the live base tip via git/ref/heads/<base.ref>. Evidence keeps snapshot/live SHAs.
No --body in Git mode renders only; PR mode checks the fetched body by default.
Checks require exactly one <!-- axstack:proof --> ... <!-- /axstack:proof -->
block and one line per field: Files, Lines added, Lines removed, Commits,
Head SHA, Base SHA. Counts must match; SHA prefixes need at least 7 hex digits.
Other prose and SHAs are ignored. Refresh refs before checking a local candidate.
Missing/duplicate/invalid body facts fail; unavailable Git/gh/body data is unknown.
This fact mode is read-only and stateless: writes nothing, grants no authority,
and supplies no aggregate verdict. No dispatch, retry, scheduling or merge.
Exit codes: 0 measured (including failed terms), 1 invalid input,
2 incomplete (one or more unknown terms).
`;

function proofOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i], value = argv[i + 1];
    if (!['--base', '--head', '--body', '--pr', '--repo'].includes(flag) ||
        !value || value.startsWith('-') || flag in options) throw Error(`invalid proof argument ${flag}; use --proof --help`);
    options[flag] = value;
  }
  if (options['--pr']) {
    if (!/^[1-9]\d*$/.test(options['--pr']) || !/^[\w.-]+\/[\w.-]+$/.test(options['--repo'] ?? '') ||
        options['--base'] || options['--head']) throw Error('--pr requires --repo owner/repo and excludes --base/--head');
  } else if (!options['--base'] || !options['--head'] || options['--repo']) {
    throw Error('proof requires --base and --head, or --pr and --repo');
  }
  return options;
}

function proof(argv, io) {
  if (argv.includes('--help')) { io.stdout(proofHelp); return 0; }
  const options = proofOptions(argv);
  const terms = Object.keys(proofFields).map((id) => ({ id, status: 'unknown', value: null,
    evidence: { cwd: process.cwd(), commands: [], results: [], reason: 'data unavailable' } }));
  const term = (id) => terms.find((t) => t.id === id);
  const query = (ids, args) => {
    for (const id of ids) term(id).evidence.commands.push(args);
    try {
      const result = run(args);
      for (const id of ids) term(id).evidence.results.push({ exitCode: result.code, stderr: result.stderr.trim() });
      if (result.code) {
        for (const id of ids) term(id).evidence.reason = result.stderr.trim() || `command exit ${result.code}`;
        return null;
      }
      return result.stdout;
    } catch (error) {
      for (const id of ids) {
        term(id).evidence.results.push({ exitCode: null, error: error.message });
        term(id).evidence.reason = error.message;
      }
      return null;
    }
  };
  const assign = (id, value) => {
    const valid = ['head', 'base'].includes(id) ? /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i.test(value ?? '')
      : Number.isSafeInteger(value) && value >= 0;
    if (valid) Object.assign(term(id), { status: 'pass', value, evidence: { ...term(id).evidence, reason: 'observed current fact' } });
  };
  let body, bodyError;
  if (options['--pr']) {
    const raw = query(Object.keys(proofFields), ['gh', 'api', `repos/${options['--repo']}/pulls/${options['--pr']}`]);
    try {
      const data = JSON.parse(raw ?? '{}');
      for (const [id, value] of Object.entries({ files: data.changed_files, additions: data.additions,
        deletions: data.deletions, commits: data.commits, head: data.head?.sha })) assign(id, value);
      const base = term('base');
      Object.assign(base.evidence, { snapshotSha: data.base?.sha ?? null, liveSha: null,
        baseRef: typeof data.base?.ref === 'string' ? data.base.ref : null });
      if (base.evidence.baseRef) {
        const ref = base.evidence.baseRef.split('/').map(encodeURIComponent).join('/');
        const live = query(['base'], ['gh', 'api', `repos/${options['--repo']}/git/ref/heads/${ref}`]);
        if (live !== null) {
          try {
            base.evidence.liveSha = JSON.parse(live)?.object?.sha ?? null;
            base.evidence.reason = 'live base ref response has no valid commit SHA';
            assign('base', base.evidence.liveSha);
          } catch { base.evidence.reason = 'invalid live base ref JSON response'; }
        }
      } else base.evidence.reason = 'PR base.ref unavailable; cannot resolve live base tip';
      if (typeof data.body === 'string') body = data.body;
      else bodyError = 'PR body unavailable in gh response';
    } catch { bodyError = 'invalid gh JSON response'; }
  } else {
    for (const id of ['base', 'head']) {
      const raw = query([id], command('rev-parse', '--verify', '--end-of-options', `${options[`--${id}`]}^{commit}`));
      if (raw !== null) assign(id, raw.trim());
    }
    const counts = ['files', 'additions', 'deletions', 'commits'];
    if (term('base').value && term('head').value) {
      const base = term('base').value, head = term('head').value;
      const commits = query(['commits'], command('rev-list', '--count', `${base}..${head}`, '--'));
      if (commits !== null && /^\d+\s*$/.test(commits)) assign('commits', Number(commits));
      const ids = counts.slice(0, 3);
      const merge = query(ids, command('merge-base', base, head));
      if (merge !== null) {
        const diff = query(ids, command('diff', '-M', '--no-relative', '--no-ext-diff', '--no-textconv', '--numstat', '-z', `${merge.trim()}..${head}`, '--'));
        if (diff !== null) {
          const rows = numstat(diff);
          assign('files', rows.length);
          assign('additions', rows.reduce((sum, row) => sum + row.additions, 0));
          assign('deletions', rows.reduce((sum, row) => sum + row.deletions, 0));
        }
      }
    } else {
      for (const id of counts) term(id).evidence = { ...term(id).evidence,
        commands: [...term('base').evidence.commands, ...term('head').evidence.commands],
        results: [...term('base').evidence.results, ...term('head').evidence.results],
        reason: 'base/head resolution unavailable; counts cannot be measured' };
    }
  }
  const block = terms.every((t) => t.status === 'pass')
    ? ['<!-- axstack:proof -->', ...terms.map((t) => `${proofFields[t.id]}: ${t.value}`), '<!-- /axstack:proof -->'].join('\n') : null;
  if (options['--body']) {
    try { body = readFileSync(options['--body'], 'utf8'); bodyError = null; }
    catch (error) { bodyError = error.message; }
  }
  if (options['--body'] || options['--pr']) {
    const blocks = [...(body ?? '').matchAll(/<!-- axstack:proof -->\r?\n([\s\S]*?)\r?\n<!-- \/axstack:proof -->/g)];
    for (const t of terms) {
      if (options['--body']) t.evidence.bodyPath = options['--body'];
      if (bodyError) { t.status = 'unknown'; t.evidence.reason = bodyError; continue; }
      if (t.status === 'unknown') continue;
      const values = blocks.length === 1 ? blocks[0][1].split(/\r?\n/)
        .filter((line) => line.startsWith(`${proofFields[t.id]}:`)).map((line) => line.slice(proofFields[t.id].length + 1).trim()) : [];
      t.evidence.stated = values;
      const stated = values[0] ?? '';
      const matches = ['base', 'head'].includes(t.id)
        ? /^[a-f0-9]{7,64}$/i.test(stated) && t.value.toLowerCase().startsWith(stated.toLowerCase())
        : /^(0|[1-9]\d*)$/.test(stated) && Number(stated) === t.value;
      t.status = values.length === 1 && matches ? 'pass' : 'fail';
      t.evidence.reason = blocks.length === 0 ? 'no facts block; render with --proof and paste the returned block into the PR body'
        : blocks.length !== 1 ? 'expected exactly one facts block' : 'compare stated value with current fact; one field required';
    }
  }
  io.stdout(`${JSON.stringify({ block, terms })}\n`);
  return terms.some((t) => t.status === 'unknown') ? 2 : 0;
}

export function main(argv, io = { stdout: (text) => process.stdout.write(text), stderr: (text) => process.stderr.write(text) }) {
  try {
    if (argv[0] === '--proof') return proof(argv.slice(1), io);
    if (argv.includes('--help')) { io.stdout(`${help}\n${proofHelp}`); return 0; }
    const options = optionsFrom(argv);
    const root = run(command('rev-parse', '--show-toplevel'));
    if (root.code) throw new Error('run this helper from a Git checkout');
    const repo = root.stdout.replace(/\n$/, '');
    const gitCommand = (...args) => command('-C', repo, ...args);
    const resolve = (flag) => {
      const result = run(gitCommand('rev-parse', '--verify', '--end-of-options', `${options[flag]}^{commit}`));
      if (result.code) throw new Error(`unresolved ${flag}; pass ${flag} <existing-commit-or-branch>`);
      return result.stdout.trim();
    };
    const inputs = { repo, baseRef: options['--base'], headRef: options['--head'], base: resolve('--base'), head: resolve('--head') };
    if (options['--source']) inputs.sourceRef = options['--source'];
    const sync = syncTerm(inputs, gitCommand);
    const mergeCommand = gitCommand('merge-base', inputs.base, inputs.head);
    const merge = run(mergeCommand);
    if (merge.code) {
      const unknown = { status: 'unknown', evidence: { commands: [mergeCommand], reason: merge.stderr.trim() || 'no common ancestor' } };
      io.stdout(`${JSON.stringify({ inputs, sync, mergeBase: { ...unknown, value: null }, totals: unknown,
        buckets: { lockfiles: unknown, generated: unknown } })}\n`);
      return 2;
    }
    const mergeBase = merge.stdout.trim();
    const diffCommand = gitCommand('diff', '-M', '--no-relative', '--no-ext-diff', '--no-textconv', '--numstat', '-z', `${mergeBase}..${inputs.head}`, '--');
    const diff = run(diffCommand);
    if (diff.code) throw new Error(`diff unavailable; verify --base and --head refer to readable commits: ${diff.stderr.trim()}`);
    const rows = numstat(diff.stdout);
    const attrCommand = gitCommand('check-attr', `--source=${inputs.head}`, '--stdin', '-z', 'linguist-generated');
    const attrEvidence = { commands: [diffCommand, attrCommand], environment: { GIT_ATTR_NOSYSTEM: '1' },
      stdin: 'feed check-attr the NUL-separated destination paths from the full numstat records',
      select: 'destination paths whose head linguist-generated value is set or true; never filter diff pathspecs' };
    const infoPath = run(gitCommand('rev-parse', '--path-format=absolute', '--git-path', 'info/attributes')).stdout.replace(/\n$/, '');
    // Git still reads info/attributes with --source; do not claim these are committed facts.
    const attrs = existsSync(infoPath) ? null : run(attrCommand, rows.map((row) => row.path).join('\0') + (rows.length ? '\0' : ''));
    let generated;
    if (!attrs || attrs.code) {
      generated = { status: 'unknown', evidence: { ...attrEvidence,
        reason: !attrs ? `local attribute override exists: ${infoPath}` : `committed attributes unavailable: ${attrs.stderr.trim()}` } };
    } else {
      const values = attrs.stdout.split('\0'), paths = new Set();
      for (let i = 0; i < values.length - 1; i += 3) {
        if (['set', 'true'].includes(values[i + 2])) paths.add(values[i]);
      }
      generated = summarize(rows.filter((row) => paths.has(row.path)), attrEvidence);
    }
    io.stdout(`${JSON.stringify({ inputs, sync, mergeBase: { status: 'pass', value: mergeBase, evidence: { commands: [mergeCommand] } },
      totals: summarize(rows, { commands: [diffCommand], select: 'all records; no exclusions' }),
      buckets: { lockfiles: summarize(rows.filter((row) => lockfiles.includes(row.path.split('/').at(-1))),
        { commands: [diffCommand], select: 'destination basename is exactly one of lockfileNames', lockfileNames: lockfiles }), generated },
      disclosures: 'Buckets may overlap. Never subtract them from totals. Formatter-only changes require manual disclosure; cohesion is a manual judgment.',
    })}\n`);
    return generated.status === 'unknown' || sync.status === 'unknown' ? 2 : 0;
  } catch (error) {
    io.stderr(`pr-shape error: ${error.message}\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
