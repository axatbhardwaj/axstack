import { chmodSync, copyFileSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const fixtures = new URL('./fixtures/', import.meta.url);
const repoName = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const safePath = (value) => typeof value === 'string' && value.startsWith('/');
const seat = (value) => typeof value?.instanceId === 'string' && typeof value.model === 'string';
const updateVersion = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/;
const positiveNumber = (value) => Number.isSafeInteger(value) && value > 0;

export function missingResources(binding) {
  const missing = [];
  if (!safePath(binding.providers?.settings) || !Array.isArray(binding.providers.secrets) ||
      !binding.providers.secrets.every((secret) => safePath(secret.source) && /^[\w.-]+\.bin$/.test(secret.name)) ||
      !seat(binding.seats?.claude) || !seat(binding.seats?.codex)) missing.push('provider seats and isolated secret slots');
  const forge = binding.forge;
  if (!repoName.test(forge?.repo) || !repoName.test(forge?.absentRepo) || forge.repo === forge.absentRepo ||
      !safePath(forge.config) || !positiveNumber(forge.opened?.existing) || !positiveNumber(forge.opened?.fresh) ||
      forge.opened.existing === forge.opened.fresh ||
      !['missingChecks', 'failedJob', 'failingStatus', 'retarget', 'lateReview'].every((name) =>
        positiveNumber(forge.cases?.[name]?.number))) missing.push('disposable forge cases and merge-capable credentials scoped to the disposable repository');
  const ssh = binding.ssh;
  if (!/^(?:[\w.-]+@)?[A-Za-z0-9][\w.-]*$/.test(ssh?.host ?? '') || !safePath(ssh.identity) ||
      !safePath(ssh.knownHosts)) missing.push('SSH read fixture');
  const linear = binding.linear;
  if (!safePath(linear?.clientFile) || !/^https:\/\//.test(linear.endpoint ?? '') ||
      !/^linear_app\.[\w.]+\.list_issues$/.test(linear.tool ?? '')) missing.push('Executor Linear read fixture');
  if (!updateVersion.test(binding.update?.version) ||
      !['stable', 'nightly', 'preview'].includes(binding.update.channel)) missing.push('disposable update target');
  return missing;
}

function privateBytes(path) {
  const info = lstatSync(path);
  if (!info.isFile() || (info.mode & 0o077) || info.uid !== process.getuid() || info.size > 1_048_576) {
    throw new Error('conformance credential input is not a bounded private regular file');
  }
  return readFileSync(path);
}

export function git(server, ...args) {
  const result = Bun.spawnSync(['git', '-C', server.project, ...args], {
    env: { ...server.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: `${server.root}/gitconfig` }, timeout: 15_000, stderr: 'pipe',
  });
  if (result.exitCode !== 0) throw new Error('conformance Git fixture command failed');
  return result.stdout.toString().trim();
}

export function provision(server, settings, binding) {
  const provider = JSON.parse(privateBytes(binding.providers.settings).toString());
  const instances = provider.providerInstances;
  if (!instances || typeof instances !== 'object' || Array.isArray(instances)) {
    throw new Error('isolated provider settings require a providerInstances object');
  }
  writeFileSync(settings, JSON.stringify({ workflowsEnabled: true, providerInstances: instances }), { mode: 0o600 });
  const secrets = server.base + '/userdata/secrets';
  mkdirSync(secrets, { mode: 0o700 });
  for (const { source, name } of binding.providers.secrets) {
    writeFileSync(secrets + '/' + name, privateBytes(source), { flag: 'wx', mode: 0o600 });
  }
  const config = server.home + '/.config/gh';
  mkdirSync(config, { recursive: true, mode: 0o700 });
  writeFileSync(config + '/hosts.yml', privateBytes(binding.forge.config), { mode: 0o600 });
  privateBytes(binding.linear.clientFile);
  writeFileSync(`${server.root}/gitconfig`, '', { mode: 0o600 });
  git(server, 'init', '--quiet');
  git(server, '-c', 'user.name=Axstack Conformance', '-c', 'user.email=fixture@example.invalid',
    'commit', '--allow-empty', '-qm', 'Isolated conformance');
  git(server, 'remote', 'add', 'origin', `https://github.com/${binding.forge.repo}.git`);
  mkdirSync(server.root + '/other-project', { mode: 0o700 });
  for (const fixture of ['clients.mjs', 'linear.mjs']) {
    copyFileSync(new URL(fixture, fixtures), server.workflows + '/' + fixture);
  }
  writeFileSync(server.root + '/client-binding.json', JSON.stringify({
    forge: { repo: binding.forge.repo, absentRepo: binding.forge.absentRepo, cases: binding.forge.cases },
    ssh: binding.ssh, linear: binding.linear,
    runtime: { t3: server.t3, bun: process.execPath, base: server.base, project: server.project },
  }), { mode: 0o600 });
  writeFileSync(server.root + '/process-helper.mjs',
    'if (!(await Bun.file(Bun.argv[2]).text()).trim()) process.exitCode = 1;\n', { mode: 0o600 });
}

export function updateEnvironment(server) {
  const guard = server.root + '/blocked-services';
  const installBin = server.root + '/update-bin';
  mkdirSync(guard, { mode: 0o700 });
  mkdirSync(installBin, { mode: 0o700 });
  writeFileSync(guard + '/systemctl', '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  chmodSync(guard + '/systemctl', 0o700);
  return {
    ...server.env, PATH: guard + ':/usr/bin:/bin', T3CODE_HOME: server.base,
    T3CODE_INSTALL_BIN_DIR: installBin,
    DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + guard + '/no-session',
    DBUS_SYSTEM_BUS_ADDRESS: 'unix:path=' + guard + '/no-system',
  };
}
