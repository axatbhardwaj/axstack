import config from './proxy-config.json';

function question(hostname, type, id) {
  const labels = hostname.split('.');
  if (hostname.length > 253 || labels.some(label => !/^[a-z0-9-]{1,63}$/.test(label))) throw Error('Invalid DNS name');
  const bytes = Buffer.from(labels.flatMap(label => [label.length, ...Buffer.from(label)]));
  const packet = Buffer.alloc(12 + bytes.length + 5);
  packet.writeUInt16BE(id, 0); packet.writeUInt16BE(0x100, 2); packet.writeUInt16BE(1, 4);
  bytes.copy(packet, 12); packet.writeUInt16BE(type, packet.length - 4); packet.writeUInt16BE(1, packet.length - 2);
  return packet;
}

// Follow compression pointers only to earlier packet positions; bounds and cycles fail closed.
function nameAt(packet, start) {
  const labels = [];
  let cursor = start;
  let end;
  for (let count = 0; count < 128; count++) {
    if (cursor >= packet.length) throw Error('Truncated DNS name');
    const length = packet[cursor++];
    if (length === 0) return { name: labels.join('.').toLowerCase(), end: end ?? cursor };
    if ((length & 0xc0) === 0xc0) {
      if (cursor >= packet.length) throw Error('Truncated DNS pointer');
      const pointer = ((length & 0x3f) << 8) | packet[cursor++];
      if (pointer >= cursor - 2) throw Error('Invalid DNS pointer');
      end ??= cursor; cursor = pointer;
    } else {
      if (length > 63 || cursor + length > packet.length) throw Error('Invalid DNS label');
      labels.push(packet.subarray(cursor, cursor + length).toString('ascii')); cursor += length;
    }
  }
  throw Error('DNS compression loop');
}

export function parseDnsAnswer(packet, query) {
  if (packet.length < 12 || packet.readUInt16BE(0) !== query.readUInt16BE(0)) throw Error('Wrong DNS transaction');
  const flags = packet.readUInt16BE(2);
  if ((flags & 0xfa0f) !== 0x8000 || packet.readUInt16BE(4) !== 1) throw Error('DNS error or truncated response');
  const expected = nameAt(query, 12);
  const questionName = nameAt(packet, 12);
  if (questionName.name !== expected.name || !packet.subarray(questionName.end, questionName.end + 4).equals(query.subarray(expected.end, expected.end + 4))) throw Error('Wrong DNS question');
  const type = query.readUInt16BE(expected.end);
  let offset = questionName.end + 4;
  const records = [];
  const answers = packet.readUInt16BE(6), authorities = packet.readUInt16BE(8);
  const count = answers + authorities;
  const zones = [];
  if (count > 256) throw Error('Oversized DNS answer');
  for (let i = 0; i < count; i++) {
    const owner = nameAt(packet, offset); offset = owner.end;
    if (offset + 10 > packet.length) throw Error('Truncated DNS record');
    const kind = packet.readUInt16BE(offset), klass = packet.readUInt16BE(offset + 2), size = packet.readUInt16BE(offset + 8);
    offset += 10;
    if (offset + size > packet.length || klass !== 1) throw Error('Invalid DNS record');
    if (i >= answers && kind === 6) {
      const primary = nameAt(packet, offset), contact = nameAt(packet, primary.end);
      if (contact.end + 20 !== offset + size) throw Error('Invalid DNS SOA');
      zones.push(owner.name);
    }
    if ((kind === 1 && size !== 4) || (kind === 28 && size !== 16)) throw Error('Invalid DNS address length');
    let address;
    if (kind === 1 && size === 4) address = [...packet.subarray(offset, offset + size)].join('.');
    else if (kind === 28 && size === 16) address = Array.from({ length: 8 }, (_, i) => packet.readUInt16BE(offset + i * 2).toString(16)).join(':');
    else if (kind === 5) {
      const cname = nameAt(packet, offset);
      if (cname.end !== offset + size) throw Error('Invalid DNS CNAME');
      records.push({ owner: owner.name, cname: cname.name });
    }
    if (i < answers && kind === type && address) records.push({ owner: owner.name, address });
    offset += size;
  }
  const reachable = new Set([expected.name]);
  for (let i = 0; i <= records.length; i++) for (const record of records) if (record.cname && reachable.has(record.owner)) reachable.add(record.cname);
  const addresses = records.filter(record => record.address && reachable.has(record.owner)).map(record => record.address);
  if (!addresses.length) {
    let terminal = expected.name;
    const seen = new Set();
    while (records.some(record => record.owner === terminal && record.cname)) {
      if (seen.has(terminal)) throw Error('DNS alias cycle');
      seen.add(terminal);
      const aliases = records.filter(record => record.owner === terminal && record.cname);
      if (aliases.length !== 1) throw Error('Ambiguous DNS alias');
      terminal = aliases[0].cname;
    }
    if (!zones.some(zone => terminal === zone || terminal.endsWith(`.${zone}`))) throw Error('Incomplete DNS NODATA answer');
  }
  return addresses;
}

async function udpExchange(packet, resolver) {
  return new Promise((resolve, reject) => {
    let socket;
    let done = false;
    const finish = (error, response) => { if (done) return; done = true; clearTimeout(timer); socket?.close(); if (error) reject(error); else resolve(response); };
    const timer = setTimeout(() => finish(Error('Fixed public DNS timed out')), 3000);
    Bun.udpSocket({ connect: { hostname: resolver, port: 53 }, socket: {
      data: (_socket, bytes) => finish(null, Buffer.from(bytes)),
      error: (_socket, error) => finish(error),
    } }).then(opened => { socket = opened; if (done) socket.close(); else if (!socket.send(packet)) finish(Error('DNS send failed')); }, error => finish(error));
  });
}

export async function resolveRegistry(hostname, { exchange = udpExchange } = {}) {
  // Both families must be known. Never fall back to libc, Docker DNS or tailnet DNS.
  const answers = await Promise.all([1, 28].map(async type => {
    const query = question(hostname, type, crypto.getRandomValues(new Uint16Array(1))[0]);
    let lastError;
    for (const resolver of [config.resolverIpv4, config.resolverIpv6]) {
      try { return parseDnsAnswer(await exchange(query, resolver), query); } catch (error) { lastError = error; }
    }
    throw lastError;
  }));
  return answers.flat();
}
