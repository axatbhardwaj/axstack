import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';

const help = `Usage: bun scratch.js run [--root <existing-private-parent>] -- <command> [args...]
       bun scratch.js plan --root <scratch-root> [--root <scratch-root> ...]
       bun scratch.js --help

--root  Absolute directory, with no symlink components. Run accepts one existing
        owned 0700 parent outside realpath(HOME). Plan accepts named roots only.
--help  Print flags, effects and exit codes; no writes or child process.
run     Without --root, use a safe TMPDIR parent; if absent or unsafe, use /tmp.
        Create a fresh axstack-scratch-<random>/ root (0700), owner.json (0600),
        cwd/ (0700), tmp/ (0700). Print their declared absolute paths as JSON.
        The owner stamp identifies this helper's paths, not execution authority.
plan    Read only declared root metadata, owner.json and cwd/tmp metadata;
        validate path components and realpath(HOME). No scan or deletion.

Process effects: run launches exactly the given command without a shell, waits
for its exit, sets cwd and TMPDIR to the declared children, inherits other env
(including HOME), and sends child stdout/stderr to this helper's stderr.
Filesystem effects: run creates only the paths above, retaining even partial
creation on error. Plan has no filesystem writes. Cleanup: none in any mode;
caller owns validated literal-path cleanup, including after failures.
Network/container effects: none by the helper. The child may start processes,
write files, use the network or containers under the caller's authority.
This is NOT filesystem containment: absolute paths and HOME remain the caller's
responsibility. It provides no process containment or descendant cleanup.
No dispatch, scheduling, retries, merging or phase selection.

Reports per-term pass/fail/unknown/n/a with evidence, no aggregate verdict.
Exit 0: measured, including failed plan criteria or a nonzero child exit.
Exit 1: invalid input or execution error. Exit 2: hold or incomplete observation.
Child exitCode and signal are stored separately in the JSON child field.
`;

function options(argv) {
  const mode = argv[0];
  if (!['run', 'plan'].includes(mode)) throw Error('pass run or plan; see --help');
  const separator = argv.indexOf('--');
  const flags = argv.slice(1, separator < 0 ? undefined : separator);
  const roots = [];
  for (let i = 0; i < flags.length; i += 2) {
    const path = flags[i + 1];
    if (flags[i] !== '--root' || !path?.startsWith('/') || path.includes('\0') || path.split('/').some((p) => p === '..' || p === '.')) {
      throw Error('pass --root <absolute-path> without dot components; see --help');
    }
    roots.push(path.replace(/\/+/g, '/').replace(/\/$/, '') || '/');
  }
  const command = separator < 0 ? [] : argv.slice(separator + 1);
  if (mode === 'run' ? roots.length > 1 || !command.length : !roots.length || separator >= 0) {
    throw Error('run needs one command and at most one parent; plan needs roots only; see --help');
  }
  return { mode, roots, command };
}

function noLinks(path) {
  let component = '';
  for (const part of path.split('/').filter(Boolean)) {
    component += `/${part}`;
    if (lstatSync(component).isSymbolicLink()) return false;
  }
  return true;
}

function inspect(path, home, terms, systemParent = false) {
  const add = (id, status, evidence) => terms.push({ root: path, id, status, evidence });
  try {
    if (!path.startsWith('/') || path.split('/').some((part) => part === '.' || part === '..')) {
      add('path', 'fail', 'absolute path without dot components required');
      return false;
    }
    if (!noLinks(path)) {
      add('symlinks', 'fail', 'a path component is a symlink; not followed');
      return false;
    }
    add('symlinks', 'pass', 'no symlink components');
    const stat = lstatSync(path);
    const actual = realpathSync(path);
    const outside = actual !== home && !actual.startsWith(`${home === '/' ? '' : home}/`);
    const owner = stat.uid === process.getuid() || (systemParent && stat.uid === 0);
    const mode = stat.mode & 0o7777;
    const permissions = systemParent ? (!(mode & 0o022) || !!(mode & 0o1000)) : mode === 0o700;
    add('directory', stat.isDirectory() ? 'pass' : 'fail', { path });
    add('owner', owner ? 'pass' : 'fail', { uid: stat.uid, expected: process.getuid(), systemParent });
    add('mode', permissions ? 'pass' : 'fail', { mode: mode.toString(8), systemParent });
    add('outside-home', outside ? 'pass' : 'fail', { home, path });
    return stat.isDirectory() && owner && permissions && outside;
  } catch (error) {
    add('metadata', 'unknown', { code: error.code, message: error.message });
    return false;
  }
}

