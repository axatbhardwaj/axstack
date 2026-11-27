// review-manager.mjs
import { createHash } from "node:crypto";
var workflowName = "axstack-review-manager";
var version = 1;
var managerIdentity = `${workflowName}@${version}`;
var interval = 1800000;
var busy = ["preparing", "queued", "starting", "running", "waiting"];
var reviewId = (value) => typeof value === "string" && /^[A-Za-z0-9_][A-Za-z0-9:_%.-]{0,511}$/.test(value);
var repository = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value);
var prId = (value) => {
  if (typeof value !== "string")
    return false;
  const [repo, number, ...rest] = value.split("#");
  return !rest.length && repository(repo) && /^[1-9]\d*$/.test(number);
};
var hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
var time = (value) => typeof value === "string" && /T\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) ? Date.parse(value) : NaN;
var inSlot = (observedAt, scheduledAt) => Math.abs(time(observedAt) - time(scheduledAt)) <= interval;
function importState(progress) {
  if (typeof progress !== "string")
    return null;
  const headings = [...progress.matchAll(/^## (.+)$/gm)].map((line) => line[1]);
  if (headings.join("/") !== "Lane state/Open holds/Watermarks/Last pass")
    return null;
  const lane = progress.split(`## Open holds
`)[0];
  const owner = /^- scheduledTaskId, threadId\/runId, workspace and exact terminal receipt: ([^,]+), ([^/\s,]+)\/([^,]+), ([^,]+), (.+)$/m.exec(lane);
  if (!owner || !reviewId(owner[1]) || !reviewId(owner[2]) || !reviewId(owner[3]) || !/^- Active PR jobs and descendants: .+$/m.test(lane) || !/^- Quiet gate: .+$/m.test(progress) || !/^- Last full pass: .+$/m.test(progress))
    return null;
  const current = /^- Current pass identity: \S+ (\S+) /m.exec(lane)?.[1];
  const unresolved = progress.split(`## Watermarks
`)[0];
  const flagged = [...unresolved.matchAll(/^- (\S+): (?:flagged|held)\b/gm)].map((line) => line[1]).filter(reviewId);
  return {
    progress,
    sourceSha: hash(progress),
    prior: owner[2],
    schedule: owner[1],
    owners: [...new Set([owner[2], current].filter(reviewId))],
    flagged: [...new Set(flagged)].sort()
  };
}
var quietTerms = [
  "observations",
  "continuity",
  "identity",
  "reap",
  "discovery",
  "pr-list",
  "full-pass-age",
  "thread-readbacks",
  "ownership",
  "prior-pass",
  "lane-idle",
  "pending-work"
];
function decide({ discovery, inventory, reap, facts }, scheduledAt) {
  const reasons = [];
  if (!inSlot(inventory.observedAt, scheduledAt))
    reasons.push("slot-observation:unknown");
  if (inventory.coverage !== "pass")
    reasons.push("project-coverage:unknown");
  if (discovery.status !== "pass")
    reasons.push("safe-6:unknown");
  if (reap.exitCode !== 0 || reap.dockerAvailable !== true) {
    reasons.push(Number.isInteger(reap.exitCode) && typeof reap.dockerAvailable === "boolean" ? "reap:fail" : "reap:unknown");
  }
  if (inventory.flagged.some((row) => row.status === "reply"))
    reasons.push("flagged-reply");
  if (inventory.flagged.some((row) => row.status === "unknown"))
    reasons.push("flagged-history:unknown");
  const prior = inventory.prior?.thread;
  const ownerUpdatedAt = inventory.ownerUpdatedAt ?? (busy.includes(prior?.status) ? prior.updatedAt : null);
  if (time(inventory.observedAt) - time(ownerUpdatedAt) >= 4 * interval) {
    reasons.push("wedged-owner");
  }
  if (facts?.version !== 2 || !Array.isArray(facts.terms) || facts.terms.length !== quietTerms.length) {
    reasons.push("quiet-facts:unknown");
  } else {
    for (const term of quietTerms) {
      const found = facts.terms.filter((fact) => fact.id === term);
      const status = found.length === 1 ? found[0].status : null;
      if (status !== "pass")
        reasons.push(term + ":" + (status === "fail" ? "fail" : "unknown"));
    }
  }
  return [...new Set(reasons)];
}
function brief(runId, state, prs, flagged) {
  const lines = [
    `AXSTACK-WAKE ${managerIdentity} run ${runId}`,
    "",
    "Follow the installed review-manager-report.md.",
    `Continuity store key: ${managerIdentity}:continuity`,
    `Import digest: ${state.sourceSha}`,
    `Prior manager: ${state.prior}`,
    `Flagged threads: ${flagged.map((row) => row.id).filter(reviewId).join(", ")}`,
    `Observed PRs: ${[...new Set(prs.filter(prId))].sort().join(", ")}`
  ];
  return lines.join(`
`);
}
function receiptMatches(result, runId, state) {
  const receipt = result?.value;
  return result?.outcome === "done" && receipt?.kind === "AXSTACK-REVIEW-MANAGER" && receipt.runId === runId && receipt.sourceSha === state.sourceSha && reviewId(receipt.threadId) && receipt.threadId === result.thread?.threadId && Array.isArray(receipt.writes) && receipt.writes.length === 0;
}

// review-manager-workflow.mjs
class Hold extends Error {
}
function reviewManager(runtime) {
  const { agent, every, step, store, runs } = T3;
  const entry = (key) => store.entry(managerIdentity + ":" + key, Schema.Json);
  const slot = () => entry("latest-slot");
  const read = (key, work) => step(key, { returns: Schema.Json }, Effect.tryPromise({
    try: work,
    catch: (error) => error instanceof Hold ? error : new Hold(key + " evidence unavailable")
  }));
  const transaction = (key, work) => step(key, { returns: Schema.Json }, store.transaction(Effect.gen(work)));
  const value = (option) => Option.isSome(option) ? option.value : null;
  const managerReceipt = Schema.Struct({
    kind: Schema.Literal("AXSTACK-REVIEW-MANAGER"),
    runId: Schema.String,
    sourceSha: Schema.String,
    threadId: Schema.String,
    writes: Schema.Array(Schema.String)
  });
  return T3.workflow(workflowName, {
    version,
    payload: T3.Tick,
    returns: Schema.Json,
    triggers: [every("30 minutes")],
    resumeAfter: []
  }, ({ scheduledAt }, { id: runId }) => Effect.gen(function* () {
    yield* step("claim-slot", { returns: Schema.Json }, Effect.gen(function* () {
      if (!reviewId(runId) || !Number.isFinite(time(scheduledAt))) {
        return yield* Effect.fail(new Hold("invalid Review manager slot identity"));
      }
      const active = (yield* runs({ workflow: workflowName })).some((other) => other.id !== runId && ["running", "waiting"].includes(other.status));
      const reason = yield* store.transaction(Effect.gen(function* () {
        const previous = value(yield* slot().get);
        if (previous?.runId === runId && previous.scheduledAt === scheduledAt)
          return null;
        if (active)
          return "an earlier Review manager workflow run is active";
        if (previous && time(previous.scheduledAt) >= time(scheduledAt))
          return "Review manager slot was already claimed";
        yield* slot().set({ runId, scheduledAt });
        return null;
      }));
      if (reason)
        return yield* Effect.fail(new Hold(reason));
      return true;
    }));
    const config = yield* read("binding", async () => {
      const binding = await runtime.binding();
      if (!binding || !["shadow", "report"].includes(binding.mode))
        throw new Hold("private Review manager binding is missing, invalid, or changed");
      return binding;
    });
    let state = yield* step("read-continuity", { returns: Schema.Json }, Effect.gen(function* () {
      return value(yield* entry("continuity").get);
    }));
    if (!state) {
      const imported = yield* read("read-predecessor-copy", async () => {
        const parsed = importState(await runtime.importProgress(config));
        if (!parsed)
          throw new Hold("predecessor continuity lacks its required ownership or watermark records");
        return parsed;
      });
      state = yield* transaction("import-continuity", function* () {
        const continuity = entry("continuity");
        if (value(yield* slot().get)?.runId !== runId)
          return null;
        const existing = value(yield* continuity.get);
        if (existing)
          return existing;
        yield* continuity.set(imported);
        return value(yield* continuity.get);
      });
    }
    yield* read("verify-continuity", async () => {
      const parsed = importState(state?.progress);
      if (!parsed || JSON.stringify(parsed) !== JSON.stringify(state))
        throw new Hold("continuity import readback mismatched");
      return true;
    });
    const reap = (yield* read("read-reap-receipt", () => runtime.reap(config, scheduledAt))) ?? {};
    const discovery = yield* read("safe-6-discovery", () => runtime.discover(config));
    const watermarks = yield* step("read-reply-watermarks", { returns: Schema.Json }, Effect.gen(function* () {
      return value(yield* entry("reply-watermarks").get) ?? {};
    }));
    const inventory = yield* read("thread-inventory", () => runtime.inventory(config, state, watermarks));
    const facts = yield* read("quiet-facts", () => runtime.quietFacts(config, state.progress, {
      reap,
      repository: discovery.repository,
      login: discovery.login,
      searches: discovery.searches,
      inventory: inventory.inventory,
      prior: inventory.prior,
      observedAt: inventory.observedAt
    }));
    const reasons = decide({ discovery, inventory, reap, facts }, scheduledAt);
    if (!reasons.length)
      return { decision: "quiet", reasons };
    if (config.mode === "shadow")
      return { decision: "shadow-wake", reasons };
    const expected = yield* read("resolve-manager-binding", async () => {
      const seat = await runtime.resolveSeat(config);
      if (!seat)
        throw new Hold("axstack-owner binding is unavailable in the live catalog");
      return { ...seat, runtimeMode: "approval-required" };
    });
    yield* read("verify-binding-unchanged", async () => {
      if (!await runtime.sameBinding(config))
        throw new Hold("Review manager binding changed during the slot");
      return true;
    });
    const current = yield* step("read-wake-claim", { returns: Schema.Json }, Effect.gen(function* () {
      return value(yield* slot().get);
    }));
    yield* read("require-wake-claim", async () => {
      if (current?.runId !== runId)
        throw new Hold("Review manager wake claim was superseded");
      return true;
    });
    const result = yield* agent.try("manager", {
      ...expected,
      project: config.project,
      title: "Review manager report",
      brief: brief(runId, state, discovery.prs, inventory.flagged),
      returns: managerReceipt
    });
    yield* read("verify-manager-receipt", async () => {
      if (!receiptMatches(result, runId, state))
        throw new Hold("manager receipt missing or invalid");
      return true;
    });
    yield* read("verify-manager-binding", async () => {
      if (!await runtime.verifySeat(config, expected, result.thread.threadId))
        throw new Hold("effective manager binding mismatched");
      return true;
    });
    const saved = yield* transaction("record-report", function* () {
      if (value(yield* slot().get)?.runId !== runId || value(yield* entry("continuity").get)?.sourceSha !== state.sourceSha)
        return false;
      const report = { ...result.value, scheduledAt, reasons };
      yield* entry("last-report").set(report);
      const updates = inventory.flagged.filter((row) => reviewId(row.id) && row.watermark);
      yield* entry("reply-watermarks").set({ ...watermarks, ...Object.fromEntries(updates.map((row) => [row.id, row.watermark])) });
      return value(yield* entry("last-report").get)?.runId === runId;
    });
    yield* read("verify-report-write", async () => {
      if (!saved)
        throw new Hold("manager receipt was superseded or failed readback");
      return true;
    });
    return { decision: "reported", reasons };
  }));
}

// review-manager-runtime.mjs
import { execFile as execFile2 } from "node:child_process";
import { lstat as lstat2, mkdtemp, readFile as readFile2, realpath as realpath2, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

// binding.mjs
function bindingMatches(expected, actual) {
  return typeof expected === "string" && /^[a-f0-9]{64}$/.test(expected) && expected === actual;
}

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
async function github(endpoint) {
  const output = await run("gh", ["api", "--hostname", "github.com", "--method", "GET", "--include", endpoint], { forge: true });
  const divider = output?.match(/\r?\n\r?\n/);
  if (!divider)
    return null;
  const [line, ...headers] = output.slice(0, divider.index).split(/\r?\n/);
  const httpStatus = /^HTTP\/\d(?:\.\d)? (\d{3})(?: |$)/.exec(line)?.[1];
  const links = headers.filter((header) => /^link:/i.test(header)).map((header) => header.slice(5).trim());
  return { status: Number(httpStatus), link: links.join(", "), body: json(output.slice(divider.index + divider[0].length)) };
}
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

// dependabot-pages.mjs
async function githubPages(request, route, query, key, identity) {
  const rows = [];
  const seen = new Set;
  let total;
  let last;
  for (let page = 1;page <= 50; page++) {
    const params = new URLSearchParams({ ...query, per_page: "100", page: String(page) });
    const reply = await request(route + "?" + params);
    const body = reply?.body;
    const batch = key ? body?.[key] : body;
    if (reply?.status !== 200 || !Array.isArray(batch) || batch.length > 100 || page > 1 && !batch.length)
      return null;
    if (key) {
      if (!Number.isSafeInteger(body.total_count) || body.total_count < 0 || total !== undefined && body.total_count !== total)
        return null;
      total = body.total_count;
    }
    for (const row of batch) {
      const id = identity(row);
      if (id == null || seen.has(id))
        return null;
      seen.add(id);
      rows.push(row);
    }
    const links = pageLinks(reply.link);
    if (!links || links.last !== undefined && (links.last < page || last !== undefined && last !== links.last))
      return null;
    last ??= links.last;
    if (links.prev !== undefined && links.prev !== page - 1)
      return null;
    if (links.next === undefined)
      return (last === undefined || page === last) && (total === undefined || total === rows.length) ? rows : null;
    if (links.next !== page + 1 || last !== undefined && links.next > last || !batch.length)
      return null;
  }
  return null;
}
function pageLinks(header) {
  const links = {};
  for (const part of header ? header.split(/,\s*(?=<)/) : []) {
    const [, href, kind] = /^\s*<([^>]+)>;\s*rel="(next|prev|first|last)"\s*$/.exec(part) ?? [];
    if (!href || Object.hasOwn(links, kind) || !URL.canParse(href))
      return null;
    const url = new URL(href);
    const page = Number(url.searchParams.get("page"));
    if (url.origin !== "https://api.github.com" || !Number.isSafeInteger(page) || page < 1)
      return null;
    links[kind] = page;
  }
  return links;
}

// review-manager-runtime.mjs
var path = (value) => typeof value === "string" && /^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(value) && !value.split("/").some((part) => part === ".." || part === ".");
var loginName = (value) => typeof value === "string" && /^[A-Za-z0-9_\[\]-]{1,80}$/.test(value);
var number = (value) => Number.isSafeInteger(value) && value > 0;
var unique = (values, check) => Array.isArray(values) && values.length > 0 && values.length <= 100 && values.every(check) && new Set(values.map((value) => value.toLowerCase())).size === values.length;
async function privateRead(file) {
  const info = await lstat2(file).catch(() => null);
  if (!info?.isFile() || info.uid !== process.getuid() || info.mode & 63 || info.size > 2 * 1024 * 1024 || await realpath2(file) !== file)
    return null;
  return readFile2(file, "utf8");
}
async function readPrivateBinding(base) {
  try {
    const record = json(await privateRead(base + "/.axstack-workflows.json"))?.workflows?.[managerIdentity];
    if (!path(record?.binding))
      return null;
    const bytes = await privateRead(record.binding);
    if (bytes === null || !bindingMatches(record.bindingDigest, hash(bytes)))
      return null;
    const config = json(bytes);
    if (!config || !["shadow", "report"].includes(config.mode) || !reviewId(config.projectId) || !["project", "bun", "t3", "roles", "registryTokenFile", "skillsDirectory", "progressCopy"].every((key) => path(config[key])) || !path(config.reapReceipt) || !unique(config.projects, path) || !config.projects.includes(config.project) || !unique(config.repositories, repository) || !config.repositories.includes(config.repository) || config.progressCopy === config.reapReceipt)
      return null;
    return config;
  } catch {
    return null;
  }
}
async function readReapReceipt(config, scheduledAt) {
  const saved = json(await privateRead(config.reapReceipt).catch(() => null));
  const age = time(scheduledAt) - time(saved?.observedAt);
  if (saved?.version !== 2 || !(age >= 0 && age <= interval) || !Array.isArray(saved.terms))
    return null;
  const terms = saved.terms.filter((item) => item?.id === "reap");
  const term = terms.length === 1 ? terms[0] : null;
  const { exitCode, dockerAvailable } = term?.evidence ?? {};
  if (!Number.isInteger(exitCode) || typeof dockerAvailable !== "boolean" || term.status !== (exitCode === 0 && dockerAvailable ? "pass" : "fail"))
    return null;
  return { exitCode, dockerAvailable };
}
async function discoverReviewPRs(config) {
  const gh = async (args) => json(await run("gh", args, { cwd: "/", forge: true }));
  const search = (flag) => gh([
    "search",
    "prs",
    flag,
    "@me",
    "--state",
    "open",
    "--draft=false",
    "--json",
    "number,repository,updatedAt,isDraft,author",
    "--limit",
    "1000"
  ]);
  const [user, ...searches] = await Promise.all([
    gh(["api", "--hostname", "github.com", "user"]),
    search("--review-requested"),
    search("--involves")
  ]);
  const expected = new Map(config.repositories.map((name) => [name.toLowerCase(), name]));
  const inventories = await Promise.all(config.repositories.map(async (name) => {
    const rows = await githubPages(github, `repos/${name}/pulls`, { state: "open" }, null, (row) => {
      const target = row?.base?.repo?.full_name;
      return number(row?.number) && row.state === "open" && typeof row.draft === "boolean" && loginName(row.user?.login) && Number.isFinite(time(row.updated_at)) && repository(target) && target.toLowerCase() === name.toLowerCase() ? row.number : null;
    });
    return [name.toLowerCase(), rows && new Map(rows.map((row) => [row.number, row]))];
  }));
  const byRepo = new Map(inventories);
  let complete = loginName(user?.login) && inventories.every(([, rows]) => rows !== null);
  const prs = new Set;
  const projected = searches.map((results) => {
    if (!Array.isArray(results) || results.length >= 1000) {
      complete = false;
      return null;
    }
    return results.map((row) => {
      const name = row?.repository?.nameWithOwner;
      if (!repository(name) || !number(row.number) || !loginName(row.author?.login) || typeof row.isDraft !== "boolean" || !Number.isFinite(time(row.updatedAt))) {
        complete = false;
        return null;
      }
      const repo = name.toLowerCase();
      const captured = byRepo.get(repo)?.get(row.number);
      if (!captured || row.updatedAt !== captured.updated_at || row.isDraft !== captured.draft || row.author.login.toLowerCase() !== captured.user.login.toLowerCase())
        complete = false;
      if (expected.has(repo) && !row.isDraft && loginName(user?.login) && row.author.login.toLowerCase() !== user.login.toLowerCase()) {
        prs.add(`${expected.get(repo)}#${row.number}`);
      }
      return {
        number: row?.number,
        repository: { nameWithOwner: name },
        updatedAt: row?.updatedAt,
        isDraft: row?.isDraft,
        author: { login: row?.author?.login }
      };
    });
  });
  return {
    status: complete ? "pass" : "unknown",
    repository: config.repository,
    login: loginName(user?.login) ? user.login : null,
    searches: projected,
    prs: [...prs].sort()
  };
}
async function threads(base, config, state, watermarks) {
  const t3 = async (command, ...args) => json(await run(config.t3, [
    "thread",
    command,
    "--base-dir",
    base,
    ...args,
    "--json"
  ], { cwd: "/" }));
  const shown = async (threadId) => {
    if (!reviewId(threadId))
      return null;
    const view = await t3("show", threadId, "--messages", "20");
    return view?.thread?.threadId === threadId && view.thread.projectId === config.projectId ? view : null;
  };
  const lists = await Promise.all(config.projects.map((project) => t3("list", "--project", project)));
  const reads = await Promise.all([...new Set([...state.owners, ...state.flagged])].map(async (id) => [id, await shown(id)]));
  const byId = new Map(reads);
  const owner = state.owners.map((threadId) => byId.get(threadId)?.thread).find((row) => busy.includes(row?.status));
  const prior = byId.get(state.prior)?.thread;
  const priorFields = prior && Object.fromEntries(["threadId", "projectId", "status", "settled", "updatedAt"].map((key) => [key, prior[key] ?? null]));
  const flagged = state.flagged.map((id) => {
    const marked = byId.get(id);
    const messages = marked?.messages;
    if (!Array.isArray(messages) || busy.includes(marked.thread.status) || marked.thread.pinned !== true)
      return { id, status: "unknown" };
    const replies = messages.filter((message) => message.role === "user");
    if (!replies.length || replies.some((message) => !message.runId || typeof message.text !== "string"))
      return { id, status: "unknown" };
    const watermark = hash(JSON.stringify(replies.map(({ runId, text }) => [runId, text])));
    return watermark === watermarks[id] ? { id, status: "unknown" } : { id, status: "reply", watermark };
  });
  return {
    coverage: "unknown",
    readableProjects: lists.filter(Array.isArray).length,
    inventory: null,
    prior: priorFields ? { thread: priorFields } : null,
    ownerUpdatedAt: owner?.updatedAt ?? null,
    flagged,
    observedAt: new Date().toISOString()
  };
}
function executeQuiet(config, input, progress, at) {
  const env = Object.fromEntries(["PATH", "HOME", "TMPDIR"].filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
  return new Promise((resolve) => {
    const child = execFile2(config.bun, [
      "--no-env-file",
      config.skillsDirectory + "/scripts/schedule-drift.js",
      "quiet-facts",
      "--input",
      input,
      "--continuity",
      progress,
      "--now",
      at
    ], { cwd: "/", env, timeout: 1e4, maxBuffer: 4 * 1024 * 1024, killSignal: "SIGKILL" }, (error, stdout) => resolve(!error || error.code === 2 ? json(stdout) : null));
    child.stdin?.on("error", () => {});
    child.stdin?.end();
  });
}
async function quietFacts(config, progress, input) {
  const dir = await mkdtemp(tmpdir() + "/axstack-review-manager-");
  try {
    await Promise.all([
      writeFile(dir + "/input.json", JSON.stringify(input), { mode: 384 }),
      writeFile(dir + "/progress.md", progress, { mode: 384 })
    ]);
    const report = await executeQuiet(config, dir + "/input.json", dir + "/progress.md", input.observedAt);
    if (!Array.isArray(report?.terms))
      return null;
    return { version: report.version, terms: report.terms.map((term) => ({ id: term?.id ?? null, status: term?.status ?? null })) };
  } finally {
    await rm(dir, { recursive: true });
  }
}
function reviewRuntime(base) {
  const sameBinding = async (config) => JSON.stringify(await readPrivateBinding(base)) === JSON.stringify(config);
  return {
    binding: () => readPrivateBinding(base),
    sameBinding,
    importProgress: (config) => privateRead(config.progressCopy),
    reap: readReapReceipt,
    discover: discoverReviewPRs,
    inventory: (config, state, watermarks) => threads(base, config, state, watermarks),
    quietFacts,
    resolveSeat: (config) => ownerBinding(base, config),
    verifySeat: async (config, expected, threadId) => await sameBinding(config) && JSON.stringify((await ownerBinding(base, config))?.model) === JSON.stringify(expected.model) && (await driverReadback(base, config, expected, null, threadId))?.thread?.projectId === config.projectId
  };
}

// entries/axstack-review-manager.mjs
var base = decodeURIComponent(new URL("../", import.meta.url).pathname).replace(/\/$/, "");
var axstack_review_manager_default = reviewManager(reviewRuntime(base));
export {
  axstack_review_manager_default as default
};
