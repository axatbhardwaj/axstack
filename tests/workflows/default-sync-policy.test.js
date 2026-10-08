import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
test('repository permits only the opt-in stateless default-sync timer exception', () => {
  const concepts = [/exception/i, /\b(?:one|single)\b/i, /opt.in/i, /systemd user timer/i,
    /axstack-default-sync/, /stateless script/i, /\bonly\b/i, /defaultModelSelection(?!\.instanceId)/];
  const allows = /\b(?:allow\w*|permit\w*)\b/i;
  checkRule(readFileSync(`${root}/AGENTS.md`, 'utf8').replace(/\s+/g, ' '), (text) => requires(text, ...concepts, allows),
    'Exception: permit one opt-in systemd user timer axstack-default-sync to run a stateless script that rewrites only T3 defaultModelSelection.',
    [[allows, 'forbid']], [...concepts, allows]);
  const doc = readFileSync(`${root}/AGENTS.md`, 'utf8').replace(/\s+/g, ' ');
  const noState = /(?:no|zero) workflow state/i;
  checkRule(doc, (text) => prohibits(text, noState, /timer/i),
    'The timer keeps zero workflow state.', [[noState, 'persistent workflow state']], [/timer/i, noState]);
  const noLaunch = /launches no|never launches/i;
  checkRule(doc, (text) => prohibits(text, noLaunch, /script/i, /agent/i),
    'The script never launches an agent.', [[noLaunch, 'launches']], [/script/i, /agent/i, noLaunch]);
});


test('model discipline confines pooled sync to the New-chat default', () => {
  const doc = readFileSync(`${root}/skills/axstack/references/contracts.md`, 'utf8');
  const concepts = [/exception/i, /opt.in default sync/i, /only/i, /New.chat default/i, /user.configured pool/i];
  const permits = /\b(?:can|allows?|permits?)\b/i;
  checkRule(doc, (text) => requires(text, ...concepts, permits),
    'Exception: opt-in default sync permits changing only the New-chat default within the user-configured pool.',
    [[permits, 'forbids']], [...concepts, permits]);
  const boundaries = [/running threads/i, /dispatched roles/i, /schedules/i, /roles\.json/i];
  const unchanged = /(?:retain|keep) existing rules/i;
  checkRule(doc, (text) => requires(text, ...boundaries, unchanged),
    'Running threads, dispatched roles, schedules and roles.json retain existing rules.',
    [[unchanged, 'discard existing rules']], [...boundaries, unchanged]);
});
