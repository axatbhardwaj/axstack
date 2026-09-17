// Behavioral checks on the trust transaction helper the driver runs to
// pre-trust a worktree it just created, and to untrust it on cleanup. The
// helper owns the only write the automation makes to Claude Code's config
// store, so this is where the safety properties are exercised for real:
// scope enforcement, Claude's own lock and lease rules, no lost updates,
// mode preservation, and — because it is a single process — nothing that
// can outlive the owner and commit later.
//
// Failure injection retargets a copy of the helper (a marker comment is
// replaced with a stall or a throw) rather than adding test knobs to the
// shipped script, the same way the precheck tests do.
import { test, expect, afterEach } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, chmodSync, utimesSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const HELPER = `${root}/docs/plans/pr-automations-trust.js`;
const BUN = process.execPath;
const HEAD_RE = /^[0-9a-f]{40}$/;
let sandbox;

const sh = (cmd, env = {}) => {
  const r = Bun.spawnSync(['bash', '-c', cmd], { env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
};

const setup = () => {
  // /var/tmp, not /tmp: a tmpfs never reuses inode numbers and hides the reclaimed-lock case.
  sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/var/tmp'}/axstack-trust-`);
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
const run = (env, args, helper = HELPER) => sh(`${BUN} ${helper} ${args}`, env.env);
const read = (env) => JSON.parse(readFileSync(env.store, 'utf8'));
// A copy of the helper with a marker replaced by injected code.
// Fixed sleeps race a cold Bun start on a slow runner: wait for the helper to
// hold the lock (it pauses at its marker right after) before interfering.
const untilLocked = (env) => `for i in $(seq 1 200); do [ -d "${env.store}.lock" ] && break; sleep 0.05; done; sleep 0.2`;

const patched = (marker, code) => {
  const src = readFileSync(HELPER, 'utf8');
  expect(src, `marker ${marker} must exist in the helper`).toContain(marker);
  const p = `${sandbox}/patched-trust.js`;
  writeFileSync(p, src.replace(marker, `${marker}\n${code}`));
  return p;
};
// A faithful Claude-like writer: steals only when the lock's mtime is at
// least `stale` seconds old, then writes its own key and releases.
const thief = (env, stale, { keep = false } = {}, key = 'concurrentClaudeWrite', value = 'must-survive') => `for i in $(seq 1 120); do
    if [ -d "${env.store}.lock" ]; then
      age=$(( $(date +%s) - $(stat -c %Y "${env.store}.lock") ))
      if [ "$age" -ge ${stale} ]; then
        rmdir "${env.store}.lock" && mkdir "${env.store}.lock" && stole=1
        t="${env.store}.tmp.thief"; jq '.${key} = "${value}"' "${env.store}" > "$t" && mv "$t" "${env.store}"
        ${keep ? '' : `rmdir "${env.store}.lock";`} break
      fi
    fi; sleep 0.1; done; echo "stole=\${stole:-0}"`;

afterEach(() => { if (sandbox) rmSync(sandbox, { recursive: true, force: true }); sandbox = null; });

test('seed trusts exactly the worktree created from the clone at the pinned head', () => {
  const env = setup();
  const r = run(env, `seed ${env.wt} ${env.clone} ${env.head}`);
  expect(r.code, r.err).toBe(0);
  const store = read(env);
  expect(store.projects[env.wt].hasTrustDialogAccepted).toBe(true);
  expect(store.sessionState).toBe('kept');
  expect(store.projects['/elsewhere'].hasTrustDialogAccepted).toBe(true);
  expect(statSync(env.store).mode & 0o777).toBe(0o600);
  expect(existsSync(`${env.store}.lock`)).toBe(false);
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

test('a fresh foreign lock is never broken; seed and unseed report busy', () => {
  const env = setup();
  mkdirSync(`${env.store}.lock`);
  const r = run(env, `seed ${env.wt} ${env.clone} ${env.head}`);
  expect(r.code, 'busy lock must be reported, not broken').toBe(2);
  expect(existsSync(`${env.store}.lock`)).toBe(true);
  expect(read(env).projects[env.wt]).toBeUndefined();
  // A live holder keeps its lease fresh; only an abandoned lock goes stale.
  utimesSync(`${env.store}.lock`, new Date(), new Date());
  expect(run(env, `unseed ${env.wt}`).code).toBe(2);
  expect(existsSync(`${env.store}.lock`), 'a fresh foreign lock is still not broken').toBe(true);
  rmSync(`${env.store}.lock`, { recursive: true });
  expect(run(env, `seed ${env.wt} ${env.clone} ${env.head}`).code).toBe(0);
}, 30000);

test('an abandoned lock past the stale threshold is reclaimed, as Claude itself would', () => {
  const env = setup();
  mkdirSync(`${env.store}.lock`);
  const old = new Date(Date.now() - 11000);
  utimesSync(`${env.store}.lock`, old, old);
  const r = run(env, `seed ${env.wt} ${env.clone} ${env.head}`);
  expect(r.code, r.err).toBe(0);
  expect(read(env).projects[env.wt].hasTrustDialogAccepted).toBe(true);
  expect(existsSync(`${env.store}.lock`)).toBe(false);
});

test('concurrent seeds and a concurrent lock-taking writer lose nothing', () => {
  const env = setup();
  const paths = [];
  for (let i = 0; i < 8; i += 1) {
    const wt = `${sandbox}/workspaces/repo/pr-repo-${i + 10}-review`;
    sh(`git -C ${env.clone} worktree add -q --detach ${wt} ${env.head}`);
    paths.push(wt);
  }
  const claudeLike = `for n in $(seq 1 20); do
      got=0; for i in $(seq 1 100); do if mkdir "${env.store}.lock" 2>/dev/null; then got=1; break; fi; sleep 0.05; done
      [ "$got" -eq 1 ] || { echo "claude-like writer could not acquire" >&2; exit 9; }
      t="${env.store}.tmp.$$.$RANDOM"; jq --arg n "$n" '.claudeWrites = ((.claudeWrites // 0) + 1)' "${env.store}" > "$t" && mv "$t" "${env.store}"
      rmdir "${env.store}.lock"; done`;
  const seeds = paths.map((p) => `${BUN} ${HELPER} seed ${p} ${env.clone} ${env.head} &`).join('\n');
  const r = sh(`${seeds}\n(${claudeLike}) &\nwait`, env.env);
  expect(r.code, r.err).toBe(0);
  const store = read(env);
  for (const p of paths) expect(store.projects[p]?.hasTrustDialogAccepted, `lost seed for ${p}`).toBe(true);
  expect(store.claudeWrites, 'lost a concurrent Claude-like write').toBe(20);
  expect(store.sessionState).toBe('kept');
  expect(existsSync(`${env.store}.lock`)).toBe(false);
  expect(sh(`ls ${env.store}.tmp.* 2>/dev/null | wc -l`).out.trim(), 'no temp files left').toBe('0');
}, 60000);

test('a rename stalled past the stale threshold cannot be stolen from, because the lease is refreshed while held', () => {
  const env = setup();
  const slow = patched('// before-commit', 'await Bun.sleep(4000);');
  const r = sh(`${BUN} ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    ${untilLocked(env)}; (${thief(env, 3)})
    wait $pid; echo "helper=$?"`, env.env);
  expect(r.out, 'the thief must never have seen a stale lock').toMatch(/stole=0/);
  expect(r.out).toMatch(/helper=0/);
  expect(read(env).projects[env.wt].hasTrustDialogAccepted).toBe(true);
  expect(existsSync(`${env.store}.lock`)).toBe(false);
}, 30000);

test('a refresh that fails compromises the lease and the commit is aborted', () => {
  const env = setup();
  // The refresher's touch throws from the second refresh on; the commit is
  // stalled past the thief's threshold.
  const bad = patched('// refresh-touch', 'if (refreshes > 0) throw new Error("injected refresh failure");');
  const slow = `${sandbox}/slow-bad.js`;
  writeFileSync(slow, readFileSync(bad, 'utf8').replace('// before-commit', '// before-commit\nawait Bun.sleep(4000);'));
  const r = sh(`${BUN} ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    ${untilLocked(env)}; (${thief(env, 3)})
    wait $pid; echo "helper=$?"`, env.env);
  expect(r.out, 'a compromised lease must abort').toMatch(/helper=2/);
  const store = read(env);
  expect(store.projects[env.wt], 'no seed committed on a compromised lease').toBeUndefined();
  if (/stole=1/.test(r.out)) expect(store.concurrentClaudeWrite).toBe('must-survive');
  expect(sh(`ls ${env.store}.tmp.* 2>/dev/null | grep -v thief | wc -l`).out.trim(), 'helper temp removed').toBe('0');
}, 40000);

test('a lock stolen between acquisition and the first refresh is left untouched', () => {
  // The owner records its inode, is paused, the lock goes stale and Claude
  // reclaims it. On resumption the first refresh sees a foreign inode and
  // must abort WITHOUT removing the replacement lock.
  const env = setup();
  const slow = patched('// after-acquire', 'await Bun.sleep(1500);');
  const r = sh(`${BUN} ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    ${untilLocked(env)}; rmdir "${env.store}.lock" && mkdir "${env.store}.lock"
    touch -d '2000-01-01 00:00:00' "${env.store}.lock"; before=$(stat -c %Y "${env.store}.lock"); ino=$(stat -c %i "${env.store}.lock")
    wait $pid; echo "helper=$?"
    [ -d "${env.store}.lock" ] && echo "lock=present:$(stat -c %i "${env.store}.lock"):$ino:$(stat -c %Y "${env.store}.lock"):$before" || echo "lock=REMOVED"`, env.env);
  expect(r.out).toMatch(/helper=2/);
  const m = r.out.match(/lock=present:(\d+):(\d+):(\d+):(\d+)/);
  expect(m, `the replacement lock must survive: ${r.out}`).not.toBeNull();
  expect(m[1], 'same inode as the thief created').toBe(m[2]);
  expect(m[3], 'thief lock mtime untouched').toBe(m[4]);
  expect(read(env).projects[env.wt]).toBeUndefined();
  rmSync(`${env.store}.lock`, { recursive: true });
}, 30000);

test('a lock recreated between the refresh touch and its verification is foreign, and its write survives', () => {
  // Same inode again (ext4). The helper must verify the mtime IT CHOSE, never
  // adopt whatever a stat after utimes happens to observe.
  const env = setup();
  const slow = patched('// after-touch', 'if (refreshes === 0) Bun.sleepSync(1500);');
  const r = sh(`${BUN} ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    ${untilLocked(env)}; rmdir "${env.store}.lock" && mkdir "${env.store}.lock"
    touch -d '2000-01-01 00:00:00' "${env.store}.lock"; before=$(stat -c %Y "${env.store}.lock")
    t="${env.store}.tmp.thief"; jq '.claudeField = "written-after-steal"' "${env.store}" > "$t" && mv "$t" "${env.store}"
    wait $pid; echo "helper=$?"; echo "thief-mtime=$before:$(stat -c %Y "${env.store}.lock" 2>/dev/null)"`, env.env);
  expect(r.out, 'helper must report failure').toMatch(/helper=2/);
  const store = read(env);
  expect(store.claudeField, "the foreign write survives").toBe('written-after-steal');
  expect(store.projects[env.wt]).toBeUndefined();
  const mt = r.out.match(/thief-mtime=(\d+):(\d+)/);
  expect(mt, `the thief's lock is left in place: ${r.out}`).not.toBeNull();
  expect(mt[1]).toBe(mt[2]);
  rmSync(`${env.store}.lock`, { recursive: true });
}, 30000);

test('a suspension between the ownership check and the touch is refused, even though the touch lands on the reclaimed lock', () => {
  // The worst ext4 interleaving: the helper passes its ownership check, is
  // suspended past the stale window, Claude faithfully reclaims the lock
  // (same inode), and the helper's own utimes then stamps the foreign lock
  // with exactly the value it will look for. Elapsed time is the only tell.
  const env = setup();
  // The commit is held open so the interval refresher runs at all; its second
  // call passes the ownership check and then stalls past the stale window.
  const bad = patched('// before-touch', 'if (refreshes === 1) Bun.sleepSync(11500);');
  const slow = `${sandbox}/slow-suspended.js`;
  writeFileSync(slow, readFileSync(bad, 'utf8').replace('// before-commit', '// before-commit\nawait Bun.sleep(3000);'));
  const r = sh(`${BUN} ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    ${untilLocked(env)}; sleep 1.2; (${thief(env, 10, { keep: true })})
    wait $pid; echo "helper=$?"; echo "after=$(jq -c '{seed: (.projects | has("${env.wt}")), w: .concurrentClaudeWrite}' "${env.store}")"
    [ -d "${env.store}.lock" ] && echo "lock=present" || echo "lock=REMOVED"`, env.env);
  expect(r.out, r.out).toMatch(/stole=1/);
  expect(r.out, 'helper must refuse the lease').toMatch(/helper=2/);
  expect(r.out, 'foreign write preserved, no seed').toMatch(/after=\{"seed":false,"w":"must-survive"\}/);
  expect(r.out, "the foreign lock is not removed").toMatch(/lock=present/);
  expect(sh(`ls ${env.store}.tmp.* 2>/dev/null | grep -v thief | wc -l`).out.trim(), 'helper temp removed').toBe('0');
  rmSync(`${env.store}.lock`, { recursive: true });
}, 40000);

test('a lock reclaimed after mkdir but before the helper first observes it is never adopted', () => {
  // Suspended between mkdirSync and the first stat for longer than the
  // acquisition bound: the observation can no longer be tied to the mkdir, so
  // whatever is there now is left alone.
  const env = setup();
  const slow = patched('// after-mkdir', 'await Bun.sleep(2600);');
  const r = sh(`${BUN} ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    ${untilLocked(env)}; rmdir "${env.store}.lock" && mkdir "${env.store}.lock"
    touch -d '2000-01-01 00:00:00' "${env.store}.lock"; before=$(stat -c %Y "${env.store}.lock"); ino=$(stat -c %i "${env.store}.lock")
    wait $pid; echo "helper=$?"
    [ -d "${env.store}.lock" ] && echo "lock=present:$(stat -c %i "${env.store}.lock"):$ino:$(stat -c %Y "${env.store}.lock"):$before" || echo "lock=REMOVED"`, env.env);
  expect(r.out).toMatch(/helper=2/);
  const m = r.out.match(/lock=present:(\d+):(\d+):(\d+):(\d+)/);
  expect(m, `the reclaimed lock must survive untouched: ${r.out}`).not.toBeNull();
  expect(m[1]).toBe(m[2]);
  expect(m[3], 'mtime untouched').toBe(m[4]);
  expect(read(env).projects[env.wt]).toBeUndefined();
  rmSync(`${env.store}.lock`, { recursive: true });
}, 30000);

test('a lock stolen after the temp is rendered aborts the commit instead of overwriting the store', () => {
  const env = setup();
  const slow = patched('// before-commit', 'await Bun.sleep(1500);');
  const r = sh(`${BUN} ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    ${untilLocked(env)}; rmdir "${env.store}.lock" && mkdir "${env.store}.lock"
    touch -d '2000-01-01 00:00:00' "${env.store}.lock"; before=$(stat -c %Y "${env.store}.lock")
    t="${env.store}.tmp.thief"; jq '.claudeField = "written-after-steal"' "${env.store}" > "$t" && mv "$t" "${env.store}"
    wait $pid; echo "helper=$?"; echo "thief-mtime=$before:$(stat -c %Y "${env.store}.lock")"`, env.env);
  expect(r.out, 'helper must report failure').toMatch(/helper=2/);
  const store = read(env);
  expect(store.claudeField).toBe('written-after-steal');
  expect(store.projects[env.wt], 'the stale seed must not have been committed').toBeUndefined();
  // Our refresher must not have touched the thief's lock.
  const mt = r.out.match(/thief-mtime=(\d+):(\d+)/);
  expect(mt, r.out).not.toBeNull();
  expect(mt[1]).toBe(mt[2]);
  expect(existsSync(`${env.store}.lock`), "the thief's lock is left in place").toBe(true);
  rmSync(`${env.store}.lock`, { recursive: true });
}, 30000);

test('when the owner is killed nothing can commit afterwards, the lease lapses, and a later writer is never overwritten', () => {
  // The single-process property, end to end: the owner is killed while its
  // commit is pending. Nothing survives it. The lock's mtime stops, the lock
  // goes stale, a faithful writer reclaims it and writes, and the old
  // transaction can never alter the store afterwards. The old process is
  // NOT cleaned up manually — that is the point.
  const env = setup();
  const slow = patched('// before-commit', 'await Bun.sleep(30000);');
  const r = sh(`${BUN} ${slow} seed ${env.wt} ${env.clone} ${env.head} & pid=$!
    ${untilLocked(env)}; kill -KILL $pid; sleep 2.5
    m1=$(stat -c %Y "${env.store}.lock" 2>/dev/null || echo gone); sleep 2.5
    m2=$(stat -c %Y "${env.store}.lock" 2>/dev/null || echo gone); echo "mtime=$m1:$m2"
    touch -d "@$(( $(date +%s) - 11 ))" "${env.store}.lock"
    (${thief(env, 10)})
    sleep 3; echo "after=$(jq -c '{seed: (.projects | has("${env.wt}")), w: .concurrentClaudeWrite}' "${env.store}")"`, env.env);
  const m = r.out.match(/mtime=(\S+):(\S+)/);
  expect(m, r.out).not.toBeNull();
  expect(m[1]).not.toBe('gone');
  expect(m[1], 'lease must lapse: mtime stops advancing').toBe(m[2]);
  expect(r.out).toMatch(/stole=1/);
  expect(r.out, 'the dead transaction must never commit').toMatch(/after=\{"seed":false,"w":"must-survive"\}/);
  expect(existsSync(`${env.store}.lock`)).toBe(false);
}, 60000);

test('unseed removes only that path, and a malformed store is an error with no write', () => {
  const env = setup();
  run(env, `seed ${env.wt} ${env.clone} ${env.head}`);
  const u = run(env, `unseed ${env.wt}`);
  expect(u.code, u.err).toBe(0);
  const store = read(env);
  expect(store.projects[env.wt]).toBeUndefined();
  expect(store.projects['/elsewhere'].hasTrustDialogAccepted).toBe(true);
  // typeof [] is 'object': an array root, or an array-valued projects, would
  // take a property assignment that JSON.stringify silently drops — a false
  // exit 0 with nothing persisted. Both must be refused, byte-for-byte.
  for (const bad of ['{not json', '"valid json but not an object"', '42', '[]', '{"projects":[]}', '{"projects":"x"}']) {
    writeFileSync(env.store, bad);
    expect(run(env, `seed ${env.wt} ${env.clone} ${env.head}`).code, `store ${bad}`).toBe(2);
    expect(readFileSync(env.store, 'utf8'), `a malformed store is never rewritten: ${bad}`).toBe(bad);
    expect(existsSync(`${env.store}.lock`)).toBe(false);
    expect(run(env, `unseed ${env.wt}`).code, `unseed on ${bad}`).toBe(2);
    expect(readFileSync(env.store, 'utf8')).toBe(bad);
  }
});

test('a failed rename is reported as failure with the temp removed and the store untouched', () => {
  const env = setup();
  const bad = patched('// before-commit', 'throw new Error("injected rename failure");');
  const before = readFileSync(env.store, 'utf8');
  const r = run(env, `seed ${env.wt} ${env.clone} ${env.head}`, bad);
  expect(r.code).toBe(2);
  expect(readFileSync(env.store, 'utf8')).toBe(before);
  expect(sh(`ls ${env.store}.tmp.* 2>/dev/null | wc -l`).out.trim()).toBe('0');
  expect(existsSync(`${env.store}.lock`)).toBe(false);
  expect(run(env, `unseed ${env.wt}`, bad).code).toBe(2);
});
