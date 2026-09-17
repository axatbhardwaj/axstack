#!/usr/bin/env bun
// Trust transaction for the PR driver: the only write the automation makes to Claude Code's
// config store, ~/.claude.json.
//
//   bun trust.js seed   <worktree path> <clone path> <head sha>
//   bun trust.js unseed <worktree path>
//
// Exit 0 done · 2 store busy or unreadable, or lease compromised (retain the worktree, dispatch
// nothing) · 3 scope refused (never seed).
//
// One process, on purpose. Claude Code trusts per git toplevel and protects ~/.claude.json with a
// mkdir-based `<store>.lock` directory under proper-lockfile rules: a lock whose mtime is older
// than 10 s is abandoned and may be reclaimed, a held lock is kept alive by refreshing its mtime,
// a failed refresh is a compromised lease, and the refresher runs with the owner and dies with it.
// This follows the same rules, and because lock, refresher, render and rename all happen in this
// one process, nothing can outlive the owner and commit later.
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';

const STORE = process.env.CLAUDE_TRUST_STORE ?? `${process.env.HOME}/.claude.json`;
const LOCK = `${STORE}.lock`;
const STALE_MS = 10_000;     // Claude's stale threshold
const REFRESH_MS = 1_000;    // well under Claude's own 5 s refresh
const HEALTH_MS = 3_000;     // a lease refreshed longer ago than this is not healthy
const ACQUIRE_TRIES = 25;    // 25 × 200 ms bounded wait; never breaks a fresh lock

const [mode, wtArg, cloneArg, headArg] = process.argv.slice(2);
const usage = () => { console.error('usage: seed <worktree> <clone> <head> | unseed <worktree>'); process.exit(2); };
const canon = (p) => { try { return realpathSync(p); } catch { return null; } };
const git = (dir, ...args) => {
  const r = Bun.spawnSync(['git', '-C', dir, ...args], { stdout: 'pipe', stderr: 'pipe' });
  return r.exitCode === 0 ? r.stdout.toString().trim() : null;
};

let key;
let mutate;
if (mode === 'seed') {
  // Scope is enforced here, not by prose: the path must be a git worktree whose common dir is the
  // allowlisted clone's, must not be the clone itself, and must sit at exactly the pinned head.
  const wt = canon(wtArg); const clone = canon(cloneArg);
  if (!wt || !clone || wt === clone) process.exit(3);
  if (!/^[0-9a-f]{40}$/.test(headArg ?? '')) process.exit(3);
  const common = git(wt, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  if (!common || canon(common) !== canon(`${clone}/.git`)) process.exit(3);
  if (git(wt, 'rev-parse', 'HEAD') !== headArg) process.exit(3);
  key = wt;
  mutate = (doc) => { doc.projects ??= {}; doc.projects[key] = { ...(doc.projects[key] ?? {}), hasTrustDialogAccepted: true }; };
} else if (mode === 'unseed') {
  if (!wtArg) usage();
  key = canon(wtArg) ?? wtArg;   // the directory is usually gone by now; the key is the string
  mutate = (doc) => { if (doc.projects) delete doc.projects[key]; };
} else {
  usage();
}

// ---- Claude's lock, Claude's lease rules ----
const lockStat = () => { try { return statSync(LOCK); } catch { return null; } };
let got = false;
for (let i = 0; i < ACQUIRE_TRIES; i += 1) {
  try { mkdirSync(LOCK); got = true; break; } catch (e) { if (e.code !== 'EEXIST') process.exit(2); }
  // Reclaim only what Claude itself would treat as abandoned.
  const st = lockStat();
  if (st && Date.now() - st.mtimeMs >= STALE_MS) { try { rmdirSync(LOCK); } catch {} }
  Bun.sleepSync(200);
}
if (!got) process.exit(2);
// Ownership is the inode AND the mtime this process last set: ext4 hands a recreated directory
// the same inode number, so a reclaimed lock is told apart by its mtime (as proper-lockfile does).
const acquired = lockStat();
const ino = acquired?.ino;
let mtimeSet = acquired?.mtimeMs;
// after-acquire
let lastRefresh = Date.now();
let compromised = false;
let refreshes = 0;
const ownsLock = () => { const st = lockStat(); return !!st && st.ino === ino && st.mtimeMs === mtimeSet; };
const refresh = () => {
  if (!ownsLock()) { compromised = true; return; }
  try {
    // refresh-touch
    const now = new Date(); utimesSync(LOCK, now, now);
    mtimeSet = statSync(LOCK).mtimeMs;   // as the filesystem stored it, whatever its precision
    lastRefresh = Date.now(); refreshes += 1;
  } catch { compromised = true; }
};
// A lock reclaimed between mkdir and this first refresh belongs to someone else: leave it.
refresh();
if (compromised) { if (ownsLock()) { try { rmdirSync(LOCK); } catch {} } process.exit(2); }
const timer = setInterval(refresh, REFRESH_MS);

let tmp = null;
const release = () => {
  clearInterval(timer);
  if (tmp) { try { rmSync(tmp, { force: true }); } catch {} tmp = null; }
  if (ownsLock()) { try { rmdirSync(LOCK); } catch {} }
};
const fail = (code) => { release(); process.exit(code); };
process.on('SIGINT', () => fail(2)); process.on('SIGTERM', () => fail(2)); process.on('SIGHUP', () => fail(2));

// The lease is healthy only if the lock is still ours, no refresh has failed, and the last
// successful refresh is recent — well inside Claude's stale window.
const leaseHealthy = () => ownsLock() && !compromised && Date.now() - lastRefresh < HEALTH_MS;

try {
  // Re-read under the lock; a store that does not parse is never rewritten.
  let doc;
  try { doc = JSON.parse(readFileSync(STORE, 'utf8')); } catch { fail(2); }
  // typeof [] is 'object', and JSON.stringify drops named properties on arrays: a false exit 0.
  const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isPlain(doc) || (doc.projects !== undefined && !isPlain(doc.projects))) fail(2);
  mutate(doc);
  tmp = `${STORE}.tmp.${process.pid}.${Math.random().toString(16).slice(2)}`;
  writeFileSync(tmp, JSON.stringify(doc, null, 2));
  chmodSync(tmp, statSync(STORE).mode & 0o777);
  // before-commit
  // commit: only while the lease provably still holds, in this same process
  if (!leaseHealthy()) fail(2);
  renameSync(tmp, STORE);
  tmp = null;
} catch {
  fail(2);
}
release();
process.exit(0);
