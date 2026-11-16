import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = new URL('../../', import.meta.url).pathname;
const agents = await Bun.file(`${root}AGENTS.md`).text();
const path = 'skills/axstack/sandbox/';
const mergeConcepts = [/PR/i, /chang|modif|touch/i, /any|every|all/i, /skills\/axstack\/sandbox\//, /stops?|halts?|holds?/i, /merge-ready/i, /user/i];
const sandboxRule = (text, directoryExists) => directoryExists && requires(text, ...mergeConcepts);
const holdsSandbox = (text) => sandboxRule(text, existsSync(`${root}${path}`));

test('every sandbox path change stops at merge-ready for the user, and the directory must exist', () => {
  checkRule(agents, holdsSandbox,
    'Every PR modifying any path under skills/axstack/sandbox/ halts at merge-ready for the user.',
    [[/stops?|halts?|holds?/i, 'continues'], [/for the user/i, 'for automated merging']], mergeConcepts);
  expect(sandboxRule(agents, false)).toBe(false);
});

test('Docker is scoped to sandbox review execution rather than general installation', () => {
  const accepts = (text) => requires(text, /Docker/i, /prerequisite/i, /only/i, /sandbox review execution/i, /axat-vps/i);
  checkRule(agents, accepts,
    'Only sandbox review execution on axat-vps has Docker as a prerequisite.',
    [[/only/i, 'always'], [/sandbox review execution/i, 'all Axstack commands']], [/Docker/i, /only/i, /sandbox review execution/i]);
});

test('packaged peer review clause prohibits host execution and preserves held-sandbox fallback', async () => {
  const file = Bun.file(`${root}${path}host-execution.md`);
  expect(await file.exists()).toBe(true);
  const clause = await file.text();
  const concepts = [/peer-mode review/i, /dependencies|build|PR code/i, /host/i];
  const accepts = (text) => prohibits(text, /never/i, ...concepts);
  checkRule(clause, accepts,
    'For every peer-mode review, never install dependencies, build or execute PR code on the host or in a container started by the reviewing seat.',
    [[/never/i, 'always']], concepts);
  expect(requires(clause, /held|failed|unavailable/i, /sandbox/i, /limitation/i, /unknown/i, /code reading/i, /CI/i)).toBe(true);
  expect(requires(clause, /authored/i, /local checks/i)).toBe(true);
});
