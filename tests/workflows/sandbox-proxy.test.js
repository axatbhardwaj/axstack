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
