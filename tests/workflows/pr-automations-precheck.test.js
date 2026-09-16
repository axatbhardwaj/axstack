import { afterEach, beforeEach, expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const source = `${root}/docs/plans/pr-automations-precheck.sh`;
const allowlisted = 'https://github.com/defi-com/monorepo/pull/7';
let sandbox;

const write = (path, body, mode) => {
  writeFileSync(path, body);
  if (mode) chmodSync(path, mode);
};

const pr = (url, number, repo, updatedAt = '2026-09-17T00:00:00Z') => ({
  url,
  number,
  repository: { nameWithOwner: repo },
  updatedAt,
});

const setup = ({ own = [], requested = [], mentioned = [], reviewed = [], details = {} } = {}) => {
  sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-pr-precheck-`);
  const runDir = `${sandbox}/run`;
  const fixture = `${sandbox}/fixture`;
  const bin = `${sandbox}/bin`;
  mkdirSync(`${runDir}/decisions`, { recursive: true });
  mkdirSync(fixture);
  mkdirSync(bin);
  for (const [name, value] of Object.entries({ own, requested, mentioned, reviewed, details })) {
    write(`${fixture}/${name}.json`, JSON.stringify(value));
  }
  write(`${fixture}/bases.json`, JSON.stringify({
    'defi-com/monorepo#main': 'base-mono',
    'defi-com/mobile#main': 'base-mobile',
    'defi-com/azure-next-hybrid#main': 'base-azure',
  }));
  write(`${bin}/gh`, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$GH_CALLS"
if [ "$1 $2" = "api user" ]; then printf 'axatbhardwaj\\n'; exit 0; fi
if [ "$1 $2" = "search prs" ]; then
  case " $* " in
    *" --author @me "*) file=own ;;
    *" --review-requested @me "*) file=requested ;;
    *" --mentions @me "*) file=mentioned ;;
    *" --reviewed-by @me "*) file=reviewed ;;
    *) exit 9 ;;
  esac
  cat "$GH_FIXTURE/$file.json"; exit 0
fi
if [ "$1 $2" = "pr view" ]; then
  number="$3"; repo=""
  while [ "$#" -gt 0 ]; do
    [ "$1" = "--repo" ] && repo="$2"
    shift
  done
  jq -ce --arg key "$repo#$number" '.[$key]' "$GH_FIXTURE/details.json"; exit $?
fi
if [ "$1" = "api" ]; then
  key="\${2#repos/}"; repo="\${key%%/commits/*}"; ref="\${key#*/commits/}"; key="$repo#$ref"
  jq -er --arg key "$key" '.[$key]' "$GH_FIXTURE/bases.json"; exit $?
fi
exit 9
`, 0o755);
  return { runDir, bin, fixture, calls: `${sandbox}/gh.log` };
};

const run = (env) => {
  const result = Bun.spawnSync(['bash', source, env.runDir], {
    env: {
      ...process.env,
      PATH: `${env.bin}:${process.env.PATH}`,
      GH_CALLS: env.calls,
      GH_FIXTURE: env.fixture,
    },
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 30000,
  });
  return { exitCode: result.exitCode, stderr: result.stderr.toString() };
};

const cursor = (env, value) => write(`${env.runDir}/cursor.json`, JSON.stringify(value));
const pending = (env) => JSON.parse(readFileSync(`${env.runDir}/pending.json`, 'utf8'));
const lastLog = (env) => readFileSync(`${env.runDir}/precheck.log`, 'utf8').trim().split('\n').at(-1);

const settleFingerprint = (env, extra = {}) => {
  expect(run(env).exitCode).toBe(0);
  cursor(env, { ...extra, fingerprint: pending(env).fingerprint });
};

beforeEach(() => { sandbox = null; });
afterEach(() => { if (sandbox) rmSync(sandbox, { recursive: true, force: true }); });

test('overlap guard logs running and exits 3 without inspecting GitHub', () => {
  const env = setup();
  cursor(env, {
    tick_started_at: new Date().toISOString(),
    tick_done_at: '2000-01-01T00:00:00Z',
  });
  expect(run(env).exitCode).toBe(3);
  expect(lastLog(env)).toMatch(/ running$/);
  expect(existsSync(env.calls)).toBe(false);
});

test('a truncated search logs error, exits 2, and does not write pending.json', () => {
  const own = Array.from({ length: 100 }, (_, i) =>
    pr(`https://github.com/defi-com/monorepo/pull/${i + 1}`, i + 1, 'defi-com/monorepo'));
  const env = setup({ own });
  expect(run(env).exitCode).toBe(2);
  expect(lastLog(env)).toMatch(/ error$/);
  expect(existsSync(`${env.runDir}/pending.json`)).toBe(false);
});

