// watch-backstops.mjs
var NAME = "axstack-watch-backstops";
var VERSION = 1;
var IDENTITY = NAME + "@" + VERSION;
var COALESCE_MS = 5000;
var CHECK_MS = 300000;
var intervals = { watch: 3600000, writer: CHECK_MS, recovery: CHECK_MS, autopilot: 3600000 };
var states = ["active", "parked", "user-stopped", "complete"];
var validId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_:-]{0,159}$/.test(value);
var label = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value);
var timestamp = (value) => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) ? Date.parse(value) : NaN;
function validModel(model) {
  return label(model?.instanceId) && label(model.model) && Array.isArray(model.options) && model.options.every((option) => label(option?.id) && (typeof option.value === "boolean" || label(option.value))) && new Set(model.options.map(({ id }) => id)).size === model.options.length;
}
function sameBinding(expected, observed) {
  return expected?.projectId === observed?.projectId && expected?.runtimeMode === observed?.runtimeMode && validModel(expected?.model) && validModel(observed?.model) && expected.model.instanceId === observed.model.instanceId && expected.model.model === observed.model.model && expected.model.options.length === observed.model.options.length && expected.model.options.every(({ id, value }) => observed.model.options.some((item) => item.id === id && item.value === value));
}
function ownerReceipt(input, ownerId, now) {
  if (input?.ownerId !== ownerId || !states.includes(input.state) || !Number.isFinite(timestamp(input.capturedAt)) || timestamp(input.capturedAt) > now || !label(input.binding?.projectId) || !label(input.binding.runtimeMode) || !validModel(input.binding.model) || !input.timers || !Object.keys(intervals).every((timer) => input.timers[timer] === null || Number.isFinite(timestamp(input.timers[timer]))))
    return null;
  const dueAt = {};
  for (const timer of Object.keys(intervals)) {
    if (input.timers[timer] !== null)
      dueAt[timer] = timestamp(input.timers[timer]);
  }
  return { state: input.state, binding: input.binding, dueAt };
}
function ownerState(ownerId, binding, view, projection, ending = false) {
  const thread = view?.thread;
  if (thread?.threadId !== ownerId)
    return { hold: "native owner evidence is missing or mismatched" };
  if (thread.archived === true)
    return { hold: "owner is archived" };
  if (!ending && (thread.snoozed === true || thread.pendingRequestCount > 0))
    return { hold: "owner is protected or awaiting user input" };
  if (thread.archived !== false || typeof thread.snoozed !== "boolean" || !Number.isSafeInteger(thread.pendingRequestCount) || thread.pendingRequestCount < 0 || ![
    "idle",
    "completed",
    "running",
    "starting",
    "waiting",
    "queued",
    "preparing",
    "interrupted",
    "failed",
    "cancelled",
    "rolled_back"
  ].includes(thread.status)) {
    return { hold: "native owner state is unknown" };
  }
  const observed = projection?.thread;
  const model = observed?.modelSelection;
  if (observed?.id !== ownerId || observed.archivedAt !== null || observed.deletedAt !== null || thread.projectId !== observed.projectId || thread.model !== model?.model || thread.providerInstanceId !== model?.instanceId || thread.runtimeMode !== observed.runtimeMode || !sameBinding(binding, {
    projectId: observed.projectId,
    model: { ...model, options: model?.options === undefined ? [] : model.options },
    runtimeMode: observed.runtimeMode
  }))
    return { hold: "effective owner binding is unknown or mismatched" };
  if (!Array.isArray(projection.runs))
    return { hold: "native owner state is unknown" };
  if (!ending && projection.runs.some((run) => run?.status === "queued" && run.queueHeld === true)) {
    return { hold: "owner is protected by a held queue" };
  }
  return { status: thread.status };
}
function timerPlan(receipt, consumed, now) {
  if (receipt.state !== "active")
    return { stop: receipt.state };
  const deadlines = Object.entries(receipt.dueAt).map(([timer, at]) => [timer, Math.max(at, (consumed[timer] ?? -Infinity) + intervals[timer])]);
  if (!deadlines.length)
    return { stop: "no-timers" };
  const due = deadlines.filter(([, at]) => at <= now);
  if (!due.length)
    return { waitMs: Math.min(CHECK_MS, Math.min(...deadlines.map(([, at]) => at)) - now) };
  const handled = due.map(([timer, at]) => [timer, at + Math.floor((now - at) / intervals[timer]) * intervals[timer]]);
  return {
    due: handled.map(([timer]) => timer),
    consumed: { ...consumed, ...Object.fromEntries(handled) },
    since: Math.min(...handled.map(([, at]) => at)) - COALESCE_MS
  };
}
function activity(messages, ownerId, since, now) {
  if (!Array.isArray(messages) || messages.some((message) => !message || typeof message.id !== "string" || !Number.isFinite(timestamp(message.createdAt)))) {
    return { decision: "wake", activity: "unknown", gap: "native PR message coverage is unavailable" };
  }
  const native = messages.find((message) => message.threadId === ownerId && message.createdBy === "agent" && message.creationSource === "server" && message.id.startsWith("message:pr-watch:") && message.notification?.source?.kind === "monitor" && message.notification.source.pullRequest && timestamp(message.createdAt) >= since && timestamp(message.createdAt) <= now);
  return native ? { decision: "native", activity: "pass", eventId: native.id } : { decision: "wake", activity: "fail" };
}

