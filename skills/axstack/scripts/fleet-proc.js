// Linux aggregate CPU counters; guest/guest_nice are already in user/nice.
const malformed = () => { throw Error('malformed'); };
const bp = (n, d) => Number((n * 10000n + d - 1n) / d);
export function parseProc(value) {
  if (typeof value !== 'string' || value.length > 65536) malformed();
  const parts = value.split('\n---AXSTACK-MEM---\n');
  if (parts.length !== 2) malformed();
  const lines = parts[0].split('\n').filter((s) => /^cpu\s/.test(s));
  if (lines.length !== 1) malformed();
  const counters = lines[0].trim().split(/\s+/).slice(1);
  if (counters.length < 8 || counters.length > 10
    || counters.some((v) => !/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)))) malformed();
  const memory = (key) => {
    const rows = parts[1].split('\n').filter((s) => s.startsWith(`${key}:`));
    const match = rows.length === 1 && rows[0].match(new RegExp(`^${key}:\\s+(\\d+) kB\\s*$`));
    if (!match || !Number.isSafeInteger(Number(match[1]))) malformed();
    return BigInt(match[1]);
  };
  const total = memory('MemTotal'); const available = memory('MemAvailable');
  if (total <= 0n || available > total) malformed();
  return { counters: counters.slice(0, 8).map(BigInt), total, used: total - available };
}

export function pressure(first, last) {
  const deltas = last.counters.map((v, i) => v - first.counters[i]);
  const total = deltas.reduce((a, b) => a + b, 0n);
  if (deltas.some((v) => v < 0n) || total <= 0n || first.total !== last.total) throw Error('inconsistent-counters');
  const busy = total - deltas[3] - deltas[4]; // idle and iowait only; steal is busy.
  return { cpuBp: bp(busy, total), ramBp: bp(first.used + last.used, 2n * last.total),
    ramLatestBp: bp(last.used, last.total) };
}
