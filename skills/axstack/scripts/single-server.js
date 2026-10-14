import * as fs from 'node:fs';

function normalizeBase(procRoot, pid, base, home) {
  if (!base) return null;
  if (base === '~' || base.startsWith('~/')) {
    if (!home) return null;
    base = home + base.slice(1);
  }
  if (!base.startsWith('/')) {
    let cwd;
    try { cwd = fs.readlinkSync(`${procRoot}/${pid}/cwd`); }
    catch { return null; }
    if (!cwd.startsWith('/')) return null;
    base = `${cwd}/${base}`;
  }
  const parts = [];
  for (const part of base.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return `/${parts.join('/')}`;
}

function serverBase(procRoot, pid, argv) {
  let base;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--base-dir') base = argv[++i];
    else if (argv[i].startsWith('--base-dir=')) base = argv[i].slice('--base-dir='.length);
  }
  let home;
  try {
    const environ = fs.readFileSync(`${procRoot}/${pid}/environ`, 'utf8').split('\0');
    const value = (key) => environ.find((entry) => entry.startsWith(`${key}=`))?.slice(key.length + 1);
    home = value('HOME');
    if (base === undefined) base = value('T3CODE_HOME') || (home ? `${home}/.t3` : null);
  } catch { /* An absolute argv base does not need the process environment. */ }
  return normalizeBase(procRoot, pid, base, home);
}

function discover(procRoot, uid, baseDir) {
  const processes = new Map();
  const servers = [];
  let unknownBase = false;
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
      const base = serverBase(procRoot, pid, argv);
      if (base === null) unknownBase = true;
      else if (base === baseDir) servers.push(pid);
    } catch (error) {
      // Processes can exit during discovery; every other scan failure prevents kills.
      if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
    }
  }
  return { processes, servers, unknownBase };
}

function descendants(pid, processes) {
  const found = new Set([pid]);
  for (const parent of found) {
    for (const [child, ppid] of processes) if (ppid === parent) found.add(child);
  }
  found.delete(pid);
  return [...found];
}

function serverTimes(procRoot, servers) {
  let uptime = null;
  try {
    const value = fs.readFileSync(`${procRoot}/uptime`, 'utf8').trim().split(/\s+/)[0];
    if (/^\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value))) uptime = Number(value);
  } catch { /* Unknown uptime never authorizes a kill. */ }
  const starts = new Map(servers.map((pid) => {
    let start = null;
    try {
      const stat = fs.readFileSync(`${procRoot}/${pid}/stat`, 'utf8');
      const end = stat.lastIndexOf(')');
      // The comm field can contain spaces and parentheses; field 22 is index 19 after it.
      const value = end < 0 ? '' : stat.slice(end + 1).trim().split(/\s+/)[19];
      if (/^\d+$/.test(value)) start = BigInt(value);
    } catch { /* Unknown age never authorizes a kill. */ }
    return [pid, start];
  }));
  const ages = new Map([...starts].map(([pid, start]) => [pid,
    start === null || uptime === null ? null : uptime - Number(start) / 100]));
  return { starts, ages, uptime };
}

function replacementHold({ starts, ages, uptime }, servers, keeper, graceSeconds) {
  if ([...starts.values()].includes(null)) return 'unknown-start-time';
  if (uptime === null) return 'unknown-uptime';
  if (servers.some((pid) => pid !== keeper && starts.get(pid) >= starts.get(keeper)
    && ages.get(pid) < graceSeconds)) return 'possible-replacement';
  return null;
}

