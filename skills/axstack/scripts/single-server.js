import * as fs from 'node:fs';

function discover(procRoot, uid, baseDir, defaultBase) {
  const processes = new Map();
  const servers = [];
  const pids = fs.readdirSync(procRoot).filter((name) => /^[1-9]\d*$/.test(name)).map(Number).sort((a, b) => a - b);
  for (const pid of pids) {
    try {
      const status = fs.readFileSync(`${procRoot}/${pid}/status`, 'utf8');
      const parent = /^PPid:\s+(\d+)/m.exec(status);
      const user = /^Uid:\s+(\d+)/m.exec(status);
      if (!parent || !user) throw new Error('invalid process status');
      processes.set(pid, Number(parent[1]));
      if (Number(user[1]) !== uid) continue;
      const argv = fs.readFileSync(`${procRoot}/${pid}/cmdline`, 'utf8').split('\0');
      if (argv[0].split('/').at(-1) !== 't3' || argv[1] !== 'serve') continue;
      let base = defaultBase;
      for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--base-dir') base = argv[++i];
        else if (argv[i].startsWith('--base-dir=')) base = argv[i].slice('--base-dir='.length);
      }
      if (base === baseDir) servers.push(pid);
    } catch (error) {
      // Processes can exit during discovery; every other scan failure prevents kills.
      if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
    }
  }
  return { processes, servers };
}

function descendants(pid, processes) {
  const found = new Set([pid]);
  for (const parent of found) {
    for (const [child, ppid] of processes) if (ppid === parent) found.add(child);
  }
  found.delete(pid);
  return [...found];
}

export async function run(args = [], {
  env = process.env, uid = process.getuid(), kill = process.kill, spawn = Bun.spawn,
  hostname = () => fs.readFileSync('/proc/sys/kernel/hostname', 'utf8').trim(), output = console.log,
} = {}) {
  let decision = { action: 'hold', reason: 'invalid-input', keeper: null, servers: [], killed: [] };
  let failure = 'invalid-input';
  let code = 0;
  try {
    const defaultBase = `${env.HOME}/.t3`;
    let baseDir = defaultBase;
    let procRoot = '/proc';
    let dryRun = false;
    const seen = new Set();
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      if (flag === '--help' && args.length === 1) {
        output('Usage: bun single-server.js [--base-dir DIR] [--proc-root DIR] [--dry-run] [--help]\n'
          + 'Defaults: $HOME/.t3 and /proc. SIGKILL duplicate t3 serve servers and their descendants;\n'
          + 'keep the runtime pid. --dry-run reports only. AXSTACK_SINGLE_SERVER_NOTIFY runs via sh -c after kills.');
        return 0;
      }
      if (seen.has(flag)) throw new Error('duplicate flag');
      seen.add(flag);
      if (flag === '--dry-run') dryRun = true;
      else if (['--base-dir', '--proc-root'].includes(flag) && args[i + 1] && !args[i + 1].startsWith('--')) {
        const value = args[++i];
        if (flag === '--base-dir') baseDir = value;
        else procRoot = value;
      } else throw new Error('invalid flag');
    }
    if (!env.HOME) throw new Error('missing home');
    failure = 'scan-failed';
    const { processes, servers } = discover(procRoot, uid, baseDir, defaultBase);
    decision.servers = servers;
    let runtimePid;
    try { runtimePid = JSON.parse(fs.readFileSync(`${baseDir}/userdata/server-runtime.json`, 'utf8')).pid; }
    catch { /* Missing, unreadable or malformed runtime data is never authority to kill. */ }
    if (Number.isSafeInteger(runtimePid) && servers.includes(runtimePid)) decision.keeper = runtimePid;
    if (servers.length < 2) decision = { ...decision, action: 'unchanged', reason: 'single-server' };
    else if (decision.keeper === null) decision.reason = 'no-valid-keeper';
    else {
      const protectedPids = new Set([decision.keeper, ...descendants(decision.keeper, processes)]);
      // Snapshot every tree before SIGKILL can reparent children, including other server trees.
      const trees = servers.filter((pid) => !protectedPids.has(pid))
        .map((pid) => [pid, ...descendants(pid, processes)]);
      const roots = trees.filter(([pid]) => !trees.some((tree) => tree[0] !== pid && tree.includes(pid)));
      const victims = [...new Set(roots.flat())].filter((pid) => !protectedPids.has(pid));
      decision.reason = 'duplicate-servers';
      if (dryRun) decision = { ...decision, action: 'would-kill', killed: victims };
      else {
        failure = 'kill-failed';
        for (const pid of victims) {
          try { kill(pid, 'SIGKILL'); }
          catch (error) { if (error.code === 'ESRCH') continue; throw error; }
          decision.action = 'killed';
          decision.killed.push(pid);
        }
        if (!decision.killed.length) decision = { ...decision, action: 'unchanged', reason: 'no-victims' };
        if (decision.killed.length && env.AXSTACK_SINGLE_SERVER_NOTIFY) {
          failure = 'notify-failed';
          const message = `${hostname()}: kept pid ${decision.keeper}; killed pids ${decision.killed.join(', ')}. `
            + 'Runs started by the killed server may stay running and need t3_thread_interrupt.\n';
          const child = spawn(['sh', '-c', env.AXSTACK_SINGLE_SERVER_NOTIFY], {
            stdin: new Blob([message]), stdout: 'ignore', stderr: 'ignore', env,
          });
          if (await child.exited !== 0) throw new Error('notification failed');
        }
      }
    }
  } catch {
    decision.reason = failure;
    code = 1;
  }
  output(JSON.stringify(decision));
  return code;
}

if (import.meta.main) process.exitCode = await run(process.argv.slice(2));
