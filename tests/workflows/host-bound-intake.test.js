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
  const concepts = [/cross.host/i, /t3_thread_launch/, /only/i, /one intake hand.off/i,
    /remote workers/i, /subagents/i, /retries/i];
  checkRule(intakeBoundary(), (s) => prohibits(s, /never/i, ...concepts),
    'Only that one intake hand-off uses cross-host t3_thread_launch, never remote workers, retries or subagents.',
    [[/only/i, 'also'], [/never remote workers/i, 'remote workers allowed']], concepts);
});
