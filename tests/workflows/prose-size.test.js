import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { isVendored } from './vendored-paths.js';
import { checkRule, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const skills = `${root}/skills`;

test('prose ceilings have no automatic round-step raise policy', () => {
  const source = readFileSync(import.meta.filename, 'utf8');
  const comments = (source.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g) ?? []).join(' ');
  expect(comments).not.toMatch(/round[- ]step|\+\s*100[,_]?000|\+\s*5[,_]?000/i);
});

test('repository prose-budget changes stop at merge-ready for the user', () => {
  const agents = readFileSync(`${root}/AGENTS.md`, 'utf8');
  const concepts = [
    /this repository/i, /PR\b|pull request\b/i, /changes?|modifies?/i,
    /tests\/workflows\/prose-budget\.json/, /(?:or|either)\b/i,
    /tests\/workflows\/prose-size\.test\.js/,
    /(?:stops?|halts?|pauses?) at/i, /merge-ready/i, /for (?:the )?user/i,
  ];
  checkRule(agents, (text) => requires(text, ...concepts),
    'In this repository, any pull request that modifies either tests/workflows/prose-budget.json or tests/workflows/prose-size.test.js halts at merge-ready for the user.',
    [
      [/(?:stops?|halts?|pauses?) at/i, 'does not stop at'],
      [/for (?:the )?user/i, 'for the agent'],
      [/\b(?:or|either)\b/gi, 'and'],
    ], concepts);
});

test('packaged guidance stays within the aggregate and always-loaded budgets', () => {
  const markdown = readdirSync(skills, { recursive: true }).filter((path) => path.endsWith('.md') && !isVendored(`skills/${path}`));
  const bytes = (path) => readFileSync(`${skills}/${path}`).byteLength;
  const total = markdown.reduce((sum, path) => sum + bytes(path), 0);
  const alwaysLoaded = ['contracts.md', 'lifecycle.md', 'routing.md']
    .reduce((sum, path) => sum + bytes(`axstack/references/${path}`), 0);

  // Contract text is never trimmed to fit.
  const budget = JSON.parse(readFileSync(`${import.meta.dir}/prose-budget.json`, 'utf8'));
  expect(total).toBeLessThanOrEqual(budget.aggregateBytes);
  expect(alwaysLoaded).toBeLessThanOrEqual(budget.alwaysLoadedBytes);
});
