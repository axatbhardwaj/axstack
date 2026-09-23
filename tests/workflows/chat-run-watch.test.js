import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/\s+/g, ' ');
const watch = () => read('skills/axstack-watch/SKILL.md');
const runtime = () => read('skills/axstack-watch/references/watch-runtime.md');

// These checks exercise the shipped instruction contract. They do not prove
// model decisions or native Orca behavior; the scenarios need independent evaluation.
test('chat-run membership admits run publications and explicit adoptions only', () => {
  const text = watch() + runtime();
  expect(text).toMatch(/chat-run watch/i);
  expect(text).toMatch(/verified publication receipts[^.]*same Run/i);
  expect(text).toMatch(/later[^.]*PR[^.]*publication[^.]*verified/i);
  expect(text).toMatch(/explicitly adopted[^.]*maintenance snapshot/i);
  expect(text).toMatch(/unrelated[^.]*self-authored PR/i);
});

test('same-head feedback and checks are events while unchanged complete passes stay quiet', () => {
  const text = runtime();
  expect(text).toMatch(/unchanged head[^.]*new check/i);
  expect(text).toMatch(/review[^.]*body digest/i);
  expect(text).toMatch(/all pages[^.]*every member/i);
  expect(text).toMatch(/healthy unchanged[^.]*no wake/i);
  expect(text).toMatch(/API[^.]*incomplete[^.]*UNKNOWN/i);
});

test('observer reports internally; only original driver routes repairs and writers', () => {
  const text = watch() + runtime();
  expect(runtime()).toMatch(/It never writes[\s\S]*?dispatches authors/i);
  expect(text).toMatch(/driver[^.]*alone[^.]*repair/i);
  expect(text).toMatch(/independent PRs[^.]*parallel/i);
  expect(text).toMatch(/same PR[^.]*one author/i);
  expect(text).toMatch(/parent[^.]*invalidates[^.]*child evidence/i);
});

test('chat-run cancellation and terminal state stop only owned automation after readback', () => {
  const text = watch() + runtime();
  expect(text).toMatch(/all members merged or closed[^.]*user cancellation/i);
  expect(text).toMatch(/re-read membership[^.]*ambiguous publication/i);
  expect(text).toMatch(/disable[^.]*own automation[^.]*readback/i);
  expect(text).toMatch(/failed or uncertain disable[^.]*hold/i);
  expect(text).toMatch(/standalone[^.]*24.h/i);
});

test('chat-run scenario corpus covers decisions beyond source checks', () => {
  const cases = JSON.parse(read('tests/workflows/chat-run-watch-scenarios.json')).cases;
  expect(cases.map((c) => c.id)).toEqual([
    'membership-and-later-publication', 'same-head-delta',
    'quiet-and-incomplete', 'authority-and-writers',
    'stack-and-publication-order', 'recovery-and-stop',
  ]);
  for (const scenario of cases) {
    expect(scenario.input.length).toBeGreaterThan(20);
    expect(scenario.expected.length).toBeGreaterThan(30);
  }
});

test('chat-run driver keeps repairing each member through current-head readiness', () => {
  const text = runtime();
  expect(text).toMatch(/repeat repair[^.]*mode-specific publication and independent review[^.]*current-head checks[^.]*full readiness/i);
  expect(text).toMatch(/until[^.]*merge-ready predicate[^.]*concrete hold/i);
  expect(text).toMatch(/rebase[^.]*root[^.]*advanced base/i);
  expect(text).toMatch(/actionable comments/i);
  expect(text).toMatch(/revalidat[^.]*stacked descendants/i);
  expect(text).toMatch(/historical approvals[^.]*threads[^.]*cleared/i);
});
