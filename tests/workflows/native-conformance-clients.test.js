import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';

const fixtures = new URL('../../skills/axstack/workflows/conformance/fixtures/', import.meta.url);

async function runFixture(root, file, entry, binding, input) {
  writeFileSync(root + '/client-binding.json', JSON.stringify(binding), { mode: 0o600 });
  const script = `
globalThis.Schema = new Proxy({}, { get: () => () => ({}) });
const effect = (run) => Object.assign(run, {
  *[Symbol.iterator]() { return yield run(); },
});
globalThis.Effect = {
  sync: effect,
  promise: effect,
  gen: (body) => effect(async () => {
    const iterator = body();
    let step = iterator.next();
    while (!step.done) step = iterator.next(await step.value);
    return step.value;
  }),
};
globalThis.T3 = {
  workflow: (_name, _options, body) => body,
  pullRequests: { opened: () => ({}) },
  step: (_name, _options, body) => body,
  runs: () => effect(() => [{ id: 'fixture-run', key: 'missing-cli' }]),
};
const fixture = await import(${JSON.stringify(new URL(file, fixtures).pathname)});
const value = await fixture[${JSON.stringify(entry)}](${JSON.stringify(input)})();
console.log(JSON.stringify(value, (key, field) => {
  if (field === undefined) throw new Error('Non-JSON field: ' + key);
  return field;
}));
`;
  const child = Bun.spawn([process.execPath, '-e', script], {
    cwd: root,
    env: { HOME: root, PATH: root, AXSTACK_CONFORMANCE_ROOT: root },
    stdout: 'pipe', stderr: 'pipe', timeout: 8000,
  });
  const [out, error, status] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  expect(status, error).toBe(0);
  return JSON.parse(out);
}

function fakeGh(root) {
  writeFileSync(root + '/gh', `#!${process.execPath}
const args = process.argv.slice(2);
if (args.includes('--slurp')) process.exit(1);
const endpoint = args.at(-1);
const repo = endpoint.split('/')[2];
if (repo === 'absent' || (repo === 'gap' && endpoint.includes('page=2'))) process.exit(1);
if (endpoint.includes('/pulls?')) {
  const page = Number(endpoint.match(/[?&]page=(\\d+)/)?.[1] ?? 1);
  let next = page === 1 ? 2 : null;
  let body = JSON.stringify([{ number: page }]);
  let status = '200 OK';
  switch (repo) {
    case 'skipped-page': if (page === 1) next = 3; break;
    case 'empty-page':
      if (page === 2) {
        body = '[]';
        next = 3;
      }
      break;
    case 'bad-status': status = '502 Bad Gateway'; break;
    case 'page-cap': next = page + 1; break;
    case 'object-body': body = '{"number":1}'; break;
    case 'truncated-body': body = '[{"number":1'; break;
  }
  let link = next === null ? '' : 'Link: <https://api.github.com/repositories/42/pulls?state=open&per_page=100&page=' + next + '>; rel="next"\\n';
  if (repo === 'missing-next-url' && page === 1) link = 'Link: rel="next"\\n';
  console.log('HTTP/2.0 ' + status + '\\n' + link + '\\n' + body);
} else if (endpoint.endsWith('/pulls/1')) {
  console.log(JSON.stringify({ state: 'open', head: { sha: 'abc' }, base: { ref: 'main' } }));
} else if (endpoint.endsWith('/pulls/2')) {
  console.log(JSON.stringify({ state: 'open' }));
} else if (endpoint.includes('/check-runs?')) {
  console.log(JSON.stringify({ total_count: 1, check_runs: [] }));
} else if (endpoint.includes('/status?')) {
  console.log(JSON.stringify({ total_count: 0, statuses: [] }));
} else {
  process.exit(1);
}
`, { mode: 0o700 });
}

test('gh without --slurp observes both pages and keeps a failed later page unknown', async () => {
  const root = makeTempRoot('axstack-forge-pages-');
  fakeGh(root);
  const result = await runFixture(root, 'clients.mjs', 'forge', {
    runtime: { project: root },
    forge: { repo: 'fixture/visible', absentRepo: 'fixture/gap', cases: {} },
  });
  expect(result).toMatchObject({
    visible: true, missing: true, combined: 'unknown',
    discovery: {
      'fixture/visible': { coverage: 'complete', count: 2 },
      'fixture/gap': { coverage: 'unknown', page: 2 },
    },
  });
});

