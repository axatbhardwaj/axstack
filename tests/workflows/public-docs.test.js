import { expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { publicDocPaths, docLinkIssues } from './public-docs.js';
import { checkRule, requires, sentences } from './prose-contract.js';

const guardedDriverLaunches = (text) => sentences(text)
  .filter((sentence) => /top.level drivers?/i.test(sentence))
  .every((sentence) => requires(sentence, /explicit user request/i, /only|requires?/i)
    && !/without|unless|even without/i.test(sentence));

const root = `${import.meta.dir}/../..`;

function fixture(check) {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/docs-links-`);
  const put = (path, text) => {
    mkdirSync(new URL('.', `file://${dir}/${path}`).pathname, { recursive: true });
    writeFileSync(`${dir}/${path}`, text);
  };
  try { check(dir, put); } finally { rmSync(dir, { recursive: true }); }
}

test('public documentation relative links and heading anchors resolve', () => {
  expect(docLinkIssues(root)).toEqual([]);
});

test('public doc discovery includes new pages and excludes historical baselines', () => {
  fixture((dir, put) => {
    put('README.md', '# Start');
    put('docs/new-page.md', '# Guide');
    put('docs/specs/old.md', '[broken](gone.md)');
    put('docs/plans/old.md', '[broken](gone.md)');
    put('docs/notes.txt', '[broken](gone.md)');
    expect(publicDocPaths(dir)).toEqual(['README.md', 'docs/new-page.md']);
    expect(docLinkIssues(dir)).toEqual([]);
  });
});

test('link guard catches broken files and anchors on newly discovered pages', () => {
  fixture((dir, put) => {
    put('README.md', '[guide](docs/new-page.md#first-task)');
    put('docs/new-page.md', '# First task\n[home](../README.md#start)\n[missing](gone.md)');
    expect(docLinkIssues(dir)).toEqual([
      'docs/new-page.md: missing ../README.md#start',
      'docs/new-page.md: missing gone.md',
    ]);
    put('README.md', '# Start\n[guide](docs/new-page.md#gone)');
    put('docs/new-page.md', '# First task');
    expect(docLinkIssues(dir)).toEqual(['README.md: missing docs/new-page.md#gone']);
    put('README.md', '# Start\n[guide](docs/new-page.md#first-task)');
    expect(docLinkIssues(dir)).toEqual([]);
  });
});

test('link guard resolves references, encoded paths, duplicate headings, and explicit anchors', () => {
  fixture((dir, put) => {
    put('README.md', `# Start
[guide][task]
[second](docs/guide%20page.md#first-task-1 "Next")
[section](docs/guide%20page.md#details)
[explicit](docs/guide%20page.md#custom)
[task]: <docs/guide%20page.md#first-task>
`);
    put('docs/guide page.md', '# First `task`\n# First task\nDetails\n-------\n<a id="custom"></a>');
    expect(docLinkIssues(dir)).toEqual([]);
    put('docs/guide page.md', '# Changed\n');
    expect(docLinkIssues(dir)).toHaveLength(4);
  });
});

test('link guard ignores examples in code and external URLs', () => {
  fixture((dir, put) => {
    put('README.md', '# Start\n```md\n[example](gone.md)\n```\n`[example](gone.md)`\n[web](https://example.invalid/page#missing)\n[mail](mailto:user@example.invalid)');
    expect(docLinkIssues(dir)).toEqual([]);
  });
});

test('workflow editing surfaces include all public documentation pages', () => {
  const concepts = [/keep/i, /workflow surfaces/i, /docs\/\*\.md/i];
  checkRule(readFileSync(`${root}/AGENTS.md`, 'utf8').replace(/\s+/g, ' '), (text) => requires(text, ...concepts),
    'Keep workflow surfaces in skills, profiles, tests/workflows, docs/*.md, and README.md.',
    [[/Keep/i, 'Exclude']], concepts);
});


test('an unmatched inline-code delimiter cannot hide later document links', () => {
  fixture((dir, put) => {
    put('README.md', '# Start\nAn unmatched ` delimiter\n[missing](gone.md)\n`valid example`');
    expect(docLinkIssues(dir)).toEqual(['README.md: missing gone.md']);
    put('README.md', '# Start\n``[example](gone.md)``\n[missing](gone.md)');
    expect(docLinkIssues(dir)).toEqual(['README.md: missing gone.md']);
  });
});


