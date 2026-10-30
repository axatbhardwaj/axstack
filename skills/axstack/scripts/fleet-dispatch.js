// Bind supplied placement facts to a plan. No reads, dispatch or authority grant.
import { inspectDestination } from './fleet-destination.js';
import { canonical, record, text } from './fleet-config.js';
import { recommend } from './fleet-route.js';

export function bindFleet(input, saved, configDigest, now, capabilitiesText, resolved, author) {
  const hold = (code) => { throw Object.assign(new Error(code), { exitCode: 2 }); };
  if (saved?.schemaVersion !== 1) hold('schema-version: recommendation');
  if (configDigest !== input?.configDigest) hold('config-digest-mismatch');
  let current;
  try { current = recommend(input, now); } catch (error) { hold(error.message); }
  if (canonical(saved) !== canonical(current)) hold('recommendation-mismatch');
  const selected = current.selected;
  if (!selected) hold('no-executable-route');
  // Coordinator enablement/lifecycle is a later capability, never inferred here.
  if (selected.routeKind === 'remote-author-coordinator') hold('remote-author-not-enabled');
  const digest = selected.destinationCapabilitiesDigest;
  if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) hold('capabilities-digest-missing');
  if (new Bun.CryptoHasher('sha256').update(capabilitiesText).digest('hex') !== digest) hold('capabilities-digest-mismatch');
  if (input.nativeDestination !== undefined) {
    const mismatch = inspectDestination(input.nativeDestination, current, capabilitiesText, now)
      .find((term) => term.state !== 'pass');
    if (mismatch) hold(mismatch.code);
  }
  const request = current.request;
  const { model, providerInstanceId, effortOption } = resolved;
  if (request.providerInstanceId !== providerInstanceId || request.model !== model
    || request.runtimeMode !== 'full-access' || (request.role === 'author') !== author
    || !record(request.options) || request.options[effortOption.id] !== effortOption.value) hold('settings-mismatch');
  const catalog = JSON.parse(capabilitiesText);
  const instance = catalog.providers.find((p) => p.providerInstanceId === providerInstanceId);
  const models = instance.models.filter((m) => m.id === model);
  if (models.length !== 1) hold('capabilities-model-ambiguous');
  const options = Object.entries(request.options).sort(([a], [b]) => a.localeCompare(b)).map(([id, value]) => {
    const definitions = models[0].options.filter((o) => o.id === id);
    if (!text(id) || !['string', 'boolean'].includes(typeof value) || definitions.length !== 1) hold('unsupported-option');
    const definition = definitions[0];
    const values = definition.values ?? definition.options?.map((v) => v.id);
    if (!values?.includes(value)) hold(`unsupported-option: ${id}`);
    return { id, value };
  });
  return {
    options, destination: { environmentId: selected.environmentId, projectId: selected.projectId },
    fleetBinding: { configDigest, destinationSnapshotId: selected.destinationSnapshotId,
      destinationCapabilitiesDigest: digest },
  };
}
