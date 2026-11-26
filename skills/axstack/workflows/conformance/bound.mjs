import { Database } from 'bun:sqlite';
import { realpathSync, writeFileSync } from 'node:fs';
import { assertIsolatedBase } from './isolated.mjs';
import { git, updateEnvironment } from './provision.mjs';

function check(value, message) {
  if (!value) throw new Error(message);
}

async function until(read, predicate, message, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  do {
    const value = read();
    if (predicate(value)) return value;
    await Bun.sleep(250);
  } while (Date.now() < deadline);
  throw new Error(message);
}

const view = (server, id) => server.command('thread', 'show', id, '--messages', '12', '--json');

async function typed(server, model, key, signal) {
  const worktree = `${server.root}/worktree-${key}`;
  git(server, 'worktree', 'add', '--detach', worktree, 'HEAD');
  try {
    check(!git(server, '-C', worktree, 'branch', '--show-current'), 'fixture was not detached');
    const started = server.start('ax-conf-typed', key, { model, worktree, recover: Boolean(signal) });
    if (signal) {
      const active = await until(
        () => server.command('workflow', 'show', started.runId, '--json'),
        (run) => run.run.status === 'waiting' && run.steps.some((step) =>
          step.threadId && view(server, step.threadId).thread.status === 'running'),
        'no active agent wait before restart');
      const pid = server.pid();
      await server.restart(signal);
      check(server.pid() !== pid && active.run.runId === started.runId, 'agent wait did not cross a server restart');
    }
    const completed = await server.waitFor(started.runId, 'completed', 85_000);
    const id = completed.result?.thread?.threadId;
    check(id && completed.result?.value?.marker === 'AXSTACK-CONFORMANCE', 'typed agent result was missing');
    const { thread } = view(server, id);
    check(thread.providerInstanceId === model.instanceId && thread.model === model.model &&
      thread.runtimeMode === 'full-access' && thread.worktreePath === worktree, 'agent binding readback differed');
    if (model.options?.length) {
      const db = new Database(server.base + '/userdata/statev2.sqlite', { readonly: true });
      try {
        const row = db.query('SELECT model_selection_json FROM projection_threads WHERE thread_id = ?').get(id);
        const options = JSON.parse(row?.model_selection_json ?? '{}').options ?? [];
        check(model.options.every((desired) => options.some((option) => option.id === desired.id && option.value === desired.value)),
          'agent option readback differed');
      } finally {
        db.close();
      }
    }
  } finally {
    git(server, 'worktree', 'remove', worktree);
    check(!git(server, 'worktree', 'list', '--porcelain').includes(worktree), 'owned worktree did not clean up');
  }
}

async function wakeCases(server, model) {
  const optionFlags = (model.options ?? []).flatMap((option) => ['--option', option.id + '=' + option.value]);
  const owner = server.command('thread', 'start', server.project, 'Reply READY and end the turn.',
    '--provider', model.instanceId, '--model', model.model, ...optionFlags, '--json');
  const thread = owner.threadId;
  check(typeof thread === 'string', 'disposable owner did not start');
  await until(() => view(server, thread),
    ({ thread, messages }) => thread.status === 'completed' &&
      messages.some((message) => message.role === 'assistant' && message.text?.includes('READY')),
    'disposable owner did not become idle', 85_000);
  writeFileSync(server.root + '/owner-id', thread, { mode: 0o600 });
  for (const mode of ['idle', 'busy']) {
    for (const route of ['agent', 'cli']) {
      if (mode === 'busy') {
        server.command('thread', 'send', thread, 'Run sleep 20 in the foreground, then reply READY.', '--json');
        await until(() => view(server, thread), ({ thread }) => thread.status === 'running', 'owner was not busy');
      }
      const key = mode + '-' + route;
      const payload = { key, route, thread, expected: model };
      const run = server.start('ax-conf-wake', key, payload);
      check(server.start('ax-conf-wake', key, payload).runId === run.runId, 'duplicate wake allocated a new run');
      const marker = `AXSTACK-WAKE ax-conf-wake@1 run ${run.runId}`;
      const { result } = await server.waitFor(run.runId, 'completed', 85_000);
      if (route === 'cli') check(result?.delivery === (mode === 'busy' ? 'queued' : 'started'), 'CLI wake delivery differed');
      const { messages } = await until(() => view(server, thread),
        ({ messages }) => messages.some((message) => message.role === 'assistant' && message.text?.includes(marker)),
        'owner response omitted exact wake marker', 85_000);
      const user = messages.filter((message) => message.role === 'user' && message.text?.startsWith(marker));
      const reply = messages.find((message) => message.role === 'assistant' && message.text?.includes(marker));
      check(user.length === 1, 'wake marker was delivered multiple times');
      check(route === 'cli' ? /this message came through T3 Code/i.test(reply.text) : /no T3 (?:sender )?label/i.test(reply.text),
        'owner response did not distinguish the sender label');
    }
  }
  const mismatched = { ...model, model: model.model + '-mismatch' };
  const held = server.start('ax-conf-wake', 'mismatch', { key: 'mismatch', route: 'agent', thread, expected: mismatched });
  check((await server.waitFor(held.runId, 'completed')).result?.decision === 'hold', 'binding change did not hold wake');
  await server.stop();
  const db = new Database(server.base + '/userdata/statev2.sqlite', { readwrite: true });
  try {
    check(db.query('UPDATE projection_threads SET archived_at = ? WHERE thread_id = ?').run(
      new Date().toISOString(), thread).changes === 1, 'isolated owner did not archive');
  } finally {
    db.close();
  }
  await server.restart();
  check(view(server, thread).thread.archived, 'archive readback failed');
  for (const [target, id] of [['missing', crypto.randomUUID()], ['archived', thread]]) {
    for (const route of ['agent', 'cli']) {
      const key = target + '-' + route;
      const started = server.start('ax-conf-wake', key, { key, route, thread: id });
      const { result } = await server.waitFor(started.runId, 'completed', 30_000);
      check(route === 'agent' ? result?.outcome === 'failed' : result?.exit === 1, target + ' owner wake was accepted');
    }
  }
  return 'idle, busy, missing, archived, duplicate delivery and binding hold';
}

