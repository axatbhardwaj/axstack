// Behavioral checks on the trust transaction helper the driver runs to
// pre-trust a worktree it just created, and to untrust it on cleanup. The
// helper owns the only write the automation makes to Claude Code's config
// store, so this is where the safety properties are exercised for real:
// scope enforcement, Claude's own lock, no lost updates, mode preservation.
import { test, expect, afterEach } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const HELPER = `${root}/docs/plans/pr-automations-trust.sh`;
const HEAD_RE = /^[0-9a-f]{40}$/;
let sandbox;

const sh = (cmd, env = {}) => {
  const r = Bun.spawnSync(['bash', '-c', cmd], { env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
};

// A real clone with one commit, and a real worktree of it at that commit —
// the shape the driver creates.
const setup = () => {
  sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-trust-`);
  const clone = `${sandbox}/clones/repo`;
  mkdirSync(clone, { recursive: true });
  sh(`cd ${clone} && git init -q && git config user.email t@t && git config user.name t && echo x > f && git add f && git commit -qm init`);
  const head = sh(`git -C ${clone} rev-parse HEAD`).out.trim();
  expect(head).toMatch(HEAD_RE);
  const wt = `${sandbox}/workspaces/repo/pr-repo-1-review`;
  mkdirSync(`${sandbox}/workspaces/repo`, { recursive: true });
  sh(`git -C ${clone} worktree add -q --detach ${wt} ${head}`);
  const store = `${sandbox}/claude.json`;
  writeFileSync(store, JSON.stringify({ projects: { '/elsewhere': { hasTrustDialogAccepted: true } }, sessionState: 'kept' }));
  chmodSync(store, 0o600);
  return { clone, head, wt, store, env: { CLAUDE_TRUST_STORE: store } };
};
const run = (env, args) => sh(`bash ${HELPER} ${args}`, env.env);
const read = (env) => JSON.parse(readFileSync(env.store, 'utf8'));

afterEach(() => { if (sandbox) rmSync(sandbox, { recursive: true, force: true }); sandbox = null; });

test('seed trusts exactly the worktree created from the clone at the pinned head', () => {
  const env = setup();
  const r = run(env, `seed ${env.wt} ${env.clone} ${env.head}`);
  expect(r.code, r.err).toBe(0);
  const store = read(env);
  expect(store.projects[env.wt].hasTrustDialogAccepted).toBe(true);
  // Unrelated state is untouched, and the file mode is preserved.
  expect(store.sessionState).toBe('kept');
  expect(store.projects['/elsewhere'].hasTrustDialogAccepted).toBe(true);
  expect(statSync(env.store).mode & 0o777).toBe(0o600);
});

test('seed refuses the clone itself, a wrong clone, a wrong head, and a path that is not a worktree', () => {
  const env = setup();
  const other = `${sandbox}/clones/other`;
  mkdirSync(other, { recursive: true });
  sh(`cd ${other} && git init -q && git config user.email t@t && git config user.name t && git commit -q --allow-empty -m x`);
  for (const [label, args] of [
    ['the clone itself', `seed ${env.clone} ${env.clone} ${env.head}`],
    ['a worktree of a different clone', `seed ${env.wt} ${other} ${env.head}`],
    ['a wrong head', `seed ${env.wt} ${env.clone} ${'0'.repeat(40)}`],
    ['a plain directory', `seed ${sandbox}/workspaces ${env.clone} ${env.head}`],
    ['a missing path', `seed ${sandbox}/nope ${env.clone} ${env.head}`],
  ]) {
    const r = run(env, args);
    expect(r.code, `${label}: must be refused (scope), got ${r.code} ${r.err}`).toBe(3);
  }
  expect(read(env).projects[env.wt], 'nothing was written').toBeUndefined();
});

test('seed and unseed take the lock Claude Code uses and never force a held one', () => {
  const env = setup();
  mkdirSync(`${env.store}.lock`);
  const r = run(env, `seed ${env.wt} ${env.clone} ${env.head}`);
  expect(r.code, 'busy lock must be reported, not broken').toBe(2);
  expect(existsSync(`${env.store}.lock`), 'the foreign lock is left in place').toBe(true);
  expect(read(env).projects[env.wt]).toBeUndefined();
  // A live holder keeps its lease fresh; only an abandoned lock goes stale.
  sh(`touch "${env.store}.lock"`);
  const u = run(env, `unseed ${env.wt}`);
  expect(u.code).toBe(2);
  expect(existsSync(`${env.store}.lock`), 'a fresh foreign lock is still not broken').toBe(true);
  rmSync(`${env.store}.lock`, { recursive: true });
  expect(run(env, `seed ${env.wt} ${env.clone} ${env.head}`).code).toBe(0);
  expect(existsSync(`${env.store}.lock`), 'the lock is released after the write').toBe(false);
}, 30000);

test('concurrent seeds and a concurrent lock-taking writer lose nothing', () => {
  const env = setup();
  const paths = [];
  for (let i = 0; i < 8; i += 1) {
    const wt = `${sandbox}/workspaces/repo/pr-repo-${i + 10}-review`;
    sh(`git -C ${env.clone} worktree add -q --detach ${wt} ${env.head}`);
    paths.push(wt);
  }
  // A writer that behaves like Claude Code: takes the same mkdir lock, then
  // read-modify-writes its own key.
  const claudeLike = `for n in $(seq 1 20); do
      got=0; for i in $(seq 1 100); do if mkdir "${env.store}.lock" 2>/dev/null; then got=1; break; fi; sleep 0.05; done
      [ "$got" -eq 1 ] || { echo "claude-like writer could not acquire" >&2; exit 9; }
      t="${env.store}.tmp.$$.$RANDOM"; jq --arg n "$n" '.claudeWrites = ((.claudeWrites // 0) + 1)' "${env.store}" > "$t" && mv "$t" "${env.store}"
      rmdir "${env.store}.lock"; done`;
  const seeds = paths.map((p) => `bash ${HELPER} seed ${p} ${env.clone} ${env.head} &`).join('\n');
  const r = sh(`${seeds}\n(${claudeLike}) &\nwait`, env.env);
  expect(r.code, r.err).toBe(0);
  const store = read(env);
  for (const p of paths) expect(store.projects[p]?.hasTrustDialogAccepted, `lost seed for ${p}`).toBe(true);
  expect(store.claudeWrites, 'lost a concurrent Claude-like write').toBe(20);
  expect(store.sessionState).toBe('kept');
  expect(existsSync(`${env.store}.lock`)).toBe(false);
  expect(sh(`ls ${env.store}.tmp.* 2>/dev/null | wc -l`).out.trim(), 'no temp files left').toBe('0');
}, 60000);

test('a rename delayed past the stale threshold cannot be stolen from, because the lease is refreshed while held', () => {
  // The exact check-to-use gap the review reproduced: still_owned passes,
  // then the rename itself stalls. A faithful proper-lockfile thief steals
  // only when the lock's mtime is older than its stale threshold. With the
  // lease refreshed continuously while held, the mtime never ages and the
  // thief never steals; without it, the thief steals and the seed clobbers
  // its write. The thief's stale threshold is scaled down to keep the test
  // short; the helper's refresh interval is fixed and much shorter.
  const env = setup();
  const shim = `${sandbox}/shim`;
  mkdirSync(shim);
  // mv that stalls 4 s, then performs the real rename.
  writeFileSync(`${shim}/mv`, '#!/bin/sh\nsleep 4\nexec /bin/mv "$@"\n'); chmodSync(`${shim}/mv`, 0o755);
  const thief = `for i in $(seq 1 60); do
      if [ -d "${env.store}.lock" ]; then
        age=$(( $(date +%s) - $(stat -c %Y "${env.store}.lock") ))
        if [ "$age" -ge 3 ]; then
          rmdir "${env.store}.lock" && mkdir "${env.store}.lock" && stole=1
          t="${env.store}.tmp.thief"; jq '.concurrentClaudeWrite = "must-survive"' "${env.store}" > "$t" && /bin/mv "$t" "${env.store}"
          rmdir "${env.store}.lock"; break
        fi
      fi; sleep 0.1; done; echo "stole=\${stole:-0}"`;
  const r = sh(`bash ${HELPER} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    sleep 0.5; (${thief})
    wait $pid; echo "helper=$?"`, { ...env.env, PATH: `${shim}:${process.env.PATH}` });
  expect(r.out, 'the thief must never have seen a stale lock').toMatch(/stole=0/);
  expect(r.out).toMatch(/helper=0/);
  expect(read(env).projects[env.wt].hasTrustDialogAccepted).toBe(true);
  expect(existsSync(`${env.store}.lock`), 'lock released').toBe(false);
}, 30000);

test('a refresher that cannot refresh compromises the lease and the commit is aborted', () => {
  // proper-lockfile treats a failed refresh as a compromised lease and the
  // owner must not proceed. Make every refresh touch fail after acquisition,
  // stall the rename past the stale threshold, and run a faithful thief.
  const env = setup();
  const shim = `${sandbox}/shim`;
  mkdirSync(shim);
  // touch succeeds once (acquisition), then always fails.
  writeFileSync(`${shim}/touch`, `#!/bin/sh\nif [ -e "${sandbox}/touched-once" ]; then exit 1; fi; : > "${sandbox}/touched-once"; exec /usr/bin/touch "$@"\n`); chmodSync(`${shim}/touch`, 0o755);
  writeFileSync(`${shim}/mv`, '#!/bin/sh\nsleep 4\nexec /bin/mv "$@"\n'); chmodSync(`${shim}/mv`, 0o755);
  const thief = `for i in $(seq 1 80); do
      if [ -d "${env.store}.lock" ]; then
        age=$(( $(date +%s) - $(stat -c %Y "${env.store}.lock") ))
        if [ "$age" -ge 3 ]; then
          rmdir "${env.store}.lock" && mkdir "${env.store}.lock" && stole=1
          t="${env.store}.tmp.thief"; jq '.concurrentClaudeWrite = "must-survive"' "${env.store}" > "$t" && /bin/mv "$t" "${env.store}"
          rmdir "${env.store}.lock"; break
        fi
      fi; sleep 0.1; done; echo "stole=\${stole:-0}"`;
  const r = sh(`bash ${HELPER} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    sleep 0.5; (${thief})
    wait $pid; echo "helper=$?"`, { ...env.env, PATH: `${shim}:${process.env.PATH}` });
  // Whether or not the thief got there first, the owner must not have
  // committed over a lease it could not keep alive.
  expect(r.out, 'a compromised lease must abort').toMatch(/helper=2/);
  const store = read(env);
  expect(store.projects[env.wt], 'no seed committed on a compromised lease').toBeUndefined();
  if (/stole=1/.test(r.out)) expect(store.concurrentClaudeWrite).toBe('must-survive');
  expect(sh(`ls ${env.store}.tmp.* 2>/dev/null | grep -v thief | wc -l`).out.trim(), 'helper temp removed').toBe('0');
}, 40000);

test('a refresher that dies silently is detected at commit and the commit is aborted', () => {
  // A refresher can be SIGKILLed (OOM, operator) and get no chance to signal
  // compromise. The lease silently stops being refreshed. Before committing
  // the owner must notice on its own — refresher dead, lease not recently
  // refreshed — and abort, even though nobody has stolen the lock yet. The
  // stall is placed before the commit check (in chmod), which is the part of
  // the transaction the check can protect; a stall inside rename itself is
  // atomic and uncoverable by any lease design, proper-lockfile included.
  const env = setup();
  const shim = `${sandbox}/shim`;
  mkdirSync(shim);
  writeFileSync(`${shim}/chmod`, '#!/bin/sh\nsleep 4\nexec /bin/chmod "$@"\n'); chmodSync(`${shim}/chmod`, 0o755);
  const before = readFileSync(env.store, 'utf8');
  const r = sh(`bash ${HELPER} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    sleep 0.6
    for c in $(pgrep -P $pid); do tr '\\0' ' ' < /proc/$c/cmdline | grep -q pr-automations-trust && kill -KILL $c; done
    wait $pid; echo "helper=$?"`, { ...env.env, PATH: `${shim}:${process.env.PATH}` });
  expect(r.out, 'a dead refresher must be detected at commit').toMatch(/helper=2/);
  expect(readFileSync(env.store, 'utf8'), 'nothing committed').toBe(before);
  expect(sh(`ls ${env.store}.tmp.* 2>/dev/null | wc -l`).out.trim(), 'temp removed').toBe('0');
  expect(existsSync(`${env.store}.lock`), 'our own lock is still released').toBe(false);
}, 40000);

test('when the owner is killed the refresher dies with it and the abandoned lock becomes stale and reclaimable', () => {
  // proper-lockfile refresh runs with the owner and cannot outlive it. An
  // orphaned refresher would keep an abandoned lock fresh forever and block
  // every later seed and unseed.
  const env = setup();
  const shim = `${sandbox}/shim`;
  mkdirSync(shim);
  // The stalled mv records its own pid so the test can end it precisely.
  writeFileSync(`${shim}/mv`, `#!/bin/sh\necho $$ > "${sandbox}/mvpid"\nsleep 30\nexec /bin/mv "$@"\n`); chmodSync(`${shim}/mv`, 0o755);
  const r = sh(`bash ${HELPER} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    sleep 1.5; kill -KILL $pid; sleep 2.5
    m1=$(stat -c %Y "${env.store}.lock" 2>/dev/null || echo gone); sleep 2.5
    m2=$(stat -c %Y "${env.store}.lock" 2>/dev/null || echo gone)
    echo "mtime=$m1:$m2"
    kill "$(cat "${sandbox}/mvpid")" 2>/dev/null; true`, { ...env.env, PATH: `${shim}:${process.env.PATH}` });
  const m = r.out.match(/mtime=(\S+):(\S+)/);
  expect(m, r.out).not.toBeNull();
  expect(m[1], 'lock left behind by the killed owner').not.toBe('gone');
  expect(m[1], 'the refresher must have stopped advancing the mtime').toBe(m[2]);
  // Once stale by Claude's own rule, the next transaction may reclaim it —
  // exactly what Claude would do — and proceed.
  sh(`touch -d '@$(( $(date +%s) - 11 ))' "${env.store}.lock"`);
  const again = run(env, `seed ${env.wt} ${env.clone} ${env.head}`);
  expect(again.code, `a stale abandoned lock must be reclaimable: ${again.err}`).toBe(0);
  expect(read(env).projects[env.wt].hasTrustDialogAccepted).toBe(true);
  expect(existsSync(`${env.store}.lock`)).toBe(false);
}, 40000);

test('a lock stolen after the temp is rendered aborts the commit instead of overwriting the store', () => {
  // The dangerous window: the helper has rendered its temp file from a store
  // it read under the lock; Claude then treats the lock as stale, replaces
  // it, and writes. Committing now would rename stale JSON over Claude's
  // write. The helper must re-verify ownership at commit and abort.
  const env = setup();
  const slow = `${sandbox}/slow-commit.sh`;
  writeFileSync(slow, readFileSync(HELPER, 'utf8').replace('# commit', 'sleep 1.5\n# commit'));
  expect(readFileSync(slow, 'utf8')).toContain('sleep 1.5');
  const r = sh(`bash ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    sleep 0.6; rmdir "${env.store}.lock" && mkdir "${env.store}.lock"
    touch -d '2000-01-01 00:00:00' "${env.store}.lock"; before=$(stat -c %Y "${env.store}.lock")
    t="${env.store}.tmp.thief"; jq '.claudeField = "written-after-steal"' "${env.store}" > "$t" && mv "$t" "${env.store}"
    wait $pid; echo "helper=$?"; echo "thief-mtime=$before:$(stat -c %Y "${env.store}.lock")"`, env.env);
  expect(r.out, 'helper must report failure, not success').toMatch(/helper=2/);
  // The lease refresher must stop the instant the lock is no longer ours: a
  // stolen lock's mtime is never touched by us, or we would keep a stranger's
  // lease alive.
  const mt = r.out.match(/thief-mtime=(\d+):(\d+)/);
  expect(mt, r.out).not.toBeNull();
  expect(mt[1], "the thief's lock mtime was refreshed by our refresher").toBe(mt[2]);
  const store = read(env);
  expect(store.claudeField, "Claude's write after the steal must survive").toBe('written-after-steal');
  expect(store.projects[env.wt], 'the stale seed must not have been committed').toBeUndefined();
  expect(sh(`ls ${env.store}.tmp.* 2>/dev/null | grep -v thief | wc -l`).out.trim(), 'helper temp removed').toBe('0');
  expect(existsSync(`${env.store}.lock`), "the thief's lock is left in place").toBe(true);
  rmSync(`${env.store}.lock`, { recursive: true });
}, 30000);

test('a failed rename or chmod is reported as failure with the temp removed and the store untouched', () => {
  const env = setup();
  const shim = `${sandbox}/shim`;
  mkdirSync(shim);
  for (const cmd of ['mv', 'chmod']) {
    writeFileSync(`${shim}/${cmd}`, '#!/bin/sh\nexit 73\n'); chmodSync(`${shim}/${cmd}`, 0o755);
    const before = readFileSync(env.store, 'utf8');
    const r = sh(`bash ${HELPER} seed ${env.wt} ${env.clone} ${env.head}`, { ...env.env, PATH: `${shim}:${process.env.PATH}` });
    expect(r.code, `${cmd} failure must be exit 2, got ${r.code}`).toBe(2);
    expect(readFileSync(env.store, 'utf8'), `${cmd} failure must leave the store untouched`).toBe(before);
    expect(sh(`ls ${env.store}.tmp.* 2>/dev/null | wc -l`).out.trim(), `${cmd} failure must remove the temp`).toBe('0');
    expect(existsSync(`${env.store}.lock`), `${cmd} failure must release the lock`).toBe(false);
    // unseed too: a false success here would leave a dead path trusted.
    const u = sh(`bash ${HELPER} unseed ${env.wt}`, { ...env.env, PATH: `${shim}:${process.env.PATH}` });
    expect(u.code, `${cmd} failure on unseed must be exit 2`).toBe(2);
    rmSync(`${shim}/${cmd}`);
  }
});

test('a lock stolen mid-transaction is never released by the helper', () => {
  // Claude's proper-lockfile may replace a lock it considers stale. Retarget a
  // copy of the helper to pause inside its critical section, steal the lock
  // meanwhile, and check the helper leaves the thief's lock in place.
  const env = setup();
  const slow = `${sandbox}/slow-trust.sh`;
  writeFileSync(slow, readFileSync(HELPER, 'utf8').replace('t="$STORE.tmp.$$.$RANDOM"', 'sleep 1.5; t="$STORE.tmp.$$.$RANDOM"'));
  const r = sh(`bash ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    sleep 0.4; rmdir "${env.store}.lock" && mkdir "${env.store}.lock"; stolen=$(stat -c %i "${env.store}.lock")
    wait $pid; echo "helper=$?"; [ -d "${env.store}.lock" ] && echo "lock=present:$(stat -c %i "${env.store}.lock"):$stolen" || echo "lock=REMOVED"`, env.env);
  // Ownership was lost before commit, so the helper must abort — and must
  // still leave the thief's lock exactly as it found it.
  expect(r.out).toMatch(/helper=2/);
  const m = r.out.match(/lock=present:(\d+):(\d+)/);
  expect(m, `the thief's lock must survive: ${r.out}`).not.toBeNull();
  expect(m[1]).toBe(m[2]);
  expect(read(env).projects[env.wt], 'nothing committed after the steal').toBeUndefined();
  rmSync(`${env.store}.lock`, { recursive: true });
});

test('unseed removes only that path, and a malformed store is an error with no write', () => {
  const env = setup();
  run(env, `seed ${env.wt} ${env.clone} ${env.head}`);
  const u = run(env, `unseed ${env.wt}`);
  expect(u.code, u.err).toBe(0);
  const store = read(env);
  expect(store.projects[env.wt]).toBeUndefined();
  expect(store.projects['/elsewhere'].hasTrustDialogAccepted).toBe(true);
  writeFileSync(env.store, '{not json');
  const before = readFileSync(env.store, 'utf8');
  expect(run(env, `seed ${env.wt} ${env.clone} ${env.head}`).code).toBe(2);
  expect(readFileSync(env.store, 'utf8'), 'a malformed store is never rewritten').toBe(before);
});
