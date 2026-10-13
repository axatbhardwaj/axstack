import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const source = () => sentences(readFileSync(`${import.meta.dir}/../../AGENTS.md`, 'utf8')).join('. ');

for (const [concepts, rewording, inversions, accepts] of [
  [[/run|execute/i, /vendored Node.oriented anatomy code/i, /Bun/i],
    'Execute vendored Node-oriented anatomy code with Bun.', [[/Bun/i,'Node.js']], requires],
  [[/anatomy/i, /installer network/i, /Git step/i],
    'Anatomy has no installer network or Git step.', [[/has no/i,'has']],
    (text, ...concepts) => prohibits(text, /has no/i, ...concepts)],
  [[/legacy archify release/i, /(?:permit|allow) only/i, /local read.only Git checks/i, /rev-parse/i, /status --porcelain --ignored/i, /permit|allow/i],
    'Allow only local read-only Git checks (rev-parse and status --porcelain --ignored) for legacy archify release.',
    [[/(?:permit|allow) only/i,'Allow also network'], [/read.only/i,'mutating']], requires],
]) {
  test(`anatomy runtime exception: ${rewording}`, () => checkRule(source(),
    (text) => accepts(text, ...concepts), rewording, inversions, concepts));
}

test('runtime boundary retires the installer network exception', () => {
  expect(source()).not.toMatch(/permit an installer network and Git step/i);
});
