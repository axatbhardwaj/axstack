import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { locateInstructionBlock, renderInstructionBlock } from '../../src/instructions.js';
import { checkRule, requires, prohibits } from '../workflows/prose-contract.js';
import { fixture, NOW } from '../workflows/fleet-route-fixture.js';
import { makeTempRoot, runCli } from './helpers.js';

const routingRules = [
  [/before/i, /every subsequent/i, /workers/i, /reviewers/i, /explicitly authorized top.level/i,
    /current routing facts/i, /fleet-dispatch\.md/, /fleet-route-schema\.md/],
  [/bind/i, /explicit/i, /environmentId/, /projectId/, /provider/, /model/, /options/, /runtimeMode/],
];
for (const concepts of routingRules) {
  test(`managed routing instruction is mandatory: ${concepts[0]}`, () => {
    const text = renderInstructionBlock().replaceAll('`', '');
    const rewording = concepts === routingRules[0]
      ? 'Before every subsequent dispatch of workers and reviewers and explicitly authorized top-level launch, read fleet-dispatch.md and fleet-route-schema.md with current routing facts.'
      : 'Bind provider, model, options and runtimeMode plus explicit projectId and environmentId to the selected destination.';
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
    [(t) => requires(t.replace(/\bno-route\b/gi, 'unroutable'), /hold/i, /fail/i, /unknown/i, /unroutable/i, /supported local isolated fallback/i),
      'Hold failed, unknown and no-route results except for a proven supported local isolated fallback.', [/hold/i, 'ignore'], [/hold/i]],
  ]) checkRule(text, accepts, rewording, [inversion], concepts);
});

test('real install owns runnable pinned routing and uninstall preserves account policy', () => {
  const root = makeTempRoot('axstack-fleet-install-');
  const home = join(root, 'home');
  const skills = join(home, '.agents/skills');
  const instructions = join(home, 'AGENTS.md');
  const repo = join(import.meta.dir, '../..');
  const cli = join(repo, 'bin/axstack.js');
  const original = 'Unrelated account profile bytes.\n';
  const facts = fixture().bind();
  const config = join(home, '.config/haoshoku/fleet-routing.json');
  mkdirSync(join(home, '.config/haoshoku'), { recursive: true });
  writeFileSync(config, facts.configText);
  writeFileSync(instructions, original);
  const args = ['--skills-dir', skills, '--instructions', instructions, '--no-claude-settings', '--yes'];
  const options = { env: { HOME: home } };
  runCli(cli, ['install', '--preset', 'mixed', '--bundle', repo, ...args], options);
  const installed = readFileSync(instructions, 'utf8');
  const block = locateInstructionBlock(installed).block;
  for (const reference of ['fleet-dispatch.md', 'fleet-route-schema.md']) {
    expect(block).toContain(`references/${reference}`);
    expect(readFileSync(join(skills, 'axstack/references', reference), 'utf8').length).toBeGreaterThan(0);
  }
  // Extract the documented command rather than constructing a second interface.
  const command = block.match(/`bun <installed-axstack>\/scripts\/fleet-route\.js ([^`]+)`/);
  expect(command).not.toBeNull();
  expect(command[1]).toContain('--config ~/.config/haoshoku/fleet-routing.json');
  expect(command[1]).toContain('--config-digest <run-pinned-sha256>');
  const input = join(root, 'facts.json');
  writeFileSync(input, JSON.stringify(facts));
  const values = { '<facts.json>': input, '<epoch-ms>': String(NOW), '<run-pinned-sha256>': facts.configDigest,
    '~/.config/haoshoku/fleet-routing.json': config };
  const routeArgs = command[1].split(' ').map((arg) => values[arg] ?? arg);
  const route = join(skills, 'axstack/scripts/fleet-route.js');
  const result = runCli(route, routeArgs, options);
  expect(JSON.parse(result.out)).toMatchObject({ configDigest: facts.configDigest,
    selected: { environmentId: 'env-worker-a', projectId: 'project-worker-a' } });
  writeFileSync(config, facts.configText + '\n');
  expect(runCli(route, routeArgs, { ...options, expectFail: true }).out).toContain('config-digest-mismatch');
  writeFileSync(config, facts.configText);
  facts.destinations = [];
  writeFileSync(input, JSON.stringify(facts));
  expect(JSON.parse(runCli(route, routeArgs, { ...options, expectFail: true }).out))
    .toMatchObject({ stage: 'no-route', selected: null });
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
});
