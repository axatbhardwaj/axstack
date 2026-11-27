import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { reviewRuntime } from '../../skills/axstack/workflows/review-manager-runtime.mjs';
import { hash, managerIdentity as identity, importState } from '../../skills/axstack/workflows/review-manager.mjs';

const { quiet } = await Bun.file(import.meta.dir + '/fixtures/review-manager-predecessor.json').json();
const stamp = quiet.input.observedAt;
const repo = quiet.pr.split('#')[0];
const login = quiet.input.login;
const rows = quiet.input.searches.flat();
const candidate = rows.find((row) => row.author.login !== login);
const projectId = quiet.input.inventory.args.projectId;

async function fixture(work, overrides = {}) {
  const scratch = await mkdtemp((process.env.TMPDIR ?? '/tmp') + '/axstack-review-runtime-');
  const originalPath = process.env.PATH;
  const marker = 'AXSTACK_REVIEW_TEST_SENTINEL';
  const originalMarker = process.env[marker];
  try {
    const config = {
      mode: 'shadow', project: scratch + '/project', projectId,
      projects: [scratch + '/project', ...(overrides.extraProjects ?? [])], repositories: [repo], repository: repo,
      bun: process.execPath, t3: scratch + '/t3', roles: scratch + '/roles.json',
      registryTokenFile: scratch + '/token', progressCopy: scratch + '/predecessor.md',
      reapReceipt: scratch + '/reap.json',
      skillsDirectory: import.meta.dir.slice(0, -'/tests/workflows'.length) + '/skills/axstack',
      ...overrides.config,
    };
    if (overrides.quietProbe) {
      config.skillsDirectory = scratch + '/probe-skill';
      await mkdir(config.skillsDirectory + '/scripts', { recursive: true, mode: 0o700 });
      await writeFile(config.skillsDirectory + '/scripts/schedule-drift.js', `
        const expected = ['PATH', 'HOME', 'TMPDIR'].every((key) => process.env[key]);
        const status = expected && process.env.AXSTACK_REVIEW_TEST_SENTINEL === undefined ? 'pass' : 'fail';
        console.log(JSON.stringify({ version: 2, terms: [{ id: 'environment', status }] }));
      `, { mode: 0o600 });
    }
    const binding = scratch + '/binding.json';
    const bytes = JSON.stringify(config);
    const markerCheck = '[ "$(printenv AXSTACK_REVIEW_TEST_SENTINEL || true)" = "" ] || exit 82';
    const inventory = quiet.input.inventory.value.threads.filter((row) => row.parentThreadId === null);
    const prior = { ...quiet.input.prior.thread, projectId };
    const flagged = { threadId: 'fixture-flagged', projectId, status: 'idle', activeRunId: null, pinned: true };
    const userReply = { role: 'user', runId: 'fixture-reply-run', text: 'PRIVATE REPLY TEXT' };
    const command = async (name, script) => writeFile(scratch + '/' + name, '#!/bin/sh\nset -eu\n' + markerCheck + '\n' + script, { mode: 0o700 });
    const print = (json) => "cat <<'AXSTACK_JSON'\n" + JSON.stringify(json) + "\nAXSTACK_JSON\n";
    await mkdir(config.project, { mode: 0o700 });
    await writeFile(binding, bytes, { mode: 0o600 });
    await writeFile(scratch + '/.axstack-workflows.json', JSON.stringify({ workflows: {
      [identity]: { binding, bindingDigest: overrides.drift ? '0'.repeat(64) : hash(bytes) },
    } }), { mode: 0o600 });
    await writeFile(config.progressCopy, quiet.progress, { mode: 0o600 });
    await writeFile(config.reapReceipt, JSON.stringify({ version: 2, observedAt: overrides.receiptTime ?? stamp, terms: [
      { id: 'reap', status: overrides.reap ?? 'pass', evidence: quiet.input.reap },
    ] }), { mode: 0o600 });
    await command('t3', 'case "$2" in\n' +
      'list) ' + print(inventory) + ';;\n' +
      'show) case "$5" in\n' +
      'fixture-flagged) ' + print({ thread: flagged, messages: [userReply] }) + ';;\n' +
      '*) ' + print({ thread: prior, messages: [] }) + ';;\nesac;;\nesac\n');
    const search = Array.from({ length: overrides.searchLength ?? 1 }, (_, index) =>
      ({ ...candidate, number: candidate.number + index }));
    const pages = [];
    for (let offset = 0; offset < search.length; offset += 100) {
      const page = offset / 100 + 1;
      const next = overrides.next || offset + 100 < search.length;
      const header = next ? `Link: <https://api.github.com/repos/${repo}/pulls?page=${page + 1}>; rel="next"\\r\\n` : '';
      const prs = search.slice(offset, offset + 100).map((row) => ({
        number: row.number, title: 'PRIVATE PR TITLE', draft: row.isDraft,
        updated_at: row.updatedAt, state: 'open', user: row.author, base: { repo: { full_name: repo } },
      }));
      pages.push(`*"pulls?"*"page=${page}") printf "HTTP/2 200 OK\\r\\n%b\\r\\n" '${header}'\n` + print(prs) + ';;\n');
    }
    await command('gh', 'case "$*" in\n' +
      '*" user") ' + print({ login }) + ';;\n' +
      pages.join('') +
      '*"pulls?"*) exit 4;;\n' +
      '*"--review-requested"*) ' + print([]) + ';;\n' +
      '*"--involves"*) ' + print(overrides.emptySearch ? [] : search) + ';;\nesac\n');
    process.env.PATH = scratch + ':' + originalPath;
    process.env[marker] = 'synthetic-marker';
    await work(reviewRuntime(scratch), config);
  } finally {
    process.env.PATH = originalPath;
    if (originalMarker === undefined) delete process.env[marker];
    else process.env[marker] = originalMarker;
    await rm(scratch, { recursive: true });
  }
}

