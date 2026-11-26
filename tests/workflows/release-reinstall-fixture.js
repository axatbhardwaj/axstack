import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const workflow = 'axstack-release-reinstall';
const routes = { io: 'xzat@io', iobook: 'iobook', iobox: 'xzat@iobox', iosatellite: 'xzat@iosatellite', 'axat-vps': 'local' };
export const targets = Object.keys(routes);
const digest = (bytes) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const executable = { mode: 0o700 };
const privateFile = { mode: 0o600 };

function populate(home, version) {
  const root = home + '/.local/share/axstack/releases/' + version + '/package';
  const skill = 'axstack release skill\n';
  for (const dir of [home + '/.local/bin', home + '/.bun/install/global/node_modules/axstack', root + '/bin']) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(root + '/package.json', JSON.stringify({ name: 'axstack', version }));
  writeFileSync(root + '/bin/axstack.js', '');
  for (const skillName of ['axstack', 'axstack-implement', 'voa']) {
    const marker = (dir) => dir + '/' + skillName + '/SKILL.md';
    for (const dir of [root + '/skills', ...['.agents/skills', '.claude/skills', '.config/opencode/skills']
      .map((path) => home + '/' + path)]) {
      mkdirSync(dir + '/' + skillName, { recursive: true });
      writeFileSync(marker(dir), skill);
    }
  }
  writeFileSync(home + '/.bun/install/global/node_modules/axstack/package.json', JSON.stringify({ name: 'axstack', version }));
  writeFileSync(home + '/.local/bin/axstack', '#!/bin/sh\n[ "$1" != install ] || { fake-install opencode "$@"; exit; }\nprintf "axstack ' + version + '\\n"\n', executable);
}