test('changed discovery exits 0, filters the allowlist union, and enriches each retained PR', () => {
  const own = pr(allowlisted, 7, 'defi-com/monorepo');
  const duplicate = pr(allowlisted, 7, 'defi-com/monorepo', '2026-09-17T00:01:00Z');
  const outside = pr('https://github.com/other/repo/pull/8', 8, 'other/repo');
  const env = setup({
    own: [own],
    requested: [duplicate, outside],
    details: {
      'defi-com/monorepo#7': {
        headRefOid: 'head-own', baseRefName: 'main', isDraft: false,
        statusCheckRollup: [{ name: 'unit', conclusion: 'SUCCESS' }],
        author: { login: 'axatbhardwaj' },
      },
    },
  });
  expect(run(env).exitCode).toBe(0);
  expect(lastLog(env)).toMatch(/ changed$/);
  const state = pending(env);
  expect(state.observed_at).toEqual(expect.any(String));
  expect(state.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(state.seen).toEqual([]);
  expect(state.discovery).toHaveLength(1);
  expect(state.discovery[0]).toMatchObject({ url: allowlisted, repo: 'defi-com/monorepo', head: 'head-own' });
  expect(state.hashed).toEqual([{
    url: allowlisted,
    head: 'head-own',
    base: 'base-mono',
    draft: false,
    checks: [{ name: 'unit', conclusion: 'SUCCESS' }],
  }]);
  const calls = readFileSync(env.calls, 'utf8');
  expect(calls.match(/^search prs /gm)?.length).toBe(4);
  expect(calls).toContain('search prs --state open --limit 100 --json url,number,repository,updatedAt --author @me');
  expect(calls).toContain('search prs --state open --limit 100 --json url,number,repository,updatedAt --reviewed-by @me --review changes_requested');
  expect(calls.match(/^pr view /gm)?.length).toBe(1);
  expect(calls).not.toContain('other/repo#8');
});

test('peer and fourth-search heads are hashed only on the second consecutive observation', () => {
  const peerUrl = 'https://github.com/defi-com/mobile/pull/9';
  const reviewedUrl = 'https://github.com/defi-com/monorepo/pull/10';
  const detail = (head, login) => ({
    headRefOid: head, baseRefName: 'main', isDraft: false,
    statusCheckRollup: [], author: { login },
  });
  const env = setup({
    requested: [pr(peerUrl, 9, 'defi-com/mobile')],
    reviewed: [pr(reviewedUrl, 10, 'defi-com/monorepo')],
    details: {
      'defi-com/mobile#9': detail('head-peer', 'peer'),
      'defi-com/monorepo#10': detail('head-reviewed', 'peer'),
    },
  });
  expect(run(env).exitCode).toBe(0);
  expect(pending(env).hashed).toEqual([]);
  expect(pending(env).seen).toHaveLength(2);
  cursor(env, { fingerprint: pending(env).fingerprint });
  expect(run(env).exitCode).toBe(0);
  expect(pending(env).hashed.map(({ url }) => url).sort()).toEqual([peerUrl, reviewedUrl].sort());
});

test('an unchanged fingerprint with no due control work logs unchanged and exits 1', () => {
  const env = setup();
  settleFingerprint(env);
  expect(run(env).exitCode).toBe(1);
  expect(lastLog(env)).toMatch(/ unchanged$/);
});

for (const state of ['approved', 'rejected']) {
  test(`${state} decision without consumed_at is due`, () => {
    const env = setup();
    settleFingerprint(env);
    write(`${env.runDir}/decisions/token.json`, JSON.stringify({ state }));
    expect(run(env).exitCode).toBe(0);
    expect(lastLog(env)).toMatch(/ due$/);
  });
}

test('spent decision without a receipt is due', () => {
  const env = setup();
  settleFingerprint(env);
  write(`${env.runDir}/decisions/token.json`, JSON.stringify({ state: 'spent' }));
  expect(run(env).exitCode).toBe(0);
  expect(lastLog(env)).toMatch(/ due$/);
});

test('deferred work is due only while its head still matches discovery', () => {
  const env = setup({
    own: [pr(allowlisted, 7, 'defi-com/monorepo')],
    details: { 'defi-com/monorepo#7': {
      headRefOid: 'head-own', baseRefName: 'main', isDraft: false,
      statusCheckRollup: [], author: { login: 'axatbhardwaj' },
    } },
  });
  settleFingerprint(env, { deferred: [{ repo: 'defi-com/monorepo', pr: 7, head: 'head-own' }] });
  expect(run(env).exitCode).toBe(0);
  expect(lastLog(env)).toMatch(/ due$/);
});

test('an expired repair cap is due', () => {
  const env = setup();
  settleFingerprint(env, {
    repair_caps: { [allowlisted]: { expires_at: '2000-01-01T00:00:00Z' } },
  });
  expect(run(env).exitCode).toBe(0);
  expect(lastLog(env)).toMatch(/ due$/);
});

test('a dispatch marker older than three hours is due', () => {
  const env = setup();
  settleFingerprint(env, {
    dispatches: { [allowlisted]: { started_at: '2000-01-01T00:00:00.000Z' } },
  });
  expect(run(env).exitCode).toBe(0);
  expect(lastLog(env)).toMatch(/ due$/);
});

test('a pending settlement is due', () => {
  const env = setup();
  settleFingerprint(env, { pending_settlement: [{ delivery_id: 'delivery-1' }] });
  expect(run(env).exitCode).toBe(0);
  expect(lastLog(env)).toMatch(/ due$/);
});

test('open and fully consumed decisions alone are not due', () => {
  const env = setup();
  settleFingerprint(env);
  write(`${env.runDir}/decisions/open.json`, JSON.stringify({ state: 'open' }));
  write(`${env.runDir}/decisions/done.json`, JSON.stringify({ state: 'approved', consumed_at: '2026-09-17T00:00:00Z' }));
  write(`${env.runDir}/decisions/receipt.json`, JSON.stringify({ state: 'spent', receipt: { id: 1 } }));
  expect(run(env).exitCode).toBe(1);
  expect(lastLog(env)).toMatch(/ unchanged$/);
});

test('precheck preserves cursor deploy-on-push sets and writes only the specified pending shape', () => {
  const env = setup();
  const original = JSON.stringify({
    deploy_on_push: { 'defi-com/monorepo': ['main'], 'defi-com/mobile': ['release'] },
  });
  write(`${env.runDir}/cursor.json`, original);
  expect(run(env).exitCode).toBe(0);
  expect(readFileSync(`${env.runDir}/cursor.json`, 'utf8')).toBe(original);
  expect(Object.keys(pending(env)).sort()).toEqual(
    ['fingerprint', 'observed_at', 'seen', 'discovery', 'hashed'].sort(),
  );
});
