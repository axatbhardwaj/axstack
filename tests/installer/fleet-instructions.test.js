import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { locateInstructionBlock, renderInstructionBlock } from '../../src/instructions.js';
import { checkRule, requires, prohibits } from '../workflows/prose-contract.js';
import { intakeFixture, NOW } from '../workflows/fleet-route-intake-fixture.js';
import { makeTempRoot, runCli } from './helpers.js';

const routingRules = [
  [/before/i, /new.task intake/i, /first.*dispatch/i,
    /current routing facts/i, /fleet-dispatch\.md/, /fleet-route-schema\.md/],
  [/bind/i, /explicit/i, /environmentId/, /projectId/, /provider/, /model/, /options/, /runtimeMode/,
    /current destination observations/i],
];
for (const concepts of routingRules) {
  test(`managed routing instruction is mandatory: ${concepts[0]}`, () => {
    const text = renderInstructionBlock().replaceAll('`', '');
    const rewording = concepts === routingRules[0]
      ? 'At new-task intake before the first worker dispatch, follow fleet-dispatch.md and fleet-route-schema.md with current routing facts.'
      : 'From current destination observations, bind explicit provider, model, options, runtimeMode, projectId and environmentId to the selected destination.';
    checkRule(text, (value) => requires(value, ...concepts), rewording,
      [[concepts[0], 'skip']], concepts);
  });
}

test('managed routing retains holds, separate UI placement and bounded authority', () => {
  const text = renderInstructionBlock().replaceAll('`', '');
  for (const [accepts, rewording, inversion, concepts] of [
    [(t) => prohibits(t, /never/i, /native main\/UI balancing/i, /override/i, /explicit worker destination/i),
      'Never allow native main/UI balancing to override the explicit worker destination.', [/never/i, 'always'], []],
    [(t) => prohibits(t, /no additional/i, /permission flow/i, /exact scoped authorization/i),
      'Exact scoped authorization needs no additional permission flow.', [/no additional/i, 'an additional'], []],
    [(t) => prohibits(t, /never/i, /absence of facts/i, /authorizes/i, /route/i),
      'Absence of facts never authorizes a route.', [/never/i, 'always'], []],
    [(t) => requires(t, /keep/i, /remote-author-coordinator/i, /off/i, /version.bound lifecycle gates/i),
      'Keep remote-author-coordinator off pending successful version-bound lifecycle gates.', [/off/i, 'on'], [/off/i]],
    [(t) => requires(t, /hold/i, /ambiguous launches/i, /unknown execution authority/i),
      'Hold unknown execution authority and ambiguous launches.', [/hold/i, 'ignore'],
      [/hold/i, /ambiguous launches/i, /unknown execution authority/i]],
  ]) checkRule(text, accepts, rewording, [inversion], concepts);
});

for (const [name, concepts, equivalent, inversion] of [
  ['once via the planner', [/route/i, /whole task/i, /at most once/i, /fleet-route\.js plan/],
    'Through fleet-route.js plan, route each whole task at most once.', [/at most once/i, 'repeatedly']],
  ['missing switch is false', [/missing/i, /intakeRouting/, /means false/i],
    'Missing intakeRouting means false for intake planning.', [/means false/i, 'means true']],
  ['scheduled work stays local', [/scheduled/i, /status/i, /follow.ups/i, /stay local/i],
    'Status asks, follow-ups and scheduled work stay local.', [/stay local/i, 'route remotely']],
  ['workers stay local', [/preserve/i, /routed marker/i, /every worker local/i, /inside the task/i, /without per.dispatch routing/i],
    'Preserve the routed marker and keep every worker local inside the task without per-dispatch routing.',
    [/without per.dispatch routing/i, 'with per-dispatch routing']],
  ['standing intake grant', [/t3_thread_launch/i, /only on explicit user request/i, /runtime.accepted/i,
    /user standing intake grant/i, /that one hand.off/i],
    'Use t3_thread_launch only on explicit user request, including a runtime-accepted user standing intake grant for that one hand-off.',
    [/runtime.accepted/i, 'assumed']],
]) test(`installed intake semantic guard: ${name}`, () => {
  const text = renderInstructionBlock().replaceAll('`', '').replace(/\s+/g, ' ');
  checkRule(text, (s) => requires(s, ...concepts), equivalent, [inversion], concepts);
});

test('ownership transfer requires the accept marker and one idempotent proceed under the fleet contract', () => {
  const concepts = [/transfer ownership/i, /only after/i, /AXSTACK-ACCEPT/,
    /one idempotent proceed/i, /references\/fleet-dispatch\.md/];
  checkRule(renderInstructionBlock().replaceAll('`', ''), (s) => requires(s, ...concepts),
    'Only after AXSTACK-ACCEPT and one idempotent proceed under references/fleet-dispatch.md, transfer ownership.',
    [[/only after/i, 'before'], [/AXSTACK-ACCEPT/, 'AXSTACK-HANDBACK'],
      [/one idempotent proceed/i, 'multiple idempotent proceeds'],
      [/idempotent/i, 'unconfirmed'], [/fleet-dispatch\.md/, 't3-runtime.md']], concepts);
});

