/** Bounded trusted command execution. No shell and no inherited host environment. */
export async function execute(argv) {
  const child = Bun.spawn(argv, { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/bin', LC_ALL: 'C' }, timeout: 15000, killSignal: 'SIGKILL' });
  let truncated = false;
  async function read(stream) {
    const chunks = []; let bytes = 0;
    for await (const chunk of stream) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) { truncated = true; child.kill('SIGKILL'); break; }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  const [stdout, stderr, exitCode] = await Promise.all([read(child.stdout), read(child.stderr), child.exited]);
  return { stdout, stderr, exitCode, truncated, timedOut: child.signalCode === 'SIGKILL' };
}

export function hold(message, terms) {
  return Object.assign(Error(message), { sandboxHold: true, terms });
}
