import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';

function canonical(path) {
  try {
    return realpathSync(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const slash = path.lastIndexOf('/');
    return canonical(path.slice(0, slash) || '/') + '/' + path.slice(slash + 1);
  }
}

export function assertIsolatedBase(base, home) {
  if (!base?.startsWith('/') || !home?.startsWith('/')) throw new Error('absolute isolation paths required');
  const live = canonical(home + '/.t3');
  const target = canonical(base);
  if (target === live || target.startsWith(live + '/')) throw new Error('refusing the default T3 base');
}

function run(t3, env, cwd, args) {
  const command = Bun.spawnSync([t3, ...args], { cwd, env, timeout: 15_000, stderr: 'pipe' });
  if (command.exitCode !== 0) throw new Error(`T3 ${args.slice(0, 2).join(' ')} failed`);
  return command.stdout.toString();
}

export async function usingIsolatedT3({ t3, defaultLocation = false, beforeStart }, work) {
  const originalHome = Bun.env.HOME;
  const temp = realpathSync(Bun.env.TMPDIR || '/tmp');
  const resolvedHome = realpathSync(originalHome);
  if (temp === resolvedHome || temp.startsWith(resolvedHome + '/')) throw new Error('conformance scratch must be outside HOME');
  const root = mkdtempSync(temp + '/axstack-conformance-');
  const home = root + '/home';
  const base = defaultLocation ? home + '/.t3' : root + '/base';
  const workflows = defaultLocation ? base + '/workflows' : root + '/workflows';
  const project = root + '/project';
  const env = {
    HOME: home, PATH: Bun.env.PATH ?? '/usr/bin:/bin', TMPDIR: root, TZ: 'UTC',
    XDG_CONFIG_HOME: home + '/.config', XDG_DATA_HOME: home + '/.local/share',
    XDG_CACHE_HOME: home + '/.cache', XDG_RUNTIME_DIR: root + '/xdg-runtime',
    AXSTACK_CONFORMANCE_ROOT: root,
    ...(!defaultLocation ? { T3CODE_WORKFLOWS: workflows } : {}),
  };
  let child;
  let port;
  let binary = t3;
  const guard = () => assertIsolatedBase(base, originalHome);
  const stop = async (signal = 'SIGTERM') => {
    guard();
    if (!child) return;
    const process = child;
    if (process.exitCode === null && process.signalCode === null) process.kill(signal);
    const exited = await Promise.race([process.exited.then(() => true), Bun.sleep(4000).then(() => false)]);
    if (!exited) {
      process.kill('SIGKILL');
      await process.exited;
    }
    child = null;
  };
  const startServer = async () => {
    guard();
    if (child) throw new Error('isolated server already running');
    const listener = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
    port = listener.port;
    await listener.stop(true);
    child = Bun.spawn([binary, 'serve', '--base-dir', base, '--host', '127.0.0.1', '--port', String(port), '--no-browser', project], {
      env, cwd: project, stdout: 'ignore', stderr: 'ignore',
    });
    const deadline = Date.now() + 12_000;
    while (child.exitCode === null && Date.now() < deadline) {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(400) }).catch(() => null);
      if (response?.ok) {
        await response.body?.cancel();
        const state = await Bun.file(base + '/userdata/server-runtime.json').json().catch(() => null);
        if (state?.pid === child.pid) return;
      }
      await Bun.sleep(100);
    }
    throw new Error('isolated T3 server did not become ready');
  };
  const command = (...args) => {
    guard();
    const section = args[0] === 'workflow' && args[1] === 'store' ? 3 : 2;
    const result = run(binary, env, project, [
      ...args.slice(0, section), '--base-dir', base, ...args.slice(section),
    ]);
    return args.includes('--json') ? JSON.parse(result) : result;
  };
  const start = (name, key, payload = null) =>
    command('workflow', 'start', name, '--key', key, '--input', JSON.stringify(payload), '--json').run;
  const waitFor = async (runId, status, ms = 15000) => {
    const deadline = Date.now() + ms;
    let run;
    do {
      run = command('workflow', 'show', runId, '--json').run;
      if (run.status === status) return run;
      if (['paused', 'completed', 'stopped', 'cancelled', 'skipped'].includes(run.status)) break;
      await Bun.sleep(120);
    } while (Date.now() < deadline);
    throw new Error(`expected ${status}; observed ${run?.status ?? 'unknown'}`);
  };
  try {
    guard();
    for (const dir of [workflows, base + '/userdata', home, project, env.XDG_RUNTIME_DIR]) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const settings = base + '/userdata/settings.json';
    writeFileSync(settings, '{"workflowsEnabled":true}', { mode: 0o600 });
    const session = {
      root, home, base, workflows, project, env, command, start, waitFor, stop, t3,
      restart: async (signal) => { await stop(signal); await startServer(); },
      version: run(t3, env, project, ['--version']).trim().replace(/^t3 v/, ''),
      setBinary: (path) => { binary = path; },
      pid: () => child?.pid,
    };
    await beforeStart?.(session, settings);
    await startServer();
    return await work(session);
  } finally {
    await stop();
    rmSync(root, { recursive: true, force: true });
  }
}
