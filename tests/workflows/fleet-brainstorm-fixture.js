import { configuredArtifact } from './fleet-artifact-fixture.js';

// Saved advertised models are synthetic availability, never live execution proof.
export const seats = [
  ['axstack-advisor-astra', 'codex', 'gpt-6-astra', 'reasoningEffort', 'high'],
  ['axstack-advisor-opus', 'claudeAgent', 'claude-opus-5-5', 'effort', 'xhigh'],
  ['axstack-arena-candidate-grok', 'grok', 'grok-4.7', 'reasoningEffort', 'high'],
  ['axstack-arena-judge-opus', 'claudeAgent', 'claude-opus-5-5', 'effort', 'xhigh'],
  ['axstack-escalation-fable', 'claudeAgent', 'claude-fable-5-1', 'effort', 'xhigh'],
  ['axstack-arena-judge-astra', 'codex', 'gpt-6-astra', 'reasoningEffort', 'xhigh'],
];
export const configuredBrainstorm = (seat, preset = 'mixed') => configuredArtifact(seat, 'brainstorm', preset);
