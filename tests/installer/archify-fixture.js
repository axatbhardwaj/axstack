import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  // The production pin stays immutable; local fixtures bind a different pin
  // only in this disposable package, including on the pre-feature revision.
  const pinFile = join(pkg, 'src', 'archify-pin.js');
  const pin = existsSync(pinFile) ? readFileSync(pinFile, 'utf8') : '';
  writeFileSync(pinFile, pin ? pin.replace(/[a-f0-9]{40}/, sha)
    : `export const ARCHIFY_PIN = { repo: 'unused', sha: '${sha}' };\n`);
  const skills = join(root, 'skills');
  const tools = join(root, 'tools');
  const bundle = writeFixtureBundle(root);
  const cli = join(pkg, 'bin', 'axstack.js');
  const env = { AXSTACK_ARCHIFY_REPO: repo };
  const run = (args, options = {}) => runCli(cli, args, { ...options, env: { ...env, ...options.env } });
  const install = (extra = [], options) => run([
    'install', '--preset', 'mixed', '--bundle', bundle,
    '--skills-dir', skills, '--tools-dir', tools, '--no-claude-settings', ...extra,
  ], options);
  return { root, repo, sha, pkg, pinFile, skills, tools, bundle, cli, run, install,
    copy: join(tools, `archify-${sha}`),
    owners: join(tools, `archify-${sha}.owners.json`),
    record: join(skills, 'axstack-diagram', 'archify.json'), BUN_BIN };
}
