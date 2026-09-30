import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/\s+/g, ' ');
const watch = () => read('skills/axstack-watch/SKILL.md');
const runtime = () => read('skills/axstack-watch/references/watch-runtime.md');
const roster = () => read('skills/axstack/references/role-roster.md');
const docs = () => read('docs/workflows.md');
const readme = () => read('README.md');
const installation = () => read('docs/installation.md');
const runRecord = () => read('skills/axstack/references/run-record.md');
const autopilot = () => read('skills/axstack/references/autopilot.md');

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
  expect(text).toMatch(/healthy unchanged[^.]*no notification/i);
  expect(text).toMatch(/API[^.]*incomplete[^.]*UNKNOWN/i);
});

test('chat-run wake uses the PR digest before deciding whether to act', () => {
  const text = runtime();
  expect(text).toMatch(/(?:each|every) driver wake[^.]*first runs[^.]*pr-digest\.js/i);
  expect(text).toMatch(/--watermark[^.]*path[^.]*private run record/i);
  expect(text).toMatch(/exit 0[^.]*unchanged[^.]*no pending local action[^.]*end the turn[^.]*no text/i);
  expect(text).toMatch(/exit 10[^.]*delta[^.]*reconcil/i);
  expect(text).toMatch(/exit 2[^.]*readiness[^.]*UNKNOWN/i);
});

test('verified Autopilot transitions update the driver sidebar comment', () => {
  const instruction = autopilot().match(/[^.]*verified Autopilot transition[^.]*\./i)?.[0] ?? '';
  expect(instruction).toMatch(/mirror[^.]*Autopilot:[^.]*driver worktree[^.]*--comment/i);
  expect(instruction).not.toMatch(/\b(?:never|do not|don't)\b/i);
});

test('observer reports internally; only original driver routes repairs and writers', () => {
  const text = watch() + runtime();
  expect(roster()).toMatch(/axstack-monitor[^.]*standalone watch[^.]*never sends[^.]*chat-run watch[^.]*bounded internal reports[^.]*Run/);
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
    'repair-loop-until-ready',
    'human-approval-survives-repair',
    'maintenance-loop-until-ready',
    'harness-native-driver-wake',
    'orca-observer-fallback',
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

test('own PR watch never re-requests a human approver after repair', () => {
  expect(watch()).toMatch(/human approval[^.]*forge counts[^.]*never re-request[^.]*review/i);
  expect(watch()).toMatch(/forge dismissed[^.]*last-push approval[^.]*hold and tell[^.]*user[^.]*auto-requesting re-review/i);
  expect(watch()).toMatch(/initial review requests[^.]*before any human approval[^.]*allowed/i);
  expect(runtime()).toMatch(/re-read[^.]*approvals[^.]*state[^.]*not re-request/i);
});

test('authorized own PR maintenance loops through feedback, base movement, and readiness', () => {
  expect(watch()).toMatch(/authorized[^.]*own.PR maintenance[^.]*keep repairing[^.]*rebasing[^.]*base/i);
  expect(watch()).toMatch(/re-run checks[^.]*every review comment and thread[^.]*human approval[^.]*required CI[^.]*green/i);
  expect(watch()).toMatch(/approval persists[^.]*fixes and rebases/i);
  expect(watch()).toMatch(/forge dismissed[^.]*hold and tell the user/i);
  expect(runtime()).toMatch(/rebase[^.]*root[^.]*advanced base[^.]*re-run checks/i);
});

test('own open PRs wake the driver every ten minutes through its harness first', () => {
  expect(watch()).toMatch(/own open PRs[^.]*every 10 minutes by default/i);
  expect(runtime()).toMatch(/harness[^.]*native monitoring or scheduled.wake[^.]*driver chat[^.]*10 minutes/i);
  expect(runtime()).toMatch(/only when[^.]*harness[^.]*none[^.]*Orca[^.]*observer/i);
  expect(runtime()).toMatch(/record[^.]*chosen mechanism[^.]*run record/i);
  expect(runtime()).toMatch(/each[^.]*wake[^.]*maintenance loop/i);
  expect(runtime()).toMatch(/delegated[^.]*Orca[^.]*no daemon[^.]*no polling model between wakes/i);
});

test('chosen wake stops at merge, cancellation, or expiry and docs describe the default', () => {
  expect(runtime()).toMatch(/stop[^.]*chosen wake[^.]*every watched PR[^.]*merged or closed[^.]*user cancels[^.]*expires/i);
  expect(watch()).toMatch(/end a chat-run watch[^.]*merged or closed[^.]*cancellation[^.]*expires/i);
  expect(watch()).toMatch(/stop the chosen wake[^.]*verify its stop receipt/i);
  expect(docs()).toMatch(/harness[^.]*native[^.]*10 minutes[^.]*Orca[^.]*fallback/i);
  expect(readme()).toMatch(/harness[^.]*native[^.]*10 minutes[^.]*Orca[^.]*fallback/i);
});

test('installation and run record describe the selected wake', () => {
  expect(installation()).toMatch(/chat-run[^.]*harness.native[^.]*10 minutes[^.]*default/i);
  expect(installation()).toMatch(/only when[^.]*harness[^.]*no[^.]*Orca[^.]*fallback/i);
  expect(runRecord()).toMatch(/chat-run watch[^.]*chosen wake mechanism[^.]*identity or command/i);
});

test('wake failure guards and human merge authority stay explicit', () => {
  expect(runtime()).toMatch(/failed or uncertain stop is a hold/i);
  expect(runtime()).toMatch(/fallback capability[^.]*missing[^.]*hold activation/i);
  expect(watch()).toMatch(/failed or uncertain harness wake stop[^.]*hold/i);
  expect(watch()).toMatch(/human merges by default/i);
});

test('own-PR merge-ready requires a head rebased on the current base', () => {
  expect(watch()).toMatch(/until[^.]*head[^.]*current base[^.]*every review comment and thread[^.]*required[^.]*CI[^.]*green[^.]*merge-ready/i);
});
