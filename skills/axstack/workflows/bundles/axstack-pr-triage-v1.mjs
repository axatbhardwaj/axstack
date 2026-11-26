// entries/axstack-pr-triage.mjs
import { execFile } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";

// ../references/pr-triage-nightly.md
var pr_triage_nightly_default = `# Nightly PR-triage prompt

## Native schedule fallback

Follow [Provider bindings](t3-runtime.md#preflight-and-binding) and [setup](automations.md#nightly-pr-triage-setup).
At pass start, read the prior pass thread with \`t3_thread_read\` for guarded verification or hold/report before replacing its identity. Record own pass threadId in the activation record and read back the save.

Read the durable activation record for the repository set.
Resolve the user with \`gh api user --jq .login\` through the collector.
Read all open PRs authored by the user in every repository in the recorded set, including all pages.
Set \`AXSTACK_SKILL_DIR\` to the installed skill directory and shell arguments to the recorded repositories.

\`\`\`bash
bun --no-env-file "\${AXSTACK_SKILL_DIR}/references/pr-triage-collect.js" "$@"
\`\`\`

Use the compact JSON with the report instructions below. Keep partial rows on exit 2.

At pass end, an unbound pass calls \`t3_thread_organize\` with \`action: settle\` on its own thread only, only when it owns no PR watch, has zero unsettled descendants, has no pending receipt and is not held, wedged or a stalled owner.
Follow [Finite-session teardown](automations.md#finite-session-teardown) for deferred self-settle and next-pass verification. This applies to quiet, skipped and empty passes too.

## Report instructions

Run a fresh read-only nightly PR-triage pass. Read-only applies to the forge.
Report each PR's CI, reviews, mergeable state, and unresolved threads in your own T3 thread.
For an incomplete forge field, report \`UNKNOWN\`.
Mark coverage gaps or an unavailable collector \`UNKNOWN\`, naming each affected repository.
Flag stale PRs after 7 days of inactivity.
Report the top three PRs to act on, or fewer if available, with observed reasons and evidence links.
Never declare a PR merge-ready.
Never merge, post comments, change labels, push, send user messages, dispatch
work, or launch threads.
`;

// binding.mjs
function bindingMatches(expected, actual) {
  return typeof expected === "string" && /^[a-f0-9]{64}$/.test(expected) && expected === actual;
}

// pr-triage.mjs
var NAME = "axstack-pr-triage";
var VERSION = 1;
var IDENTITY = `${NAME}@${VERSION}`;
var DAILY_TIME = "02:00";
var TRIGGER_KEY = `trigger:${NAME}/daily:${DAILY_TIME}:all:`;
function slotOwner(scheduledAt, runs, now) {
  const due = Date.parse(scheduledAt);
  if (!Number.isFinite(due) || scheduledAt !== new Date(due).toISOString() || due > now || now - due > 600000)
    return null;
  const active = runs.filter(({ status }) => ["running", "waiting", "paused"].includes(status));
  const run = active[0];
  if (active.length !== 1 || run.status !== "running" || run.key !== TRIGGER_KEY + scheduledAt || !/^[a-f0-9]{32}$/.test(run.id))
    return null;
  return run.id;
}
function triageFacts(repos, report) {
  const rows = Array.isArray(report?.repositories) ? report.repositories : [];
  const repositories = repos.map((repo) => {
    const matches = rows.filter((row) => row?.repo === repo);
    const row = matches[0];
    return matches.length === 1 && Array.isArray(row.prs) && ["pass", "unknown"].includes(row.coverage?.status) ? row : { repo, coverage: { status: "unknown", reason: "collector observation unavailable" }, prs: [] };
  });
  const partial = repositories.some(({ coverage, prs }) => coverage.status === "unknown" || prs.some((pr) => Object.values(pr).includes("UNKNOWN")));
  return {
    decision: partial ? "partial" : repositories.some(({ prs }) => prs.length) ? "normal" : "quiet",
    facts: { login: report?.login ?? "UNKNOWN", repositories }
  };
}
function sameReportBinding(expected, observed) {
  const model = observed?.model;
  return observed?.runtimeMode === expected.runtimeMode && model?.instanceId === expected.model.instanceId && model.model === expected.model.model && Array.isArray(model.options) && model.options.length === expected.model.options.length && expected.model.options.every(({ id, value }) => model.options.some((option) => option?.id === id && option.value === value));
}

