import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, checkRule, sentences } from './prose-contract.js';

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
// model decisions or native T3 behavior; the scenarios need independent evaluation.
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
  const concepts = [/start of (?:each|every) driver wake/i, /follow Provider bindings/i,
    /driver account re-selection/i, /then run the digest/i, /pr-digest\.js/i];
  checkRule(sentences(text).join('. '), (source) => requires(source, ...concepts),
    'At the start of every driver wake, follow Provider bindings for driver account re-selection, then run the digest using pr-digest.js.',
    [[/start of (?:each|every) driver wake/i, 'end of selected wakes'],
      [/follow Provider bindings/i, 'skip Provider bindings'],
      [/then run the digest/i, 'then skip the digest']], concepts);
  const invocation = text.match(/At the start of each driver wake[\s\S]*?Exit 0/)?.[0] ?? '';
  expect(invocation).toMatch(/once per repository/i);
  expect(invocation).toMatch(/installed[^.]*axstack[^.]*skill directory/i);
  expect(invocation).toMatch(/bun scripts\/pr-digest\.js --repo <owner\/name> --prs <[^>]*every watched member[^>]*in that repo> --watermark <[^>]*repository[^>]*private run.record path>/i);
  expect(runRecord()).toMatch(/PR digest watermarks: <repo (?:->|→) absolute path inside this private run record> \| none/i);
  expect(text).toMatch(/exit 0[^.]*unchanged[^.]*no pending local action[^.]*end the turn[^.]*no text/i);
  expect(text).toMatch(/exit 10[^.]*delta[^.]*reconcil/i);
  expect(text).toMatch(/saves? (?:only |exactly )?the printed `watermark` field as JSON[^.]*after disposition/i);
  expect(text).toMatch(/exit 2[^.]*readiness[^.]*UNKNOWN/i);
});

