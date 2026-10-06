import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { publicDocPaths, docLinkIssues } from './public-docs.js';
import { checkRule, requires } from './prose-contract.js';

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
