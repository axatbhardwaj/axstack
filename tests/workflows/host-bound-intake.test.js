import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, prohibits } from './prose-contract.js';

const intakeBoundary = () => readFileSync(
  `${import.meta.dir}/../../skills/axstack/references/fleet-dispatch.md`, 'utf8',
).split('## Intake boundary (CR-3)')[1].split('\n## ')[0].replaceAll('`', '').replace(/\s+/g, ' ');

test('fleet intake routes tasks needing resources exclusive to another host', () => {
  const concepts = [/needs?|requires?/i, /only another fleet host has|exclusive to another fleet host/i,
    /route/i, /whole task/i, /at intake/i, /fleet-route\.js plan/];
  checkRule(intakeBoundary(), (s) => requires(s, ...concepts),
    'For resources exclusive to another fleet host that a task requires, route the whole task at intake with fleet-route.js plan.',
    [[/route the whole task/i, 'skip the whole task']], concepts);
});

test('fleet cross-host launches allow only the single intake hand-off', () => {
  const concepts = [/cross.host/i, /t3_thread_launch/, /only/i, /(one|single) intake hand.off/i,
    /remote workers/i, /subagents/i, /replacement launches/i];
  checkRule(intakeBoundary(), (s) => prohibits(s, /never/i, ...concepts),
    'Only that single intake hand-off uses cross-host t3_thread_launch, never for remote workers, replacement launches or subagents.',
    [[/only/i, 'also'], [/never/i, 'including']], concepts);
});

test('a host-bound task whose plan stays local holds and names the needed host', () => {
  const concepts = [/host.bound task/i, /plan/i, /stays local/i, /hold/i,
    /name/i, /needed host/i, /user/i];
  checkRule(intakeBoundary(), (s) => requires(s, ...concepts),
    'For a host-bound task whose plan stays local, name the needed host to the user and hold.',
    [[/\bhold\b/i, 'continue'], [/name the needed host/i, 'conceal the needed host']], concepts);
});
