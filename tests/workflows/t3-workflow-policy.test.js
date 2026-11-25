import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replaceAll('`', '');
const agents = read('AGENTS.md');
const t3 = /T3(?:-native)?/i;
const workflows = /workflows?/i;
const schedules = /(?:schedules|timers)/i;
const state = /(?:state|durable data)/i;
const ownership = /T3 (?:owns|holds|stores)\b/i;
const data = /(?:are|treat.*as) (?:input )?data/i;
const holds = /(?:add|record) holds/i;
const wakes = /(?:wake|resume) owners/i;
const facts = /(?:fact terms?|facts)/i;

test('durable automation uses native workflows and schedules with T3-owned state', () => {
  const use = /(?:use|uses|runs on)\b/i;
  checkRule(agents, (text) => requires(text, /durable automation/i, use, t3, workflows, schedules),
    'For durable automation, use native T3 schedules and workflows.',
    [[use, 'bypasses'], [t3, 'external']], [workflows, schedules]);
  checkRule(agents, (text) => requires(text, t3, ownership, state),
    'T3 stores the durable data.',
    [[ownership, 'discards']], [t3, state]);
});

test('workflows can observe threads and forge state on their timers', () => {
  const permission = /(?:may|can) (?:observe|inspect)/i;
  const observations = [workflows, /threads/i, /forge/i, schedules];
  checkRule(agents, (text) => prohibits(text, permission, ...observations),
    'On their own schedules, workflows can inspect forge state and threads.',
    [[permission, 'must not inspect']], observations);
});

test('workflow holds, owner wakes and stored inputs convey no authority', () => {
  const denial = /(?:never grants?|cannot confer) authority/i;
  const allowed = /\b(?:may|can)(?= (?:add|record))|(?:never grants?|cannot confer) authority/gi;
  checkRule(agents, (text) => prohibits(text, allowed, workflows, holds, wakes, denial),
    'Workflow code can record holds and resume owners and cannot confer authority.',
    [[denial, 'always grants authority']], [workflows, holds, wakes, denial]);
  checkRule(agents, (text) => requires(text, /store(?:d)? values/i, /ask\(\)/, /answers|responses/i, data),
    'Treat stored values and ask() responses as input data.',
    [[data, 'grant authority']], [/store(?:d)? values/i, /ask\(\)/]);
});

test('a quiet tick requires every fact to pass and failure or uncertainty wakes an agent', () => {
  const quiet = /(?:skips? (?:a|the) wake|suppress(?:es)? (?:a|the) wake)/i;
  const onlyAll = /only (?:when|if) (?:every|all)/i;
  const fail = /fail(?:ure|s)?\b/i;
  const unknown = /unknown|uncertain(?:ty)?/i;
  checkRule(agents, (text) => prohibits(text, quiet, facts, onlyAll, /pass/i),
    'Suppress the wake only if all facts pass.',
    [[onlyAll, 'when any']], [facts]);
  const either = /\bor\b/i;
  checkRule(agents, (text) => requires(text, fail, either, unknown, /(?:wake|start)s? an agent/i),
    'Start an agent for any failure or uncertainty.',
    [[fail, 'success'], [either, 'and'], [unknown, 'known result']], [fail, unknown]);
});

test('outside T3 only the two systemd timers are excepted and code cannot adjudicate', () => {
  const concepts = [/outside T3/i, /daemon/i, /scheduler/i, /runtime database/i, /(?:two|both) systemd timers/i];
  const denial = /(?:adds? no|prohibits?|forbids?)/i;
  checkRule(agents, (text) => prohibits(text, denial, ...concepts, /(?:except|apart from)/i),
    'Outside T3, forbid a scheduler, daemon or runtime database apart from both systemd timers.',
    [[denial, 'allow']], concepts);
  checkRule(agents, (text) => prohibits(text, denial, /programmatic escalation gate/i, /decision interpreter/i),
    'Axstack forbids a decision interpreter or programmatic escalation gate.',
    [[denial, 'requires']], [/programmatic escalation gate/i, /decision interpreter/i]);
  for (const timer of [/axstack-single-server/, /axstack-default-sync/]) {
    checkRule(agents, (text) => requires(text, /opt-in/i, /systemd user timers/i, timer),
      `The opt-in systemd user timers include ${timer.source}.`,
      [[/opt-in/i, 'mandatory']], [timer]);
  }
});

const native = /native\b/i;
const localActivation = /(?:activate|start|run)/i;

