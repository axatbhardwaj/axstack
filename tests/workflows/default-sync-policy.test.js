import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
test('repository permits only the opt-in stateless default-sync timer exception', () => {
  const concepts = [/exception/i, /\b(?:one|single)\b/i, /opt.in/i, /systemd user timer/i,
    /axstack-default-sync/, /stateless script/i, /\bonly\b/i, /defaultModelSelection\.instanceId/];
  const allows = /\b(?:allow\w*|permit\w*)\b/i;
  checkRule(readFileSync(`${root}/AGENTS.md`, 'utf8').replace(/\s+/g, ' '), (text) => requires(text, ...concepts, allows),
    'Exception: permit one opt-in systemd user timer axstack-default-sync to run a stateless script that rewrites only T3 defaultModelSelection.instanceId.',
    [[allows, 'forbid']], [...concepts, allows]);
  const doc = readFileSync(`${root}/AGENTS.md`, 'utf8').replace(/\s+/g, ' ');
  const noState = /(?:no|zero) workflow state/i;
  checkRule(doc, (text) => prohibits(text, noState, /timer/i),
    'The timer keeps zero workflow state.', [[noState, 'persistent workflow state']], [/timer/i, noState]);
  const noLaunch = /launches no|never launches/i;
  checkRule(doc, (text) => prohibits(text, noLaunch, /script/i, /agent/i),
    'The script never launches an agent.', [[noLaunch, 'launches']], [/script/i, /agent/i, noLaunch]);
});
