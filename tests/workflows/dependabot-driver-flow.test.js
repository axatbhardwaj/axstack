import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { briefs } from '../../skills/axstack/workflows/dependabot-brief.mjs';
import { makeTempRoot } from '../installer/helpers.js';

const source = `${import.meta.dir}/../../skills/axstack/workflows`;
const runId = 'f'.repeat(32);
const head = 'a'.repeat(40);
const scenarios = [
  { name: 'matching binding and verified merged outcome', acted: true, outcome: 'merged' },
  { name: 'mismatched effective binding', mismatch: true, acted: false, outcome: 'paused' },
  { name: 'a user claims the thread during preparation', userInput: true, acted: false, outcome: 'paused' },
  { name: 'driver holds the exact head', hold: true, acted: true, outcome: 'paused' },
  { name: 'a user returns after the driver settles', userOnEnd: true, acted: true, outcome: 'merged' },
];

function replay(cases) {
  const scratch = makeTempRoot('axstack-dependabot-driver-flow-');
  mkdirSync(scratch + '/entries');
  for (const file of [
    'entries/axstack-dependabot-merge.mjs',
    'dependabot-brief.mjs',
    'dependabot-facts.mjs',
    'dependabot-pins.mjs',
    'dependabot-pages.mjs',
  ]) {
    writeFileSync(scratch + '/' + file, readFileSync(source + '/' + file));
  }
  writeFileSync(
    scratch + '/dependabot-worktree.mjs',
    `
export async function prepareWorktree() { return '/fixture/detached' }
export async function cleanupWorktree() { globalThis.cleaned++; return true }
`,
  );
  writeFileSync(
    scratch + '/dependabot-runtime.mjs',
    `
export const validId = (id) => /^[a-f0-9]{32}$/.test(id)
export const parseYaml = (_bun, source) => Bun.YAML.parse(source)
export const verifiedBinding = () => ({project:'/repo',reportOnlyTrial:false})
export const ownerBinding = () => ({model:{instanceId:'codex',model:'gpt-6.2-sol',options:[{id:'reasoningEffort',value:'high'}]},runtimeMode:'full-access'})
export const github = (...args) => globalThis.github(...args)
export function driverReadback() {
  const messages = globalThis.prompts.map((text) => ({ role: 'system', text }))
  if (globalThis.caseData.mismatch) return null
  if (globalThis.caseData.userInput || (globalThis.caseData.userOnEnd && globalThis.ended)) {
    messages.push({ role: 'user', text: 'I am taking over this thread' })
  }
  return { thread: { status:'completed' }, messages }
}
`,
  );
  const entry = scratch + '/entries/axstack-dependabot-merge.mjs';
  const script = `
import { fixture } from ${JSON.stringify(import.meta.dir + '/dependabot-forge-fixture.js')};
const unit = (run) => ({ *[Symbol.iterator]() { return yield run; }, run });
const gen = (f) => unit(async () => {
  const op = f();
  let next = op.next();
  while (!next.done) next = op.next(await next.value());
  return next.value;
});
const currentStore = new Map();
class FailedStep extends Error {
  constructor(step, cause) {
    super(cause.message, { cause });
    this.step = step;
  }
}
globalThis.Schema = { Json: {}, String: {}, Boolean: {}, Number: {} };
globalThis.Option = { isSome: (option) => option.value !== undefined,
  getOrElse: (option, fallback) => option.value === undefined ? fallback() : option.value };
globalThis.Effect = { gen, promise: unit, tryPromise: (work) => unit(async () => {
  try { return await work.try(); } catch (error) { throw work.catch(error); }
}) };
globalThis.T3 = {
  workflow: (_name, options, body) => ({ options, body }),
  every: () => ({}), Tick: {}, runs: () => unit(() => []),
  stop: (reason) => unit(() => ({ disposition: 'stopped', reason })),
  step: (name, _options, work) => unit(async () => {
    try { return await work.run(); } catch (error) { throw new FailedStep(name, error); }
  }),
  store: {
    transaction: (work) => work,
    entry: (key) => ({
      get: unit(() => ({ value: currentStore.get(key) })),
      set: (value) => unit(() => currentStore.set(key, value)),
    }),
  },
  agent: { try: (step, options) => unit(() => {
    globalThis.prompts.push(options.brief);
    globalThis.calls.push(options);
    return { outcome:'done', thread:{threadId:'workflow:fixture'}, value:step.endsWith('-bind')
      ? 'AXSTACK-BOUND' : 'AXSTACK-RESULT ' + '1'.repeat(40) + (globalThis.caseData.hold ? ' HELD' : ' MERGED') };
  }) },
};
const flow = (await import(${JSON.stringify(entry)})).default;
const cases = ${JSON.stringify(cases)};
for (const item of cases) {
  currentStore.clear();
  globalThis.caseData = item;
  globalThis.prompts = [];
  globalThis.calls = [];
  globalThis.cleaned = 0;
  globalThis.ended = false;
  const forge = fixture({ title: 'Bump actions/checkout from 6 to 7.0.0\\nUNTRUSTED FORGE TEXT', ...item.forge });
  globalThis.github = (endpoint) => endpoint.endsWith('/pulls/1') && globalThis.prompts.length === 2
    ? { status:200, body: { number: 1, merged: !item.hold, head: {sha:item.hold ? ${JSON.stringify(head)} : '1'.repeat(40)},
      base:{repo:{full_name:'axatbhardwaj/axstack'}} } }
    : forge(endpoint);
  let disposition;
  let reason;
  let failedStep;
  try {
    const result = await flow.body({}, { id: ${JSON.stringify(runId)} }).run();
    disposition = result.pulls?.[0]?.disposition ?? result.disposition ?? 'completed';
    reason = result.reason;
    globalThis.ended = true;
    await flow.options.onEnd({}, { id:${JSON.stringify(runId)}, outcome:'completed' }).run();
  } catch (error) {
    if (!(error instanceof FailedStep)) throw error;
    disposition = 'paused';
    reason = error.message;
    failedStep = error.step;
  }
  console.log(JSON.stringify({ disposition, reason, failedStep, calls:globalThis.calls, cleaned:globalThis.cleaned }));
}
`;
  const execution = Bun.spawnSync([process.execPath, '-e', script], { cwd: scratch });
  expect(execution.stderr.toString()).toBe('');
  expect(execution.exitCode).toBe(0);
  return execution.stdout
    .toString()
    .trim()
    .split('\n')
    .map((row) => JSON.parse(row));
}

