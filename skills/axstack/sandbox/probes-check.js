import { readlink } from 'node:fs/promises';
import { execute } from './probes-exec.js';
import { udpSnapshot, udpDenial, udpProbePort } from './probes-udp.js';

const loopback = (address) => /^127\./.test(address) || address === '::1';

/** Inspect every process returned by Docker top, including pid 1, without image tools. */
export function inspectIdentity(statuses) {
  if (!statuses.length) return { status: 'unknown', evidence: ['no live process statuses'] };
  let failed = false;
  for (const text of statuses) {
    const uid = text.match(/^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/m);
    const caps = ['CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb'].map((field) => text.match(new RegExp(`^${field}:\\s+([a-fA-F0-9]+)\\s*$`, 'm')));
    const nnp = text.match(/^NoNewPrivs:\s+([01])\s*$/m);
    if (!uid || caps.some((c) => !c) || !nnp) return { status: 'unknown', evidence: ['missing process security fields'] };
    if (uid.slice(1).some((id) => Number(id) === 0) || caps.some((c) => BigInt(`0x${c[1]}`) !== 0n) || nnp[1] !== '1') failed = true;
  }
  return { status: failed ? 'fail' : 'pass', evidence: statuses };
}

/** A connected socket is reachable even if TLS/HTTP fails after connection. */
export function classifyConnection(result, target, expected) {
  const unknown = () => ({ status: 'unknown', evidence: [JSON.stringify(result)] });
  if (result.timedOut || result.truncated) return unknown();
  // A socket to loopback in the container cannot identify a host listener.
  // Prove distinct live network namespaces instead of probing the wrong endpoint.
  if (loopback(target.address)) {
    const { hostNetworkNamespace: host, containerNetworkNamespace: container } = result;
    if (!/^net:\[\d+\]$/.test(host) || !/^net:\[\d+\]$/.test(container)) return unknown();
    return { status: expected === 'deny' && host !== container ? 'pass' : 'fail', evidence: [JSON.stringify(result)] };
  }
  let reachable, retained = result;
  if (target.protocol === 'icmp') {
    if (![0, 1].includes(result.exitCode)) return unknown();
    reachable = result.exitCode === 0;
  } else if (target.protocol === 'udp' || target.kind === 'dns') {
    if (/status: (NOERROR|NXDOMAIN|REFUSED|SERVFAIL)/.test(result.stdout) && result.exitCode === 0) {
      reachable = target.kind === 'dns' ? /ANSWER:\s*[1-9]\d*/.test(result.stdout) : true;
    }
    else if (target.kind === 'dns' && result.exitCode === 9 && /no servers could be reached|timed out/.test(result.stdout)) reachable = false;
    else if (target.protocol === 'udp' && target.kind !== 'dns' && expected === 'deny' && result.exitCode === 9 &&
      (result.udpNoRoute === true || result.udpDenial?.sourcePort === udpProbePort && Number.isSafeInteger(result.udpDenial.before) && result.udpDenial.after === result.udpDenial.before + 1)) reachable = false;
    // Silence alone, a stale/missing counter or unrelated/noisy traffic proves nothing.
    else return unknown();
  } else {
    let output;
    try { output = JSON.parse(result.stdout); } catch { return unknown(); }
    retained = { ...result, stdout: JSON.stringify({ remote_ip: output.remote_ip, http_connect: output.http_connect, http_code: output.http_code }) };
    if (Number(output.http_connect) === 403) reachable = false;
    else if (output.remote_ip) reachable = true;
    else if ([6, 7, 28].includes(result.exitCode)) reachable = false;
    else return unknown();
  }
  return { status: reachable === (expected === 'allow') ? 'pass' : 'fail', evidence: [JSON.stringify(retained)] };
}

