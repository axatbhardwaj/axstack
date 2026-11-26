import { expect, test } from 'bun:test';
import { scanPulls } from '../../skills/axstack/workflows/dependabot-facts.mjs';
import { fixture, head } from './dependabot-forge-fixture.js';

const expected = {
  author: 'pass',
  branch: 'pass',
  paths: 'pass',
  claims: 'pass',
  releaseTags: 'pass',
  pins: 'pass',
  ci: 'pass',
  checks: 'pass',
  head: 'pass',
};

test('an empty covered inventory has no candidate heads', async () => {
  expect(await scanPulls(fixture({ pulls: [] }))).toMatchObject({ discovery: 'pass', pulls: [] });
});

test('checks each head and reports a fully verified pin and release tag', async () => {
  expect(await scanPulls(fixture())).toMatchObject({
    discovery: 'pass',
    pulls: [{ number: 1, head, facts: expected }],
  });
});

for (const [label, inputs, term, status] of [
  ['non-bot author', { author: 'octocat' }, 'author', 'fail'],
  ['branch outside the allowed prefix', { branch: 'dependabot/npm_and_yarn/test' }, 'branch', 'fail'],
  ['file outside workflows', { filename: 'README.md' }, 'paths', 'fail'],
  ['rename from outside workflows', { oldFilename: 'README.md' }, 'paths', 'fail'],
  ['wrong pin', { pin: 'b'.repeat(40) }, 'pins', 'fail'],
  ['tag without a published release', { releases: [] }, 'releaseTags', 'fail'],
  ['tag verification denied', { tagUnknown: true }, 'releaseTags', 'unknown'],
  ['an arbitrary tag despite a valid claim', { pin: 'main' }, 'releaseTags', 'fail'],
  ['detour through a dot path', { filename: '.github/workflows/../README.yml' }, 'paths', 'fail'],
  ['missing action version claim', { title: 'Maintenance' }, 'claims', 'unknown'],
  ['ci absent on the selected head', { runs: [] }, 'ci', 'fail'],
  ['ci queued before its jobs are visible', { runStatus: 'queued' }, 'ci', 'fail'],
  ['ci from another head', { runHead: 'e'.repeat(40) }, 'ci', 'unknown'],
  ['no checks at the head', { checks: [], statuses: [] }, 'checks', 'fail'],
  ['pending check', { checkStatus: 'in_progress' }, 'checks', 'fail'],
  ['failed check', { conclusion: 'failure' }, 'checks', 'fail'],
  ['cancelled check', { conclusion: 'cancelled' }, 'checks', 'fail'],
  ['pending commit status', { statuses: [{ id: 1, state: 'pending' }] }, 'checks', 'fail'],
  ['incomplete check list', { checkTotal: 2 }, 'checks', 'unknown'],
  ['head moved while facts were collected', { moved: true }, 'head', 'fail'],
]) {
  test(label, async () => {
    const result = await scanPulls(fixture(inputs));
    expect(result.discovery).toBe('pass');
    expect(result.pulls).toHaveLength(1);
    expect(result.pulls[0].facts[term]).toBe(status);
  });
}

test('a page gap discards partial discovery', async () => {
  expect(await scanPulls(fixture({ gap: true }))).toMatchObject({ discovery: 'unknown', pulls: [] });
});

test('the grouped update table supplies the claim for the named action', async () => {
  const result = await scanPulls(
    fixture({
      title: 'Bump the github-actions group with 1 update',
      body: '| Package | From | To |\n| --- | --- | --- |\n| [actions/checkout](https://github.com/actions/checkout) | `v6` | `v7.0.0` |',
    }),
  );
  expect(result.pulls[0].facts).toEqual(expected);
});

test('a release alias must resolve to the same commit as a published release', async () => {
  const valid = await scanPulls(fixture({ title: 'Bump actions/checkout from 6 to 7', pin: 'v7' }));
  expect(valid.pulls[0].facts).toEqual(expected);
  const invalid = await scanPulls(
    fixture({
      title: 'Bump actions/checkout from 6 to 7',
      pin: 'v7',
      aliasSha: 'b'.repeat(40),
    }),
  );
  expect(invalid.pulls[0].facts.releaseTags).toBe('fail');
});
