import * as fs from 'node:fs';
import { decide } from './default-policy.js';
import { commit } from './default-settings.js';
import { readHub } from './hub-usage.js';
export { decide } from './default-policy.js';

const help = `Usage: bun sync-default.js [--settings path] [--dry-run | --apply]
  --usage-file path   T3 UsageLimitSourceSnapshot array (otherwise read configured hub)
  --catalog-dir path T3 provider cache directory (default: T3 caches beside userdata)
  --history-file path Complete saved T3 thread-list JSON; optional fairness input
  --now ISO          Deterministic clock for fixtures; cannot combine with live hub
  --help             Print this help
Dry-run is the default and writes nothing. Reads settings, provider model caches,
optional snapshots/history, or configured cliproxy auth-files/api-call usage endpoints.
--apply writes ONLY global defaultModelSelection in --settings (default ~/.t3/userdata/settings.json).
Apply creates a sibling .axstack-default-sync.lock directory and unique .tmp file,
fsyncs and atomically renames settings, preserves mode, compares concurrent edits
and reads back; removes its lock/temp. Existing locks hold (no stale-lock stealing).
Symlinks refused. Other settings, project overrides, threads, roles and credentials
are never modified. Does not install/enable timers or write title instructions.
Exit: 0 decision/unchanged, 1 input/I/O error, 2 held. Output contains no secrets.`;

async function main() {
  const options = {};
  const values = ['--settings', '--usage-file', '--catalog-dir', '--history-file', '--now'];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help') { console.log(help); return; }
    if (Object.hasOwn(options, flag)) throw Error('duplicate flag');
    if (['--apply', '--dry-run'].includes(flag)) options[flag] = true;
    else if (values.includes(flag) && args[i + 1] && !args[i + 1].startsWith('--')) options[flag] = args[++i];
    else throw Error('invalid arguments');
  }
  if (options['--apply'] && options['--dry-run']) throw Error('conflicting modes');
  if (options['--now'] && !options['--usage-file']) throw Error('--now requires --usage-file');
  const requested = options['--settings'] ?? `${process.env.HOME}/.t3/userdata/settings.json`;
  const stat = fs.lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('settings must be a regular file');
  const path = fs.realpathSync(requested);
  const original = fs.readFileSync(path, 'utf8');
  const settings = JSON.parse(original);
  const now = options['--now'] ? Date.parse(options['--now']) : Date.now();
  const cache = options['--catalog-dir'] ?? `${path.slice(0, path.lastIndexOf('/'))}/../caches`;
  const catalogs = [];
  for (const [id, p] of Object.entries(settings.providerInstances ?? {})) {
    if (p.enabled !== true || !['claudeAgent', 'codex'].includes(p.driver)) continue;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error('invalid instance ID');
    try { catalogs.push(JSON.parse(fs.readFileSync(`${cache}/${id}.json`, 'utf8'))); }
    catch { /* Policy reports an unknown catalog; never guess a model. */ }
  }
  const usage = options['--usage-file'] ? JSON.parse(fs.readFileSync(options['--usage-file'], 'utf8')) : await readHub(settings, now);
  const history = options['--history-file'] ? JSON.parse(fs.readFileSync(options['--history-file'], 'utf8')) : null;
  const result = decide(settings, usage, catalogs, now, history);
  if (result.action === 'update' && options['--apply']) {
    const status = commit(path, original, result.selection);
    result.action = status === 'updated' ? 'updated' : 'held';
    if (status !== 'updated') result.reason = status;
  }
  result.mode = options['--apply'] ? 'apply' : 'dry-run';
  console.log(JSON.stringify(result));
  if (result.action === 'held') process.exitCode = 2;
}
if (import.meta.main) main().catch(() => {
  console.error('default sync failed: invalid input or settings I/O; no sensitive details logged');
  process.exitCode = 1;
});
