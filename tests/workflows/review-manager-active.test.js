import { expect, test } from 'bun:test';
import { copyFileSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';
import { hash, managerIdentity, version, workflowName } from '../../skills/axstack/workflows/review-manager.mjs';

const source = `${import.meta.dir}/../../skills/axstack`;
const { quiet } = await Bun.file(import.meta.dir + '/fixtures/review-manager-predecessor.json').json();
const threadId = 'workflow:' + '8'.repeat(64);
const receipt = { threadId, runId: 'run:thread:workflow%3A' + '8'.repeat(64) + ':ordinal:1', outcome: 'full' };
const seat = {
  model: { instanceId: 'codex', model: 'gpt-6.2-sol', options: [{ id: 'reasoningEffort', value: 'high' }] },
  runtimeMode: 'full-access',
};
const catalog = { providers: [{
  instanceId: 'codex', driver: 'codex', enabled: true, installed: true, status: 'ready',
  models: [{ slug: seat.model.model, capabilities: { optionDescriptors: [
    { id: 'reasoningEffort', options: [{ id: 'high' }] },
  ] } }],
}] };

const action = (run) => ({ run, *[Symbol.iterator]() { return yield run; } });
function gen(body) {
  return action(async () => {
    const operations = body();
    let next = operations.next();
    while (!next.done) next = operations.next(await next.value());
    return next.value;
  });
}

function fakeRuntime({ progress, config, worktreeRoot, getScenario }) {
  const calls = [], values = new Map();
  Object.assign(globalThis, {
    Schema: new Proxy({}, { get: (_target, name) => ['String', 'Number', 'Boolean', 'Json'].includes(name) ? {} : (shape) => shape }),
    Effect: { gen, fail: (error) => action(() => { throw error; }),
      tryPromise: (effect) => action(async () => {
        try { return await effect.try(); } catch (error) { throw effect.catch(error); }
      }),
    },
    Option: { isSome: ({ value }) => value !== undefined },
    T3: {
      Tick: {}, runs: () => action(() => []), every: (value) => value,
      workflow: (_name, _schema, body) => body,
      step: (name, _schema, effect) => action(async () => {
        calls.push(name);
        try { return await effect.run(); } catch (error) { throw Object.assign(error, { step: name }); }
      }),
      store: {
        transaction: (effect) => effect,
        entry: (key) => ({
          get: action(() => ({ value: values.get(key) })),
          set: (value) => action(() => values.set(key, value)),
        }),
      },
      agent: { try: (_name, options) => action(() => {
        const scenario = getScenario();
        calls.push({ agent: options });
        expect(readFileSync(config.progressCopy, 'utf8')).toBe(progress);
        expect(options.workspace.worktreePath).toBe(`${worktreeRoot}/review-manager-${scenario.runId}`);
        expect(options).toMatchObject({ ...seat, project: config.projectId, workspace: { type: 'existing_worktree' } });
        expect(options.brief.split('\n')[0]).toBe(`AXSTACK-WAKE ${managerIdentity} run ${scenario.runId}`);
        expect(options.brief).not.toMatch(/PRIVATE LIMIT|PRIVATE PR|predecessor\.md|reviewThread/);
        return { outcome: 'done', thread: { threadId }, value: scenario.output === undefined ? receipt : scenario.output };
      }) },
    },
  });
  return { calls, values };
}

test('replays the shipped active entry with native readback shapes and real detached Git worktrees', async () => {
  const root = makeTempRoot('axstack-active-review-');
  const env = { PATH: `${root}/bin:/usr/bin:/bin`, HOME: root + '/home', TMPDIR: root,
    AXSTACK_ACTIVE_TEST_SENTINEL: 'synthetic' };
  const original = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  let server, scenario;
  try {
    for (const dir of ['workflows', 'bin', 'home', 'project', 'worktrees', 'userdata', 'skills', 'skills/sandbox']) {
      mkdirSync(root + '/' + dir, { mode: 0o700 });
    }
    const command = (name, script) => writeFileSync(root + '/bin/' + name,
      '#!/bin/sh\nset -eu\ntest -z "$(printenv AXSTACK_ACTIVE_TEST_SENTINEL || true)"\n' + script + '\n', { mode: 0o700 });
    const print = (value) => "cat <<'JSON'\n" + JSON.stringify(value) + "\nJSON\n";
    const token = root + '/token';
    const project = root + '/project';
    const worktreeRoot = root + '/worktrees';
    const config = {
      mode: 'active', project, projectId: quiet.input.inventory.args.projectId, projects: [project],
      repository: quiet.input.repository, repositories: [quiet.input.repository], worktreeRoot,
      progressCopy: root + '/predecessor.md', bun: process.execPath, t3: root + '/bin/t3',
      skillsDirectory: root + '/skills', registryTokenFile: token, nativeSeat: seat, operationalLimits: 'PRIVATE LIMIT',
    };
    const gitEnv = { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: env.HOME + '/.gitconfig' };
    writeFileSync(gitEnv.GIT_CONFIG_GLOBAL, '[init]\n', { mode: 0o600 });
    const git = (...args) => {
      const result = Bun.spawnSync(['/usr/bin/git', ...args], { env: gitEnv, cwd: project });
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      return result.stdout.toString().trim();
    };
    git('init', '-b', 'main');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'fixture');
    const sha = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', sha);
    command('git', 'exec env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$HOME/.gitconfig" /usr/bin/git "$@"');
    command('gh', 'exit 1');
    command('docker', 'test "$*" = "info --format {{.ServerVersion}}"\nprintf "%s\\n" 28.0.0');
    command('t3', `case "$2:$5" in
list:--project) ${print(quiet.input.inventory.value.threads)}
;;
show:${threadId}) cat "${root}/thread.json";;
show:*) ${print(quiet.input.prior)}
;;
*) exit 3;;
esac`);
    symlinkSync(source + '/scripts', config.skillsDirectory + '/scripts');
    writeFileSync(config.skillsDirectory + '/sandbox/launcher.js', `
if (process.env.AXSTACK_ACTIVE_TEST_SENTINEL || Bun.argv[2] !== 'reap') process.exit(8);
await Bun.write(${JSON.stringify(root + '/launcher-called')}, 'reap');
console.log('[]');
process.exit(Number(await Bun.file(${JSON.stringify(root + '/reap-exit')}).text()));
`);
    writeFileSync(config.skillsDirectory + '/roles.json', JSON.stringify({
      version: 1, roles: [{ id: 'axstack-owner', provider: 'codex', modeId: 'full-access', modelClass: 'sol', thinkingOptionId: 'high' }],
    }));
    writeFileSync(token, 'synthetic-reader', { mode: 0o600 });
    writeFileSync(config.progressCopy, quiet.progress, { mode: 0o600 });
    server = Bun.serve({ hostname: '127.0.0.1', port: 0,
      fetch(request, local) {
        if (request.headers.get('authorization') !== 'Bearer synthetic-reader') return new Response(null, { status: 401 });
        if (!local.upgrade(request)) return new Response(null, { status: 400 });
      },
      websocket: { message(socket, raw) {
        const request = JSON.parse(String(raw));
        const value = request.tag === 'server.getConfig' ? catalog : {
          thread: { id: threadId, modelSelection: scenario.effective?.model ?? seat.model,
            runtimeMode: scenario.effective?.runtimeMode ?? seat.runtimeMode },
        };
        socket.send(JSON.stringify({ _tag: 'Chunk', requestId: request.id, values: [value] }));
      } },
    });
    writeFileSync(root + '/userdata/server-runtime.json', JSON.stringify({
      origin: server.url.origin, pid: process.pid, startedAt: new Date().toISOString(),
    }));
    const bind = (actual, declared = actual) => {
      const binding = root + '/binding.json';
      writeFileSync(binding, JSON.stringify(actual), { mode: 0o600 });
      writeFileSync(root + '/.axstack-workflows.json', JSON.stringify({ workflows: {
        [managerIdentity]: { binding, bindingDigest: hash(JSON.stringify(declared)) },
      } }), { mode: 0o600 });
    };
    Object.assign(process.env, env);
    const { calls, values } = fakeRuntime({ progress: quiet.progress, config, worktreeRoot, getScenario: () => scenario });
    const bundle = `${workflowName}-v${version}.mjs`;
    copyFileSync(source + '/workflows/bundles/' + bundle, root + '/workflows/' + bundle);
    const run = (await import(root + '/workflows/' + bundle)).default;
    const now = Date.now();
    const cases = [
      { decision: 'managed' },
      { decision: 'managed', reapExit: 2 },
      { step: 'manager-launch', expectedSeat: { ...seat, model: { ...seat.model, model: 'gpt-6.1-sol' } }, agents: 0 },
      { step: 'manager-readback', effective: { ...seat, runtimeMode: 'approval-required' } },
      { step: 'manager-readback', effective: { ...seat, model: { ...seat.model, options: [{ id: 'reasoningEffort', value: 'low' }] } } },
      { step: 'manager-readback', output: null },
      { step: 'manager-readback', output: { ...receipt, runId: 'not-the-manager-run' } },
      { step: 'binding', edit: true, agents: 0 },
      { step: 'claim-slot', repeat: true, agents: 0 },
    ];
    for (const [index, next] of cases.entries()) {
      scenario = { runId: index.toString(16).padStart(32, '0'), ...next };
      const scheduledAt = new Date(now + (index - Number(scenario.repeat ?? false)) * 1_800_000).toISOString();
      const bound = { ...config, nativeSeat: scenario.expectedSeat ?? seat };
      bind(scenario.edit ? { ...bound, mode: 'report' } : bound, bound);
      writeFileSync(root + '/reap-exit', String(scenario.reapExit ?? 0));
      writeFileSync(root + '/thread.json', JSON.stringify({
        thread: { ...quiet.input.prior.thread, threadId, latestRunId: receipt.runId,
          worktreePath: worktreeRoot + '/review-manager-' + scenario.runId },
      }));
      calls.length = 0;
      const result = await run({ scheduledAt }, { id: scenario.runId }).run()
        .catch((error) => ({ decision: 'paused', step: error.step }));
      if (scenario.reapExit === undefined && !scenario.step) expect(result.reasons).not.toContain('reap:fail');
      expect(result).toMatchObject(scenario.step ? { decision: 'paused', step: scenario.step } : {
        decision: scenario.decision, mode: 'active', reasons: expect.arrayContaining([
          'identity:unknown', 'project-coverage:unknown', ...(scenario.reapExit ? ['reap:fail'] : []),
        ]), receipt,
      });
      expect(calls.filter((call) => call.agent)).toHaveLength(scenario.agents ?? 1);
      if (!scenario.step || scenario.step === 'manager-readback') {
        expect(git('worktree', 'list', '--porcelain')).toContain(`HEAD ${sha}\ndetached`);
      }
    }
    expect([...values.keys()]).toEqual([managerIdentity + ':latest-slot']);
    expect(readFileSync(config.progressCopy, 'utf8')).toBe(quiet.progress);
    expect(readFileSync(root + '/launcher-called', 'utf8')).toBe('reap');
    expect(git('status', '--porcelain')).toBe('');
  } finally {
    await server?.stop(true);
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(root, { recursive: true });
  }
}, 15_000);
