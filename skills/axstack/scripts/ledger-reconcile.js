import { readFileSync, readdirSync } from 'node:fs';

const help = `Usage: bun skills/axstack/scripts/ledger-reconcile.js --run-dir <dir> [--record <path>]
--run-dir  Required run directory; inspect immediate evidence/<key>/ directories
--record   Run record path (default: <run-dir>/run-record.md); relative to cwd
--help     Show flags, recognition rules and exit codes

Read-only: writes nothing, retains no state. JSON goes to stdout.
Dispatch rows are pipe-delimited (at least three cells), optionally prefixed by
"|" or "- ". The first cell is the dispatch key. An evidence cell must contain
exactly evidence/<key>/ or evidence/<key>/<file>, optionally in backticks.
Keys contain no whitespace. Table headings and prose mentions do not count.
Folder matching uses the evidence key, which can differ from the dispatch key.
Output lists folders, dispatch keys and per-folder pass/fail terms with evidence;
summary contains counts only. No term grants authority or an aggregate verdict.
Exit codes: 0 all folders matched, 1 input/read error, 2 incomplete ledger.
`;

function reconcile(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i], value = argv[i + 1];
    if (!['--run-dir', '--record'].includes(flag) || !value || value.startsWith('--') || flag in options) {
      throw Error(`invalid argument ${flag}; use --help`);
    }
    options[flag] = value;
  }
  if (!options['--run-dir']) throw Error('missing --run-dir; use --help');
  const runDir = options['--run-dir'];
  const record = options['--record'] ?? `${runDir}/run-record.md`;
  const source = readFileSync(record, 'utf8');
  const folders = readdirSync(`${runDir}/evidence`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const dispatches = [];
  for (const line of source.split('\n')) {
    const cells = line.trim().replace(/^[-*]\s+/, '').replace(/^\||\|$/g, '')
      .split('|').map((cell) => cell.trim().replace(/^`|`$/g, ''));
    if (cells.length < 3 || !/^\S+$/.test(cells[0])) continue;
    for (const cell of cells.slice(1)) {
      const match = /^evidence\/([^/\s`]+)\/[^\s`]*$/.exec(cell);
      if (match) dispatches.push({ key: cells[0], evidenceKey: match[1] });
    }
  }
  const terms = folders.map((key) => {
    const matches = dispatches.filter((dispatch) => dispatch.evidenceKey === key);
    return { key, status: matches.length ? 'pass' : 'fail', evidence: matches.length
      ? `evidence/${key}/ recorded by ${matches.map((dispatch) => dispatch.key).join(', ')}`
      : `evidence/${key}/ has no dispatch row` };
  });
  const summary = { pass: 0, fail: 0, unknown: 0, 'n/a': 0 };
  for (const term of terms) summary[term.status]++;
  console.log(JSON.stringify({ runDir, record, folders, dispatches, terms, summary }, null, 2));
  return summary.fail ? 2 : 0;
}

if (process.argv.length === 3 && process.argv[2] === '--help') {
  console.log(help);
} else {
  try {
    process.exitCode = reconcile(process.argv.slice(2));
  } catch (error) {
    console.log(JSON.stringify({ terms: [{ status: 'unknown', evidence: error.message }],
      summary: { pass: 0, fail: 0, unknown: 1, 'n/a': 0 } }));
    process.exitCode = 1;
  }
}
