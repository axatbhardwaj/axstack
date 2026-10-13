import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { BUN_BIN, makeTempRoot, runCli, writeFixtureBundle } from './helpers.js';

export function git(repo, ...args) {
  const result = Bun.spawnSync(['git', '-C', repo, ...args], {
    env: { ...Bun.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
    stdout: 'pipe', stderr: 'pipe',
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

export function archifyFixture() {
  const root = makeTempRoot('axstack-archify-');
  const repo = join(root, 'upstream');
  mkdirSync(join(repo, 'archify', 'bin'), { recursive: true });
  writeFileSync(join(repo, 'archify', 'bin', 'archify.mjs'), 'console.log("fixture");\n');
  writeFileSync(join(repo, 'archify', 'LICENSE'), 'Fixture licence\n');
  writeFileSync(join(repo, 'archify', 'THIRD_PARTY_NOTICES.md'), 'Fixture notices\n');
  writeFileSync(join(repo, 'archify', '.gitignore'), 'ignored.txt\n');
  mkdirSync(join(repo, 'outside'));
  writeFileSync(join(repo, 'outside', 'excluded.txt'), 'outside sparse payload\n');
  writeFileSync(join(repo, 'README.md'), 'root file outside payload\n');
  git(repo, 'init', '-q');
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture');
  const sha = git(repo, 'rev-parse', 'HEAD');
  const pkg = join(root, 'cli');
  mkdirSync(pkg);
  for (const dir of ['src', 'bin']) cpSync(join(import.meta.dir, '../..', dir), join(pkg, dir), { recursive: true });
  const skills = join(root, 'skills');
  const tools = join(root, 'tools');
  const bundle = writeFixtureBundle(root);
  const cli = join(pkg, 'bin', 'axstack.js');
  const run = (args, options = {}) => runCli(cli, args, options);
  const install = (extra = [], options) => run([
    'install', '--preset', 'mixed', '--bundle', bundle,
    '--skills-dir', skills, '--no-claude-settings', ...extra,
  ], options);
  return { root, repo, sha, pkg, skills, tools, bundle, cli, run, install,
    copy: join(tools, `archify-${sha}`),
    owners: join(tools, `archify-${sha}.owners.json`),
    record: join(skills, 'axstack-diagram', 'archify.json'), BUN_BIN };
}