test.each([
  ['skipped-page', 1, 'invalid GitHub API next page'],
  ['missing-next-url', 1, 'invalid GitHub API next page'],
  ['empty-page', 2, 'missing or invalid GitHub API page'],
  ['bad-status', 1, 'missing or invalid GitHub API page'],
  ['page-cap', 21, 'GitHub API page limit reached'],
  ['object-body', 1, 'missing or invalid GitHub API page'],
  ['truncated-body', 1, 'missing or invalid GitHub API page'],
])('forge returns unknown coverage and JSON evidence for %s', async (scenario, page, reason) => {
  const root = makeTempRoot('axstack-forge-incomplete-');
  fakeGh(root);
  const repo = 'fixture/' + scenario;
  const result = await runFixture(root, 'clients.mjs', 'forge', {
    runtime: { project: root },
    forge: { repo, absentRepo: 'fixture/visible', cases: {} },
  });
  expect(result).toMatchObject({
    visible: false, combined: 'unknown',
    discovery: {
      [repo]: { coverage: 'unknown', page, reason },
      'fixture/visible': { coverage: 'complete', count: 2 },
    },
  });
});

test('forge emits JSON with evidence when PR fields or observations are missing', async () => {
  const root = makeTempRoot('axstack-forge-shape-');
  fakeGh(root);
  const result = await runFixture(root, 'clients.mjs', 'forge', {
    runtime: { project: root },
    forge: {
      repo: 'fixture/visible', absentRepo: 'fixture/absent',
      cases: { lateReview: { number: 1, greenAt: '2026-11-25T20:45:43Z' } },
    },
  });
  expect(result.facts.lateReview).toMatchObject({
    status: 'unknown', checks: null, statuses: [], lateReview: null,
    unknown: ['status', 'checks', 'lateReview'],
  });
  const partial = await runFixture(root, 'clients.mjs', 'forge', {
    runtime: { project: root },
    forge: { repo: 'fixture/visible', absentRepo: 'fixture/absent', cases: { retarget: { number: 2 } } },
  });
  expect(partial.facts.retarget).toMatchObject({ unknown: ['head', 'base'] });
});

test('a refused CLI wake returns a JSON receipt for a missing owner', async () => {
  const root = makeTempRoot('axstack-wake-missing-');
  const t3 = root + '/t3';
  writeFileSync(t3, '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  const result = await runFixture(root, 'clients.mjs', 'wake', { runtime: { t3, project: root, base: root } },
    { key: 'missing-cli', route: 'cli', thread: 'missing' });
  expect(result).toEqual({ exit: 1, delivery: null });
});

function executorBinding(root, port) {
  const endpoint = `http://127.0.0.1:${port}/mcp`;
  const clientFile = root + '/client.json';
  writeFileSync(clientFile, JSON.stringify({
    mcpServers: { executor: { url: endpoint, headers: { authorization: 'Bearer fixture-key' } } },
  }), { mode: 0o600 });
  return { endpoint, clientFile, tool: 'linear_app.fixture.list_issues' };
}

test('Executor sends its bounded read only to the explicitly bound loopback URL', async () => {
  const root = makeTempRoot('axstack-linear-loopback-');
  const seen = [];
  const listener = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      if (request.headers.get('authorization') !== 'Bearer fixture-key') return new Response(null, { status: 401 });
      const { method, id, params } = await request.json();
      seen.push(method);
      if (method === 'initialize') {
        return Response.json({ id, result: { protocolVersion: '2025-03-26' } }, { headers: { 'mcp-session-id': 'fixture' } });
      }
      if (method === 'notifications/initialized') return new Response(null, { status: 202 });
      if (method === 'tools/call' && params.name === 'execute' &&
          params.arguments.code.includes('tools.linear_app.fixture.list_issues({limit:1,fields:["id","updatedAt"]})') &&
          request.headers.get('mcp-session-id') === 'fixture') {
        return Response.json({ id, result: { structuredContent: {
          result: { ok: true, count: 1, hasNextPage: true, hasCursor: true },
        } } });
      }
      return new Response(null, { status: 400 });
    },
  });
  try {
    const linear = executorBinding(root, listener.port);
    expect(await runFixture(root, 'linear.mjs', 'default', { linear })).toEqual({ status: 'unknown' });
    expect(seen).toEqual([]);
    expect(await runFixture(root, 'linear.mjs', 'default', { linear: { ...linear, loopback: true } }))
      .toEqual({ status: 'pass', coverage: 'unknown', failureCoverage: 'unknown' });
    expect(seen).toEqual(['initialize', 'notifications/initialized', 'tools/call']);
  } finally {
    await listener.stop(true);
  }
});

test('Executor reports unknown and makes no request to a 307 redirect target', async () => {
  const root = makeTempRoot('axstack-linear-redirect-');
  const seen = [];
  const listener = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      seen.push(path);
      if (path === '/mcp' && request.headers.get('authorization') === 'Bearer fixture-key') {
        return new Response(null, { status: 307, headers: { Location: '/redirected' } });
      }
      return new Response(null, { status: 400 });
    },
  });
  try {
    const linear = { ...executorBinding(root, listener.port), loopback: true };
    expect(await runFixture(root, 'linear.mjs', 'default', { linear })).toEqual({ status: 'unknown' });
    expect(seen).toEqual(['/mcp']);
  } finally {
    await listener.stop(true);
  }
});
