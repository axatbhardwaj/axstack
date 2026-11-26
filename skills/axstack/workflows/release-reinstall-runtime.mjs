import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { hostname } from 'node:os';
import { bindingMatches } from './binding.mjs';
import hostScript from './release-reinstall-host.sh' with { type: 'text' };

export const NAME = 'axstack-release-reinstall';
export const VERSION = 1;
export const IDENTITY = NAME + '@' + VERSION;
const routes = { io: 'xzat@io', iobook: 'iobook', iobox: 'xzat@iobox', iosatellite: 'xzat@iosatellite', 'axat-vps': 'local' };
export const hosts = Object.keys(routes);
const privatePaths = ['reinstallScript', 'globalBun', 'project', 'bun', 't3', 'roles', 'registryTokenFile'];
const abs = (path) => typeof path === 'string' && path.startsWith('/');
const versionPattern = 'v(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})';
const stable = new RegExp('^' + versionPattern + '$');
export const validVersion = (value) => typeof value === 'string' && stable.test(value);
const tarballOrigin = 'https://registry.npmjs.org';
const names = ['PATH', 'HOME', 'TMPDIR', 'SSH_AUTH_SOCK', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS'];

async function bytes(path, privateFile) {
  const info = await lstat(path);
  const mask = privateFile ? 0o077 : 0o022;
  if (!info.isFile() || (info.mode & mask) || info.uid !== process.getuid() ||
      info.size > 65_536 || path !== await realpath(path)) throw new Error('unavailable binding data');
  return readFile(path);
}

async function matches(want, data) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return bindingMatches(want, Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join(''));
}

const json = (input) => {
  try { return JSON.parse(input); } catch { return null; }
};

export async function readBinding(base) {
  try {
    const record = json(await bytes(base + '/.axstack-workflows.json', true))?.workflows?.[IDENTITY];
    if (!abs(record?.binding)) return null;
    const data = await bytes(record.binding, true);
    if (!await matches(record.bindingDigest, data)) return null;
    const binding = json(data);
    if (!binding || privatePaths.some((key) => !abs(binding[key])) || !/^\/[a-zA-Z0-9._/-]+$/.test(binding.globalBun) ||
        !binding.hosts || Object.keys(binding.hosts).length !== hosts.length ||
        hosts.some((id) => binding.hosts[id] !== routes[id]) ||
        typeof binding.localHostname !== 'string' || !/^[a-zA-Z0-9-]+$/.test(binding.localHostname) ||
        !Number.isInteger(binding.pollSeconds) || binding.pollSeconds < 0 || binding.pollSeconds > 60) return null;
    if (binding.localHostname !== hostname().split('.')[0]) return { wrongHost: true };
    const script = await bytes(binding.reinstallScript, false);
    if (!script.length || !await matches(binding.reinstallDigest, script)) return null;
    return { ...binding, script: script.toString('utf8') };
  } catch {
    return null;
  }
}

function command(program, args, { input, timeout = 15_000 } = {}) {
  const env = Object.fromEntries(names.filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]));
  return new Promise((resolve) => {
    const child = execFile(program, args, { env, cwd: '/', timeout, killSignal: 'SIGKILL', maxBuffer: 256 * 1024 },
      (error, stdout) => resolve(error ? { code: error.code } : { code: 0, stdout }));
    child.stdin?.on('error', () => {});
    child.stdin?.end(input);
  });
}

async function npmView(spec, field) {
  const { stdout } = await command('npm', ['view', spec, field, '--json', '--prefer-online', '--registry', tarballOrigin]);
  return json(stdout);
}

export async function latest(version) {
  const found = await npmView('axstack@latest', 'version');
  if (typeof found !== 'string' || !validVersion('v' + found)) return 'registry latest is unknown';
  const toNumber = (v) => v.slice(1).split('.').map(Number);
  const a = toNumber('v' + found);
  const b = toNumber(version);
  const diff = a.map((part, index) => part - b[index]).find((part) => part !== 0);
  if (diff > 0) return 'release is older than npm latest';
  if (diff < 0) return 'release is ahead of npm latest';
  return null;
}

export async function tarball(version) {
  const release = version.slice(1);
  const expected = tarballOrigin + '/axstack/-/axstack-' + release + '.tgz';
  const dist = await npmView('axstack@' + release, 'dist');
  if (dist?.tarball !== expected || typeof dist.integrity !== 'string' ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/.test(dist.integrity)) return { error: 'npm tarball metadata is unknown' };
  const { code, stdout } = await command('curl', ['--disable', '--silent', '--fail', '--proto', '=https',
    '--max-time', '10', '--range', '0-0', '--output', '/dev/null', '--write-out', '%{http_code}', expected]);
  return { available: code === 0 && ['200', '206'].includes(stdout.trim()) };
}

const quoted = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
const sshOptions = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=yes',
  '-o', 'ClearAllForwardings=yes', '-T'];

function result(stdout, release, host, action) {
  const fields = stdout.trim().split(' ');
  const [prefix, kind, ...data] = fields;
  if (prefix !== 'AXSTACK' || /[\n\r]/.test(stdout.trim())) return null;
  if (kind === 'hold' && data.length === 1 && ['unknown', 'busy', 'newer', 'readback', 'timer'].includes(data[0])) {
    return { state: data[0] };
  }
  if (kind === 'pending' && !data.length && action === 'probe') return { state: 'pending' };
  if (kind === 'failure' && data.length === 2 && data[0] === 'install' && /^[1-9][0-9]{0,2}$/.test(data[1]) &&
      action === 'apply') return { state: 'install-failed', exitCode: Number(data[1]) };
  if (kind === 'mismatch' && data.length === 9 && action === 'apply') return { state: 'verify-mismatch' };
  if (kind !== 'done' || data.length !== 9) return null;
  const [installed, packaged, packageSkills, defaultActive, defaultEnabled, singleActive, singleEnabled, dropIn, global] = data;
  const version = 'v' + installed;
  const packageVersion = 'v' + packaged;
  if (version !== release || packageVersion !== release || packageSkills !== 'present' ||
      defaultActive !== 'active' || defaultEnabled !== 'enabled' || singleActive !== 'active' || singleEnabled !== 'enabled' ||
      !['present', 'absent', 'unknown'].includes(dropIn) || global !== (host === 'axat-vps' ? installed : 'n/a')) return null;
  return { state: 'done', receipt: { version, packageVersion, packageSkills, dropIn,
    defaultSync: { active: defaultActive, enabled: defaultEnabled },
    singleServer: { active: singleActive, enabled: singleEnabled },
    ...(host === 'axat-vps' ? { bunGlobal: 'v' + global } : {}),
  } };
}

export async function hostRead(config, host, version, action) {
  const route = config.hosts[host];
  const local = route === 'local';
  const args = ['-s', '--', action, host, version.slice(1), ...(local ? [config.globalBun] : [])];
  const input = action === 'apply' ? 'reinstall=' + quoted(config.script) + '\n' + hostScript : hostScript;
  const { code, stdout } = local ? await command('bash', args, { input, timeout: 300_000 }) :
    await command('ssh', [...sshOptions, route, 'bash ' + args.join(' ')], { input, timeout: 300_000 });
  if (code !== 0) return { state: code === 255 ? 'unreachable' : 'unknown-transport' };
  return result(stdout, version, host, action) ?? { state: 'unknown-transport' };
}
