import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { publicDocPaths } from './public-docs.js';

const root = `${import.meta.dir}/../..`;
const retired = JSON.parse(readFileSync(`${import.meta.dir}/retired-terms.json`, 'utf8'))
  .map((term) => ({ ...term, pattern: new RegExp(term.pattern, 'i') }));
const paths = ['skills', 'profiles'].flatMap((dir) => readdirSync(`${root}/${dir}`, { recursive: true })
  .filter((path) => /\.(?:md|m?js|json)$/.test(path)).map((path) => `${dir}/${path}`));
paths.push('src/roles.js', ...publicDocPaths(root));

function retirementIssues(path, text) {
  return retired.filter(({ pattern, exceptions }) => {
    const workflowText = exceptions.filter((exception) => exception.path === path)
      .reduce((remaining, exception) => remaining.replace(exception.text, ''), text);
    return pattern.test(workflowText);
  }).map(({ reason }) => reason);
}

test('active guidance and presets omit retired workflow roles and provider', () => {
  for (const path of paths) {
    expect(retirementIssues(path, readFileSync(`${root}/${path}`, 'utf8')), path).toEqual([]);
  }
});

test('retirement guard catches reintroduced routes while allowing surviving prose rewordings', () => {
  for (const name of ['axstack-research-web-google', 'axstack-explore-codebase-flash',
    'axstack-arena-candidate-antigravity', 'antigravity', 'Gemini']) {
    for (const instruction of [`Dispatch ${name}.`, `Do not dispatch ${name}.`]) {
      expect(retirementIssues('docs/installation.md', instruction)).not.toEqual([]);
    }
  }
  for (const text of ['Use Grok for X sources.', 'X posts are researched with Grok.']) {
    expect(retirementIssues('docs/installation.md', text)).toEqual([]);
  }
});

test('retirement guard catches read-only dependency symlink advice and rewordings', () => {
  for (const instruction of [
    'Use a read-only symlink to the host node_modules.',
    'Symlink the host dependencies as a read-only dependency view.',
    'Expose a read only dependency view\nvia symlinks for reviewers.',
    'Reviewers may use symlinked node_modules\nread-only.',
  ]) {
    expect(retirementIssues('skills/axstack/references/review-manager-prompt.md', instruction), instruction).not.toEqual([]);
  }
});

test('installer exceptions stay exact and confined to their documented path', () => {
  for (const { exceptions } of retired) {
    for (const { path, text } of exceptions) {
      expect(retirementIssues(path, text)).toEqual([]);
      expect(retirementIssues('skills/axstack/references/candidate-publication.md', text)).not.toEqual([]);
      expect(retirementIssues(path, `${text}\nDispatch Gemini.`)).not.toEqual([]);
    }
  }
});

test('unrelated symlinks, read-only reviews and the retained PR-link ban remain allowed', () => {
  for (const text of [
    'Reject symlink escapes from the evidence folder.',
    'Peer code stays read-only. Use a private dependency installation.',
    'Never link unrelated PRs.',
  ]) {
    expect(retirementIssues('skills/axstack/references/t3-runtime.md', text)).toEqual([]);
  }
});
