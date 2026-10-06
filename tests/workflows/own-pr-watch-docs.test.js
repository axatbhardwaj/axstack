import { expect, test } from 'bun:test';
import { publicDocPaths } from './public-docs.js';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const docs = publicDocPaths(`${import.meta.dir}/../..`);
const rules = [
  ['publication', [/every|any/i, /Axstack phase/i, /own PR/i, /verified.*readback/i, /driver/i, /\b(?:arms?|starts?)\b.*(?:joins?|reuses?)\b/i, /chat-run watch/i],
    'After verified publication readback of an own PR from any Axstack phase, the driver arms or joins its chat-run watch.', [/\b(?:arms?|starts?)\b/i, 'abandons']],
  ['no open-PR expiry', [/chat-run watch/i, /expir/i, /PRs.*open/i],
    'The chat-run watch never expires while PRs remain open.', [/never/i, 'always'], /never/i],
  ['settled stop', [/chat-run watch/i, /only/i, /all|every/i, /PRs.*merge.*close/i,
    /launched work[^,]*\bsettled\b/i, /release[^,]*\bsettled or not applicable\b/i, /user cancels/i],
    'The chat-run watch ends only when all watched PRs merge or close, launched work is settled, and release is settled or not applicable, or the user cancels.', [/\b(?:ends?|stops?)\b/i, 'continues'], /not applicable/i],
  ['recorded identity', [/run record/i, /schedule ID/i, /driver thread/i],
    'The run record contains the schedule ID and driver thread.', [/\b(?:holds?|keeps?|stores?|contains?)\b/i, 'omits']],
];

// Public docs must carry the same obligations as packaged guidance. Mutation
// checks below operate on real-source sentences in memory, never tracked files.
for (const [name, concepts, rewording, inversion, negative] of rules) {
  const path = name === 'recorded identity' ? 'docs/host-operations.md' : 'docs/workflows.md';
  test(`own-PR watch docs: ${path}: ${name}`, () => {
    const required = negative?.source === 'never' ? concepts : [...concepts, inversion[0]];
    const accepts = negative ? (text) => prohibits(text, negative, ...required)
      : (text) => requires(text, ...required);
    checkRule(read(path), accepts, rewording, [inversion], required);
  });
}

for (const path of docs) {
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

for (const [path, link] of [
  ['README.md', 'docs/workflows.md#chat-run-pr-watch'],
  ['docs/installation.md', 'workflows.md#chat-run-pr-watch'],
]) {
  test(`watch lifecycle summary links to full instructions: ${path}`, () => {
    const text = readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
    expect(text).toContain(`](${link})`);
  });
}
