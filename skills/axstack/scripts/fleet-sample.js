import { parseProc, pressure } from './fleet-proc.js';
import { validateManifest, sampleOptions } from './fleet-sample-manifest.js';
import { readProc, wait } from './fleet-sample-io.js';
export { parseProc, pressure, validateManifest };

// Read functions and clocks are injectable for deterministic offline verification.
export async function sampleFleet(manifest, hosts, options, dependencies = {}) {
  validateManifest(manifest, hosts);
  const { intervalMs, timeoutMs } = sampleOptions(options);
  const { clock = Date.now, monotonic = () => performance.now(), read = readProc, wait: pause = wait,
    signal } = dependencies;
  const telemetry = await Promise.all(manifest.hosts.map(async (host) => {
    const controller = new AbortController();
    const cancel = () => controller.abort(Error('cancelled'));
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const timer = setTimeout(() => controller.abort(Error('timeout')), timeoutMs);
    const windowStartedAt = clock(); const started = monotonic();
    const source = host.transport === 'local' ? 'linux-proc-local' : 'linux-proc-ssh';
    const provenance = { hostId: host.hostId, environmentId: host.environmentId, scope: 'whole-host', source,
      intervalMs, timeoutMs, windowStartedAt, windowKind: 'collector-bracket' };
    const check = () => { if (controller.signal.aborted) throw controller.signal.reason; };
    try {
      check();
      const first = parseProc(await read(host, controller.signal));
      check();
      await pause(intervalMs, controller.signal);
      check();
      const last = parseProc(await read(host, controller.signal));
      check();
      const windowEndedAt = clock(); const durationMs = Math.floor(monotonic() - started);
      if (durationMs >= timeoutMs) throw Error('timeout');
      if (durationMs < intervalMs || windowEndedAt < windowStartedAt
        || windowEndedAt - windowStartedAt < durationMs
        || windowEndedAt - windowStartedAt > durationMs + 1000) throw Error('collector-clock');
      return { ...provenance, status: 'ok', ...pressure(first, last), durationMs,
        windowEndedAt, receivedAt: windowEndedAt };
    } catch (error) {
      const reason = controller.signal.aborted ? controller.signal.reason?.message : error.message;
      return { ...provenance, status: ['timeout', 'cancelled', 'malformed', 'inconsistent-counters', 'collector-clock']
        .includes(reason) ? reason : 'failed', durationMs: Math.max(0, Math.floor(monotonic() - started)), receivedAt: clock() };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }));
  return { schemaVersion: 1, telemetry };
}
