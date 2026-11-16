import { expect, test } from 'bun:test';
import { authorizeTunnel } from '../../skills/axstack/sandbox/proxy-policy.js';
import { startProxy } from '../../skills/axstack/sandbox/proxy.js';
import { resolveRegistry } from '../../skills/axstack/sandbox/proxy-dns.js';

test('proxy rejects arbitrary hosts, direct IP, port bypasses, and the second connection after an allowed redirect', async () => {
  let queries = 0;
  const resolve = async () => { queries++; return ['104.16.26.34']; };
  expect((await authorizeTunnel({ authority: 'registry.npmjs.org:443', resolve, hostAddresses: ['2a01:4f8::17'] })).addresses).toEqual(['104.16.26.34']);
  for (const authority of ['evil.example:443', '104.16.26.34:443', 'registry.npmjs.org.evil.example:443', 'registry.npmjs.org:22', 'registry.npmjs.org.:443', 'user@registry.npmjs.org:443', '[::1]:443']) {
    await expect(authorizeTunnel({ authority, resolve, hostAddresses: [] })).rejects.toThrow();
  }
  expect(queries).toBe(1);
});

function request(port, text) {
  return new Promise((resolve, reject) => {
    let received = '';
    Bun.connect({ hostname: '127.0.0.1', port, socket: {
      open(socket) { socket.timeout(2); socket.write(text); },
      data(socket, bytes) { received += bytes.toString(); if (received.includes('\r\n\r\n')) { socket.end(); resolve(received); } },
      error: (_socket, error) => reject(error), timeout(socket) { socket.end(); reject(Error('test client timeout')); },
    } }).catch(reject);
  });
}

test('real CONNECT listener denies a redirect connection and never resolves or connects to its destination', async () => {
  const connects = [];
  const upstream = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data(socket, bytes) { socket.write(bytes); } } });
  const server = startProxy({ port: 0, hostAddresses: ['127.0.0.1'], resolve: async () => ['104.16.26.34'], connect: options => {
    connects.push([options.hostname, options.port]);
    return Bun.connect({ ...options, hostname: '127.0.0.1', port: upstream.port });
  } });
  try {
    expect(await request(server.port, 'CONNECT registry.npmjs.org:443 HTTP/1.1\r\nHost: registry.npmjs.org:443\r\n\r\n')).toContain('200 Connection Established');
    expect(await request(server.port, 'CONNECT evil.example:443 HTTP/1.1\r\nHost: evil.example:443\r\n\r\n')).toContain('403 Forbidden');
    expect(await request(server.port, 'GET http://registry.npmjs.org/redirect HTTP/1.1\r\nHost: registry.npmjs.org\r\n\r\n')).toContain('403 Forbidden');
    expect(connects).toEqual([['104.16.26.34', 443]]);
  } finally { server.stop(true); upstream.stop(true); }
});

test('fixed DNS rejects malformed address records instead of silently treating the family as absent', async () => {
  const seen = [];
  const exchange = async (query, resolver) => {
    seen.push(resolver);
    const response = Buffer.concat([query, Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 60, 0, 0])]);
    response.writeUInt16BE(0x8180, 2); response.writeUInt16BE(1, 6);
    return response;
  };
  await expect(resolveRegistry('registry.npmjs.org', { exchange })).rejects.toThrow();
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every(resolver => ['1.1.1.1', '2606:4700:4700::1111'].includes(resolver))).toBe(true);
});