test('named-host pilot needs no support record', () => {
  checkRule(renderInstructionBlock().replaceAll('`', ''),
    (s) => prohibits(s, /no support record/i, /explicit named host/i, /pilot/i, /needs/i),
    'The explicit named host (pilot) needs no support record for intake.',
    [[/no support record/i, 'a support record']], [/explicit named host/i, /pilot/i]);
});

test('an uncertain launch cannot create a second driver', () => {
  // "May exist" qualifies uncertainty about the first driver, not optional work.
  checkRule(renderInstructionBlock().replaceAll('`', ''),
    (s) => prohibits(s, /never|may(?= exist)/gi, /never/i, /start a second driver/i, /while the first may exist/i),
    'While the first may exist, never start a second driver.', [[/never/i, 'always']],
    [/start a second driver/i, /while the first may exist/i]);
});

test('global authority and routing block stays below 2100 bytes', () => {
  expect(Buffer.byteLength(renderInstructionBlock())).toBeLessThanOrEqual(2100);
});

test('installed no-launch path requires local staffing before continuing', () => {
  const text = renderInstructionBlock().replaceAll('`', '').replace(/\s+/g, ' ');
  checkRule(text, (s) => prohibits(s, /no launch call/i, /stay local/i, /check staffing/i),
    'With no launch call, check staffing and stay local.', [[/stay local/i, 'launch remotely']], [/check staffing/i]);
});

test('real install owns runnable pinned routing and uninstall preserves account policy', () => {
  const root = makeTempRoot('axstack-fleet-install-');
  const home = join(root, 'home');
  const skills = join(home, '.agents/skills');
  const instructions = join(home, 'AGENTS.md');
  const repo = join(import.meta.dir, '../..');
  const cli = join(repo, 'bin/axstack.js');
  const original = 'Unrelated account profile bytes.\n';
  const facts = intakeFixture().bind();
  const config = join(home, '.config/haoshoku/fleet-routing.json');
  mkdirSync(join(home, '.config/haoshoku'), { recursive: true });
  writeFileSync(config, facts.configText);
  writeFileSync(instructions, original);
  const args = ['--skills-dir', skills, '--instructions', instructions, '--no-claude-settings', '--yes'];
  const options = { env: { HOME: home } };
  runCli(cli, ['install', '--preset', 'mixed', '--bundle', repo, ...args], options);
  const installed = readFileSync(instructions, 'utf8');
  const block = locateInstructionBlock(installed).block;
  for (const reference of ['t3-runtime.md', 'fleet-dispatch.md', 'fleet-route-schema.md']) {
    expect(block).toContain(`references/${reference}`);
    expect(readFileSync(join(skills, 'axstack/references', reference), 'utf8').length).toBeGreaterThan(0);
  }
  // Execution details live in the installed reference, reached through the block.
  const procedure = readFileSync(join(skills, 'axstack/references/fleet-dispatch.md'), 'utf8');
  const command = procedure.match(/`fleet-route\.js ([^`]+)`/);
  expect(command).not.toBeNull();
  expect(command[1]).toContain('--config');
  expect(command[1]).toContain('--config-digest');
  const factsDir = join(root, 'facts');
  mkdirSync(factsDir);
  const input = join(factsDir, 'input.json');
  writeFileSync(input, JSON.stringify(facts));
  const values = { '<facts-dir>': factsDir, '<epoch-ms>': String(NOW), '<run-pin>': facts.configDigest,
    '<reviewed-config>': config };
  const routeArgs = command[1].split(/\s+/).map((arg) => values[arg] ?? arg);
  const route = join(skills, 'axstack/scripts/fleet-route.js');
  const result = runCli(route, routeArgs, options);
  expect(JSON.parse(result.out)).toMatchObject({ configDigest: facts.configDigest,
    selected: { environmentId: 'env-worker-a', projectId: 'project-worker-a' } });
  writeFileSync(config, facts.configText + '\n');
  expect(runCli(route, routeArgs, { ...options, expectFail: true }).out).toContain('config-digest-mismatch');
  writeFileSync(config, facts.configText);
  facts.destinations = [];
  writeFileSync(input, JSON.stringify(facts));
  expect(JSON.parse(runCli(route, routeArgs, options).out))
    .toMatchObject({ disposition: 'stay', selected: null });
  const checked = Bun.spawnSync([process.execPath, cli, 'check', '--bundle', repo,
    '--skills-dir', skills, '--instructions', instructions], { env: { ...Bun.env, HOME: home,
      CODEX_HOME: join(home, '.codex'), CLAUDE_CONFIG_DIR: join(home, '.claude') } });
  // Real offline prerequisite gaps remain visible, independently of ownership.
  expect([0, 1]).toContain(checked.exitCode);
  expect(checked.stdout.toString()).toContain('instruction owned:');
  expect(checked.stdout.toString()).not.toContain('instruction conflict:');
  runCli(cli, ['uninstall', ...args], options);
  expect(readFileSync(instructions, 'utf8')).toBe(original);
  expect(readFileSync(config, 'utf8')).toBe(facts.configText);
}, 60000);
