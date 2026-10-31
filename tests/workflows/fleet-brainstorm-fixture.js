import { readFileSync } from 'node:fs';
import { article } from './fleet-artifact-fixture.js';

// Saved advertised models are synthetic availability, never live execution proof.
export const seats = [
  ['axstack-advisor-astra', 'codex', 'gpt-6-astra', 'reasoningEffort', 'high'],
  ['axstack-advisor-opus', 'claudeAgent', 'claude-opus-5-5', 'effort', 'xhigh'],
  ['axstack-arena-candidate-grok', 'grok', 'grok-4.7', 'reasoningEffort', 'high'],
  ['axstack-arena-judge-opus', 'claudeAgent', 'claude-opus-5-5', 'effort', 'xhigh'],
  ['axstack-escalation-fable', 'claudeAgent', 'claude-fable-5-1', 'effort', 'xhigh'],
  ['axstack-arena-judge-astra', 'codex', 'gpt-6-astra', 'reasoningEffort', 'xhigh'],
];
export function configuredBrainstorm(seat, preset = 'mixed') {
  const [role, providerInstanceId, model, option, effort] = seat;
  const f = article();
  Object.assign(f.scope, { workflow: 'brainstorm', roleId: role });
  f.roles.roles = JSON.parse(readFileSync(`${import.meta.dir}/../../profiles/presets/${preset}.json`, 'utf8')).roles;
  Object.assign(f.input.request, { providerInstanceId, model, options: { [option]: effort } });
  f.input.destinations.forEach((d) => {
    Object.assign(d.execution, { providerInstanceId, model, options: { [option]: effort } });
  });
  f.capabilities.providers.forEach((p) => {
    Object.assign(p, { canRunChildTask: true, constraints: [], runtimeModes: ['full-access'] });
  });
  f.refreshCatalog();
  return f;
}
