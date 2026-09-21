import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from '../../src/posixpath.js';
import { makeTempRoot, runCli, writeFixtureBundle } from './helpers.js';

const CLI = resolve(import.meta.dir, '../../bin/axstack.js');
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = makeTempRoot('ax-codex-root-');
  roots.push(root);
  return {
    root,
    bundle: writeFixtureBundle(root),
    codexHome: join(root, 'codex-home'),
    canonical: join(root, '.agents', 'skills'),
    legacy: join(root, 'codex-home', 'skills'),
  };
}

function codexInstall(f, extra = [], options = {}) {
  return runCli(CLI, [
    'install', '--preset', 'mixed', '--bundle', f.bundle,
    '--harness', 'codex', '--yes', ...extra,
  ], {
    env: { HOME: f.root, CODEX_HOME: f.codexHome },
    ...options,
  });
}

function seedLegacy(f) {
  runCli(CLI, [
    'install', '--preset', 'mixed', '--bundle', f.bundle,
    '--skills-dir', f.legacy, '--yes',
  ], { env: { HOME: f.root, CODEX_HOME: f.codexHome } });
}

test('Codex defaults skills to ~/.agents/skills and keeps AGENTS.md in CODEX_HOME', () => {
  const f = fixture();
  const result = codexInstall(f);

  expect(result.out).toContain(`instruction created: ${f.codexHome}/AGENTS.md`);
  expect(existsSync(join(f.canonical, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(f.legacy, 'axstack-demo', 'SKILL.md'))).toBe(false);
});

test('Codex install retires only unchanged manifest-owned legacy skills after canonical install', () => {
  const f = fixture();
  seedLegacy(f);
  const unrelated = join(f.legacy, 'other-owner.txt');
  writeFileSync(unrelated, 'keep\n');

  const result = codexInstall(f);

  expect(existsSync(join(f.canonical, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(f.legacy, 'axstack-demo', 'SKILL.md'))).toBe(false);
  expect(readFileSync(unrelated, 'utf8')).toBe('keep\n');
  expect(result.out).toMatch(/legacy Codex skills retired/i);
});

test('migration transfers an unchanged legacy AGENTS.md binding into a preinstalled shared root', () => {
  const f = fixture();
  const instructions = join(f.codexHome, 'AGENTS.md');
  runCli(CLI, [
    'install', '--preset', 'mixed', '--bundle', f.bundle,
    '--skills-dir', f.canonical, '--no-claude-settings', '--yes',
  ], { env: { HOME: f.root, CODEX_HOME: f.codexHome } });
  runCli(CLI, [
    'install', '--preset', 'mixed', '--bundle', f.bundle,
    '--skills-dir', f.legacy, '--instructions', instructions,
    '--no-claude-settings', '--yes',
  ], { env: { HOME: f.root, CODEX_HOME: f.codexHome } });

  const result = codexInstall(f, ['--no-claude-settings']);
  const canonicalManifest = JSON.parse(
    readFileSync(join(f.canonical, '.axstack-manifest.json'), 'utf8'),
  );
  expect(result.ok).toBe(true);
  expect(canonicalManifest.instructions.path).toBe(instructions);
  expect(existsSync(join(f.legacy, '.axstack-manifest.json'))).toBe(false);
  expect(existsSync(join(f.legacy, 'axstack-demo', 'SKILL.md'))).toBe(false);
  expect(readFileSync(instructions, 'utf8')).toContain('<!-- axstack:begin v1 -->');
});

test('an instruction ownership conflict preserves the complete legacy install', () => {
  const f = fixture();
  const instructions = join(f.codexHome, 'AGENTS.md');
  runCli(CLI, [
    'install', '--preset', 'mixed', '--bundle', f.bundle,
    '--skills-dir', f.legacy, '--instructions', instructions,
    '--no-claude-settings', '--yes',
  ], { env: { HOME: f.root, CODEX_HOME: f.codexHome } });
  writeFileSync(instructions, readFileSync(instructions, 'utf8').replace('engineering work', 'everything'));

  const result = codexInstall(f, ['--no-claude-settings'], { expectFail: true });

  expect(result.out).toMatch(/instruction conflict/i);
  expect(existsSync(join(f.legacy, 'axstack-demo', 'SKILL.md'))).toBe(true);
});

test('modified legacy skills are preserved and reported as migration conflicts', () => {
  const f = fixture();
  seedLegacy(f);
  const edited = join(f.legacy, 'axstack-demo', 'SKILL.md');
  writeFileSync(edited, '# locally modified\n');

  const result = codexInstall(f);

  expect(readFileSync(edited, 'utf8')).toBe('# locally modified\n');
  expect(existsSync(join(f.legacy, 'axstack-demo', 'helper.md'))).toBe(true);
  expect(result.out).toMatch(/legacy Codex skills preserved.*axstack-demo\/SKILL\.md/i);
});

test('partial canonical ownership retains the complete legacy install', () => {
  const f = fixture();
  seedLegacy(f);
  mkdirSync(join(f.canonical, 'axstack-demo'), { recursive: true });
  writeFileSync(
    join(f.canonical, 'axstack-demo', 'SKILL.md'),
    readFileSync(join(f.bundle, 'skills', 'axstack-demo', 'SKILL.md')),
  );

  const result = codexInstall(f);

  expect(result.out).toMatch(/legacy Codex skills preserved.*canonical install/i);
  expect(existsSync(join(f.legacy, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(f.legacy, 'axstack-demo', 'helper.md'))).toBe(true);
});

test('legacy symlinks are never followed and leave the verified canonical install intact', () => {
  const f = fixture();
  seedLegacy(f);
  const owned = join(f.legacy, 'axstack-demo', 'SKILL.md');
  const outside = join(f.root, 'outside.txt');
  writeFileSync(outside, 'outside\n');
  rmSync(owned);
  symlinkSync(outside, owned);

  const result = codexInstall(f, [], { expectFail: true });

  expect(readFileSync(outside, 'utf8')).toBe('outside\n');
  expect(existsSync(join(f.canonical, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(result.out).toMatch(/legacy Codex skills.*symlink|symlink.*legacy Codex skills/i);
});

test('a symlinked legacy skills root is refused without touching its target', () => {
  const f = fixture();
  const outsideSkills = join(f.root, 'outside-skills');
  runCli(CLI, [
    'install', '--preset', 'mixed', '--bundle', f.bundle,
    '--skills-dir', outsideSkills, '--yes',
  ], { env: { HOME: f.root, CODEX_HOME: f.codexHome } });
  mkdirSync(f.codexHome, { recursive: true });
  symlinkSync(outsideSkills, f.legacy);

  const result = codexInstall(f, [], { expectFail: true });

  expect(result.out).toMatch(/legacy Codex.*symlink|symlink.*legacy Codex/i);
  expect(existsSync(join(outsideSkills, 'axstack-demo', 'SKILL.md'))).toBe(true);
});

test('explicit --skills-dir bypasses Codex default migration and remains meaningful', () => {
  const f = fixture();
  seedLegacy(f);
  const explicit = join(f.root, 'explicit-skills');

  codexInstall(f, ['--skills-dir', explicit]);

  expect(existsSync(join(explicit, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(f.legacy, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(f.canonical, 'axstack-demo', 'SKILL.md'))).toBe(false);
});

test('repeated Codex install stays idempotent after legacy retirement', () => {
  const f = fixture();
  seedLegacy(f);
  codexInstall(f);

  const repeated = codexInstall(f);

  expect(repeated.out).toMatch(/idempotent|no changes/i);
  expect(existsSync(join(f.legacy, 'axstack-demo', 'SKILL.md'))).toBe(false);
});