// entries/axstack-pr-triage.mjs
var runtimeFile = decodeURIComponent(new URL("../userdata/server-runtime.json", import.meta.url).pathname);
var manifestFile = new URL("../.axstack-workflows.json", import.meta.url);
var reportHeading = `
## Report instructions
`;
var decisionSchema = Schema.Json;
var claimSchema = Schema.Struct({ scheduledAt: Schema.String, runId: Schema.String });
var repoName = /^(?!\.{1,2}\/)[A-Za-z0-9_.-]+\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
var absolute = (path) => typeof path === "string" && path.startsWith("/");
async function privateBytes(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.uid !== process.getuid() || info.mode & 63)
    throw new Error;
  return readFile(path);
}
async function readBinding() {
  try {
    const record = JSON.parse(await privateBytes(manifestFile)).workflows[IDENTITY];
    if (!absolute(record.binding))
      return null;
    const bytes = await privateBytes(record.binding);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const digest = Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (!bindingMatches(record.bindingDigest, digest))
      return null;
    const binding = JSON.parse(bytes);
    const { bun, skillsDirectory, project, registryTokenFile, repositories } = binding;
    if (![bun, skillsDirectory, registryTokenFile].every(absolute) || typeof project !== "string" || !/^[A-Za-z0-9_-]+$/.test(project) || !Array.isArray(repositories) || repositories.length === 0 || !repositories.every((repo) => typeof repo === "string" && repoName.test(repo)) || new Set(repositories.map((repo) => repo.toLowerCase())).size !== repositories.length)
      return null;
    return binding;
  } catch {
    return null;
  }
}
function factCommand(bun, script, args, timeout, exitCodes) {
  return new Promise((resolve) => {
    execFile(bun, ["--no-env-file", script, ...args], { cwd: "/", timeout, maxBuffer: 2 * 1024 * 1024, killSignal: "SIGKILL" }, (error, stdout) => {
      try {
        resolve(exitCodes.includes(error ? error.code : 0) ? JSON.parse(stdout) : null);
      } catch {
        resolve(null);
      }
    }).stdin?.end();
  });
}
function reportBinding({ bun, skillsDirectory, registryTokenFile }, threadId) {
  return factCommand(bun, `${skillsDirectory}/scripts/pr-triage-binding.js`, [runtimeFile, registryTokenFile, `${skillsDirectory}/roles.json`, ...threadId ? [threadId] : []], 8000, [0]);
}
async function collect() {
  const binding = await readBinding();
  if (!binding)
    return { hold: "private binding is missing, invalid, or changed" };
  const { bun, skillsDirectory, project, repositories } = binding;
  const observation = await factCommand(bun, `${skillsDirectory}/references/pr-triage-collect.js`, repositories, 1e5, [0, 2]);
  const seat = await reportBinding(binding);
  if (seat?.status !== "pass" || !seat.binding)
    return { hold: "report agent binding unavailable or mismatched" };
  return { ...triageFacts(repositories, observation), project, seat: seat.binding };
}
var axstack_pr_triage_default = T3.workflow(NAME, {
  version: VERSION,
  payload: T3.Tick,
  returns: decisionSchema,
  triggers: [T3.daily(DAILY_TIME)],
  resumeAfter: []
}, ({ scheduledAt }) => Effect.gen(function* () {
  const runId = yield* T3.step("claim-slot", { returns: decisionSchema }, Effect.gen(function* () {
    const id = slotOwner(scheduledAt, yield* T3.runs({ workflow: NAME }), Date.now());
    if (!id)
      return null;
    const claim = T3.store.entry(`${IDENTITY}:latest-slot`, claimSchema);
    return yield* T3.store.transaction(Effect.gen(function* () {
      const previous = yield* claim.get;
      if (Option.isSome(previous) && previous.value.scheduledAt >= scheduledAt) {
        return previous.value.scheduledAt === scheduledAt && previous.value.runId === id ? id : null;
      }
      yield* claim.set({ scheduledAt, runId: id });
      return id;
    }));
  }));
  if (!runId)
    return yield* T3.stop("nightly slot unavailable, stale, or already claimed");
  const receipt = yield* T3.step("collect-facts", { returns: decisionSchema }, Effect.promise(collect));
  if (receipt.hold)
    return yield* T3.stop(receipt.hold);
  const { decision, facts, project, seat } = receipt;
  const guidance = pr_triage_nightly_default.split(reportHeading)[1];
  if (!guidance)
    return yield* T3.stop("shared report instructions unavailable");
  const report = yield* T3.agent.try("write-report", {
    project,
    ...seat,
    title: "Nightly PR triage",
    timeout: "10 minutes",
    brief: `AXSTACK-WAKE ${IDENTITY} run ${runId}

Use only the provided facts. Write the report as your final reply.

${guidance}

Collected JSON data:
${JSON.stringify(facts)}`
  });
  if (!report.thread?.threadId)
    return yield* T3.stop("report agent did not start");
  const verified = yield* T3.step("verify-report-binding", { returns: Schema.Boolean }, Effect.promise(async () => {
    const binding = await readBinding();
    if (!binding)
      return false;
    const observed = await reportBinding(binding, report.thread.threadId);
    return observed?.status === "pass" && sameReportBinding(seat, observed.binding);
  }));
  if (!verified)
    return yield* T3.stop("effective report agent binding unavailable or mismatched");
  if (report.outcome !== "done" || !report.value?.trim())
    return yield* T3.stop("report agent did not return a report");
  return { decision, scheduledAt, threadId: report.thread.threadId, binding: "pass" };
}));
export {
  axstack_pr_triage_default as default
};