export function createProbeChecker({ runner = execute, readText = (path) => Bun.file(path).text(), readNamespace = readlink, readProxyConfig = () => Bun.file(new URL('./proxy-config.json', import.meta.url)).json() } = {}) {
async function liveContainer(id) {
  if (!/^[a-zA-Z0-9][\w.-]*$/.test(id)) throw Error('invalid container id');
  const result = await runner(['docker', 'inspect', '--type', 'container', id]);
  if (result.exitCode !== 0 || result.timedOut || result.truncated) throw Error('container inspect unavailable');
  const [container] = JSON.parse(result.stdout);
  if (!container?.State?.Running || !Number.isSafeInteger(container.State.Pid) || container.State.Pid < 2) throw Error('container not live');
  return container;
}

async function identity(id) {
  const container = await liveContainer(id);
  const top = await runner(['docker', 'top', id, '-eo', 'pid']);
  if (top.exitCode !== 0 || top.timedOut || top.truncated) throw Error('container process enumeration unavailable');
  const pids = top.stdout.trim().split('\n').slice(1).map((s) => Number(s.trim()));
  if (!pids.includes(container.State.Pid) || pids.some((pid) => !Number.isSafeInteger(pid) || pid < 2)) throw Error('incomplete process enumeration');
  const statuses = await Promise.all(pids.map((pid) => readText(`/proc/${pid}/status`)));
  const after = await liveContainer(id);
  const next = await runner(['docker', 'top', id, '-eo', 'pid']);
  if (after.State.Pid !== container.State.Pid || next.exitCode !== 0 || next.stdout !== top.stdout) throw Error('process set changed during identity probe');
  return inspectIdentity(statuses);
}

async function network(id, expected, target, proxyId) {
  if (!['allow', 'deny'].includes(expected)) throw Error('invalid expected outcome');
  const container = await liveContainer(id), pid = container.State.Pid;
  const start = await readText(`/proc/${pid}/stat`);
  if (loopback(target.address)) {
    const [hostNetworkNamespace, containerNetworkNamespace] = await Promise.all([readNamespace('/proc/self/ns/net'), readNamespace(`/proc/${pid}/ns/net`)]);
    if ((await liveContainer(id)).State.Pid !== pid) throw Error('container replaced during namespace observation');
    return classifyConnection({ hostNetworkNamespace, containerNetworkNamespace }, target, expected);
  }
  const prefix = ['nsenter', '--target', String(pid), '--net', '--', 'setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', '--bounding-set=-all', '--inh-caps=-all', '--ambient-caps=-all', '--no-new-privs', '--'];
  const udpDenied = target.protocol === 'udp' && target.kind !== 'dns' && expected === 'deny';
  const noRoute = async () => {
    const r = await runner([...prefix, 'ip', '-j', ...(target.address.includes(':') ? ['-6'] : ['-4']), 'route', 'get', target.address]);
    return r.exitCode === 2 && !r.timedOut && !r.truncated && /RTNETLINK answers: Network is unreachable/.test(r.stderr);
  };
  // A disconnected namespace cannot hit a bridge's drop counter. A fresh kernel
  // ENETUNREACH before and after the datagram is positive absence-of-path proof.
  const routeAbsent = udpDenied && await noRoute();
  const udpBefore = udpDenied && !routeAbsent ? await udpSnapshot(container, runner) : null;
  let argv, resolution;
  if (target.protocol === 'icmp') {
    argv = ['ping', '-n', '-c', '1', '-W', '2', target.address];
  } else if (target.kind === 'dns' || target.protocol === 'udp') {
    const resolver = target.kind === 'dns' ? target.id.includes('-stub:') ? '127.0.0.11' : target.id.startsWith('tailnet-dns:') ? '100.100.100.100' : (await readProxyConfig()).resolverIpv4 : target.address;
    argv = ['dig', ...(udpBefore ? ['-b', `${target.address.includes(':') ? '::' : '0.0.0.0'}#${udpProbePort}`] : []), `@${resolver}`, '-p', String(target.port ?? 53), '+time=2', '+tries=1', target.protocol === 'tcp' ? '+tcp' : '+notcp', target.kind === 'dns' ? target.address : 'example.com', 'A'];
  } else {
    const host = target.address.includes(':') ? `[${target.address}]` : target.address;
    argv = ['curl', '--silent', '--show-error', '--insecure', '--connect-timeout', '2', '--max-time', '4', '--location', '--max-redirs', '5', '--output', '/dev/null', '--write-out', '{"remote_ip":"%{remote_ip}","http_connect":"%{http_connect}","http_code":"%{http_code}"}', '--noproxy', '*'];
    if (proxyId) {
      const proxy = await liveContainer(proxyId);
      const peers = Object.entries(proxy.NetworkSettings.Networks).filter(([name]) => container.NetworkSettings.Networks[name]);
      const address = peers[0]?.[1]?.IPAddress;
      const config = await readProxyConfig();
      if (!address || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw Error('proxy endpoint unavailable');
      argv.splice(-2, 2, '--noproxy', '', '--proxy', `http://${address}:${config.port}`, '--proxytunnel');
    }
    if (!proxyId && !target.address.includes(':') && !/^(?:\d+\.){3}\d+$/.test(target.address)) {
      const config = await readProxyConfig();
      if (!/^(?:\d+\.){3}\d+$/.test(config.resolverIpv4)) throw Error('fixed public resolver unavailable');
      resolution = await runner([...prefix, 'dig', `@${config.resolverIpv4}`, '+time=2', '+tries=1', '+short', target.address, 'A']);
      const answers = resolution.stdout.trim().split(/\s+/).filter((address) => /^(?:\d+\.){3}\d+$/.test(address) && address.split('.').every((part) => Number(part) <= 255));
      if (resolution.exitCode !== 0 || resolution.timedOut || resolution.truncated || !answers.length) return classifyConnection(resolution, { ...target, kind: 'dns', protocol: 'udp' }, expected);
      argv.push('--resolve', `${target.address}:${target.port ?? 443}:${answers.join(',')}`);
    }
    argv.push(`${target.port === 80 ? 'http' : 'https'}://${host}:${target.port ?? 443}/`);
  }
  const result = { udpDenial: null, udpNoRoute: false, ...await runner([...prefix, ...argv]), ...(resolution ? { dns: resolution } : {}) };
  const after = await liveContainer(id);
  if (after.State.Pid !== pid || await readText(`/proc/${pid}/stat`) !== start) {
    // /proc stat CPU counters may advance; compare start-time field, not all bytes.
    const ticks = (text) => text.slice(text.lastIndexOf(')') + 2).split(' ')[19];
    if (after.State.Pid !== pid || ticks(await readText(`/proc/${pid}/stat`)) !== ticks(start)) throw Error('container process replaced');
  }
  if (routeAbsent) result.udpNoRoute = await noRoute();
  if (udpBefore) {
    try { result.udpDenial = udpDenial(udpBefore, await udpSnapshot(await liveContainer(id), runner)); }
    catch (error) { return { status: 'unknown', evidence: [JSON.stringify(result), String(error)] }; }
  }
  return classifyConnection(result, target, expected);
}

return { identity, network };
}

const checker = createProbeChecker();

if (import.meta.main) {
  const [mode, id, expected, raw, proxyId] = Bun.argv.slice(2);
  if (mode === '--help') {
    console.log('Usage: bun probes-check.js identity CONTAINER | network CONTAINER allow|deny TARGET_JSON [PROXY_CONTAINER]\nTrusted synthetic probes only. Reads Docker inspect/top and /proc; starts bounded docker, nsenter, setpriv, curl/dig/ping processes; temporarily enters the container network namespace only; drops user/capabilities before sockets. Reads fresh owned UDP drop counters around reserved-source-port denial datagrams; fresh kernel no-route readback handles disconnected namespaces; silence alone stays unknown. No mounts, files, rules or containers created. No cleanup assets. Requires host root, Docker, util-linux, curl, dnsutils and iputils-ping. Outputs one pass/fail/unknown term; grants no authority. Exit 0 facts, 1 invalid input, 2 incomplete.');
  } else {
    let result;
    try {
      if (mode === 'identity') result = await checker.identity(id);
      else if (mode === 'network') result = await checker.network(id, expected, JSON.parse(raw), proxyId);
      else throw Error('invalid probe mode; use --help');
    } catch (error) { result = { status: 'unknown', evidence: [String(error)] }; }
    console.log(JSON.stringify(result));
    if (result.status === 'unknown') process.exitCode = 2;
  }
}