// watch-backstops-runtime.mjs
import { lstat, readFile, realpath } from "node:fs/promises";
import { hostname } from "node:os";

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
import { execFile } from "node:child_process";
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

// watch-backstops-runtime.mjs
var hosts = ["io", "iobox", "iosatellite", "axat-vps"];
var safePath = (path) => typeof path === "string" && /^\/(?:[A-Za-z0-9._:-]+\/)*[A-Za-z0-9._:-]+$/.test(path) && !path.split("/").some((segment) => segment === "." || segment === "..");
async function privateFile(path) {
  if (!safePath(path))
    throw new Error;
  const info = await lstat(path);
  if (!info.isFile() || info.uid !== process.getuid() || info.mode & 63 || info.size > 32768 || await realpath(path) !== path)
    throw new Error;
  return readFile(path);
}
async function control(base, ownerId) {
  let config;
  try {
    const record = json(await privateFile(base + "/.axstack-workflows.json"))?.workflows?.[IDENTITY];
    const bytes = await privateFile(record?.binding);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    if (!bindingMatches(record.bindingDigest, Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(""))) {
      throw new Error;
    }
    config = json(bytes);
    if (!["bun", "t3", "registryTokenFile", "ownersDirectory"].every((key) => safePath(config?.[key])))
      throw new Error;
  } catch {
    return { hold: "private binding is missing, invalid, or changed" };
  }
  if (!hosts.includes(config.host) || config.host !== hostname().split(".")[0]) {
    return { hold: "backstop is unavailable on this local host" };
  }
  const raw = await privateFile(config.ownersDirectory + "/" + ownerId + ".json").catch(() => null);
  const receipt = ownerReceipt(json(raw), ownerId, Date.now());
  return receipt ? { config, receipt } : { hold: "private owner receipt is missing or invalid" };
}
var projectionScript = t3_workflow_read_default + `
const [origin, file, threadId] = Bun.argv.slice(1);
console.log(JSON.stringify(await readWorkflowRpc(origin, file, 'orchestration.getThreadProjection', { threadId })));
`;
function command(base, config, words, args) {
  return run(config.t3, [...words, "--base-dir", base, ...args, "--json"], { cwd: "/" }).then(json);
}
function runtime(base) {
  return readFile(base + "/userdata/server-runtime.json", "utf8").catch(() => null).then(json);
}
async function observeOwner(base, config, ownerId, binding, ending) {
  const before = await runtime(base);
  let projection = null;
  const view = await command(base, config, ["thread", "show"], [ownerId, "--messages", "1"]);
  if (typeof before?.origin === "string" && Number.isInteger(before.pid) && typeof before.startedAt === "string") {
    projection = json(await run(config.bun, [
      "--no-env-file",
      "-e",
      projectionScript,
      before.origin,
      config.registryTokenFile,
      ownerId
    ], { cwd: "/" }));
    const after = await runtime(base);
    if (after?.origin !== before.origin || after.pid !== before.pid || after.startedAt !== before.startedAt)
      projection = null;
  }
  return { ...ownerState(ownerId, binding, view, projection, ending), messages: projection?.messages };
}
async function priorState(base, config, runId) {
  const { run: observed } = await command(base, config, ["workflow", "show"], [runId]) ?? {};
  if (observed?.runId !== runId || observed.workflow !== NAME || observed.version !== VERSION)
    return null;
  return observed.status;
}

