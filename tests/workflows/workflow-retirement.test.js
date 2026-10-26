import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { publicDocPaths } from './public-docs.js';

const root = `${import.meta.dir}/../..`;
const retired = /\b(?:gemini|antigravity)\b|axstack-(?:research-web-google|explore-codebase-flash|arena-candidate-antigravity)\b/i;
const paths = ['skills', 'profiles'].flatMap((dir) => readdirSync(`${root}/${dir}`, { recursive: true })
  .filter((path) => /\.(?:md|m?js|json)$/.test(path)).map((path) => `${dir}/${path}`));
paths.push('src/roles.js', ...publicDocPaths(root));

// These exact installer interfaces remain supported, independent of workflows.
function workflowText(path, text) {
  if (path !== 'docs/installation.md') return text;
  return text
    .replace('`--harness antigravity` defaults to `~/.gemini/GEMINI.md`.', '')
    .replace('`antigravity` skill directory.', '')
    .replace('Antigravity (IDE and `agy` CLI) reads `~/.gemini/config/skills`', '')
    .replace('| Antigravity IDE / `agy` CLI | `~/.gemini/config/skills` | documented upstream |', '');
}

test('active guidance and presets omit retired workflow roles and provider', () => {
  for (const path of paths) {
    expect(workflowText(path, readFileSync(`${root}/${path}`, 'utf8')), path).not.toMatch(retired);
  }
});

test('retirement guard catches reintroduced routes while allowing surviving prose rewordings', () => {
  for (const name of ['axstack-research-web-google', 'axstack-explore-codebase-flash',
    'axstack-arena-candidate-antigravity', 'antigravity', 'Gemini']) {
    for (const instruction of [`Dispatch ${name}.`, `Do not dispatch ${name}.`]) {
      expect(retired.test(workflowText('docs/installation.md', instruction))).toBe(true);
    }
  }
  for (const text of ['Use Grok for X sources.', 'X posts are researched with Grok.']) {
    expect(retired.test(text)).toBe(false);
  }
});
