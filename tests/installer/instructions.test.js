import { describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { sentences, requires } from '../workflows/prose-contract.js';
import { makeTempRoot, runCli, writeFixtureBundle } from './helpers.js';
import { hashContent } from '../../src/manifest.js';
import {
  applyInstructionPlan,
  findLegacyRoutingLines,
  planInstruction,
  renderInstructionBlock,
  stripInstructionBlock,
} from '../../src/instructions.js';

const skillsDir = '/tmp/ax skills';

describe('owned instruction block primitives', () => {
  test('renders deterministic v1 direct phase routing prose', () => {
    const block = renderInstructionBlock(skillsDir);
    expect(block).toBe(renderInstructionBlock());
    expect(block).toStartWith('<!-- axstack:begin v1 -->');
    expect(block).toEndWith('<!-- axstack:end -->');
    expect(block).toContain('skills/axstack/references/t3-runtime.md');
    expect(renderInstructionBlock.length).toBe(0);
    expect(block).not.toMatch(/model|opus|claude|codex|orca/i);
  });

  test('creates, appends once, and records exact recoverable separation', () => {
    const block = renderInstructionBlock(skillsDir);
    const missing = planInstruction({ text: null, block, ownership: null });
    expect(missing).toEqual({ action: 'created', block, separation: '' });
    expect(applyInstructionPlan(null, missing)).toBe(block);

    const existing = 'personal text';
    const append = planInstruction({ text: existing, block, ownership: null });
    expect(append.action).toBe('updated');
    expect(append.separation).toBe('\n\n');
    const installed = applyInstructionPlan(existing, append);
    expect(installed).toBe(`${existing}\n\n${block}`);
    expect(planInstruction({
      text: installed,
      block,
      ownership: { hash: hashContent(block), separation: '\n\n' },
    }).action).toBe('unchanged');
  });

  test('upgrades pristine ownership but preserves edited and unowned blocks', () => {
    const current = renderInstructionBlock();
    const old = current.replace(
      'Use Axstack for engineering work: invoke the matching `axstack-*` skill directly.',
      'Use Axstack for engineering work. Load `/tmp/old/axstack/SKILL.md` to route the request.',
    );
    expect(planInstruction({
      text: old,
      block: current,
      ownership: { hash: hashContent(old), separation: '' },
    }).action).toBe('updated');

    const edited = old.replace('engineering work', 'all work');
    expect(planInstruction({
      text: edited,
      block: current,
      ownership: { hash: hashContent(old), separation: '' },
    }).action).toBe('conflict');
    expect(planInstruction({ text: old, block: current, ownership: null }).action).toBe('conflict');
    expect(planInstruction({ text: old, block: current, ownership: null, force: true }).action).toBe('conflict');
    expect(planInstruction({
      text: edited,
      block: current,
      ownership: { hash: hashContent(old), separation: '' },
      force: true,
    }).action).toBe('updated');
  });

  test('rejects duplicate, nested, and incomplete marker structures', () => {
    const block = renderInstructionBlock(skillsDir);
    for (const text of [
      `${block}\n${block}`,
      `<!-- axstack:begin v1 -->\n${block}\n<!-- axstack:end -->`,
      '<!-- axstack:begin v1 -->\nunfinished',
      'orphan\n<!-- axstack:end -->',
    ]) {
      expect(() => planInstruction({ text, block, ownership: null })).toThrow(/marker/i);
    }
  });

  test('uninstall strips only the exact owned block and recorded separator', () => {
    const original = 'personal text';
    const block = renderInstructionBlock(skillsDir);
    const installed = `${original}\n\n${block}`;
    expect(stripInstructionBlock(installed, {
      hash: hashContent(block),
      separation: '\n\n',
    })).toEqual({ text: original, removed: true, block });
    const edited = installed.replace('engineering work', 'all work');
    expect(stripInstructionBlock(edited, {
      hash: hashContent(block),
      separation: '\n\n',
    })).toEqual({ text: edited, removed: false, conflict: true });
  });
});

// Local equivalent of T1's shared helper, absent on this independent base.
const prohibits = (text, prohibition, ...concepts) => sentences(text).some((sentence) =>
  prohibition.test(sentence) && concepts.every((concept) => concept.test(sentence))
  && requires(sentence.replace(prohibition, ''), /^/));
const rules = {
  routing: (text) => requires(text, /\b(?:route|rout\w*|dispatch)\b/i, /subagents?/i,
    /delegated workers?/i, /reviewers?/i, /cross.harness dispatch/i, /T3 Code orchestration/i, /t3-code.*MCP|MCP.*t3-code/i),
  delegates: (text) => requires(text, /delegate_task/, /\b(?:use|us\w*|run|rout\w*)\b/i, /non.writer roles?/i),
  writers: (text) => !/non.writer/i.test(text) && requires(text, /t3_thread_launch/, /\b(?:use|us\w*|run|rout\w*)\b/i, /\bwriters?\b/i),
  authorization: (text) => requires(text, /^(?:the )?user\s+(?:authoriz\w*|permit\w*|allow\w*)\b/i,
    /Axstack drivers?/i, /\bT3\b/i, /\brun\b/i, /\bfull.access\b/i, /launch/i,
    /top.level writer threads?/i, /worktrees?/i, /within approved scope/i),
  native: (text) => prohibits(text, /\b(?:do not use|never use|forbid\w*)\b/i,
    /harness.native subagent tools?|native subagent tools?[^.;]*harness/i, /delegated work/i),
};
const holdouts = {
  routing: [
    'Route reviewers, cross-harness dispatches, subagents and delegated workers through T3 Code orchestration using the t3-code MCP.',
    'Through the MCP named t3-code, T3 Code orchestration routes delegated workers, subagents, cross-harness dispatches and reviewers.',
  ],
  delegates: ['For non-writer roles, use delegate_task.', 'Run non-writer roles using delegate_task.'],
  writers: ['For writers, use t3_thread_launch.', 'Writers run using t3_thread_launch.'],
  authorization: [
    'The user permits Axstack drivers in T3 to launch top-level writer threads and worktrees within approved scope and run full-access.',
    'User allows Axstack drivers to run full-access in T3 and launch worktrees and top-level writer threads within approved scope.',
  ],
  native: ['Never use harness-native subagent tools for delegated work.', 'For delegated work, do not use native subagent tools from the harness.'],
};
// Class transforms are applied to every applicable rule, not chosen per rule.
const inversions = (text) => [
  'Do not follow this instruction: ' + text,
  text.replace(/\buse\b/gi, 'do not use'),
  text.replace(/\bnever\b/gi, 'always').replace(/\bnot\b/gi, 'indeed'),
  text.replace(/\b(route|routes|run|runs|launch|authorizes|permits|allows)\b/gi, 'avoid $1'),
  text.replace(/\buser\b/gi, 'author rather than the user'),
  text.replace(/\b(non-writer roles|writers)\b/gi, (role) => role.toLowerCase() === 'writers' ? 'non-writer roles' : 'writers'),
  text.replace(/\b(full-access|approved)\b/gi, 'un$1'),
  text.replace(/[.]$/, '') + ' only for optional work',
].filter((changed) => changed !== text);
for (const [name, accepts] of Object.entries(rules)) {
  test(`generated ${name} rejects removal and inversions and accepts holdouts`, () => {
    const source = sentences(renderInstructionBlock().replace(/[`]/g, ''));
    const matching = source.filter(accepts);
    expect(matching.length).toBeGreaterThan(0);
    expect(accepts(source.filter((sentence) => !accepts(sentence)).join('. '))).toBe(false);
    for (const holdout of holdouts[name]) expect(accepts(holdout), holdout).toBe(true);
    for (const sentence of [...matching, ...holdouts[name]]) {
      for (const changed of inversions(sentence)) expect(accepts(changed), changed).toBe(false);
    }
  });
}

test('legacy routing detector excludes owned text and unrelated mentions', () => {
  const legacy = 'Route all reviewers and writers through Orca orchestration.';
  expect(findLegacyRoutingLines(legacy + '\n' + renderInstructionBlock())).toContain(legacy);
  expect(findLegacyRoutingLines('Orca is installed for rollback.')).toEqual([]);
  expect(findLegacyRoutingLines('<!-- axstack:begin v1 -->\n' + legacy + '\n<!-- axstack:end -->')).toEqual([]);
});

test('CLI reports hand-written legacy routing gaps without editing either global instruction file', () => {
  const root = makeTempRoot('axstack-legacy-routing-');
  const home = join(root, 'home');
  const fakeBin = join(root, 'fake-bin');
  mkdirSync(fakeBin, { recursive: true });
  for (const [name, output] of [['git', 'git fixture'], ['gh', 'gh fixture'], ['t3', 't3 v0.0.46-nightly.20261003.2610']]) {
    const file = join(fakeBin, name);
    writeFileSync(file, `#!/bin/sh\necho '${output}'\n`);
    chmodSync(file, 0o755);
  }
  const bundle = writeFixtureBundle(root);
  for (const [harness, directory, filename] of [['claude', '.claude', 'CLAUDE.md'], ['codex', '.codex', 'AGENTS.md']]) {
    mkdirSync(join(home, directory), { recursive: true });
    const file = join(home, directory, filename);
    const original = 'Use Orca orchestration via the orca CLI for every delegated worker.\nKeep my personal rules.\n';
    writeFileSync(file, original);
    const skills = join(root, harness + '-skills');
    const cli = join(import.meta.dir, '../../bin/axstack.js');
    runCli(cli, ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skills,
      '--instructions', file, '--no-claude-settings', '--yes'], { env: { HOME: home } });
    const installed = readFileSync(file, 'utf8');
    expect(installed).toStartWith(original);
    const result = runCli(cli, ['check', '--skills-dir', skills, '--harness', harness], {
      expectFail: true, env: { HOME: home, CODEX_HOME: join(home, '.codex'), CLAUDE_CONFIG_DIR: join(home, '.claude'), PATH: fakeBin },
    });
    expect(result.out).toContain('No gaps detected.');
    expect(result.out).toMatch(/gap: legacy routing.*manual migration/i);
    expect(readFileSync(file, 'utf8')).toBe(installed);
    runCli(cli, ['uninstall', '--skills-dir', skills, '--instructions', file, '--no-claude-settings', '--yes'], { env: { HOME: home } });
    expect(readFileSync(file, 'utf8')).toBe(original);
  }
});