async function forgeCases(server, binding) {
  const run = server.start('ax-conf-forge', 'coverage');
  const { result } = await server.waitFor(run.runId, 'completed', 120_000);
  check(result?.visible && result.missing && result.combined === 'unknown', 'forge discovery gap was not isolated');
  const { missingChecks, failedJob, retarget, failingStatus, lateReview } = result.facts;
  check(missingChecks?.checks?.length === 0, 'missing-check fixture differs');
  check(failedJob?.checks?.some((check) => check.name === binding.forge.cases.failedJob.name && check.conclusion === 'failure'),
    'failed check fixture differs');
  check(retarget?.base === binding.forge.cases.retarget.base && retarget?.base !== binding.forge.cases.retarget.previousBase,
    'retargeted-base fixture differs');
  check(failingStatus?.status === 'failure' && failingStatus?.checks?.length > 0 &&
    failingStatus.checks.every((check) => check.conclusion === 'success'), 'failed status beside green checks was missed');
  check(lateReview?.lateReview, 'late review comment was not observed');
  const list = () => server.command('workflow', 'list', '--json').filter((entry) => entry.workflow === 'ax-conf-opened');
  const { fresh, existing } = binding.forge.opened;
  const opened = await until(list, (runs) => runs.some((entry) => entry.result?.number === fresh),
    'fresh disposable PR did not produce an opened event', 90_000);
  check(opened.filter((entry) => entry.result?.number === fresh).length === 1 &&
    !opened.some((entry) => entry.result?.number === existing), 'opened backfilled or duplicated a scratch PR');
  return 'separate repo coverage, opened gap, retarget, check, status, and review facts';
}

async function processCases(server) {
  const started = server.start('ax-conf-processes', 'facts');
  const { result } = await server.waitFor(started.runId, 'completed', 90_000);
  check(result?.coverage && Object.values(result.exits).every((exit) => exit === 0) &&
    result.projectSetCoverage === 'unknown' && result.ms.every(Number.isFinite), 'process or fact coverage differed');
  const pinned = server.start('ax-conf-pin', 'moved-head');
  const { result: refusal } = await server.waitFor(pinned.runId, 'completed', 40_000);
  check(refusal?.refused, 'GitHub did not report a head-pin refusal on the open scratch PR');
  return 'file, Git, gh, SSH, thread inventories, helper, timing, head-pin refusal; project completeness unknown';
}

async function disposableUpdate(server, target) {
  assertIsolatedBase(server.base, Bun.env.HOME);
  check(server.base.startsWith(server.root + '/') && server.home.startsWith(server.root + '/'), 'update target is outside its scratch root');
  check(target.version !== server.version, 'update target must differ from the tested version');
  const run = server.start('ax-conf-durable', 'disposable-update', 'wait');
  await server.waitFor(run.runId, 'waiting');
  const result = Bun.spawnSync([server.t3, 'update', '--base-dir', server.base, '--channel', target.channel,
    '--allow-downgrade', target.version], { env: updateEnvironment(server), cwd: server.root, timeout: 120_000 });
  check(result.exitCode === 0, 'disposable t3 update failed');
  const bin = realpathSync(`${server.base}/runtime/versions/${target.version}/t3`);
  check(bin.startsWith(server.base + '/runtime/versions/'), 'updated runtime escaped the isolated base');
  server.setBinary(bin);
  await server.restart();
  server.command('workflow', 'signal', '--run', run.runId, '--wait', 'release', '--id', 'updated', '"updated"');
  check((await server.waitFor(run.runId, 'completed')).result === 'updated', 'wait did not survive disposable update');
  return 'disposable install and wait recovery after update';
}

export async function runBoundCases(server, binding) {
  server.command('project', 'add', server.project);
  server.command('project', 'add', server.root + '/other-project');
  const cases = {
    'POC-1': async () => {
      for (const seat of ['claude', 'codex']) await typed(server, binding.seats[seat], seat);
      return 'Claude and Codex typed results, exact bindings and detached worktree cleanup';
    },
    'POC-3-agent': async () => {
      for (const signal of ['SIGTERM', 'SIGKILL']) await typed(server, binding.seats.codex, signal, signal);
      return 'active agent wait across TERM and KILL';
    },
    'POC-4': () => forgeCases(server, binding),
    'POC-6': () => wakeCases(server, binding.seats.claude),
    'POC-8': () => processCases(server),
    'POC-10': async () => {
      const run = server.start('ax-conf-linear', 'bounded-read');
      const { result } = await server.waitFor(run.runId, 'completed', 70_000);
      check(result?.status === 'pass' && result.failureCoverage === 'unknown', 'bounded Linear read or coverage failure missing');
      return 'bounded authenticated Linear read and incomplete coverage';
    },
    'POC-3-update': () => disposableUpdate(server, binding.update),
  };
  const verdicts = {};
  for (const [name, probe] of Object.entries(cases)) {
    try {
      verdicts[name] = { status: 'pass', detail: await probe() };
    } catch (error) {
      // Error text from subprocesses and provider results can include private binding data.
      verdicts[name] = { status: 'fail', detail: error instanceof Error && error.message.startsWith('T3 ')
        ? error.message : 'fixture assertion or resource failed' };
    }
  }
  return verdicts;
}
