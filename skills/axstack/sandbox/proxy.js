import { authorizeTunnel, proxyEnvironment } from './proxy-policy.js';
import { resolveRegistry } from './proxy-dns.js';

// B owns argv/caps. proxy-command.js bundles only these trusted package assets.
export function startProxy({ port, hostAddresses, resolve = resolveRegistry, connect = Bun.connect }) {
  const sessions = new Set();
  // Bun can deliver a 512 KiB TCP read; retain at most 1 MiB per direction.
  const maxBufferedBytes = 1048576;
  function close(session) {
    if (session.closed) return;
    session.closed = true;
    session.client?.terminate(); session.upstream?.terminate(); sessions.delete(session);
  }
  function flush(socket, bytes = Buffer.alloc(0), source) {
    const state = socket.data;
    if (state.session.closed) return;
    if (source) state.source = source;
    const pending = state.pending.length ? Buffer.concat([state.pending, bytes]) : bytes;
    const sent = socket.write(pending);
    if (sent < 0) { close(state.session); return; }
    state.pending = pending.subarray(sent);
    if (state.pending.length > maxBufferedBytes) { close(state.session); return; }
    // Stop reading the peer while its destination is backpressured.
    // The fixed pending cap still rejects oversized/in-flight bursts.
    if (state.pending.length) state.source?.pause();
    else state.source?.resume();
  }
  function deny(session) {
    if (session.closed) return;
    session.client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  }
  async function establish(session, header) {
    try {
      const lines = header.split('\r\n');
      const request = /^CONNECT ([^ ]+) HTTP\/1\.[01]$/.exec(lines.shift());
      if (!request) throw Error('HTTPS CONNECT required');
      const hosts = [];
      for (const line of lines.filter(Boolean)) {
        const match = /^([A-Za-z0-9-]+):[ \t]*([^\r\n]*)$/.exec(line);
        if (!match) throw Error('Malformed proxy header');
        const name = match[1].toLowerCase(), value = match[2].trim();
        if (name === 'host') hosts.push(value);
        if (name === 'transfer-encoding' || (name === 'content-length' && value !== '0')) throw Error('Unexpected CONNECT body');
      }
      if (hosts.length > 1 || (hosts.length === 1 && hosts[0] !== request[1])) throw Error('Mismatched CONNECT host');
      const target = await authorizeTunnel({ authority: request[1], resolve, hostAddresses });
      if (session.closed) return;
      // Connect to the validated numeric address. No second DNS lookup or fallback.
      const upstream = await connect({ hostname: target.addresses[0], port: 443, data: { session, pending: Buffer.alloc(0) }, socket: {
        data: (socket, bytes) => flush(session.client, Buffer.from(bytes), socket),
        drain: socket => flush(socket),
        close: () => close(session), error: () => close(session), timeout: () => close(session),
      } });
      if (session.closed) { upstream.terminate(); return; }
      session.upstream = upstream; upstream.timeout(30);
      session.client.timeout(30);
      flush(session.client, Buffer.from('HTTP/1.1 200 Connection Established\r\n\r\n'));
      if (session.waiting.length) flush(upstream, session.waiting, session.client);
      session.waiting = Buffer.alloc(0);
    } catch (error) { console.error('proxy tunnel denied:', String(error.message).slice(0, 256)); deny(session); }
  }
  const listener = Bun.listen({ hostname: '::', port, data: undefined, socket: {
    open(client) {
      const session = { client, upstream: null, waiting: Buffer.alloc(0), header: Buffer.alloc(0), connecting: false, closed: false };
      client.data = { session, pending: Buffer.alloc(0) };
      sessions.add(session); client.timeout(5);
      if (sessions.size > 128) close(session);
    },
    data(client, bytes) {
      const session = client.data.session;
      if (session.closed) return;
      if (session.upstream) { flush(session.upstream, Buffer.from(bytes), client); return; }
      if (session.connecting) {
        session.waiting = Buffer.concat([session.waiting, bytes]);
        if (session.waiting.length > maxBufferedBytes) close(session);
        return;
      }
      session.header = Buffer.concat([session.header, bytes]);
      const end = session.header.indexOf('\r\n\r\n');
      if (session.header.length > 16384) { deny(session); return; }
      if (end < 0) return;
      session.connecting = true;
      session.waiting = session.header.subarray(end + 4);
      const header = session.header.subarray(0, end).toString('ascii');
      session.header = Buffer.alloc(0);
      void establish(session, header);
    },
    drain: socket => flush(socket),
    close: socket => close(socket.data.session), error: socket => close(socket.data.session), timeout: socket => close(socket.data.session),
  } });
  return { port: listener.port, stop() { for (const session of sessions) close(session); listener.stop(true); } };
}

if (import.meta.main) {
  if (process.argv.includes('--help')) console.log('Usage: proxy.js [--help]\nSide effects: binds TCP 3128; sends A/AAAA DNS only to fixed public resolvers; opens HTTPS tunnels only to inventory registry names after checking every answer. No files, credentials, host resolver or redirects followed. HTTP/direct-IP/non-443 destinations are denied; redirected clients must pass a new allowlist check. Limits: 128 tunnels, 16 KiB headers, 1 MiB pending per direction, 5s handshake/30s idle. Exit: 1 invalid fixed environment.');
  else {
    try { startProxy(proxyEnvironment(process.env)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
