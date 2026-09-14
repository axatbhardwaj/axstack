import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

function writeOrcaBundle(root, { skillBody = '# Axstack\n', roles } = {}) {
  const bundle = join(root, 'bundle');
  mkdirSync(join(bundle, 'skills', 'axstack'), { recursive: true });
  mkdirSync(join(bundle, 'profiles', 'presets'), { recursive: true });
  writeFileSync(join(bundle, 'skills', 'axstack', 'SKILL.md'), skillBody);
  const selectedRoles = roles ?? [{
    id: 'axstack-driver',
    name: 'Axstack driver',
    provider: 'codex',
    model: 'gpt-test',
    modeId: 'default',
    thinkingOptionId: 'medium',
    notes: 'Fixture role.',
  }];
  writeFileSync(
    join(bundle, 'profiles', 'roles.json'),
    JSON.stringify({
      version: 1,
      roles: selectedRoles,
    }, null, 2) + '\n',
  );
  writeFileSync(
    join(bundle, 'profiles', 'presets', 'mixed.json'),
    JSON.stringify({
      version: 1,
      preset: 'mixed',
      agentProfiles: [{ id: 'axstack-driver', name: 'Driver', provider: 'codex', model: 'm' }],
    }, null, 2) + '\n',
  );
  return bundle;
}

test('installs roles as an ordinary owned axstack file and preserves edits', () => {
  const root = makeTempRoot('axstack-orca-roles-');
  const bundle = writeOrcaBundle(root);
  const skillsDir = join(root, 'skills');
  const roleFile = join(skillsDir, 'axstack', 'roles.json');

  runCli(['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir]);
  expect(JSON.parse(readFileSync(roleFile, 'utf8')).roles[0].id).toBe('axstack-driver');
  const manifest = JSON.parse(readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'));
  expect(manifest.files['axstack/roles.json']).toBeString();

  const edited = '{"version":1,"roles":[],"userEdit":true}\n';
  writeFileSync(roleFile, edited);
  const again = runCli(['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir]);
  expect(again.out).toMatch(/preserved user edits/i);
  expect(readFileSync(roleFile, 'utf8')).toBe(edited);
  runCli(['uninstall', '--skills-dir', skillsDir]);
  expect(readFileSync(roleFile, 'utf8')).toBe(edited);
});

test('rejects malformed or duplicate roles before target writes', () => {
  const root = makeTempRoot('axstack-orca-invalid-');
  const roles = [
    { id: 'axstack-driver', name: 'Driver', provider: 'codex', model: 'm' },
    { id: 'axstack-driver', name: 'Duplicate', provider: 'claude', model: 'm' },
  ];
  const bundle = writeOrcaBundle(root, { roles });
  const skillsDir = join(root, 'skills');
  const result = runCli(['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir], {
    expectFail: true,
  });
  expect(result.out).toMatch(/duplicate.*role|role.*duplicate/i);
  expect(existsSync(skillsDir)).toBe(false);
});

test('obsolete --profile is rejected with migration guidance before writes', () => {
  const root = makeTempRoot('axstack-orca-obsolete-');
  const bundle = writeOrcaBundle(root);
  const skillsDir = join(root, 'skills');
  const oldConfig = join(root, 'paseo.json');
  writeFileSync(oldConfig, 'untouched\n');

  for (const args of [
    ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', oldConfig],
    ['uninstall', '--skills-dir', skillsDir, '--profile', oldConfig],
  ]) {
    const result = runCli(args, { expectFail: true });
    expect(result.out).toMatch(/--profile.*obsolete|obsolete.*--profile/i);
    expect(result.out).toMatch(/roles\.json|Orca/i);
    expect(existsSync(skillsDir)).toBe(false);
    expect(readFileSync(oldConfig, 'utf8')).toBe('untouched\n');
  }
});

test('legacy profile provenance remains inert across install and uninstall', () => {
  const root = makeTempRoot('axstack-orca-legacy-');
  const bundle = writeOrcaBundle(root, { skillBody: '# Axstack v2\n' });
  const skillsDir = join(root, 'skills');
  mkdirSync(join(skillsDir, 'axstack'), { recursive: true });
  writeFileSync(join(skillsDir, 'axstack', 'SKILL.md'), '# Axstack v1\n');
  const legacy = {
    version: 1,
    files: {},
    profiles: {
      path: '/unreadable/legacy/paseo.json',
      entries: { 'axstack-driver': 'historical-hash' },
    },
  };
  writeFileSync(
    join(skillsDir, '.axstack-manifest.json'),
    JSON.stringify(legacy, null, 2) + '\n',
  );

  const installed = runCli([
    'install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir, '--force',
  ]);
  expect(installed.out).toMatch(/legacy.*profile.*provenance/i);
  let manifest = JSON.parse(readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'));
  expect(manifest.profiles).toEqual(legacy.profiles);
  runCli(['uninstall', '--skills-dir', skillsDir]);
  manifest = JSON.parse(readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'));
  expect(manifest.profiles).toEqual(legacy.profiles);
});