export function fakeFleet(server, bundle) {
  const bin = server.root + '/bin';
  const log = server.root + '/events';
  const registryFile = server.root + '/registry.json';
  const bindingFile = server.root + '/binding.json';
  const script = server.root + '/reinstall.sh';
  const stateFiles = Object.fromEntries(targets.map((host) => [host, server.root + '/' + host + '.json']));
  const homes = Object.fromEntries(targets.map((host) => [host, host === 'axat-vps' ? server.home : server.root + '/' + host]));
  const prompts = server.root + '/agent-calls.json';
  const controls = { log, registryFile, stateFiles, homes, routes, prompts, bindingFile };
  writeFileSync(server.workflows + '/' + workflow + '-v1.mjs', bundle);
  mkdirSync(bin);
  writeFileSync(log, '');
  writeFileSync(script, 'set -eu\nfake-install reinstall "$1"\nfake-install claude\nfake-install codex\n', privateFile);
  for (const [host, home] of Object.entries(homes)) {
    populate(home, '1.2.2');
    writeFileSync(stateFiles[host], '{}');
  }
  const runner = `#!${process.execPath}
import { appendFileSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
const { log, registryFile, stateFiles, homes, routes, prompts, bindingFile } = ${JSON.stringify(controls)};
${populate.toString()}
const executable = { mode: 0o700 };
const mkdirSync = (await import('node:fs')).mkdirSync;
const name = Bun.argv[1].split('/').at(-1);
const args = Bun.argv.slice(2);
const local = Object.entries(homes).find(([, home]) => home === Bun.env.HOME)?.[0];
const state = (host) => JSON.parse(readFileSync(stateFiles[host], 'utf8'));
const emit = (line) => appendFileSync(log, line + '\\n');
if (['npm','curl','ssh'].includes(name) && (Bun.env.SECRET_SENTINEL ||
    (Bun.env.CLAUDE_CONFIG_DIR && process.cwd() === '/'))) process.exit(98);
if (name === 'npm' || name === 'curl') {
  const registry = JSON.parse(readFileSync(registryFile, 'utf8'));
  if (name === 'npm') {
    if (args[0] === 'pack') {
      const v = args.find((arg) => arg.startsWith('axstack@')).split('@')[1];
      const scratch = mkdtempSync(Bun.env.TMPDIR + '/pack-');
      populate(scratch, v);
      const tar = Bun.spawnSync(['/usr/bin/tar', '-czf', process.cwd() + '/axstack-' + v + '.tgz',
        '-C', scratch + '/.local/share/axstack/releases/' + v, 'package']);
      rmSync(scratch, { recursive: true });
      if (tar.exitCode !== 0) process.exit(tar.exitCode);
      emit('write ' + local + ' reinstall ' + v);
    } else if (args.includes('dist.integrity')) {
      const v = args.find((arg) => arg.startsWith('axstack@')).split('@')[1];
      if (registry.badVpsIntegrity) { console.log('sha512-invalid'); process.exit(); }
      console.log('sha512-' + new Bun.CryptoHasher('sha512').update(readFileSync('axstack-' + v + '.tgz')).digest('base64'));
    } else if (args.includes('version')) {
      registry.reads = (registry.reads ?? 0) + 1;
      writeFileSync(registryFile, JSON.stringify(registry));
      if (registry.changeBindingAt === registry.reads) {
        writeFileSync(bindingFile, '{}');
      }
      const found = registry.latestAt === registry.reads ? 'v1.2.4' : (registry.latest ?? 'v1.2.3');
      console.log(JSON.stringify(typeof found === 'string' ? found.slice(1) : found));
    } else {
      const v = args.find((arg) => arg.startsWith('axstack@')).split('@')[1];
      console.log(JSON.stringify({
        tarball: registry.invalidMetadata ? 'https://evil.invalid/file' : 'https://registry.npmjs.org/axstack/-/axstack-' + v + '.tgz',
        integrity: registry.invalidIntegrity ? 'invalid' : 'sha512-' + 'A'.repeat(86) + '==',
      }));
    }
  } else {
    if (registry.unavailable > 0) {
      registry.unavailable--;
      writeFileSync(registryFile, JSON.stringify(registry));
      emit('tarball unavailable');
      process.exit(22);
    }
    emit('tarball available');
    console.log('206');
  }
} else if (name === 'ssh' || name === 'bash') {
  const host = name === 'ssh' ? Object.entries(routes).find(([, target]) => args.includes(target))?.[0] : local;
  if (!host) process.exit(98);
  const parameters = name === 'ssh' ? args.at(-1).split(' ').slice(1) : args;
  const fixture = state(host);
  const apply = parameters.includes('apply');
  if (name === 'ssh') {
    if (fixture.offline || (fixture.hasWritten && fixture.unknownAfter)) process.exit(255);
    if (fixture.doneReceipt) {
      const { packageSkills = 'present', defaultActive = 'active', defaultEnabled = 'enabled',
        singleActive = 'active', singleEnabled = 'enabled' } = fixture.doneReceipt;
      console.log(['AXSTACK done 1.2.3 1.2.3', packageSkills, defaultActive, defaultEnabled,
        singleActive, singleEnabled, 'present n/a'].join(' '));
      process.exit();
    }
    if (fixture.malformed) {
      console.log('unstructured output');
      process.exit();
    }
    if (apply && fixture.newerOnApply) populate(homes[host], '1.2.4');
  }
  const command = parameters[0] === '-lc' ? ['--noprofile', '--norc', '-c', ...parameters.slice(1)] : parameters;
  const processHandle = Bun.spawn(['/bin/bash', ...command], {
    env: { ...Bun.env, HOME: homes[host],
      ...(host === 'axat-vps' ? { CLAUDE_CONFIG_DIR: homes[host] + '/shadow' } : {}) }, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
  });
  const code = await processHandle.exited;
  process.exit(apply && fixture.unknownAfter ? 255 : code);
} else if (name === 'systemctl') {
  const fixture = state(local);
  const unit = args.at(-1);
  if (fixture.timerUnknown === unit) process.exit(1);
  const mismatch = fixture.hasWritten && fixture.mismatch &&
    (fixture.mismatch === true || unit === 'axstack-' + fixture.mismatch + '.timer');
  if (args.includes('is-active')) console.log(fixture.disabled || (mismatch && !fixture.disabledAfter) ? 'inactive' : 'active');
  else if (args.includes('is-enabled')) console.log(mismatch && fixture.disabledAfter ? 'disabled' : 'enabled');
  else if (args.includes('--property=DropInPaths')) console.log('/fixture/pool.conf');
  else process.exit(98);
} else if (name === 'fake-install') {
  if (args[0] === 'reinstall') {
    emit('write ' + local + ' reinstall ' + args[1]);
    const fixture = state(local);
    if (fixture.exit) process.exit(fixture.exit);
    if (fixture.delay) await Bun.sleep(fixture.delay);
    populate(homes[local], args[1]);
    if (fixture.missingSkills) unlinkSync(homes[local] + '/.agents/skills/voa/SKILL.md');
    writeFileSync(stateFiles[local], JSON.stringify({ ...fixture, hasWritten: true }));
  } else {
    emit('write ' + local + ' ' + args[0] + (Bun.env.CLAUDE_CONFIG_DIR ? ' shadow' : ' clean') + (args.includes('--no-claude-settings') ? ' --no-claude-settings' : ''));
  }
} else if (name === 'fixture-rpc') {
  if (args.includes('server.getConfig')) {
    console.log(JSON.stringify({ providers: [{
      instanceId: 'codex', driver: 'codex', enabled: true, installed: true, models: [{
        slug: 'gpt-6.2-sol', capabilities: { optionDescriptors: [{ id: 'reasoningEffort', options: [{ id: 'high' }] }] },
      }],
    }] }));
  } else {
    const { model, runtimeMode } = JSON.parse(readFileSync(prompts, 'utf8'))[0];
    console.log(JSON.stringify({ thread: { id: 'workflow:fixture', modelSelection: model, runtimeMode } }));
  }
} else if (name === 'fixture-t3') {
  const { model, runtimeMode, brief } = JSON.parse(readFileSync(prompts, 'utf8'))[0];
  console.log(JSON.stringify({
    thread: { threadId: 'workflow:fixture', status: 'completed', archived: false, pinned: false,
      createdBy: 'system', creationSource: 'server', worktreePath: null, providerInstanceId: model.instanceId,
      model: model.model, runtimeMode: state('iobook').agentMismatch ? 'approval-required' : runtimeMode },
    messages: [{ role: 'system', text: brief }],
  }));
} else if (name === 'bun-global') {
  if (args[0] === '--no-env-file') {
    const result = Bun.spawnSync([process.execPath, ...args], { stdout: 'inherit', stderr: 'inherit' });
    process.exit(result.exitCode);
  } else if (args[0] === 'add') {
    emit('write ' + local + ' bun-global ' + args.at(-1));
    const version = args.at(-1).split('@')[1];
    writeFileSync(homes[local] + '/.bun/install/global/node_modules/axstack/package.json', JSON.stringify({ name: 'axstack', version }));
  } else if (args[1] === '--version') {
    const manifest = JSON.parse(readFileSync(args[0].replace('/bin/axstack.js', '/package.json'), 'utf8'));
    console.log('axstack ' + manifest.version);
  } else if (args[1] === 'install') {
    const harness = args[args.indexOf('--harness') + 1];
    emit('write ' + local + ' ' + harness + (Bun.env.CLAUDE_CONFIG_DIR ? ' shadow' : ' clean') +
      (args.includes('--no-claude-settings') ? ' --no-claude-settings' : ''));
  } else process.exit(98);
} else {
  process.exit(98);
}
`;
  for (const command of ['ssh', 'npm', 'curl', 'bash', 'systemctl', 'fake-install', 'bun-global', 'fixture-rpc', 'fixture-t3']) {
    writeFileSync(bin + '/' + command, runner, executable);
  }
  server.env.PATH = bin + ':' + server.env.PATH;
  server.env.CLAUDE_CONFIG_DIR = server.root + '/claude-alt';
  server.env.SECRET_SENTINEL = 'synthetic-secret';
  // The shell stub used as the installed CLI delegates OpenCode to the fixture.
  function host(id, fixture) {
    writeFileSync(stateFiles[id], JSON.stringify(fixture));
    const home = homes[id];
    if (fixture.version) populate(home, fixture.version);
    if (fixture.malformedPackage) {
      writeFileSync(home + '/.local/share/axstack/releases/1.2.3/package/package.json', '{');
    } else if (existsSync(home + '/.local/share/axstack/releases/1.2.3/package/package.json')) {
      writeFileSync(home + '/.local/share/axstack/releases/1.2.3/package/package.json',
        JSON.stringify({ name: 'axstack', version: '1.2.3' }));
    }
  }
  function registry(fixture) {
    writeFileSync(registryFile, JSON.stringify(fixture));
  }
  function changeBinding({ digest: changed, scriptDigest, missingHost, wrongLocalHostname, agent, insecureBinding } = {}) {
    const hosts = { ...routes };
    if (missingHost) delete hosts.io;
    const binding = JSON.stringify({
      hosts, localHostname: wrongLocalHostname ? 'wrong-host' : Bun.spawnSync(['hostname']).stdout.toString().trim().split('.')[0],
      reinstallScript: script, reinstallDigest: scriptDigest ?? digest(readFileSync(script)),
      globalBun: bin + '/bun-global', project: server.project,
      bun: agent ? bin + '/fixture-rpc' : process.execPath, t3: agent ? bin + '/fixture-t3' : server.t3, roles: server.root + '/roles.json',
      registryTokenFile: server.root + '/registry-token', pollSeconds: 0,
    });
    writeFileSync(bindingFile, binding, privateFile);
    chmodSync(bindingFile, insecureBinding ? 0o644 : 0o600);
    if (agent) {
      writeFileSync(server.base + '/userdata/server-runtime.json',
        JSON.stringify({ origin: 'http://127.0.0.1:1', pid: 123, startedAt: 'fixture' }), privateFile);
      writeFileSync(server.root + '/roles.json', JSON.stringify({ version: 1, roles: [{
        id: 'axstack-owner', provider: 'codex', modeId: 'full-access', model: 'gpt-6.2-sol', thinkingOptionId: 'high',
      }] }), privateFile);
    }
    writeFileSync(server.base + '/.axstack-workflows.json', JSON.stringify({ version: 1, workflows: {
      [workflow + '@1']: { binding: bindingFile, digest: digest(bundle), bindingDigest: changed ?? digest(binding) },
    } }), privateFile);
  }
  changeBinding();
  registry({});
  const events = () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
  return {
    registry, changeBinding, host, events, prompts,
    clearEvents: () => writeFileSync(log, ''),
    writes: () => events().filter((line) => line.startsWith('write ')).map((line) => line.slice(6)),
  };
}
