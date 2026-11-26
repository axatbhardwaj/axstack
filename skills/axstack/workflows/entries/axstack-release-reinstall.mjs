import { driverReadback, ownerBinding, validId } from '../dependabot-runtime.mjs';
import { acquire, finish, firstPause } from '../release-reinstall-claims.mjs';
import { hostRead, hosts, IDENTITY, latest, NAME, readBinding, tarball, validVersion, VERSION } from '../release-reinstall-runtime.mjs';

const { agent, sleep, step, workflow } = T3;
const base = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/\/$/, '');
const hold = (reason) => Effect.fail(new Error(reason));
const observe = (name, effect) => step(name, { returns: Schema.Json }, effect);
const reason = {
  unknown: 'host evidence unknown', 'unknown-transport': 'host evidence unknown', unreachable: 'host unreachable',
  busy: 'host installer is busy', timer: 'required timer inactive or disabled', newer: 'installed release is newer', claimed: 'host already claimed',
  'claim-unknown': 'host claim evidence is unknown', 'install-failed': 'install exited nonzero',
  'verify-mismatch': 'verification mismatch', readback: 'prior write needs readback',
  binding: 'private binding is missing, invalid, or changed',
};

function installHost(host, version, runId, round) {
  return observe('host-' + host + '-' + round, Effect.gen(function* () {
    const config = yield* Effect.promise(() => readBinding(base));
    if (!config || config.wrongHost) return { state: 'binding' };
    let phase = yield* acquire(host, version, runId);
    if (phase === 'claimed' || phase === 'claim-unknown') return { state: phase };

    const close = (status, outcome) => Effect.gen(function* () {
      return (yield* finish(host, version, runId, phase, status)) ? outcome : { state: 'claim-unknown' };
    });
    const before = yield* Effect.promise(() => hostRead(config, host, version, 'probe'));
    if (phase === 'failed') return before.state === 'done' ? before : { state: 'readback' };
    if (before.state === 'done') return yield* close('done', before);
    if (phase === 'writing') return { state: 'readback' };
    if (before.state !== 'pending') return yield* close('clear', before);

    const stale = yield* Effect.promise(() => latest(version));
    if (stale) return yield* close('clear', { state: 'registry', detail: stale });
    const current = yield* Effect.promise(() => readBinding(base));
    if (!current || current.wrongHost) return yield* close('clear', { state: 'binding' });
    if (!(yield* finish(host, version, runId, 'reading', 'writing'))) return { state: 'claim-unknown' };

    phase = 'writing';
    const applied = yield* Effect.promise(() => hostRead(current, host, version, 'apply'));
    if (applied.state === 'done') return yield* close('done', applied);
    if (['install-failed', 'verify-mismatch'].includes(applied.state)) return yield* close('failed', applied);
    if (['busy', 'newer', 'unknown', 'timer'].includes(applied.state)) return yield* close('clear', applied);

    const after = yield* Effect.promise(() => hostRead(current, host, version, 'probe'));
    return after.state === 'done' ? yield* close('done', after) : { state: 'readback' };
  }));
}

function preflight(version, round) {
  return Effect.gen(function* () {
    const seconds = yield* observe('preflight-' + round, Effect.gen(function* () {
      const config = yield* Effect.promise(() => readBinding(base));
      if (!config) return yield* hold(reason.binding);
      if (config.wrongHost) return yield* hold('local execution host does not match the private binding');
      const stale = yield* Effect.promise(() => latest(version));
      if (stale) return yield* hold(stale);
      return config.pollSeconds;
    }));
    for (let attempt = 1; attempt <= 6; attempt++) {
      const available = yield* observe('tarball-' + round + '-' + attempt, Effect.gen(function* () {
        const found = yield* Effect.promise(() => tarball(version));
        if (found.error) return yield* hold(found.error);
        if (!found.available && attempt === 6) return yield* hold('npm tarball not fetchable');
        return found.available;
      }));
      if (available) return;
      if (seconds) yield* sleep('tarball-wait-' + round + '-' + attempt, seconds + ' seconds');
    }
  });
}

function reportFailure(runId, round) {
  return Effect.gen(function* () {
    const expected = yield* observe('failure-agent-seat-' + round, Effect.promise(async () => {
      const config = await readBinding(base);
      if (!config || config.wrongHost) return null;
      const seat = await ownerBinding(base, config);
      return seat && { project: config.project, ...seat };
    }));
    if (!expected) return 'failure agent binding unknown';
    const brief = `AXSTACK-WAKE ${IDENTITY} run ${runId}\n\nRead this T3 workflow run and report the release reinstall failure in this thread. The release driver owns recovery and hold clearance.`;
    const reported = yield* agent.try('report-failure-' + round, {
      ...expected, title: 'Axstack release reinstall failure', brief, timeout: '10 minutes',
    });
    return yield* observe('failure-agent-readback-' + round, Effect.promise(async () => {
      const config = await readBinding(base);
      const thread = reported.thread?.threadId;
      if (!config || config.wrongHost || reported.outcome !== 'done' || !thread) return 'failure agent evidence unknown';
      const view = await driverReadback(base, config, expected, null, thread);
      if (!view?.messages?.some((message) => message.role === 'system' && message.text === brief)) {
        return 'failure agent binding or transcript mismatched';
      }
      return null;
    }));
  });
}

export default workflow(NAME, {
  version: VERSION, payload: Schema.Struct({ version: Schema.String }), returns: Schema.Json, resumeAfter: [],
}, ({ version }, { id }) => Effect.gen(function* () {
  if (!validVersion(version) || !validId(id)) {
    return yield* observe('invalid-release', hold('invalid release payload or run ID'));
  }
  const receipts = {};
  for (let round = 1; ; round++) {
    yield* preflight(version, round);
    const outstanding = {};
    let failure = false;
    for (const host of hosts) {
      if (receipts[host]) continue;
      const observation = yield* installHost(host, version, id, round);
      if (observation.state === 'done') {
        receipts[host] = observation.receipt;
      } else {
        outstanding[host] = observation.detail ?? reason[observation.state];
        if (['install-failed', 'verify-mismatch'].includes(observation.state)) failure = true;
      }
    }
    const pending = Object.keys(outstanding);
    if (!pending.length) {
      return yield* observe('complete-' + round, Effect.gen(function* () {
        const stale = yield* Effect.promise(() => latest(version));
        if (stale) return yield* hold(stale);
        return { version, hosts: receipts };
      }));
    }
    const agentIssue = failure ? yield* reportFailure(id, round) : null;
    yield* observe('outstanding-' + round, Effect.gen(function* () {
      if (yield* firstPause(id, round)) {
        const details = pending.map((host) => host + '=' + outstanding[host]).join(', ');
        return yield* hold('outstanding hosts: ' + pending.join(', ') + ' (' + details + ')' +
          (agentIssue ? '. ' + agentIssue : ''));
      }
      return true;
    }));
  }
}));
