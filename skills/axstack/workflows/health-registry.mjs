import { lstatSync } from 'node:fs';

const LOOPBACK = new Set(['127.0.0.1', '[::1]', 'localhost']);

export async function workflowRegistry(origin, tokenPath) {
  if (!tokenPath) return null;
  try {
    const url = new URL('/ws?orchestrationProtocol=2', origin);
    if (!LOOPBACK.has(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const file = lstatSync(tokenPath);
    if (!file.isFile() || file.uid !== process.getuid() || (file.mode & 0o077) || file.size > 8192) return null;
    const token = (await Bun.file(tokenPath).text()).trim();
    if (!token) return null;
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return await registrySnapshot(url, token);
  } catch {
    return null;
  }
}

function registrySnapshot(url, token) {
  return new Promise((resolve) => {
    // @ts-expect-error Bun accepts client headers, which the DOM type omits.
    const socket = new WebSocket(url, { headers: { Authorization: 'Bearer ' + token } });
    const timer = setTimeout(() => finish(null), 5000);
    function finish(value) {
      clearTimeout(timer);
      resolve(value);
      socket.close();
    }
    socket.addEventListener('open', () => socket.send(JSON.stringify({
      _tag: 'Request', id: '1', tag: 'workflows.subscribe', payload: { changes: true }, headers: [],
    })));
    socket.addEventListener('error', () => finish(null));
    socket.addEventListener('close', () => finish(null));
    socket.addEventListener('message', ({ data }) => {
      try {
        const frame = JSON.parse(data);
        if (frame._tag === 'Chunk' && frame.requestId === '1') {
          const snapshot = frame.values[0];
          finish(Array.isArray(snapshot?.workflows) ? { workflows: snapshot.workflows, definition: snapshot.definition } : null);
        } else if (frame._tag === 'Exit' || frame._tag === 'Defect') finish(null);
      } catch {
        finish(null);
      }
    });
  });
}