function stampFor(root) {
  return { version: 1, kind: 'axstack-scratch', uid: process.getuid(), root, cwd: `${root}/cwd`, tmp: `${root}/tmp` };
}

function inspectStamp(root, terms) {
  const path = `${root}/owner.json`;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o600) {
      terms.push({ root, id: 'stamp', status: 'fail', evidence: { path, reason: 'need owned regular 0600 stamp; links not followed' } });
      return;
    }
    const expected = stampFor(root);
    let stamp;
    try { stamp = JSON.parse(readFileSync(path, 'utf8')); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      terms.push({ root, id: 'stamp', status: 'fail', evidence: { path, reason: 'malformed JSON' } });
      return;
    }
    const matches = stamp && Object.entries(expected).every(([key, value]) => stamp[key] === value);
    terms.push({ root, id: 'stamp', status: matches ? 'pass' : 'fail', evidence: { path, expected } });
  } catch (error) {
    terms.push({ root, id: 'stamp', status: 'unknown', evidence: { path, code: error.code, message: error.message } });
  }
}

export async function main(argv) {
  if (argv.length === 1 && argv[0] === '--help') { console.log(help); return 0; }
  const report = { mode: null, roots: [], terms: [], child: null };
  try {
    const { mode, roots, command } = options(argv);
    Object.assign(report, { mode, roots });
    let home;
    try {
      if (!process.env.HOME) throw Error('HOME unavailable; cannot establish real HOME boundary');
      home = realpathSync(process.env.HOME);
    } catch (error) {
      report.terms.push({ id: 'home', status: 'unknown', evidence: error.message });
      console.log(JSON.stringify(report));
      return 2;
    }
    if (mode === 'plan') {
      for (const root of roots) {
        if (inspect(root, home, report.terms)) {
          inspectStamp(root, report.terms);
          inspect(`${root}/cwd`, home, report.terms);
          inspect(`${root}/tmp`, home, report.terms);
        } else {
          report.terms.push({ root, id: 'stamp', status: 'n/a', evidence: 'root not safe to read' });
        }
      }
    } else {
      let parent = roots[0];
      if (!parent && process.env.TMPDIR) {
        // Rejected environment candidates are facts, but do not prevent fallback.
        const candidate = process.env.TMPDIR;
        if (inspect(candidate, home, report.terms)) parent = candidate;
        else report.terms.push({ id: 'fallback', status: 'pass', evidence: 'unsafe TMPDIR ignored; using /tmp' });
      }
      if (roots.length ? !inspect(parent, home, report.terms) : !parent && !inspect('/tmp', home, report.terms, true)) {
        console.log(JSON.stringify(report));
        return 2;
      }
      parent ??= '/tmp';
      report.terms.push({ id: 'parent', status: 'pass', evidence: parent });
      const root = mkdtempSync(`${parent}/axstack-scratch-`);
      Object.assign(report, stampFor(root));
      chmodSync(root, 0o700);
      writeFileSync(`${root}/owner.json`, `${JSON.stringify(stampFor(root))}\n`, { mode: 0o600, flag: 'wx' });
      mkdirSync(`${root}/cwd`, { mode: 0o700 });
      mkdirSync(`${root}/tmp`, { mode: 0o700 });
      // Check the actual filesystem rather than assuming creation preserved mode/owner.
      const created = [];
      const safe = [root, `${root}/cwd`, `${root}/tmp`].every((path) => inspect(path, home, created));
      report.terms.push(...created);
      if (!safe) { console.log(JSON.stringify(report)); return 2; }
      const child = Bun.spawn(command, {
        cwd: `${root}/cwd`, env: { ...process.env, TMPDIR: `${root}/tmp` },
        stdin: 'inherit', stdout: 2, stderr: 'inherit',
      });
      report.child = { exitCode: await child.exited, signal: child.signalCode };
      report.terms.push({ id: 'child', status: 'pass', evidence: report.child });
    }
    console.log(JSON.stringify(report));
    // An observed unsafe inherited TMPDIR is complete once the safe fallback runs.
    return report.child ? 0 : report.terms.some((term) => term.status === 'unknown') ? 2 : 0;
  } catch (error) {
    const permissionGap = ['EACCES', 'EPERM'].includes(error.code);
    report.terms.push({ id: 'execution', status: permissionGap ? 'unknown' : 'fail', evidence: { message: error.message, code: error.code } });
    console.log(JSON.stringify(report));
    return permissionGap ? 2 : 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