// entries/axstack-watch-backstops.mjs
var base = decodeURIComponent(new URL("../", import.meta.url).pathname).replace(/\/$/, "");
var hold = (message) => Effect.fail(new Error(message));
var step = (name, work) => T3.step(name, { returns: Schema.Json }, work);
var terminal = ["cancelled", "completed", "stopped", "skipped"];
function readControl(ownerId, binding) {
  return Effect.gen(function* () {
    const observed = yield* Effect.promise(() => control(base, ownerId));
    if (observed.hold)
      return yield* hold(observed.hold);
    if (binding && !sameBinding(binding, observed.receipt.binding)) {
      return yield* hold("recorded owner binding changed during this backstop");
    }
    return observed;
  });
}
function readOwner(ownerId, config, binding, ending = false) {
  return Effect.gen(function* () {
    const observed = yield* Effect.promise(() => observeOwner(base, config, ownerId, binding, ending));
    if (observed.hold)
      return yield* hold(observed.hold);
    return observed;
  });
}
function acquire(ownerId, runId, lease) {
  return Effect.gen(function* () {
    const { config, receipt } = yield* readControl(ownerId);
    if (receipt.state !== "active")
      return { stop: receipt.state };
    yield* readOwner(ownerId, config, receipt.binding);
    const previous = yield* lease.get;
    if (Option.isSome(previous) && previous.value?.runId !== runId) {
      const previousId = previous.value?.runId;
      const status = validId(previousId) ? yield* Effect.promise(() => priorState(base, config, previousId)) : null;
      if (!status)
        return yield* hold("prior backstop state is unknown");
      if (!terminal.includes(status))
        return yield* hold("owner already has an active backstop");
    }
    return yield* T3.store.transaction(Effect.gen(function* () {
      const current = yield* lease.get;
      const currentId = Option.isSome(current) ? current.value?.runId : null;
      const priorId = Option.isSome(previous) ? previous.value?.runId : null;
      if (currentId !== priorId && currentId !== runId) {
        return yield* hold("owner already has an active backstop");
      }
      if (currentId !== runId)
        yield* lease.set({ runId, round: 0 });
      return { binding: receipt.binding };
    }));
  });
}
function claimWake(lease, runId, round) {
  return T3.store.transaction(Effect.gen(function* () {
    const current = yield* lease.get;
    if (!Option.isSome(current) || current.value?.runId !== runId || !Number.isSafeInteger(current.value.round) || current.value.round < 0 || current.value.round > round) {
      return yield* hold("wake slot claim is unavailable or has another owner");
    }
    if (current.value.round !== round)
      yield* lease.set({ runId, round });
  }));
}
var axstack_watch_backstops_default = T3.workflow(NAME, {
  version: VERSION,
  payload: Schema.Struct({ ownerId: Schema.String, shadow: Schema.Boolean }),
  returns: Schema.Json,
  resumeAfter: []
}, ({ ownerId, shadow }, { id }) => Effect.gen(function* () {
  if (!validId(ownerId) || !validId(id) || typeof shadow !== "boolean") {
    return yield* step("identity", hold("invalid owner or run identity"));
  }
  const lease = T3.store.entry(NAME + ":" + (shadow ? "shadow:" : "live:") + ownerId, Schema.Json);
  const { binding, stop } = yield* step("owner-lease", acquire(ownerId, id, lease));
  if (stop)
    return { decision: stop };
  let consumed = {};
  for (let tick = 1;; tick++) {
    const plan = yield* step("timer-plan-" + tick, Effect.gen(function* () {
      const { receipt } = yield* readControl(ownerId, binding);
      return timerPlan(receipt, consumed, Date.now());
    }));
    if (plan.stop)
      return { decision: plan.stop };
    if (plan.waitMs) {
      yield* T3.sleep("wait-timers-" + tick, Math.ceil(plan.waitMs / 1000) + " seconds");
      continue;
    }
    yield* T3.sleep("coalesce-native-" + tick, COALESCE_MS / 1000 + " seconds");
    const slot = yield* step("wake-slot-" + tick, Effect.gen(function* () {
      const { config, receipt } = yield* readControl(ownerId, binding);
      const now = Date.now();
      const current = timerPlan(receipt, consumed, now);
      if (!current.due)
        return current;
      const owner = yield* readOwner(ownerId, config, binding);
      const signal = activity(owner.messages, ownerId, current.since, Date.now());
      if (!shadow && signal.decision === "wake")
        yield* claimWake(lease, id, tick);
      return { ...current, ...signal, ownerStatus: owner.status };
    }));
    if (slot.stop)
      return { decision: slot.stop };
    if (!slot.due)
      continue;
    consumed = slot.consumed;
    if (shadow || slot.decision === "native")
      continue;
    const brief = `AXSTACK-WAKE ${IDENTITY} run ${id}
Owner ${ownerId} slot ${tick}`;
    yield* T3.agent.try("wake-owner-" + tick, { thread: { threadId: ownerId }, brief });
    yield* step("wake-readback-" + tick, Effect.gen(function* () {
      const { config, receipt } = yield* readControl(ownerId, binding);
      const owner = yield* readOwner(ownerId, config, binding, receipt.state !== "active");
      const matches = Array.isArray(owner.messages) ? owner.messages.filter((message) => message.threadId === ownerId && message.createdBy === "system" && message.creationSource === "server" && message.text === brief) : [];
      if (matches.length !== 1)
        return yield* hold("wake delivery could not be read back exactly once");
      return { delivery: "pass" };
    }));
  }
}));
export {
  axstack_watch_backstops_default as default
};