const policySurfaces = [
  ['README.md', native, [t3, workflows, schedules, state, ownership],
    'For native schedules and workflows, T3 stores durable automation state.', 'external'],
  ['docs/workflows.md', native, [t3, workflows, schedules, state, ownership],
    'For native workflows and schedules, T3 stores durable automation state.', 'external'],
  ['docs/workflows.md', /schedule_task/, [/weekly audit/i, /(?:keep|uses?|continues)/i],
    'The weekly audit continues with schedule_task.', 'a custom scheduler'],
  ['docs/host-operations.md', /T3/i, [schedules, /wakes/i, /watch/i],
    'T3 supplies chat-run watch wakes from its schedules.', 'Axstack'],
  ['docs/host-operations.md', native, [t3, workflows, schedules, state, ownership],
    'T3 holds automation state for native workflows and schedules.', 'external'],
  ['skills/axstack/references/automations.md', native, [t3, workflows, schedules, state, ownership],
    'T3 holds durable state for native schedules and workflows.', 'external'],
  ['skills/axstack/references/t3-runtime.md', /T3/i, [/coordination/i, /threads/i, /runs/i],
    'For coordination, T3 owns the threads and runs.', 'Axstack'],
  ['skills/axstack/references/t3-runtime.md', native, [t3, workflows, schedules, state, ownership],
    'For native workflows and schedules, T3 stores automation state.', 'external'],
  ['skills/axstack/references/lifecycle.md', /T3/i, [/lifecycle/i, schedules, /wakes/i],
    'T3 schedules supply lifecycle wakes.', 'Axstack'],
  ['skills/axstack/references/lifecycle.md', /T3/i, [/review manager/i, schedules, /state/i],
    'T3 owns review manager schedules and runtime state.', 'Axstack'],
  ['skills/axstack-watch/references/watch-runtime.md', /T3/i, [schedules, /wakes/i, /watch/i],
    'T3 supplies chat-run watch wakes through its schedules.', 'Axstack'],
  ['skills/axstack/references/parallel-first.md', /T3/i, [/parallel.first/i, /orchestration/i, schedules],
    'Parallel-first uses T3 orchestration and schedules.', 'Axstack'],
  ['skills/axstack-cleanup/SKILL.md', /packaged/i, [/T3/i, workflows, /fleet cleanup/i, localActivation, /(?:within approved scope|with recorded authority)/i],
    'For fleet cleanup, activate the packaged T3 workflow within approved scope.', 'unpackaged'],
];

for (const [path, term, concepts, rewording, inversion] of policySurfaces) {
  test(`${path} keeps the ${concepts[0].source} policy within T3`, () => {
    checkRule(read(path), (text) => requires(text, term, ...concepts), rewording, [[term, inversion]], [term, ...concepts]);
  });
}

test('fleet cleanup preserves its force, bulk and runtime database guards', () => {
  const concepts = [/force removal/i, /bulk.clean/i, /edit.*runtime database/i];
  const denial = /(?:do not|never)/i;
  checkRule(read('skills/axstack-cleanup/SKILL.md'), (text) => prohibits(text, denial, ...concepts),
    'Never force removal, bulk-clean, or directly edit the runtime database.',
    [[denial, 'always']], concepts);
});

for (const path of ['docs/installation.md', 'docs/host-operations.md', 'bin/axstack.js']) {
  test(`${path} keeps workflow activation out of installation`, () => {
    const denial = /(?:activates? no|never activates?)/i;
    checkRule(read(path), (text) => prohibits(text, denial, /install(?:er|ation)/i, workflows),
      'The installer never activates workflows.', [[denial, 'always activates']], [workflows]);
  });
}

test('host setup documents both opt-in systemd timers', () => {
  const concepts = [/opt-in/i, /systemd user timers/i, /axstack-single-server/i, /axstack-default-sync/i];
  checkRule(read('docs/host-operations.md'), (text) => requires(text, ...concepts),
    'Both axstack-default-sync and axstack-single-server are opt-in systemd user timers.',
    [[/opt-in/i, 'mandatory']], concepts);
});

for (const path of ['AGENTS.md', 'docs/installation.md', 'docs/workflows.md']) {
  test(`${path} bounds packaged workflow dispatch to the local run and explicit binding`, () => {
    const scope = [/packaged/i, workflows, /agent\(\)/, /(?:start|launch) a thread/i,
      /(?:its own|the same) host/i, /(?:its own|the current) run/i, /explicit model binding/i];
    checkRule(read(path), (text) => requires(text, ...scope),
      'With explicit model binding, a packaged workflow agent() step can launch a thread on the same host for the current run.',
      [[/explicit model binding/i, 'provider defaults'], [scope[4], 'any host'], [scope[5], 'any run']], scope);
    checkRule(read(path), (text) => requires(text, /drivers?/i, /(?:start|launch)/i, /packaged workflow runs/i),
      'Drivers can launch packaged workflow runs.',
      [[/packaged workflow runs/i, 'arbitrary workflow runs']]);
    checkRule(read(path), (text) => prohibits(text, /never|must not/i, workflows, /cross.host|across hosts/i, /(?:launch|start)/i),
      'Workflows must not launch cross-host threads.', [[/never|must not/i, 'always']]);
  });
}
