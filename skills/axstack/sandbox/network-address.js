// Shared destination classification: never treat mapped/transition IPv6 as public.
export const deniedV4 = ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4'];
export const deniedV6 = ['2001::/23', '2001:db8::/32', '2002::/16', '3fff::/20'];

export function ipAddress(address) {
  if (typeof address !== 'string' || address.includes('%') || address.includes('/')) throw Error('Invalid IP address');
  if (/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(address)) {
    const bytes = address.split('.').map(Number);
    if (bytes.some(b => b > 255)) throw Error('Invalid IP address');
    return { version: 4, text: address, value: bytes.reduce((v, b) => (v << 8n) | BigInt(b), 0n) };
  }
  if (!/^[0-9a-fA-F:.]+$/.test(address) || !address.includes(':')) throw Error('Invalid IP address');
  let text;
  try { text = new URL(`http://[${address}]/`).hostname.slice(1, -1); } catch { throw Error('Invalid IP address'); }
  const halves = text.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  if (words.length !== 8) throw Error('Invalid IP address');
  return { version: 6, text, value: words.reduce((v, w) => (v << 16n) | BigInt(`0x${w}`), 0n) };
}

export function inSubnet(address, cidr) {
  const ip = ipAddress(address);
  const [base, bits] = cidr.split('/');
  const network = ipAddress(base);
  const shift = BigInt((ip.version === 4 ? 32 : 128) - Number(bits));
  return ip.version === network.version && ip.value >> shift === network.value >> shift;
}

export function publicDestination(address, hostAddresses = []) {
  try {
    const ip = ipAddress(address);
    if (hostAddresses.some(a => { const host = ipAddress(a); return ip.version === host.version && ip.value === host.value; })) return false;
    return ip.version === 4
      ? !deniedV4.some(cidr => inSubnet(address, cidr))
      : inSubnet(address, '2000::/3') && !deniedV6.some(cidr => inSubnet(address, cidr));
  } catch { return false; }
}
