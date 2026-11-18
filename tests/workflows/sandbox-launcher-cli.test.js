import { expect, test } from 'bun:test';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { admitCapture } from '../../skills/axstack/scripts/capture-identity.js';
import { fixture, image, planners } from './sandbox-launcher-fixture.js';

const launcher = `${import.meta.dir}/../../skills/axstack/sandbox/launcher.js`;
test('help discloses owned resources, per-run probes and the caller timeout', () => {
  const result = Bun.spawnSync([process.execPath, launcher, '--help']);
  expect(result.exitCode).toBe(0);
  const text = result.stdout.toString();
  for (const word of ['plan', 'run', 'reap', 'image file', 'loop device', 'volume', '/var/lib/axstack/sandbox', 'per-run', '910', 'SIGINT', 'SIGHUP', 'exit 2', 'inet axstack_sandbox', 'input/forward chains', 'persist after cleanup']) expect(text).toContain(word);
});

test('unknown CLI options fail instead of silently doing nothing', () => {
  const result = Bun.spawnSync([process.execPath, launcher, 'run', '--privileged']);
  expect(result.exitCode).toBe(1);
});
function withCli(check) {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-cli-`); chmodSync(root, 0o700);
  try {
    cpSync(`${import.meta.dir}/../../skills/axstack/sandbox`, `${root}/sandbox`, { recursive: true });
    mkdirSync(`${root}/scripts`);
    for (const file of ['capture-identity.js', 'command-capture.js', 'git-argv.js']) cpSync(`${import.meta.dir}/../../skills/axstack/scripts/${file}`, `${root}/scripts/${file}`);
    const fake = planners();
    for (const [file, name] of [['network', 'planNetwork'], ['storage', 'planStorage'], ['probes', 'planProbes']]) {
      cpSync(`${root}/sandbox/${file}.js`, `${root}/sandbox/${file}-real.js`);
      writeFileSync(`${root}/sandbox/${file}.js`, `export * from './${file}-real.js'; const image = ${JSON.stringify(image)}; export const ${name} = ${fake[name].toString()};\n`);
    }
    const cli = (...args) => Bun.spawnSync([process.execPath, '--no-env-file', `${root}/sandbox/launcher.js`, ...args], { cwd: '/' });
    mkdirSync(`${root}/evidence`, { mode: 0o700 });
    check(root, cli);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('packaged CLI prints exact plan argv/rules with interface fakes and wrong-host writers exit 2', () => {
  withCli((root, cli) => {
    writeFileSync(`${root}/input.json`, JSON.stringify(fixture()));
    const result = cli('plan', '--input', `${root}/input.json`);
    expect(result.exitCode).toBe(0);
    const p = JSON.parse(result.stdout.toString());
    expect(p.rules).toEqual(planners().planNetwork({ runId: 'r1' }).rules);
    for (const c of p.containers) expect(c.argv.slice(0, 2)).toEqual(['docker', 'create']);
    writeFileSync(`${root}/sandbox/launcher-host.json`, JSON.stringify({ schemaVersion: 1, hostname: 'axat-vps', machineIdSha256: '0'.repeat(64) }));
    for (const args of [['run', '--input', `${root}/input.json`, '--evidence-dir', `${root}/evidence`], ['reap']]) {
      const held = cli(...args);
      expect(held.exitCode).toBe(2); expect(held.stderr.toString()).toContain('wrong host');
    }
    expect(readdirSync(`${root}/evidence`)).toEqual([]);
  });
});

function syntheticCheckout(root) {
  const input = fixture(), repo = `${root}/checkout`, origin = 'git@github.com:fixture-org/fixture-repo.git';
  mkdirSync(repo);
  const git = (...args) => {
    const result = Bun.spawnSync(['git', '-C', repo, '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
      { env: { PATH: process.env.PATH, HOME: root, GIT_CONFIG_NOSYSTEM: '1' } });
    if (result.exitCode !== 0) throw Error(result.stderr.toString());
    return result.stdout.toString().trim();
  };
  git('init');
  git('commit', '--allow-empty', '-m', 'fixture base');
  const base = git('rev-parse', 'HEAD');
  git('commit', '--allow-empty', '-m', 'fixture head');
  git('remote', 'add', 'origin', origin);
  input.request = { ...input.request, repo, head: git('rev-parse', 'HEAD'), base, repository: 'https://github.com/fixture-org/fixture-repo', fetchArgv: ['true'], testArgv: ['true'] };
  return { input, origin, git };
}

function stopAtAdmission(root, input) {
  const path = `${root}/sandbox/launcher-host.js`;
  cpSync(path, `${root}/sandbox/launcher-host-real.js`);
  writeFileSync(path, `export * from './launcher-host-real.js';
export const loadAssets = async () => (${JSON.stringify(input.assets)});
export const observeHost = async () => (${JSON.stringify(input.host)});
export const currentOwner = async () => (${JSON.stringify(input.owner)});
export const withAdmission = async () => { throw Error('fixture reached admission without host writes'); };
`);
}

test('run already rejects the incomplete historical plan shape before admission', () => {
  withCli((root, cli) => {
    const { input } = syntheticCheckout(root);
    stopAtAdmission(root, input);
    writeFileSync(`${root}/input.json`, JSON.stringify(input));
    const generated = cli('plan', '--input', `${root}/input.json`);
    expect(generated.exitCode).toBe(0);
    const { networks, rules, ...incomplete } = JSON.parse(generated.stdout.toString());
    expect(networks.length).toBeGreaterThan(0);
    expect(rules.length).toBeGreaterThan(0);
    writeFileSync(`${root}/incomplete.json`, JSON.stringify(incomplete));
    const rejected = cli('run', '--input', `${root}/incomplete.json`, '--evidence-dir', `${root}/evidence`);
    expect(rejected.exitCode).toBe(1);
    expect(rejected.stderr.toString()).toContain('invalid plan');
    expect(readdirSync(`${root}/evidence`)).toEqual([]);
  });
});

test('binds the authorized HTTPS pin to the exact SSH origin and passes generated bytes directly to run', () => {
  withCli((root, cli) => {
    const { input, origin } = syntheticCheckout(root);
    stopAtAdmission(root, input);
    const binding = { ...input.request, tool: { name: 'fixture', version: '1' } };
    expect(() => admitCapture(binding, `${root}/evidence`, binding.repo)).toThrow('repository or requested head does not match source');
    writeFileSync(`${root}/input.json`, JSON.stringify(input));
    const generated = cli('plan', '--input', `${root}/input.json`, '--bind-origin');
    expect(generated.stderr.toString()).toBe('');
    expect(generated.exitCode).toBe(0);
    const { request } = JSON.parse(generated.stdout.toString());
    expect(request).toEqual({ ...input.request, repository: origin });
    expect(admitCapture({ ...binding, repository: request.repository }, `${root}/evidence`, binding.repo).head).toBe(input.request.head);
    writeFileSync(`${root}/generated.json`, generated.stdout);
    const run = cli('run', '--input', `${root}/generated.json`, '--evidence-dir', `${root}/evidence`);
    expect(run.stderr.toString()).toContain('fixture reached admission without host writes');
    expect(readdirSync(`${root}/evidence`)).toEqual([]);
  });
});

test('bind-origin never substitutes a different checkout or resolves moving commit pins', () => {
  withCli((root, cli) => {
    const { input, git } = syntheticCheckout(root);
    for (const [override, status, reason] of [
      [{ repository: 'different-org/fixture-repo' }, 2, 'origin does not match expected repository'],
      [{ head: input.request.base }, 2, 'checkout HEAD does not match expected head'],
      [{ base: '0'.repeat(40) }, 2, 'expected base commit unavailable'],
      [{ base: 'HEAD~1' }, 1, 'head/base must be exact commits'],
    ]) {
      writeFileSync(`${root}/input.json`, JSON.stringify({ ...input, request: { ...input.request, ...override } }));
      const rejected = cli('plan', '--input', `${root}/input.json`, '--bind-origin');
      expect(rejected.stderr.toString()).toContain(reason);
      expect(rejected.exitCode).toBe(status);
      expect(rejected.stdout.toString()).toBe('');
    }
    git('remote', 'set-url', 'origin', 'https://github.com.evil.invalid/fixture-org/fixture-repo');
    writeFileSync(`${root}/input.json`, JSON.stringify(input));
    const rejected = cli('plan', '--input', `${root}/input.json`, '--bind-origin');
    expect(rejected.exitCode).toBe(2);
    expect(rejected.stderr.toString()).toContain('origin does not match expected repository');
  });
});
