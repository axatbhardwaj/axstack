// dependabot-runtime.mjs
import { execFile } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";

// ../scripts/t3-workflow-read.js
var t3_workflow_read_default = `import { lstatSync } from 'node:fs';

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
    const socket = new WebSocket(url, { headers: { Authorization: \`Bearer \${token}\` } });
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
`;

// binding.mjs
function bindingMatches(expected, actual) {
  return typeof expected === "string" && /^[a-f0-9]{64}$/.test(expected) && expected === actual;
}

// dependabot-runtime.mjs
var baseEnvironment = ["PATH", "HOME", "TMPDIR"];
var forgeEnvironment = ["XDG_CONFIG_HOME", "GH_CONFIG_DIR", "GH_TOKEN", "GITHUB_TOKEN"];
function run(program, args, { cwd, input, forge = false } = {}) {
  const names = forge ? [...baseEnvironment, ...forgeEnvironment] : baseEnvironment;
  const env = Object.fromEntries(names.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  return new Promise((resolve) => {
    const child = execFile(program, args, { cwd, env, timeout: 30000, maxBuffer: 8 * 1024 * 1024, killSignal: "SIGKILL" }, (error, stdout) => resolve(error ? null : stdout));
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
}
var json = (bytes) => {
  try {
    return JSON.parse(bytes);
  } catch {
    return null;
  }
};
var rpcScript = t3_workflow_read_default + `
const [origin, tokenPath, method, threadId] = Bun.argv.slice(1);
console.log(JSON.stringify(await readWorkflowRpc(origin, tokenPath, method, threadId ? { threadId } : {})));
`;
async function runtimeRpc(binding, origin, method, threadId) {
  if (typeof origin !== "string")
    return null;
  return json(await run(binding.bun, [
    "--no-env-file",
    "-e",
    rpcScript,
    origin,
    binding.registryTokenFile,
    method,
    ...threadId ? [threadId] : []
  ]));
}
function roleSelection(snapshot, catalog) {
  const roles = snapshot?.version === 1 && snapshot.roles?.filter((candidateRole) => candidateRole.id === "axstack-owner");
  if (!roles || roles.length !== 1 || !Array.isArray(catalog))
    return null;
  const [role] = roles;
  const codex = role.provider === "codex" && role.modeId === "full-access";
  const claude = role.provider === "claude" && role.modeId === "bypassPermissions";
  if (!codex && !claude)
    return null;
  const instanceId = codex ? "codex" : "claudeAgent";
  const instances = catalog.filter((entry) => entry.instanceId === instanceId && entry.driver === instanceId);
  const [instance] = instances;
  if (instances.length !== 1 || !instance.enabled || !instance.installed || ["error", "disabled"].includes(instance.status) || instance.availability === "unavailable" || instance.supportsTextGeneration === false || instance.supportedRuntimeModes && !instance.supportedRuntimeModes.includes("full-access"))
    return null;
  const safeClass = typeof role.modelClass === "string" && /^[a-z]+$/.test(role.modelClass);
  const family = !safeClass ? null : codex ? new RegExp(`^gpt-([0-9]+(?:\\.[0-9]+)*)-${role.modelClass}$`) : new RegExp(`^claude-${role.modelClass}-([0-9]+-[0-9]+)$`);
  const models = instance.models.filter((candidateModel) => candidateModel.supportsTextGeneration !== false && (role.model ? candidateModel.slug === role.model : family?.test(candidateModel.slug)));
  const [model] = models.sort((a, b) => b.slug.localeCompare(a.slug, "en", { numeric: true }));
  const id = codex ? "reasoningEffort" : "effort";
  const descriptor = model?.capabilities?.optionDescriptors?.find((item) => item.id === id);
  if (!descriptor?.options?.some((option) => option.id === role.thinkingOptionId))
    return null;
  return {
    model: { instanceId, model: model.slug, options: [{ id, value: role.thinkingOptionId }] },
    runtimeMode: "full-access"
  };
}
async function ownerBinding(base, binding) {
  try {
    const [roles, state] = await Promise.all([
      readFile(binding.roles, "utf8"),
      readFile(base + "/userdata/server-runtime.json", "utf8")
    ]);
    const { origin, pid, startedAt } = json(state);
    const apiConfig = await runtimeRpc(binding, origin, "server.getConfig");
    const after = json(await readFile(base + "/userdata/server-runtime.json", "utf8"));
    if (after?.pid !== pid || after?.startedAt !== startedAt || after?.origin !== origin)
      return null;
    return roleSelection(json(roles), apiConfig?.providers);
  } catch {
    return null;
  }
}
var identifier = /^[A-Za-z0-9_-]+$/;
var validId = (value) => typeof value === "string" && identifier.test(value);
async function driverReadback(base, binding, expected, worktree, threadId, { exclusive = false } = {}) {
  if (typeof threadId !== "string" || !/^[A-Za-z0-9:_-]{1,160}$/.test(threadId))
    return null;
  const loadRuntime = async () => json(await readFile(base + "/userdata/server-runtime.json", "utf8").catch(() => null));
  const state = await loadRuntime();
  if (!state?.origin || !state.pid || !state.startedAt)
    return null;
  const [view, projection] = await Promise.all([
    run(binding.t3, ["thread", "show", "--base-dir", base, threadId, "--messages", "12", "--json"]),
    runtimeRpc(binding, state.origin, "orchestration.getThreadProjection", threadId)
  ]);
  const observed = json(view);
  const thread = observed?.thread;
  const observedRuntime = await loadRuntime();
  if (observedRuntime?.pid !== state.pid || observedRuntime.startedAt !== state.startedAt || observedRuntime.origin !== state.origin || projection?.thread?.id !== threadId || projection.thread.runtimeMode !== expected.runtimeMode)
    return null;
  const model = projection.thread.modelSelection;
  const desired = expected.model;
  if (thread?.threadId !== threadId || thread.status !== "completed" || thread.archived !== false || thread.pinned !== false || thread.createdBy !== "system" || thread.creationSource !== "server" || thread.worktreePath !== worktree || thread.providerInstanceId !== desired.instanceId || thread.model !== desired.model || thread.runtimeMode !== expected.runtimeMode || model?.instanceId !== desired.instanceId || model.model !== desired.model || !Array.isArray(model.options) || model.options.length !== desired.options.length || !desired.options.every((option) => model.options.some((item) => item.id === option.id && item.value === option.value)))
    return null;
  if (exclusive) {
    const threads = json(await run(binding.t3, ["thread", "list", "--base-dir", base, "--project", binding.project, "--json"]));
    if (!Array.isArray(threads))
      return null;
    const attached = threads.filter((item) => item?.worktreePath === worktree);
    if (attached.length !== 1 || attached[0].threadId !== threadId)
      return null;
  }
  return observed;
}

// release-reinstall-claims.mjs
var records = (host, release) => [
  T3.store.entry("release-reinstall:host:" + host, Schema.Json),
  T3.store.entry("release-reinstall:release:" + release + ":" + host, Schema.Json)
];
var matches = (entry, runId, release) => entry?.run === runId && entry.release === release;
function acquire(host, release, runId) {
  const [lease, operation] = records(host, release);
  return T3.store.transaction(Effect.gen(function* () {
    const owner = Option.getOrElse(yield* lease.get, () => null);
    const prior = Option.getOrElse(yield* operation.get, () => null);
    if (owner !== null) {
      if (!matches(owner, runId, release))
        return "claimed";
      if (!matches(prior, runId, release) || prior.phase !== owner.phase || !["reading", "writing"].includes(owner.phase))
        return "claim-unknown";
      return owner.phase;
    }
    if (matches(prior, runId, release) && prior.phase === "failed")
      return "failed";
    if (prior !== null && !["done", "failed"].includes(prior.phase))
      return "claim-unknown";
    const record = { release, run: runId, phase: "reading" };
    yield* operation.set(record);
    yield* lease.set(record);
    return record.phase;
  }));
}
function finish(host, release, runId, from, phase) {
  const [lease, operation] = records(host, release);
  return T3.store.transaction(Effect.gen(function* () {
    const owner = Option.getOrElse(yield* lease.get, () => null);
    const prior = Option.getOrElse(yield* operation.get, () => null);
    if (!matches(owner, runId, release) || !matches(prior, runId, release) || prior.phase !== from || owner.phase !== from)
      return false;
    const record = { release, run: runId, phase };
    yield* lease.set(phase === "writing" ? record : null);
    yield* operation.set(phase === "clear" ? null : record);
    return true;
  }));
}
function firstPause(runId, round) {
  const seen = T3.store.entry("release-reinstall:pause:" + runId + ":" + round, Schema.Boolean);
  return T3.store.transaction(Effect.gen(function* () {
    if (Option.isSome(yield* seen.get))
      return false;
    yield* seen.set(true);
    return true;
  }));
}

// release-reinstall-runtime.mjs
import { execFile as execFile2 } from "node:child_process";
import { lstat as lstat2, readFile as readFile2, realpath as realpath2 } from "node:fs/promises";
import { hostname } from "node:os";

// release-reinstall-host.sh
var release_reinstall_host_default = `set -u
set -o pipefail
export LC_ALL=C npm_config_registry=https://registry.npmjs.org
action=$1
host=$2
version=$3
global_bun=\${4:-}
data=$HOME/.local/share/axstack
cli=$HOME/.local/bin/axstack
package_dir=$data/releases/$version/package

emit() { printf 'AXSTACK %s\\n' "$*"; }
hold() { emit "hold $1"; exit 0; }

stable_version() {
  [[ $1 =~ ^(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})$ ]]
}

package_version() {
  "$bun" --no-env-file -e '
    try {
      const manifest = await Bun.file(Bun.argv[1]).json();
      if (manifest.name !== "axstack" || typeof manifest.version !== "string") process.exit(1);
      console.log(manifest.version);
    } catch (error) {
      if (error.code === "ENOENT") console.log("absent");
      else process.exit(1);
    }
  ' "$1/package.json"
}

timer() {
  local active_status=0 enabled_status=0
  active=$(systemctl --user is-active "$1.timer" 2>/dev/null) || active_status=$?
  enabled=$(systemctl --user is-enabled "$1.timer" 2>/dev/null) || enabled_status=$?
  [[ $active != active || $active_status == 0 ]] || return 1
  [[ $enabled != enabled || $enabled_status == 0 ]] || return 1
  case "$active" in active|inactive|failed|activating|deactivating) ;; *) return 1 ;; esac
  case "$enabled" in enabled|disabled|enabled-runtime|static|masked|masked-runtime|indirect|linked|linked-runtime|not-found) ;; *) return 1 ;; esac
  printf '%s %s' "$active" "$enabled"
}

skills() {
  local marker skill harness
  [[ -r $package_dir/bin/axstack.js && -s $package_dir/skills/axstack-implement/SKILL.md ]] || return 1
  local -a markers=(axstack/references/contracts.md)
  for skill in "$package_dir"/skills/axstack-* "$package_dir"/skills/voa; do
    markers+=("\${skill##*/}/SKILL.md")
  done
  local -a roots=("$HOME/.agents/skills" "$HOME/.claude/skills")
  if [[ $host == io || $host == axat-vps ]]; then roots+=("$HOME/.config/opencode/skills"); fi
  for marker in "\${markers[@]}"; do
    [[ -s $package_dir/skills/$marker ]] || return 1
    for harness in "\${roots[@]}"; do
      cmp -s "$package_dir/skills/$marker" "$harness/$marker" || return 1
    done
  done
}

observe() {
  installed=absent
  if [[ -e $cli || -L $cli ]]; then
    installed=$("$cli" --version 2>/dev/null) || return 1
    [[ $installed == 'axstack '* ]] || return 1
    installed=\${installed#axstack }
    stable_version "$installed" || return 1
    current=$(package_version "$data/releases/$installed/package") || return 1
    [[ $current == "$installed" ]] || return 1
  fi
  packaged=$(package_version "$package_dir") || return 1
  [[ $packaged == absent || $packaged == "$version" ]] || return 1
  default_sync=$(timer axstack-default-sync) || return 1
  single_server=$(timer axstack-single-server) || return 1
  drop_in=unknown
  if paths=$(systemctl --user show --property=DropInPaths --value axstack-default-sync.service 2>/dev/null); then
    drop_in=absent
    [[ -z $paths ]] || drop_in=present
  fi
  package_skills=absent
  if skills; then package_skills=present; fi
  global=n/a
  if [[ $host == axat-vps ]]; then
    global=$(package_version "$HOME/.bun/install/global/node_modules/axstack") || return 1
    [[ $global == absent ]] || stable_version "$global" || return 1
  fi
}

ready() {
  [[ $installed == "$version" && $packaged == "$version" && $package_skills == present &&
     $default_sync == 'active enabled' && $single_server == 'active enabled' &&
     ( $global == n/a || $global == "$version" ) ]]
}

receipt() {
  emit "$1 $installed $packaged $package_skills $default_sync $single_server $drop_in $global"
}

stage_vps() (
  local release_dir=\${package_dir%/package} want got
  rm -rf -- "$release_dir" && mkdir -p -- "$release_dir" && cd -- "$release_dir" || return 1
  npm pack -q "axstack@$version" || return $?
  want=$(npm view "axstack@$version" dist.integrity) || return $?
  got=$(openssl dgst -sha512 -binary "axstack-$version.tgz" | base64 -w0) || return $?
  [[ $want == "sha512-$got" ]] || return 1
  tar -xzf "axstack-$version.tgz" || return $?
  printf '#!/bin/sh\\nexec "%s" "%s/bin/axstack.js" "$@"\\n' "$global_bun" "$package_dir" > "$cli" &&
    chmod 755 "$cli"
)

install_release() {
  if [[ $host == axat-vps ]]; then
    stage_vps || return $?
    # The shadow Claude settings are symlinked on this host.
    env -u CLAUDE_CONFIG_DIR "$cli" install --preset mixed --harness claude --yes || return $?
    env -u CLAUDE_CONFIG_DIR "$cli" install --preset mixed --harness codex --yes || return $?
    env -u CLAUDE_CONFIG_DIR "$cli" install --preset mixed --harness opencode --no-claude-settings --yes || return $?
    "$global_bun" add -g "axstack@$version"
  else
    printf '%s\\n' "$reinstall" | bash -s -- "$version" || return $?
    if [[ $host == io ]]; then
      bash -lc '~/.local/bin/axstack install --preset mixed --harness opencode --no-claude-settings --yes'
    fi
  fi
}

# Lock the existing state directory across the final read, the write and
# the receipt. A disconnected SSH client does not release this host lock
# while its remote installer is still running.
bun=$global_bun
if [[ $host != axat-vps ]]; then
  bun=/usr/bin/bun
  [[ -x $bun ]] || bun=$(command -v bun) || hold unknown
fi
[[ -x $bun ]] || hold unknown
[[ -d $data && ! -L $data && -d $HOME/.local/bin && -x $HOME/.local/bin ]] || hold unknown
exec 9<"$data" || hold unknown
flock -n -E 75 9
case $? in 0) ;; 75) hold busy ;; *) hold unknown ;; esac
observe || hold unknown
for existing in "$installed" "$global"; do
  if stable_version "$existing" && [[ $existing != "$version" &&
      $(printf '%s\\n%s\\n' "$version" "$existing" | sort -V | tail -n 1) == "$existing" ]]; then
    hold newer
  fi
done
if ready; then receipt done; exit 0; fi
[[ $default_sync == 'active enabled' && $single_server == 'active enabled' ]] || hold timer
if [[ $action == probe ]]; then emit pending; exit 0; fi
[[ $action == apply && -n \${reinstall:-} && -w $data && -w $HOME/.local/bin &&
   ! -L $cli && ! -L $data/releases && ! -L $data/releases/$version ]] || hold unknown
status=0
install_release >/dev/null 2>&1 || status=$?
observe || hold readback
if ((status != 0)); then emit "failure install $status"; exit 0; fi
if ready; then receipt done; else receipt mismatch; fi
`;

// release-reinstall-runtime.mjs
var NAME = "axstack-release-reinstall";
var VERSION = 2;
var IDENTITY = NAME + "@" + VERSION;
var routes = { io: "xzat@io", iobook: "iobook", iobox: "xzat@iobox", iosatellite: "xzat@iosatellite", "axat-vps": "local" };
var hosts = Object.keys(routes);
var privatePaths = ["reinstallScript", "globalBun", "project", "bun", "t3", "roles", "registryTokenFile"];
var abs = (path) => typeof path === "string" && path.startsWith("/");
var versionPattern = "v(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})";
var stable = new RegExp("^" + versionPattern + "$");
var validVersion = (value) => typeof value === "string" && stable.test(value);
var tarballOrigin = "https://registry.npmjs.org";
var names = ["PATH", "HOME", "TMPDIR", "SSH_AUTH_SOCK", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"];
async function bytes(path, privateFile) {
  const info = await lstat2(path);
  const mask = privateFile ? 63 : 18;
  if (!info.isFile() || info.mode & mask || info.uid !== process.getuid() || info.size > 65536 || path !== await realpath2(path))
    throw new Error("unavailable binding data");
  return readFile2(path);
}
async function matches2(want, data) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return bindingMatches(want, Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(""));
}
var json2 = (input) => {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
};
async function readBinding(base) {
  try {
    const record = json2(await bytes(base + "/.axstack-workflows.json", true))?.workflows?.[IDENTITY];
    if (!abs(record?.binding))
      return null;
    const data = await bytes(record.binding, true);
    if (!await matches2(record.bindingDigest, data))
      return null;
    const binding = json2(data);
    if (!binding || privatePaths.some((key) => !abs(binding[key])) || !/^\/[a-zA-Z0-9._/-]+$/.test(binding.globalBun) || !binding.hosts || Object.keys(binding.hosts).length !== hosts.length || hosts.some((id) => binding.hosts[id] !== routes[id]) || typeof binding.localHostname !== "string" || !/^[a-zA-Z0-9-]+$/.test(binding.localHostname) || !Number.isInteger(binding.pollSeconds) || binding.pollSeconds < 0 || binding.pollSeconds > 60)
      return null;
    if (binding.localHostname !== hostname().split(".")[0])
      return { wrongHost: true };
    const script = await bytes(binding.reinstallScript, false);
    if (!script.length || !await matches2(binding.reinstallDigest, script))
      return null;
    return { ...binding, script: script.toString("utf8") };
  } catch {
    return null;
  }
}
function command(program, args, { input, timeout = 15000 } = {}) {
  const env = Object.fromEntries(names.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  return new Promise((resolve) => {
    const child = execFile2(program, args, { env, cwd: "/", timeout, killSignal: "SIGKILL", maxBuffer: 256 * 1024 }, (error, stdout) => resolve(error ? { code: error.code } : { code: 0, stdout }));
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
}
async function npmView(spec, field) {
  const { stdout } = await command("npm", ["view", spec, field, "--json", "--prefer-online", "--registry", tarballOrigin]);
  return json2(stdout);
}
async function latest(version) {
  const found = await npmView("axstack@latest", "version");
  if (typeof found !== "string" || !validVersion("v" + found))
    return "registry latest is unknown";
  const toNumber = (v) => v.slice(1).split(".").map(Number);
  const a = toNumber("v" + found);
  const b = toNumber(version);
  const diff = a.map((part, index) => part - b[index]).find((part) => part !== 0);
  if (diff > 0)
    return "release is older than npm latest";
  if (diff < 0)
    return "release is ahead of npm latest";
  return null;
}
async function tarball(version) {
  const release = version.slice(1);
  const expected = tarballOrigin + "/axstack/-/axstack-" + release + ".tgz";
  const dist = await npmView("axstack@" + release, "dist");
  if (dist?.tarball !== expected || typeof dist.integrity !== "string" || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(dist.integrity))
    return { error: "npm tarball metadata is unknown" };
  const { code, stdout } = await command("curl", [
    "--disable",
    "--silent",
    "--fail",
    "--proto",
    "=https",
    "--max-time",
    "10",
    "--range",
    "0-0",
    "--output",
    "/dev/null",
    "--write-out",
    "%{http_code}",
    expected
  ]);
  return { available: code === 0 && ["200", "206"].includes(stdout.trim()) };
}
var quoted = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
var sshOptions = [
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=10",
  "-o",
  "StrictHostKeyChecking=yes",
  "-o",
  "ClearAllForwardings=yes",
  "-T"
];
function result(stdout, release, host, action) {
  const fields = stdout.trim().split(" ");
  const [prefix, kind, ...data] = fields;
  if (prefix !== "AXSTACK" || /[\n\r]/.test(stdout.trim()))
    return null;
  if (kind === "hold" && data.length === 1 && ["unknown", "busy", "newer", "readback", "timer"].includes(data[0])) {
    return { state: data[0] };
  }
  if (kind === "pending" && !data.length && action === "probe")
    return { state: "pending" };
  if (kind === "failure" && data.length === 2 && data[0] === "install" && /^[1-9][0-9]{0,2}$/.test(data[1]) && action === "apply")
    return { state: "install-failed", exitCode: Number(data[1]) };
  if (kind === "mismatch" && data.length === 9 && action === "apply")
    return { state: "verify-mismatch" };
  if (kind !== "done" || data.length !== 9)
    return null;
  const [installed, packaged, packageSkills, defaultActive, defaultEnabled, singleActive, singleEnabled, dropIn, global] = data;
  const version = "v" + installed;
  const packageVersion = "v" + packaged;
  if (version !== release || packageVersion !== release || packageSkills !== "present" || defaultActive !== "active" || defaultEnabled !== "enabled" || singleActive !== "active" || singleEnabled !== "enabled" || !["present", "absent", "unknown"].includes(dropIn) || global !== (host === "axat-vps" ? installed : "n/a"))
    return null;
  return { state: "done", receipt: {
    version,
    packageVersion,
    packageSkills,
    dropIn,
    defaultSync: { active: defaultActive, enabled: defaultEnabled },
    singleServer: { active: singleActive, enabled: singleEnabled },
    ...host === "axat-vps" ? { bunGlobal: "v" + global } : {}
  } };
}
async function hostRead(config, host, version, action) {
  const route = config.hosts[host];
  const local = route === "local";
  const args = ["-s", "--", action, host, version.slice(1), ...local ? [config.globalBun] : []];
  const input = action === "apply" ? "reinstall=" + quoted(config.script) + `
` + release_reinstall_host_default : release_reinstall_host_default;
  const { code, stdout } = local ? await command("bash", args, { input, timeout: 300000 }) : await command("ssh", [...sshOptions, route, "bash " + args.join(" ")], { input, timeout: 300000 });
  if (code !== 0)
    return { state: code === 255 ? "unreachable" : "unknown-transport" };
  return result(stdout, version, host, action) ?? { state: "unknown-transport" };
}

// entries/axstack-release-reinstall.mjs
var { agent, sleep, step, workflow } = T3;
var base = decodeURIComponent(new URL("../", import.meta.url).pathname).replace(/\/$/, "");
var hold = (reason) => Effect.fail(new Error(reason));
var observe = (name, effect) => step(name, { returns: Schema.Json }, effect);
var reason = {
  unknown: "host evidence unknown",
  "unknown-transport": "host evidence unknown",
  unreachable: "host unreachable",
  busy: "host installer is busy",
  timer: "required timer inactive or disabled",
  newer: "installed release is newer",
  claimed: "host already claimed",
  "claim-unknown": "host claim evidence is unknown",
  "install-failed": "install exited nonzero",
  "verify-mismatch": "verification mismatch",
  readback: "prior write needs readback",
  binding: "private binding is missing, invalid, or changed"
};
function installHost(host, version, runId, round) {
  return observe("host-" + host + "-" + round, Effect.gen(function* () {
    const config = yield* Effect.promise(() => readBinding(base));
    if (!config || config.wrongHost)
      return { state: "binding" };
    let phase = yield* acquire(host, version, runId);
    if (phase === "claimed" || phase === "claim-unknown")
      return { state: phase };
    const close = (status, outcome) => Effect.gen(function* () {
      return (yield* finish(host, version, runId, phase, status)) ? outcome : { state: "claim-unknown" };
    });
    const before = yield* Effect.promise(() => hostRead(config, host, version, "probe"));
    if (phase === "failed")
      return before.state === "done" ? before : { state: "readback" };
    if (before.state === "done")
      return yield* close("done", before);
    if (phase === "writing")
      return { state: "readback" };
    if (before.state !== "pending")
      return yield* close("clear", before);
    const stale = yield* Effect.promise(() => latest(version));
    if (stale)
      return yield* close("clear", { state: "registry", detail: stale });
    const current = yield* Effect.promise(() => readBinding(base));
    if (!current || current.wrongHost)
      return yield* close("clear", { state: "binding" });
    if (!(yield* finish(host, version, runId, "reading", "writing")))
      return { state: "claim-unknown" };
    phase = "writing";
    const applied = yield* Effect.promise(() => hostRead(current, host, version, "apply"));
    if (applied.state === "done")
      return yield* close("done", applied);
    if (["install-failed", "verify-mismatch"].includes(applied.state))
      return yield* close("failed", applied);
    if (["busy", "newer", "unknown", "timer"].includes(applied.state))
      return yield* close("clear", applied);
    const after = yield* Effect.promise(() => hostRead(current, host, version, "probe"));
    return after.state === "done" ? yield* close("done", after) : { state: "readback" };
  }));
}
function preflight(version, round) {
  return Effect.gen(function* () {
    const seconds = yield* observe("preflight-" + round, Effect.gen(function* () {
      const config = yield* Effect.promise(() => readBinding(base));
      if (!config)
        return yield* hold(reason.binding);
      if (config.wrongHost)
        return yield* hold("local execution host does not match the private binding");
      const stale = yield* Effect.promise(() => latest(version));
      if (stale)
        return yield* hold(stale);
      return config.pollSeconds;
    }));
    for (let attempt = 1;attempt <= 6; attempt++) {
      const available = yield* observe("tarball-" + round + "-" + attempt, Effect.gen(function* () {
        const found = yield* Effect.promise(() => tarball(version));
        if (found.error)
          return yield* hold(found.error);
        if (!found.available && attempt === 6)
          return yield* hold("npm tarball not fetchable");
        return found.available;
      }));
      if (available)
        return;
      if (seconds)
        yield* sleep("tarball-wait-" + round + "-" + attempt, seconds + " seconds");
    }
  });
}
function reportFailure(runId, round) {
  return Effect.gen(function* () {
    const expected = yield* observe("failure-agent-seat-" + round, Effect.promise(async () => {
      const config = await readBinding(base);
      if (!config || config.wrongHost)
        return null;
      const seat = await ownerBinding(base, config);
      return seat && { project: config.project, ...seat };
    }));
    if (!expected)
      return "failure agent binding unknown";
    const brief = `AXSTACK-WAKE ${IDENTITY} run ${runId}

Read this T3 workflow run and report the release reinstall failure in this thread. The release driver owns recovery and hold clearance.`;
    const reported = yield* agent.try("report-failure-" + round, {
      ...expected,
      title: "Axstack release reinstall failure",
      brief,
      timeout: "10 minutes"
    });
    return yield* observe("failure-agent-readback-" + round, Effect.promise(async () => {
      const config = await readBinding(base);
      const thread = reported.thread?.threadId;
      if (!config || config.wrongHost || reported.outcome !== "done" || !thread)
        return "failure agent evidence unknown";
      const view = await driverReadback(base, config, expected, null, thread);
      if (!view?.messages?.some((message) => message.role === "system" && message.text === brief)) {
        return "failure agent binding or transcript mismatched";
      }
      return null;
    }));
  });
}
var axstack_release_reinstall_default = workflow(NAME, {
  version: VERSION,
  payload: Schema.Struct({ version: Schema.String }),
  returns: Schema.Json,
  resumeAfter: []
}, ({ version }, { id }) => Effect.gen(function* () {
  if (!validVersion(version) || !validId(id)) {
    return yield* observe("invalid-release", hold("invalid release payload or run ID"));
  }
  const receipts = {};
  for (let round = 1;; round++) {
    yield* preflight(version, round);
    const outstanding = {};
    let failure = false;
    for (const host of hosts) {
      if (receipts[host])
        continue;
      const observation = yield* installHost(host, version, id, round);
      if (observation.state === "done") {
        receipts[host] = observation.receipt;
      } else {
        outstanding[host] = observation.detail ?? reason[observation.state];
        if (["install-failed", "verify-mismatch"].includes(observation.state))
          failure = true;
      }
    }
    const pending = Object.keys(outstanding);
    if (!pending.length) {
      return yield* observe("complete-" + round, Effect.gen(function* () {
        const stale = yield* Effect.promise(() => latest(version));
        if (stale)
          return yield* hold(stale);
        return { version, hosts: receipts };
      }));
    }
    const agentIssue = failure ? yield* reportFailure(id, round) : null;
    yield* observe("outstanding-" + round, Effect.gen(function* () {
      if (yield* firstPause(id, round)) {
        const details = pending.map((host) => host + "=" + outstanding[host]).join(", ");
        return yield* hold("outstanding hosts: " + pending.join(", ") + " (" + details + ")" + (agentIssue ? ". " + agentIssue : ""));
      }
      return true;
    }));
  }
}));
export {
  axstack_release_reinstall_default as default
};