test('the workflow sends merge instructions after effective binding readback and cleans owned, settled evidence', () => {
  const results = replay(scenarios);
  expect(results).toHaveLength(scenarios.length);
  for (const [index, scenario] of scenarios.entries()) {
    const result = results[index];
    expect(result.disposition, scenario.name).toBe(scenario.outcome);
    expect(result.calls).toHaveLength(scenario.acted ? 2 : 1);
    expect(result.calls[0]).toMatchObject({
      project: '/repo',
      workspace: { type: 'existing_worktree', worktreePath: '/fixture/detached' },
      model: { instanceId: 'codex', model: 'gpt-6.2-sol', options: [{ id: 'reasoningEffort', value: 'high' }] },
      runtimeMode: 'full-access',
    });
    expect(result.calls[0].brief).not.toContain('gh pr merge');
    for (const { brief } of result.calls) {
      expect(brief.split('\n')[0]).toBe(`AXSTACK-WAKE axstack-dependabot-merge@1 run ${runId}`);
      expect(brief).not.toContain('UNTRUSTED FORGE TEXT');
    }
    if (scenario.acted) {
      expect(Object.keys(result.calls[1]).sort()).toEqual(['brief', 'thread']);
      expect(result.calls[1].brief).toContain('gh pr merge 1 --merge --match-head-commit ' + '1'.repeat(40));
    }
    if (scenario.outcome === 'paused') expect(result.reason).toMatch(/owner/);
    expect(result.cleaned).toBe(scenario.outcome === 'merged' && !scenario.userOnEnd ? 1 : 0);
  }
});

test.each([
  { name: 'non-Dependabot author', forge: { author: 'octocat' }, disposition: 'outside-scope' },
  { name: 'queued CI', forge: { runStatus: 'queued' }, disposition: 'paused', reason: /\bci fail\b/ },
  { name: 'failed check', forge: { conclusion: 'failure' }, disposition: 'paused', reason: /\bchecks fail\b/ },
  { name: 'discovery page gap', forge: { gap: true }, disposition: 'paused', reason: /page coverage/ },
])('entry routes $name without any agent call', (scenario) => {
  const results = replay([scenario]);
  expect(results).toHaveLength(1);
  const [result] = results;
  expect(result.calls).toEqual([]);
  expect(result.cleaned).toBe(0);
  expect(result.disposition).toBe(scenario.disposition);
  if (scenario.reason) {
    expect(result.failedStep).toBe('discover');
    expect(result.reason).toMatch(scenario.reason);
  }
});

test('the driver command only submits one head-pinned attempt across a provider retry', () => {
  const scratch = makeTempRoot('axstack-dependabot-retry-');
  const command = briefs(runId, 17, head).merge.match(/^git_dir=.*$/m)?.[0];
  expect(command).toBeDefined();
  expect(Bun.spawnSync(['git', 'init', '-q', scratch]).exitCode).toBe(0);
  const log = scratch + '/attempts';
  writeFileSync(scratch + '/gh', '#!/bin/sh\nprintf "%s\\n" "$*" >> "$C10_ATTEMPTS"\nexit 1\n', { mode: 0o700 });
  const env = { ...process.env, PATH: scratch + ':' + process.env.PATH, C10_ATTEMPTS: log };
  const attempt = () => Bun.spawnSync(['sh', '-c', command], { cwd: scratch, env });
  expect(attempt().exitCode).toBe(1);
  expect(attempt().exitCode).toBe(1);
  expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual(['pr merge 17 --merge --match-head-commit ' + head]);
});
