import { readFile } from 'node:fs/promises';
export const PROC_COMMAND = "cat /proc/stat && printf '\\n---AXSTACK-MEM---\\n' && cat /proc/meminfo";
export function sshArgv(host) {
  return ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'IdentitiesOnly=yes',
    '-o', 'ConnectTimeout=3', '-o', 'ConnectionAttempts=1', '-o', 'ServerAliveInterval=2',
    '-o', 'ServerAliveCountMax=1', '-o', 'ControlMaster=no', '-o', 'ControlPath=none',
    '-o', 'ClearAllForwardings=yes', '-o', 'PermitLocalCommand=no',
    ...(host.user ? ['-l', host.user] : []), '--', host.destination, PROC_COMMAND];
}
export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
async function limited(stream, signal) {
  const reader = stream.getReader(); const chunks = []; let size = 0;
  const cancel = () => { void reader.cancel(); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw Error('malformed');
      chunks.push(value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel();
    reader.releaseLock();
  }
}
export async function readProc(host, signal, spawn = Bun.spawn) {
  if (host.transport === 'local') {
    const stat = await readFile('/proc/stat', { encoding: 'utf8', signal });
    const mem = await readFile('/proc/meminfo', { encoding: 'utf8', signal });
    return `${stat}\n---AXSTACK-MEM---\n${mem}`;
  }
  const child = spawn(sshArgv(host), { stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' });
  const cancel = () => child.kill('SIGKILL');
  signal.addEventListener('abort', cancel, { once: true });
  try {
    if (signal.aborted) { cancel(); throw signal.reason; }
    const output = await limited(child.stdout, signal);
    const code = await child.exited;
    if (signal.aborted) throw signal.reason;
    if (code !== 0) throw Error('failed');
    return output;
  } finally {
    signal.removeEventListener('abort', cancel);
    child.kill('SIGKILL');
    await child.exited;
  }
}