test('package recipe requires every entry point and both current publication references', () => {
  const recipe = readFileSync(`${root}/.agents/skills/verify-axstack/features/package.md`, 'utf8');
  const assertions = recipe.match(/cmp "\$EVIDENCE\/archives-before.txt" "\$EVIDENCE\/archives-after.txt"\n([\s\S]*?)\nif rg/)?.[1];
  expect(assertions).toBeTruthy();
  const members = ['bin/axstack.js', 'skills/axstack/scripts/dispatch-plan.js',
    'skills/axstack/scripts/fleet-route.js', 'skills/axstack/scripts/fleet-config.js',
    'skills/axstack/scripts/fleet-facts.js', 'skills/axstack/references/fleet-route-schema.md',
    'skills/axstack/scripts/fleet-route-cli.js', 'skills/axstack/scripts/fleet-dispatch.js',
    'skills/axstack/scripts/fleet-proc.js', 'skills/axstack/scripts/fleet-sample.js',
    'skills/axstack/scripts/fleet-sample-cli.js', 'skills/axstack/scripts/fleet-sample-io.js',
    'skills/axstack/scripts/fleet-sample-manifest.js',
    'skills/axstack/scripts/fleet-inventory.js', 'skills/axstack/scripts/fleet-destination.js',
    'skills/axstack/scripts/fleet-receipt.js', 'skills/axstack/references/fleet-dispatch.md',
    'skills/axstack/references/fleet-verification.md',
    'skills/axstack-spec/references/format.md',
    'profiles/presets/mixed.json', 'skills/axstack/references/candidate-publication.md',
    'skills/axstack/references/preview.md', 'skills/axstack/references/pr-chain.md',
    'skills/axstack/scripts/single-server.js',
    'skills/axstack/scripts/sync-default.js', 'skills/axstack/scripts/hub-usage.js',
    'skills/axstack/scripts/default-policy.js', 'skills/axstack/scripts/default-settings.js',
    'skills/axstack/scripts/hub-secret.js', 'skills/axstack/scripts/driver-history.js',
    'skills/axstack/references/thread-title-instructions.txt',
    'skills/axstack/systemd/axstack-default-sync.service', 'skills/axstack/systemd/axstack-default-sync.timer',
    'skills/axstack/systemd/axstack-single-server.service', 'skills/axstack/systemd/axstack-single-server.timer',
    'skills/axstack-publish/SKILL.md',
    'skills/axstack-explain/references/design.md',
    'skills/axstack-explain/references/frontend-design/FRONTEND-DESIGN.md',
    'skills/axstack-explain/references/frontend-design/LICENSE.txt',
    'skills/axstack-explain/references/frontend-design/PROVENANCE.md',
    'skills/axstack-watch/references/repair-publication.md'];
  fixture((dir, put) => {
    // The automated recipe boundary needs only Linux/POSIX shell tools.
    put('bin/rg', '#!/bin/sh\nexit 73\n');
    chmodSync(`${dir}/bin/rg`, 0o755);
    const env = { ...Bun.env, PATH: `${dir}/bin:${Bun.env.PATH ?? ''}`, EVIDENCE: dir };
    expect(Bun.spawnSync([`${dir}/bin/rg`], { env }).exitCode).toBe(73);
    const check = (listing) => {
      put('pack.log', listing.map((path) => `packed 100B ${path}`).join('\n'));
      return Bun.spawnSync(['/bin/bash', '-e', '-c', assertions],
        { env, stdout: 'pipe', stderr: 'pipe' }).exitCode;
    };
    expect(check(members)).toBe(0);
    for (const missing of members) {
      expect(check(members.filter((path) => path !== missing)), missing).toBe(1);
    }
  });
});

for (const path of ['docs/installation.md', 'docs/concepts.md', 'docs/workflows.md']) {
  test(`${path}: top-level launch requires an explicit user request`, () => {
    const text = readFileSync(`${root}/${path}`, 'utf8').replace(/`/g, '').replace(/\s+/g, ' ');
    const concepts = [/every/i, /top-level launch/i, /including/i, /author fallback/i,
      /requires/i, /explicit user request/i];
    checkRule(text, (value) => requires(value, ...concepts),
      'Every top-level launch, including an author fallback, requires an explicit user request.',
      [[/requires/i, 'does not require']], concepts);
  });
}

for (const path of ['docs/installation.md', 'docs/concepts.md', 'docs/workflows.md']) {
  test(`${path}: additional blanket driver grants are rejected`, () => {
    const accepts = (text) => guardedDriverLaunches(text) && requires(text, /every/i, /top-level launch/i, /requires/i, /explicit user request/i);
    const text = readFileSync(`${root}/${path}`, 'utf8').replace(/`/g, '');
    expect(accepts(text)).toBe(true);
    for (const extra of [
      'The standing block authorizes top-level driver threads.',
      'Top-level drivers use t3_thread_launch.',
      'Top-level drivers use t3_thread_launch without an explicit user request.',
    ]) expect(accepts(`${text}\n${extra}`), extra).toBe(false);
  });
}

test('driver launch guard accepts equivalent restrictions and rejects inversions', () => {
  const equivalent = 'Only after an explicit user request, top-level drivers launch through t3_thread_launch.';
  expect(guardedDriverLaunches(equivalent)).toBe(true);
  expect(guardedDriverLaunches('Top-level drivers require an explicit user request before launching.')).toBe(true);
  for (const changed of [equivalent.replace('Only after', 'Without'),
    equivalent.replace('explicit user request', 'implicit consent'),
    'Top-level drivers do not require an explicit user request.']) {
    expect(guardedDriverLaunches(changed), changed).toBe(false);
  }
});
