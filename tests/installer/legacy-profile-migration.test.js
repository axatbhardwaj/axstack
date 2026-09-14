import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { hashObject } from '../../src/manifest.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '..', '..', 'bin', 'axstack.js');
const runCli = (args, options) => runBunCli(CLI, args, options);
const wanted = {
  id: 'axstack-reviewer-primary',
  name: 'Primary reviewer',
  provider: 'codex',
  model: 'gpt-5.6-sol',
  thinkingOptionId: 'medium',
};
const legacy = {
  id: 'axstack-reviewer-sol',
  name: 'Legacy reviewer',
  provider: 'codex',
  model: 'gpt-5.6-sol',
  thinkingOptionId: 'medium',
};

function setup({ owned, live = legacy }) {
  const root = makeTempRoot('axstack-legacy-migration-');
  const bundle = writeFixtureBundle(root, { profiles: [wanted] });
  const skillsDir = join(root, 'skills');
  const profilePath = join(root, 'paseo.json');
  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(
    profilePath,
    JSON.stringify({ version: 1, daemon: { agentProfiles: [live] } }, null, 2) + '\n',
  );
  writeFileSync(
    join(skillsDir, '.axstack-manifest.json'),
    JSON.stringify({
      version: 1,
      files: {},
      profiles: {
        path: realpathSync(profilePath),
        entries: owned ? { [legacy.id]: hashObject(legacy) } : {},
      },
    }, null, 2) + '\n',
  );
  return { bundle, skillsDir, profilePath };
}

function install(fixture, options) {
  return runCli([
    'install', '--preset', 'mixed', '--bundle', fixture.bundle,
    '--skills-dir', fixture.skillsDir, '--profile', fixture.profilePath,
  ], options);
}

describe('legacy reviewer migration', () => {
  test('removes only an unchanged hash-owned legacy entry and drops ownership', () => {
    const fixture = setup({ owned: true });
    const result = install(fixture);
    const config = JSON.parse(readFileSync(fixture.profilePath, 'utf8'));
    const ids = config.daemon.agentProfiles.map((profile) => profile.id);
    const manifest = JSON.parse(
      readFileSync(join(fixture.skillsDir, '.axstack-manifest.json'), 'utf8'),
    );

    expect(ids).toContain(wanted.id);
    expect(ids).not.toContain(legacy.id);
    expect(manifest.profiles.entries[legacy.id]).toBeUndefined();
    expect(result.out).toMatch(/migrated.*axstack-reviewer-sol/i);
  });

  test('preserves an unowned legacy entry even when it is byte-identical', () => {
    const fixture = setup({ owned: false });
    const result = install(fixture, { expectFail: true });
    const config = JSON.parse(readFileSync(fixture.profilePath, 'utf8'));

    expect(config.daemon.agentProfiles).toContainEqual(legacy);
    expect(result.out).toMatch(/legacy gap.*axstack-reviewer-sol/i);
  });

  test('preserves an edited owned legacy entry and retains its old hash', () => {
    const edited = { ...legacy, model: 'USER_EDIT' };
    const fixture = setup({ owned: true, live: edited });
    const result = install(fixture, { expectFail: true });
    const config = JSON.parse(readFileSync(fixture.profilePath, 'utf8'));
    const manifest = JSON.parse(
      readFileSync(join(fixture.skillsDir, '.axstack-manifest.json'), 'utf8'),
    );

    expect(config.daemon.agentProfiles).toContainEqual(edited);
    expect(manifest.profiles.entries[legacy.id]).toBe(hashObject(legacy));
    expect(result.out).toMatch(/legacy gap.*axstack-reviewer-sol/i);
  });
});
