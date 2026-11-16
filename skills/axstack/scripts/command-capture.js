import { admitCapture, finishCapture } from './capture-identity.js';
import { closeSync, openSync, realpathSync, writeFileSync, writeSync } from 'node:fs';

const drainGraceMs = 200;

export function killGroup(proc) {
  try { process.kill(-proc.pid, 'SIGKILL'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}

export async function runCommand(commands, paths, kind, argv, cwd, env, limits, state, spawnArgv = argv, binding = null) {
  let before = null;
  if (binding) {
    try { before = admitCapture(binding, paths.evidence, cwd); }
    catch (error) { error.captureHold = true; throw error; }
  }
  const capturedCwd = binding ? realpathSync(cwd) : cwd;
  const started = performance.now();
  const step = { kind, argv, spawnArgv, exitCode: null, durationMs: 0, logPath: `${paths.evidence}/${crypto.randomUUID()}-${kind}.log`, timedOut: false, logBytes: 0, omittedBytes: 0, logIncomplete: false };
  step.receiptPath = `${step.logPath.slice(0, -4)}.json`;
  commands.push(step);
  const fd = openSync(step.logPath, 'wx', 0o600);
  let proc;
  let timer;
  let graceTimer;
  let logging = true;
  const readers = [];
  function log(chunk) {
    if (!logging) return;
    const kept = Math.min(chunk.length, limits.logBytes - step.logBytes);
    if (kept) writeSync(fd, chunk.subarray(0, kept));
    step.logBytes += kept;
    step.omittedBytes += chunk.length - kept;
  }
  async function drain(reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        log(value);
      }
    } catch (error) {
      if (logging) { step.error = error.message; killGroup(proc); }
    }
  }
  try {
    proc = Bun.spawn(spawnArgv, { cwd, env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', detached: true });
    state.active = proc;
    readers.push(proc.stdout.getReader(), proc.stderr.getReader());
    const drained = Promise.all(readers.map(drain));
    const exited = proc.exited.then((code) => {
      if (logging) step.exitCode = code;
      clearTimeout(timer);
      killGroup(proc);
    });
    /** @type {Promise<void>} */
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => { step.timedOut = true; killGroup(proc); resolve(); }, limits.timeoutMs);
    });
    await Promise.race([exited, timeout]);
    const complete = await Promise.race([
      Promise.all([exited, drained]).then(() => true),
      new Promise((resolve) => { graceTimer = setTimeout(() => resolve(false), drainGraceMs); }),
    ]);
    step.logIncomplete = !complete;
  } catch (error) {
    step.error = error.message;
    log(new TextEncoder().encode(error.message));
  } finally {
    clearTimeout(timer);
    clearTimeout(graceTimer);
    logging = false;
    if (proc) killGroup(proc);
    // Cancel without another EOF wait. Escaped writers may retain the other pipe end forever.
    for (const reader of readers) reader.cancel().then(() => reader.releaseLock()).catch(() => {});
    state.active = null;
    closeSync(fd);
    step.durationMs = Math.round(performance.now() - started);
    if (binding) finishCapture(step, binding, before, capturedCwd, state.signal);
    writeFileSync(step.receiptPath, `${JSON.stringify(step, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  }
  return step;
}

