import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';

const help = `Usage: bun scripts/run-init.js --slug <slug> [--date YYYYMMDD]
Example: bun scripts/run-init.js --slug cli-lessons --date 20261008

--slug  Required run slug: lowercase letters, digits and hyphens only
--date  Valid calendar date in YYYYMMDD; defaults to today's UTC date
--help  Show flags, side effects and exit codes without writing

Writes: creates <git-common-dir>/axstack/runs/<date>-<slug>[-n]/ and any
missing parent directories, then progress.md and empty evidence/ inside it.
Reads the Compact template in the adjacent references/run-record.md.
Creates an owned 0700 scratch directory named axstack-<run-id>-<random>
under the system temp directory (TMPDIR, otherwise /tmp), never under $HOME.
Leaves these paths for the caller to manage; never selects an existing run.
Prints paths and revision/inputs as JSON, with per-term status and evidence.
Exit codes: 0 ok, 1 input, Git or filesystem error; see --help to correct inputs.
`;

function optionsFrom(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!['--slug', '--date'].includes(flag)) throw new Error(`unexpected argument ${flag}; use --help`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value; pass ${flag} <value>`);
    if (flag in options) throw new Error(`duplicate ${flag}; pass it once`);
    options[flag] = value;
  }
  if (!options['--slug'] || !/^[a-z0-9-]+$/.test(options['--slug'])) {
    throw new Error('pass --slug <slug> using only lowercase letters, digits and hyphens');
  }
  const date = options['--date'] ?? new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (!/^\d{8}$/.test(date) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== iso) {
    throw new Error('pass --date YYYYMMDD with a valid calendar date');
  }
  return { slug: options['--slug'], date };
}

function git(...args) {
  const result = Bun.spawnSync(['git', '--no-optional-locks', ...args], { stdout: 'pipe', stderr: 'pipe' });
  return result.exitCode === 0 ? result.stdout.toString().trim() : null;
}

export function main(argv, io = { stdout: (text) => process.stdout.write(text), stderr: (text) => process.stderr.write(text) }) {
  try {
    if (argv.includes('--help')) {
      io.stdout(help);
      return 0;
    }
    const { slug, date } = optionsFrom(argv);
    const gitCommonDir = git('rev-parse', '--path-format=absolute', '--git-common-dir');
    if (!gitCommonDir) throw new Error('not in a Git repository; run this helper from a Git checkout');
    const head = git('rev-parse', '--verify', 'HEAD');
    const source = realpathSync(`${import.meta.dir}/../references/run-record.md`);
    const template = readFileSync(source, 'utf8').match(/^## Compact template\r?\n[\s\S]*?^```text\r?\n([\s\S]*?)^```/m)?.[1];
    if (!template) throw new Error('compact template missing; restore references/run-record.md');
    const temp = realpathSync(process.env.TMPDIR || '/tmp');
    const home = realpathSync(process.env.HOME);
    if (temp === home || temp.startsWith(`${home === '/' ? '' : home}/`)) {
      throw new Error('set TMPDIR to a system temp directory outside $HOME');
    }
    const runs = `${gitCommonDir}/axstack/runs`;
    mkdirSync(runs, { recursive: true });
    let runId, runDir;
    for (let suffix = 0; ; suffix += 1) {
      runId = `${date}-${slug}${suffix ? `-${suffix}` : ''}`;
      runDir = `${runs}/${runId}`;
      try {
        mkdirSync(runDir);
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
    const recordPath = `${runDir}/progress.md`;
    const evidenceDir = `${runDir}/evidence`;
    const scratchDir = mkdtempSync(`${temp}/axstack-${runId}-`);
    chmodSync(scratchDir, 0o700);
    const scratch = statSync(scratchDir);
    if (scratch.uid !== process.getuid() || (scratch.mode & 0o777) !== 0o700) {
      throw new Error('scratch ownership or permissions invalid; inspect the new scratch directory');
    }
    mkdirSync(evidenceDir);
    writeFileSync(recordPath, template.replace(/^Run: .*$/m, `Run: ${runId}`), { flag: 'wx' });
    io.stdout(`${JSON.stringify({ runId, runDir, recordPath, evidenceDir, scratchDir,
      inputs: { head, gitCommonDir, template: source, slug, date },
      terms: [
        { id: 'revision', status: head ? 'pass' : 'unknown', evidence: head ?? 'HEAD unavailable (unborn or unreadable)' },
        { id: 'run', status: 'pass', evidence: { runDir, recordPath, evidenceDir, template: source } },
        { id: 'scratch', status: 'pass', evidence: { scratchDir, uid: scratch.uid, mode: '0700' } },
      ],
    })}\n`);
    return 0;
  } catch (error) {
    io.stderr(`run-init error: ${error.message}\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