test('every A and AAAA answer is checked and validated addresses are pinned per tunnel', async () => {
  for (const address of ['127.0.0.1', '10.8.1.1', '172.17.0.2', '192.168.1.1', '100.100.100.100', '169.254.169.254', '0.0.0.0', '224.0.0.1', '::1', 'fd7a:115c:a1e0::1', 'fe80::1', '::ffff:7f00:1', '2002:7f00:1::', '2001::1', '2a01:4f8::17']) {
    await expect(authorizeTunnel({ authority: 'registry.npmjs.org:443', resolve: async () => ['104.16.26.34', address], hostAddresses: ['2a01:4f8::17'] })).rejects.toThrow();
  }
  let calls = 0;
  const resolved = await authorizeTunnel({ authority: 'registry.npmjs.org:443', resolve: async () => { calls++; return ['104.16.26.34', '2606:4700::6810:1a22']; }, hostAddresses: [] });
  expect(calls).toBe(1);
  expect(resolved.addresses).toEqual(['104.16.26.34', '2606:4700::6810:1a22']);
  await expect(authorizeTunnel({ authority: 'registry.npmjs.org:443', resolve: async () => [], hostAddresses: [] })).rejects.toThrow();
});

test('proxy denial logs retain the bounded diagnostic without logging CONNECT headers', async () => {
  const messages = [], original = console.error;
  console.error = (...parts) => messages.push(parts.join(' '));
  const server = startProxy({ port: 0, hostAddresses: [], resolve: async () => { throw Error('synthetic DNS failure'); } });
  try {
    expect(await request(server.port, 'CONNECT registry.npmjs.org:443 HTTP/1.1\r\nX-Secret: hidden\r\n\r\n')).toContain('403 Forbidden');
    expect(messages.join(' ')).toContain('synthetic DNS failure');
    expect(messages.join(' ')).not.toContain('hidden');
  } finally { server.stop(); console.error = original; }
});

test('fixed DNS accepts an authoritative alias NODATA family while incomplete aliases still hold', async () => {
  const name = value => Buffer.from([...value.split('.').flatMap(label => [label.length, ...Buffer.from(label)]), 0]);
  const rr = (owner, type, data) => {
    const header = Buffer.alloc(10); header.writeUInt16BE(type, 0); header.writeUInt16BE(1, 2); header.writeUInt16BE(data.length, 8);
    return Buffer.concat([name(owner), header, data]);
  };
  for (const authority of [true, false]) {
    const exchange = async query => {
      const v6 = query.readUInt16BE(query.length - 4) === 28;
      const answer = rr('registry.npmjs.org', v6 ? 5 : 1, v6 ? name('cdn.example.com') : Buffer.from([104, 16, 26, 34]));
      const soa = rr('example.com', 6, Buffer.concat([name('ns.example.com'), name('hostmaster.example.com'), Buffer.alloc(20)]));
      const response = Buffer.concat([query, answer, ...(v6 && authority ? [soa] : [])]);
      response.writeUInt16BE(0x8180, 2); response.writeUInt16BE(1, 6); response.writeUInt16BE(v6 && authority ? 1 : 0, 8);
      return response;
    };
    if (authority) expect(await resolveRegistry('registry.npmjs.org', { exchange })).toEqual(['104.16.26.34']);
    else await expect(resolveRegistry('registry.npmjs.org', { exchange })).rejects.toThrow();
  }
});

test('large allowed tunnels preserve bytes under backpressure including upstream EOF', async () => {
 for (const finish of [false, true]) {
  const total = 16 * 1024 * 1024, chunk = Buffer.alloc(65536, 0x61);
  const send = socket => {
    if (socket.data.sent < total) {
      const bytes = chunk.subarray(0, Math.min(chunk.length, total - socket.data.sent));
      const count = socket.write(bytes); if (count < 0) return;
      socket.data.sent += count; if (count < bytes.length) return;
      setTimeout(() => send(socket), 1); return;
    }
    if (finish && !socket.data.ended) { socket.data.ended = true; socket.end(); }
  };
  const upstream = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: {
    open(socket) { socket.data = { sent: 0 }; }, data: send, drain: send,
  } });
  const server = startProxy({ port: 0, hostAddresses: [], resolve: async () => ['104.16.26.34'], connect: options => Bun.connect({ ...options, hostname: '127.0.0.1', port: upstream.port }) });
  let client, timer;
  try {
    const received = await new Promise((resolve, reject) => {
      let header = Buffer.alloc(0), headers = true, bytes = 0;
      timer = setTimeout(() => reject(Error(`transfer timed out after ${bytes} bytes`)), 3000);
      Bun.connect({ hostname: '127.0.0.1', port: server.port, socket: {
        open(socket) { client = socket; socket.write('CONNECT registry.npmjs.org:443 HTTP/1.1\r\n\r\n'); },
        data(socket, data) {
          if (headers) {
            header = Buffer.concat([header, data]);
            const end = header.indexOf('\r\n\r\n');
            if (end < 0) return;
            expect(header.subarray(0, end).toString()).toContain('200 Connection Established');
            data = header.subarray(end + 4); headers = false;
            socket.pause(); socket.write('start'); setTimeout(() => socket.resume(), 250);
          }
          expect(data.every(byte => byte === 0x61)).toBe(true);
          bytes += data.length; if (bytes === total) resolve(bytes);
        }, close() { resolve(bytes); }, error(_socket, error) { reject(error); },
      } }).catch(reject);
    });
    expect(received).toBe(total);
  } finally { clearTimeout(timer); client?.terminate(); server.stop(); upstream.stop(true); }
 }
}, 8000);