export async function run(args = [], {
  env = process.env, uid = process.getuid(), kill = process.kill, spawn = Bun.spawn,
  hostname = () => fs.readFileSync('/proc/sys/kernel/hostname', 'utf8').trim(), output = console.log,
} = {}) {
  let decision = { action: 'hold', reason: 'invalid-input', keeper: null, servers: [], killed: [] };
  let failure = 'invalid-input';
  let code = 0;
  try {
    let baseDir = `${env.HOME}/.t3`;
    let procRoot = '/proc';
    let dryRun = false;
    let graceSeconds = 120;
    const seen = new Set();
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      if (flag === '--help' && args.length === 1) {
        output('Usage: bun single-server.js [--base-dir DIR] [--proc-root DIR] [--grace-seconds N] [--dry-run] [--help]\n'
          + 'Defaults: $HOME/.t3 and /proc. SIGKILL duplicate t3 serve servers and their descendants;\n'
          + 'keep the runtime pid. Newer servers get 120 seconds grace (N: non-negative integer).\n'
          + '--dry-run reports only. AXSTACK_SINGLE_SERVER_NOTIFY runs via sh -c after kills,\n'
          + 'or for holds with 2+ servers whose youngest age is 600 to under 780 seconds.');
        return 0;
      }
      if (seen.has(flag)) throw new Error('duplicate flag');
      seen.add(flag);
      if (flag === '--dry-run') dryRun = true;
      else if (['--base-dir', '--proc-root', '--grace-seconds'].includes(flag) && args[i + 1] && !args[i + 1].startsWith('--')) {
        const value = args[++i];
        if (flag === '--base-dir') baseDir = value;
        else if (flag === '--proc-root') procRoot = value;
        else {
          if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('invalid grace');
          graceSeconds = Number(value);
        }
      } else throw new Error('invalid flag');
    }
    if (!env.HOME) throw new Error('missing home');
    baseDir = normalizeBase(procRoot, process.pid, baseDir, env.HOME);
    if (baseDir === null) throw new Error('unresolved base dir');
    failure = 'scan-failed';
    const { processes, servers, unknownBase } = discover(procRoot, uid, baseDir);
    decision.servers = servers;
    let runtimePid;
    try { runtimePid = JSON.parse(fs.readFileSync(`${baseDir}/userdata/server-runtime.json`, 'utf8')).pid; }
    catch { /* Missing, unreadable or malformed runtime data is never authority to kill. */ }
    if (Number.isSafeInteger(runtimePid) && servers.includes(runtimePid)) decision.keeper = runtimePid;
    const times = serverTimes(procRoot, servers);
    const ageHold = !unknownBase && servers.length > 1 && decision.keeper !== null
      ? replacementHold(times, servers, decision.keeper, graceSeconds) : null;
    if (unknownBase) decision.reason = 'unknown-base-dir';
    else if (servers.length < 2) decision = { ...decision, action: 'unchanged', reason: 'single-server' };
    else if (decision.keeper === null) decision.reason = 'no-valid-keeper';
    else if (ageHold) decision.reason = ageHold;
    else {
      const protectedPids = new Set([decision.keeper, ...descendants(decision.keeper, processes)]);
      // Snapshot every tree before SIGKILL can reparent children, including other server trees.
      const trees = servers.filter((pid) => !protectedPids.has(pid))
        .map((pid) => [pid, ...descendants(pid, processes)]);
      const roots = trees.filter(([pid]) => !trees.some((tree) => tree[0] !== pid && tree.includes(pid)));
      const victims = [...new Set(roots.flat())].filter((pid) => !protectedPids.has(pid));
      const ancestors = new Set([process.pid]);
      let parent = processes.get(process.pid) ?? process.ppid;
      while (parent && !ancestors.has(parent)) {
        ancestors.add(parent);
        parent = processes.get(parent);
      }
      decision.reason = 'duplicate-servers';
      if (victims.some((pid) => ancestors.has(pid))) decision.reason = 'own-process-tree';
      else if (dryRun) decision = { ...decision, action: 'would-kill', killed: victims };
      else {
        failure = 'kill-failed';
        for (const pid of victims) {
          try { kill(pid, 'SIGKILL'); }
          catch (error) {
            if (error.code !== 'ESRCH') {
              decision.failed ??= [];
              decision.failed.push(pid);
              code = 1;
            }
            continue;
          }
          decision.action = 'killed';
          decision.killed.push(pid);
        }
        if (decision.failed?.length) decision.reason = 'kill-failed';
        else if (!decision.killed.length) decision = { ...decision, action: 'unchanged', reason: 'no-victims' };
      }
    }
    if (!dryRun && env.AXSTACK_SINGLE_SERVER_NOTIFY) {
      let message;
      failure = 'notify-failed';
      if (decision.killed.length || decision.failed?.length) {
        message = `${hostname()}: kept pid ${decision.keeper}; killed pids ${decision.killed.join(', ') || 'none'}. `
          + 'Runs started by the killed server may stay running and need t3_thread_interrupt.\n';
        if (decision.failed?.length) message += `Failed pids ${decision.failed.join(', ')} are still running.\n`;
      } else if (decision.action === 'hold' && servers.length > 1) {
        const ages = [...times.ages.values()];
        const youngest = ages.every((age) => age !== null && age >= 0) ? Math.min(...ages) : null;
        if (youngest !== null && youngest >= 600 && youngest < 780) {
          message = `${hostname()}: hold ${decision.reason}; keeper ${decision.keeper ?? 'none'}; `
            + `servers ${servers.join(', ')}; duplicates are still running.\n`;
        }
      }
      if (message) {
        const child = spawn(['sh', '-c', env.AXSTACK_SINGLE_SERVER_NOTIFY], {
          stdin: new Blob([message]), stdout: 'ignore', stderr: 'ignore', env,
        });
        if (await child.exited !== 0) throw new Error('notification failed');
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
