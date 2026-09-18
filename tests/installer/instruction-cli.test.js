import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from '../../src/posixpath.js';
import { makeTempRoot, runCli, writeFixtureBundle } from './helpers.js';

const CLI = resolve(import.meta.dir, '../../bin/axstack.js');
const FIRST_LINE = 'Use Axstack for engineering work: invoke the matching `axstack-*` skill directly.';
const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = makeTempRoot('ax-instruction-cli-');
  roots.push(root);
  return { root, bundle: writeFixtureBundle(root) };
}

describe('instruction CLI routing', () => {
  test('explicit --instructions installs, reports state, and uninstalls only its block', () => {
    const { root, bundle } = fixture();
    const skills = join(root, 'skills');
    const instructions = join(root, 'AGENTS.md');
    writeFileSync(instructions, 'personal');
    const installed = runCli(CLI, ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skills, '--instructions', instructions]);
    expect(installed.out).toContain(`instruction updated: ${instructions}`);
    expect(readFileSync(instructions, 'utf8').split('\n')[3]).toBe(FIRST_LINE);
    const repeated = runCli(CLI, ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skills, '--instructions', instructions]);
    expect(repeated.out).toContain(`instruction unchanged: ${instructions}`);
    const removed = runCli(CLI, ['uninstall', '--skills-dir', skills, '--instructions', instructions]);
    expect(removed.out).toContain(`instruction removed: ${instructions}`);
    expect(readFileSync(instructions, 'utf8')).toBe('personal');
  });

  test('Codex harness resolves skills and AGENTS.md from CODEX_HOME', () => {
    const { root, bundle } = fixture();
    const codexHome = join(root, 'codex-home');
    const installed = runCli(CLI, ['install', '--preset', 'mixed', '--bundle', bundle, '--harness', 'codex', '--yes'], {
      env: { HOME: root, CODEX_HOME: codexHome },
    });
    expect(installed.out).toContain(`instruction created: ${codexHome}/AGENTS.md`);
    expect(readFileSync(join(codexHome, 'AGENTS.md'), 'utf8').split('\n')[1]).toBe(FIRST_LINE);
    runCli(CLI, ['uninstall', '--harness', 'codex', '--yes'], {
      env: { HOME: root, CODEX_HOME: codexHome },
    });
    expect(readFileSync(join(codexHome, 'AGENTS.md'), 'utf8')).toBe('');
  });

  test('OpenCode and Antigravity harnesses resolve their global skills and rules files', () => {
    const cases = [
      ['opencode', '.config/opencode/skills', '.config/opencode/AGENTS.md'],
      ['antigravity', '.gemini/config/skills', '.gemini/GEMINI.md'],
    ];
    for (const [harness, skills, instructions] of cases) {
      const { root, bundle } = fixture();
      const installed = runCli(CLI, [
        'install', '--preset', 'mixed', '--bundle', bundle, '--harness', harness, '--no-claude-settings', '--yes',
      ], { env: { HOME: root } });
      expect(installed.out).toContain(`instruction created: ${join(root, instructions)}`);
      expect(readFileSync(join(root, instructions), 'utf8').split('\n')[1]).toBe(FIRST_LINE);
      runCli(CLI, ['uninstall', '--harness', harness, '--no-claude-settings', '--yes'], { env: { HOME: root } });
      expect(readFileSync(join(root, instructions), 'utf8')).toBe('');
    }
  });

  test('Claude defaults its instruction file while skills-dir alone writes none', () => {
    const { root, bundle } = fixture();
    runCli(CLI, ['install', '--preset', 'mixed', '--bundle', bundle, '--harness', 'claude', '--yes'], { env: { HOME: root } });
    expect(readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf8').split('\n')[1]).toBe(FIRST_LINE);

    const otherSkills = join(root, 'other-skills');
    runCli(CLI, ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', otherSkills]);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
  });

  test('reports conservative Haoshoku routing text outside the owned block', () => {
    const { root, bundle } = fixture();
    const skills = join(root, 'skills');
    const instructions = join(root, 'AGENTS.md');
    writeFileSync(instructions, 'Use Haoshoku routing for legacy skills.');
    const result = runCli(CLI, ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skills, '--instructions', instructions]);
    expect(result.out).toMatch(/note: legacy Haoshoku routing text remains outside the Axstack block/i);
    expect(readFileSync(instructions, 'utf8')).toStartWith('Use Haoshoku routing for legacy skills.');
  });

  test('install exits nonzero when an edited owned instruction block is preserved', () => {
    const { root, bundle } = fixture();
    const skills = join(root, 'skills');
    const instructions = join(root, 'AGENTS.md');
    const args = [
      'install', '--preset', 'mixed', '--bundle', bundle,
      '--skills-dir', skills, '--instructions', instructions,
    ];
    const installed = runCli(CLI, args);
    expect(installed.ok).toBe(true);
    const edited = readFileSync(instructions, 'utf8').replace('engineering work', 'all work');
    writeFileSync(instructions, edited);

    const conflict = runCli(CLI, args, { expectFail: true });
    expect(conflict.out).toContain(`instruction conflict: ${instructions} preserved`);
    expect(conflict.out).toContain('owned instruction block was edited');
    expect(readFileSync(instructions, 'utf8')).toBe(edited);
  });

  test('help documents instruction selection and harness defaults', () => {
    const result = runCli(CLI, ['--help']);
    expect(result.out).toContain('--instructions <file>');
    expect(result.out).toContain('$CODEX_HOME/AGENTS.md');
    expect(result.out).toContain('~/.claude/CLAUDE.md');
  });

  test('check reports owned instruction state for Claude and Codex harness targets', () => {
    for (const harness of ['claude', 'codex']) {
      const { root, bundle } = fixture();
      const env = {
        HOME: root,
        CODEX_HOME: join(root, 'codex-home'),
      };
      runCli(CLI, [
        'install', '--preset', 'mixed', '--bundle', bundle, '--harness', harness,
        '--no-claude-settings', '--yes',
      ], { env });
      const checked = runCli(CLI, ['check', '--harness', harness], {
        env: { ...env, PATH: '' },
        expectFail: true,
      });
      const expected = harness === 'claude'
        ? join(root, '.claude', 'CLAUDE.md')
        : join(root, 'codex-home', 'AGENTS.md');
      expect(checked.out).toContain(`instruction owned: ${expected}`);
    }
  });
});
