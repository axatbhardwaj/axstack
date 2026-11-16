#!/usr/bin/env bun
import { realpathSync } from 'node:fs';
import { captureVersion } from './capture-identity.js';
import { killGroup, runCommand } from './command-capture.js';

export const help = `Usage: check-run.js --repo PATH --repository ORIGIN --head REF --base REF --out DIR [options] -- COMMAND [ARG...]
Capture v${captureVersion}; receipt schema v1. Flags:
  --repo PATH          Git source root (origin URL must match --repository)
  --repository ORIGIN  Exact repository identity, as reported by git remote get-url origin
  --head REF           Resolve to a full commit SHA; must match source HEAD
  --base REF           Resolve to a full base SHA; typed refs are informational only
  --out DIR            Existing owned 0700 receipt directory outside all writable roots
  --cwd PATH           Command cwd (default: --repo)
  --snapshot SHA256    Exact source digest required when dirty; holds print the digest
  --pr URL             Optional PR identity, recorded alongside repository
  --image-digest VALUE Optional sandbox image sha256:<64 hex>; default null
  --writable-root PATH Additional untrusted writable mount; repeat for every mount
  --timeout-ms N       Deadline (default 300000)
  --log-bytes N        Combined stdout/stderr byte cap (default 1048576)
  --help              Show help; runs no child, writes nothing
Effects: reads Git identity/status using local git subprocesses with hooks/fsmonitor
 disabled, and hashes tracked and non-ignored untracked files, modes and
 symlink targets. Ignored untracked files (e.g. node_modules) and .git metadata
 are not bound; ignored-file changes cannot be detected by source comparison.
 The receipt snapshotScope names the ignore sources: .gitignore, .git/info/exclude
 and core.excludesFile (or Git's user-ignore default); local/user excludes widen
 the unbound set. Starts one detached command without a
 shell, with inherited environment, closed stdin, piped stdout/stderr and cwd.
 Creates two exclusive 0600 files (combined .log and schema-v1 .json) in --out;
 creates no directories, overwrites nothing, and retains both files for the caller.
 No container or network isolation is created; the command may use the network,
 spawn descendants and write anywhere its credentials permit. Declare all sandbox
 writable mounts with --writable-root; mount discovery is not performed.
 On exit, timeout, SIGINT, SIGTERM or SIGHUP, SIGKILLs the command's process group, drains
 pipes for up to 200ms, then cancels readers/closes handles. Escaped process groups
 are not contained. SIGKILL of check-run cannot clean up the process group; it
 may remain running without a receipt. A crash may do the same. No filesystem
 cleanup or source restoration is performed. Receipt path placement is not OS
 isolation from malicious commands running with the writer's credentials.
Exit: 0 measured (child may fail), 1 invocation/writer error, 2 hold/incomplete.
 Child exitCode is separate; terms describe capture facts, never proof sufficiency.
 Silence is valid. Timeout/spawn failure/interruption/truncation/incomplete drain
 leave capture unknown; changed source fails source identity. Neither closes a
 proof term that needs the missing evidence. No dispatch, retry, schedule or merge.
`;

export async function main(args, io = { stdout: console.log, stderr: console.error }) {
  if (args.length === 1 && args[0] === '--help') { io.stdout(help); return 0; }
  /** @type {Record<string, string>} */
  const flags = {};
  const writableRoots = [];
  const allowed = new Set(['repo', 'repository', 'head', 'base', 'out', 'cwd', 'snapshot', 'pr', 'image-digest', 'timeout-ms', 'log-bytes', 'writable-root']);
  let argv;
  try {
    const separator = args.indexOf('--');
    if (separator < 0 || separator === args.length - 1) throw Error('command required after --');
    argv = args.slice(separator + 1);
    for (let i = 0; i < separator; i += 2) {
      const key = args[i].slice(2), value = args[i + 1];
      if (!args[i].startsWith('--') || !allowed.has(key) || !value || i + 1 >= separator || (key !== 'writable-root' && key in flags)) throw Error(`invalid flag: ${args[i]}`);
      if (key === 'writable-root') writableRoots.push(value);
      else flags[key] = value;
    }
    for (const key of ['repo', 'repository', 'head', 'base', 'out']) if (!flags[key]) throw Error(`--${key} required`);
    for (const key of ['timeout-ms', 'log-bytes']) if (flags[key] && (!/^[1-9]\d*$/.test(flags[key]) || !Number.isSafeInteger(Number(flags[key])) || Number(flags[key]) > 2147483647)) throw Error(`invalid --${key}`);
  } catch (error) { io.stderr(error.message); return 1; }
  const state = { active: null, signal: null };
  const interrupt = (signal) => { state.signal = signal; if (state.active) killGroup(state.active); };
  const sigint = () => interrupt('SIGINT'), sigterm = () => interrupt('SIGTERM'), sighup = () => interrupt('SIGHUP');
  process.on('SIGINT', sigint);
  process.on('SIGTERM', sigterm);
  process.on('SIGHUP', sighup);
  try {
    const repo = realpathSync(flags.repo), cwd = realpathSync(flags.cwd ?? flags.repo);
    const binding = { tool: { name: 'check-run', version: captureVersion }, repo, repository: flags.repository, head: flags.head, base: flags.base,
      snapshot: flags.snapshot, pr: flags.pr, sandboxImageDigest: flags['image-digest'] ?? null, writableRoots };
    const step = await runCommand([], { evidence: flags.out }, 'check', argv, cwd, process.env,
      { timeoutMs: Number(flags['timeout-ms'] ?? 300000), logBytes: Number(flags['log-bytes'] ?? 1048576) }, state, argv, binding);
    io.stdout(JSON.stringify(step, null, 2));
    return step.terms.some(t => t.status === 'fail' || t.status === 'unknown') ? 2 : 0;
  } catch (error) { io.stderr(error.message); return error.captureHold ? 2 : 1; }
  finally { process.off('SIGINT', sigint); process.off('SIGTERM', sigterm); process.off('SIGHUP', sighup); }
}
if (import.meta.main) process.exit(await main(process.argv.slice(2)));
