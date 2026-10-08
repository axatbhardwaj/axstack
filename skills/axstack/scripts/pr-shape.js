import { existsSync } from 'node:fs';

const lockfiles = ['bun.lock', 'bun.lockb', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock'];
const help = `Usage: bun scripts/pr-shape.js --base <ref> --head <ref>
Example: bun scripts/pr-shape.js --base main --head HEAD

--base  Required actual PR base (parent branch for a stacked child)
--head  Required candidate commit or branch
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
No cohesion or approval verdict. Exit codes: 0 measured, 1 input/Git error,
2 incomplete (no merge-base or unavailable committed-attribute evidence).
`;

function optionsFrom(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!['--base', '--head'].includes(flag)) throw new Error(`unexpected argument ${flag}; use --help`);
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

const command = (...args) => ['git', '--no-optional-locks', '-c', 'core.attributesFile=/dev/null', ...args];
function run(argv, input) {
  const result = Bun.spawnSync(argv, { stdin: input === undefined ? 'ignore' : new TextEncoder().encode(input),
    stdout: 'pipe', stderr: 'pipe', env: { ...process.env, GIT_ATTR_NOSYSTEM: '1' } });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
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

export function main(argv, io = { stdout: (text) => process.stdout.write(text), stderr: (text) => process.stderr.write(text) }) {
  try {
    if (argv.includes('--help')) { io.stdout(help); return 0; }
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
    const mergeCommand = gitCommand('merge-base', inputs.base, inputs.head);
    const merge = run(mergeCommand);
    if (merge.code) {
      const unknown = { status: 'unknown', evidence: { commands: [mergeCommand], reason: merge.stderr.trim() || 'no common ancestor' } };
      io.stdout(`${JSON.stringify({ inputs, mergeBase: { ...unknown, value: null }, totals: unknown,
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
    io.stdout(`${JSON.stringify({ inputs, mergeBase: { status: 'pass', value: mergeBase, evidence: { commands: [mergeCommand] } },
      totals: summarize(rows, { commands: [diffCommand], select: 'all records; no exclusions' }),
      buckets: { lockfiles: summarize(rows.filter((row) => lockfiles.includes(row.path.split('/').at(-1))),
        { commands: [diffCommand], select: 'destination basename is exactly one of lockfileNames', lockfileNames: lockfiles }), generated },
      disclosures: 'Buckets may overlap. Never subtract them from totals. Formatter-only changes require manual disclosure; cohesion is a manual judgment.',
    })}\n`);
    return generated.status === 'unknown' ? 2 : 0;
  } catch (error) {
    io.stderr(`pr-shape error: ${error.message}\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