test('EOF drains both directions before ending the peer; errors still terminate', async () => {
  for (const fromClient of [false, true]) {
    let handlers, upstreamHandlers;
    const peer = () => ({ data: {}, capacity: Infinity, bytes: [], ended: false, terminated: false,
      write(bytes) { const n = Math.min(this.capacity, bytes.length); this.bytes.push(Buffer.from(bytes.subarray(0, n))); return n; },
      end() { this.ended = true; }, terminate() { this.terminated = true; }, timeout() {}, pause() {}, resume() {},
    });
    const client = peer(), upstream = peer();
    const proxy = startProxy({ port: 0, hostAddresses: [], resolve: async () => ['104.16.26.34'],
      listen(options) { handlers = options.socket; return { port: 0, stop() {} }; },
      async connect(options) { upstreamHandlers = options.socket; upstream.data = options.data; return upstream; },
    });
    try {
      handlers.open(client);
      handlers.data(client, Buffer.from('CONNECT registry.npmjs.org:443 HTTP/1.1\r\n\r\n'));
      await Bun.sleep(0);
      const source = fromClient ? client : upstream, destination = fromClient ? upstream : client;
      const sourceHandlers = fromClient ? handlers : upstreamHandlers, destinationHandlers = fromClient ? upstreamHandlers : handlers;
      destination.bytes = []; destination.capacity = 3;
      sourceHandlers.data(source, Buffer.from('complete registry transfer'));
      sourceHandlers.end?.(source); sourceHandlers.close(source);
      expect(destination.terminated).toBe(false); expect(destination.ended).toBe(false);
      destination.capacity = Infinity; destinationHandlers.drain(destination);
      expect(Buffer.concat(destination.bytes).toString()).toBe('complete registry transfer');
      expect(destination.ended).toBe(true);
      destinationHandlers.error(destination, Error('transport failed'));
      expect(destination.terminated).toBe(true);
    } finally { proxy.stop(); }
  }
});

test('disconnect during asynchronous connection cannot leave an orphan upstream socket', async () => {
  let handlers, release;
  const socket = () => ({ data: {}, terminated: false, write: bytes => bytes.length, end() {}, terminate() { this.terminated = true; }, timeout() {}, pause() {}, resume() {} });
  const client = socket(), upstream = socket();
  const proxy = startProxy({ port: 0, hostAddresses: [], resolve: async () => ['104.16.26.34'],
    listen(options) { handlers = options.socket; return { port: 0, stop() {} }; },
    connect(options) { upstream.data = options.data; return new Promise(resolve => { release = () => resolve(upstream); }); },
  });
  try {
    handlers.open(client); handlers.data(client, Buffer.from('CONNECT registry.npmjs.org:443 HTTP/1.1\r\n\r\n'));
    await Bun.sleep(0); handlers.close(client); release(); await Bun.sleep(0);
    expect(upstream.terminated).toBe(true);
  } finally { proxy.stop(); }
});