test('native adapter preserves the coverage gap and reads and hashes a known idle flagged reply', () => fixture(async (runtime, expected) => {
  const config = await runtime.binding();
  expect(config).toEqual(expected);
  expect(await runtime.importProgress(config)).toBe(quiet.progress);
  const state = { ...importState(quiet.progress), flagged: ['fixture-flagged'] };
  const inventory = await runtime.inventory(config, state, {});
  const watermark = inventory.flagged[0].watermark;
  expect(watermark).toMatch(/^[a-f0-9]{64}$/);
  expect(inventory).toMatchObject({ coverage: 'unknown', inventory: null, prior: { thread: { threadId: state.prior } },
    flagged: [{ id: 'fixture-flagged', status: 'reply', watermark }] });
  expect(JSON.stringify(inventory)).not.toContain('PRIVATE REPLY TEXT');
  const seen = await runtime.inventory(config, state, { 'fixture-flagged': watermark });
  expect(seen.flagged).toEqual([{ id: 'fixture-flagged', status: 'unknown' }]);
}));

test('SAFE-6 reads per-repository pages and retains only eligible IDs', () => fixture(async (runtime, config) => {
  const result = await runtime.discover(config);
  expect(result).toMatchObject({ status: 'pass', prs: [quiet.pr] });
  expect(JSON.stringify(result)).not.toContain('PRIVATE PR TITLE');
}));

test('a lost second repository page leaves discovery unknown', () => fixture(async (runtime, config) => {
  expect(await runtime.discover(config)).toMatchObject({ status: 'unknown' });
}, { next: true, emptySearch: true }));

test('unsafe binding arguments never reach a native command', () => fixture(async (runtime) => {
  expect(await runtime.binding()).toBeNull();
}, { extraProjects: ['/fixture/space and quote'] }));

test('a changed private binding digest holds before native reads', () => fixture(async (runtime) => {
  expect(await runtime.binding()).toBeNull();
}, { drift: true }));

test('sandbox receipt from the previous interval is usable and future/stale receipts wake', async () => {
  const previous = new Date(Date.parse(stamp) - 1_800_000).toISOString();
  await fixture(async (runtime, config) => expect(await runtime.reap(config, stamp)).toEqual(quiet.input.reap), { receiptTime: previous });
  for (const offset of [-1_800_001, 900_000]) {
    await fixture(async (runtime, config) => expect(await runtime.reap(config, stamp)).toBeNull(), {
      receiptTime: new Date(Date.parse(stamp) + offset).toISOString(),
    });
  }
});

test('quiet helper gets its read context without inheriting the sentinel', () => fixture(async (runtime, config) => {
  expect(await runtime.quietFacts(config, quiet.progress, quiet.input)).toEqual({
    version: 2, terms: [{ id: 'environment', status: 'pass' }],
  });
}, { quietProbe: true }));

for (const [length, expected] of [[999, 'pass'], [1000, 'unknown']]) {
  test(`a ${length}-row search is ${expected} even when all REST pages agree`, () => fixture(async (runtime, config) => {
    const result = await runtime.discover(config);
    expect(result.status).toBe(expected);
    if (expected === 'pass') expect(result.searches[1]).toHaveLength(length);
    else {
      expect(result.searches[1]).toBeNull();
      expect(result.prs).toEqual([]);
    }
  }, { searchLength: length }));
}
