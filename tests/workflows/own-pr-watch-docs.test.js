import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const docs = ['README.md', 'docs/workflows.md', 'docs/installation.md'];
const rules = [
  ['publication', [/every|any/i, /Axstack phase/i, /own PR/i, /verified.*readback/i, /driver/i, /arm.*join/i, /chat-run watch/i],
    'After verified publication readback of an own PR from any Axstack phase, the driver arms or joins its chat-run watch.'],
  ['no open-PR expiry', [/chat-run watch/i, /expir/i, /PRs.*open/i],
    'The chat-run watch never expires while PRs remain open.', /never/i],
  ['settled stop', [/chat-run watch/i, /only/i, /all|every/i, /PRs.*merge.*close/i,
    /launched work.*settled/i, /release.*settled or not applicable/i, /user cancels/i],
    'The chat-run watch ends only when all watched PRs merge or close, launched work is settled, and release is settled or not applicable, or the user cancels.', /not applicable/i],
  ['recorded identity', [/run record/i, /schedule ID/i, /driver thread/i],
    'The run record holds the schedule ID and driver thread.'],
];

// Public docs must carry the same obligations as packaged guidance. Mutation
// checks below operate on real-source sentences in memory, never tracked files.
for (const path of docs) {
  for (const [name, concepts, rewording, negative] of rules) {
    test(`own-PR watch docs: ${path}: ${name}`, () => {
      const accepts = negative ? (text) => prohibits(text, negative, ...concepts)
        : (text) => requires(text, ...concepts);
      const inversion = name === 'no open-PR expiry' ? [/never/i, 'always'] : [/^/, 'Never '];
      checkRule(read(path), accepts, rewording, [inversion], concepts);
    });
  }
  test(`own-PR watch docs: ${path}: expiry never ends a chat-run watch`, () => {
    const accepts = (text) => !sentences(text).some((unit) =>
      /watch/i.test(unit) && /(?:ends?|lasts?|stop|delete|deletion)/i.test(unit)
      && /\bexpir\w*/i.test(unit) && !/standalone/i.test(unit));
    expect(accepts(read(path))).toBe(true);
    expect(accepts(`${read(path)} The chat-run watch ends when its wake expires.`)).toBe(false);
    expect(accepts(`${read(path)} A standalone watch ends at its expiry.`)).toBe(true);
  });
}

test('watch end-state template distinguishes native lifetime from standalone expiry', () => {
  const text = read('skills/axstack-watch/SKILL.md');
  expect(text).toMatch(/Watch: <[^>]*native schedule lifetime[^>]*re-arm[^>]*stop receipt[^>]*>/);
  expect(text).toMatch(/standalone[^.]*expiry/i);
  expect(text).not.toMatch(/stop receipt \+ expiry/);
});

test('Autopilot links directly to chat-run cadence instructions', () => {
  const text = readFileSync(`${import.meta.dir}/../../skills/axstack/references/autopilot.md`, 'utf8');
  expect(text).toContain('](../../axstack-watch/references/watch-runtime.md#chat-run-watch)');
});
