import { lstatSync } from 'node:fs';

const LOOPBACK = new Set(['127.0.0.1', '[::1]', 'localhost']);
const READ_METHODS = new Set(['workflows.subscribe', 'server.getConfig', 'orchestration.getThreadProjection']);

export async function readWorkflowRpc(origin, tokenPath, tag, payload) {
  if (!READ_METHODS.has(tag) || typeof tokenPath !== 'string' || !tokenPath.startsWith('/')) return null;
  try {
    const url = new URL('/ws?orchestrationProtocol=2', origin);
    if (!LOOPBACK.has(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const file = lstatSync(tokenPath);
    if (!file.isFile() || file.uid !== process.getuid() || (file.mode & 0o077) || file.size > 8192) return null;
    const token = (await Bun.file(tokenPath).text()).trim();
    if (!token) return null;
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return await firstReply(url, token, tag, payload);
  } catch {
    return null;
  }
}

function firstReply(url, token, tag, payload) {
  return new Promise((resolve) => {
    // @ts-expect-error Bun supports bearer headers on WebSocket connections.
    const socket = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });
    const timer = setTimeout(() => finish(null), 5000);
    function finish(value) {
      clearTimeout(timer);
      resolve(value);
      socket.close();
    }
    socket.addEventListener('open', () => socket.send(JSON.stringify({ _tag: 'Request', id: '1', tag, payload, headers: [] })));
    socket.addEventListener('error', () => finish(null));
    socket.addEventListener('close', () => finish(null));
    socket.addEventListener('message', ({ data }) => {
      try {
        const frame = JSON.parse(data);
        if (frame._tag === 'Defect') return finish(null);
        if (frame.requestId !== '1') return;
        if (frame._tag === 'Chunk') finish(frame.values[0] ?? null);
        if (frame._tag === 'Exit') finish(frame.exit?._tag === 'Success' ? frame.exit.value : null);
      } catch {
        finish(null);
      }
    });
  });
}