test('driver records verified Autopilot transitions in the authoritative private run record', () => {
  const recordsTransition = (text) => requires(text, /driver/i, /record\w*/i,
    /each|every/i, /verified/i, /Autopilot:/i, /transition\w*/i,
    /private run record/i, /remain\w* authoritative/i);
  const instruction = 'The driver records each verified `Autopilot:` transition in the private run record, which remains authoritative.';
  expect(recordsTransition(autopilot())).toBe(true);
  expect(recordsTransition(autopilot().replace(instruction, ''))).toBe(false);
  expect(recordsTransition('Every verified Autopilot: transition is recorded by the driver in the private run record, which remains authoritative.')).toBe(true);
  expect(recordsTransition(instruction.replace('records', 'does not record'))).toBe(false);
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
  expect(text).toMatch(/delete[^.]*recorded watch[^.]*delete_scheduled_task[^.]*absence[^.]*list_scheduled_tasks/i);
  expect(text).toMatch(/uncertain delete[^.]*hold/i);
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
    't3-bound-driver-wake',
    't3-watch-deletion-hold',
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
  expect(watch()).toMatch(/never re-request a collaborator's review[^.]*approval still counts[^.]*carryover rule/i);
  expect(watch()).toMatch(/forge dismissed[^.]*last-push approval[^.]*hold and tell[^.]*user[^.]*auto-requesting re-review/i);
  expect(watch()).toMatch(/initial review requests[^.]*before any human approval[^.]*allowed/i);
  expect(runtime()).toMatch(/re-read[^.]*approvals[^.]*state[^.]*not re-request/i);
});

test('authorized own PR maintenance loops through feedback, base movement, and readiness', () => {
  expect(watch()).toMatch(/authorized[^.]*own.PR maintenance[^.]*keep repairing[^.]*rebasing[^.]*base/i);
  expect(watch()).toMatch(/re-run checks[^.]*comment holds above are cleared[^.]*approval term holds[^.]*required CI[^.]*green/i);
  expect(watch()).toMatch(/approval carries over only[^.]*rebase[^.]*unchanged[^.]*patch-id[^.]*both heads[^.]*forge still counts/i);
  expect(watch()).toMatch(/forge dismissed[^.]*hold and tell the user/i);
  expect(runtime()).toMatch(/rebase[^.]*root[^.]*advanced base[^.]*re-run checks/i);
});

test('own open PRs wake the original T3 driver every ten minutes', () => {
  expect(watch()).toMatch(/own open PRs[^.]*every 10 minutes by default/i);
  expect(runtime()).toContain('`bindToCurrentThread:true`, `everyMs:600000`');
  expect(runtime()).toMatch(/record[^.]*schedule ID[^.]*driver thread[^.]*native schedule lifetime/i);
  expect(runtime()).toMatch(/each wake[^.]*maintenance loop/i);
  expect(runtime()).toMatch(/delegated[^.]*T3 runtime[^.]*no daemon[^.]*no polling model between wakes/i);
});

test('chat-run wake waits for settled work and release; docs describe the default', () => {
  expect(runtime()).toMatch(/stop[^.]*chosen wake[^.]*every watched PR[^.]*merged or closed[^.]*launched work is settled[^.]*release[^.]*user cancels/i);
  expect(watch()).toMatch(/end a chat-run watch[^.]*merged or closed[^.]*launched work is settled[^.]*release[^.]*cancellation/i);
  expect(watch()).toMatch(/stop the chosen wake[^.]*verify its stop receipt/i);
  expect(docs()).toMatch(/bound T3 schedule[^.]*10 minutes/i);
  expect(readme()).toMatch(/bound T3 schedule[^.]*10 minutes/i);
});

test('installation and run record describe the selected wake', () => {
  expect(installation()).toMatch(/bound T3 schedule[^.]*10 minutes[^.]*default/i);
  expect(installation()).toMatch(/missing schedule capability[^.]*holds activation/i);
  expect(runRecord()).toMatch(/chat-run watch[^.]*bound T3 schedule[^.]*scheduledTaskId/i);
});

test('wake failure guards and owning watch merge authority stay explicit', () => {
  expect(runtime()).toMatch(/uncertain delete[^.]*hold/i);
  expect(runtime()).toMatch(/missing schedule capability[^.]*holds activation/i);
  expect(watch()).toMatch(/failed or uncertain schedule deletion[^.]*hold/i);
  expect(watch()).toMatch(/automatic merge is the default for own PRs/i);
});

test('own-PR merge-ready requires a head rebased on the current base', () => {
  expect(watch()).toMatch(/until[^.]*head[^.]*current base[^.]*comment holds above are cleared[^.]*required[^.]*CI[^.]*green[^.]*merge-ready/i);
});


test('AC2 bound watch wakes and verifies exact schedule deletion', () => {
  const scenario = JSON.parse(read('tests/workflows/t3-recovery-scenarios.json')).cases
    .find(({ id }) => id === 'bound-watch-wake-and-deletion');
  expect(scenario).toBeDefined();
  expect(scenario.contracts).toEqual([
    'One bound schedule serves both the run watch and the chat-run watch; never create a second watch.',
    'For a chat-run watch, keep the bound run watch armed until every watched PR is merged or closed, launched work is settled, and the release step is settled or not applicable, or until user cancellation.',
    'For a chat-run watch, defer the T3 runtime\'s "nothing remains unsettled" deletion until those chat-run stop conditions.',
    'Each wake reconciles all unsettled runs before running the authorized maintenance loop.',
    'A failed run holds incomplete work even when its writer sent no receipt.',
    'Delete only the recorded watch with `delete_scheduled_task` and read back its absence with `list_scheduled_tasks`.',
    'An uncertain delete preserves the hold and recorded schedule ID.',
  ]);
  const text = runtime();
  for (const sentence of scenario.contracts) expect(text).toContain(sentence);
  expect(scenario.input).toContain('all runs settle while a PR stays open with CI pending');
  expect(scenario.input).toContain('all PRs merge but release is still pending');
  expect(scenario.expected.action).toContain('keep the same schedule armed while CI or release is pending');
  expect(scenario.expected.action).toContain('never create a second watch');
  expect(scenario.expected.action).toContain('delete only after chat-run stop conditions');
  for (const concept of ['schedule_task', 'bindToCurrentThread:true', 'everyMs:600000',
    'reconcile', 'delete_scheduled_task', 'list_scheduled_tasks', 'absence', 'hold']) {
    expect(scenario.expected.action).toContain(concept);
    expect(scenario.expected.action.replaceAll(concept, '')).not.toContain(concept);
  }
});

for (const sentence of [
  'One bound schedule serves both the run watch and the chat-run watch; never create a second watch.',
  'For a chat-run watch, keep the bound run watch armed until every watched PR is merged or closed, launched work is settled, and the release step is settled or not applicable, or until user cancellation.',
  'For a chat-run watch, defer the T3 runtime\'s "nothing remains unsettled" deletion until those chat-run stop conditions.',
  'Wake only the exact live original driver.',
  'A busy, missing, protected (user-taken-over) or permission-held driver is never interrupted or replaced.',
  "The orphan sweep covers the run record's repositories plus registered repositories on this host.",
  'Each wake reconciles all unsettled runs before running the authorized maintenance loop.',
  'A failed run holds incomplete work even when its writer sent no receipt.',
  'Delete only the recorded watch with `delete_scheduled_task` and read back its absence with `list_scheduled_tasks`.',
  'An uncertain delete preserves the hold and recorded schedule ID.',
]) {
  test(`T3 watch safety: ${sentence}`, () => {
    const accepts = (text) => text.includes(sentence);
    const text = runtime();
    expect(accepts(text)).toBe(true);
    expect(accepts(text.replace(sentence, ''))).toBe(false);
    expect(accepts(text.replace(sentence, sentence.replace(/^(\S+)/, '$1 not')))).toBe(false);
  });
}

test('recovery scenario does not interrupt the busy driver', () => {
  const scenario = JSON.parse(read('tests/workflows/chat-run-watch-scenarios.json')).cases
    .find(({ id }) => id === 'recovery-and-stop');
  const sentence = 'does not interrupt the busy driver';
  expect(scenario.expected).toContain(sentence);
  expect(scenario.expected.replace(sentence, '')).not.toContain(sentence);
});

test('watch frontmatter and unchanged links keep their single-line form', () => {
  const text = readFileSync(`${import.meta.dir}/../../skills/axstack-watch/SKILL.md`, 'utf8');
  expect(text).toContain('description: When babysitting an existing PR, use axstack-watch to monitor or maintain it within bounded authority.\n');
  expect(text).toContain('On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.');
  expect(text).toContain("repository, or peer scope. For standalone broad discovery of the user's own PRs (such as “my” or “our” PRs), run\n");
  expect(text).not.toMatch(/\[[^\]]*\n[^\]]*\]\(/);
});
